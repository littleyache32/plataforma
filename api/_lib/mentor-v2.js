import { createHash } from 'node:crypto'
import { evaluateMentorV2, mentorWeekTarget, resolveMentorV2Policy, stableMentorJSON, validateMentorV2Decision, MENTOR_V2_CONTRACT, MENTOR_V2_ENGINE_VERSION } from '../../shared/mentor-v2-policy.js'

// Transport pagination, not a strategic lookback or minimum evidence threshold.
async function readAll(query, orderKey = 'id') {
  const rows = [], pageSize = 500
  for (let offset = 0; ; offset += pageSize) {
    const result = await query().order(orderKey).range(offset, offset + pageSize - 1)
    if (result.error) return result
    if (!Array.isArray(result.data)) return { data: null, error: new Error('Fonte factual inválida.') }
    rows.push(...result.data)
    if (result.data.length < pageSize) return { data: rows, error: null }
  }
}

// Shared factual adapter for the API and planner; no strategy or V1 defaults.
export async function evaluateMentorWeekV2({ supabase, inicio, instanteReferencia, persist = false }) {
  const target = mentorWeekTarget(inicio)
  const policyQuery = await supabase.from('conhecimento_modulo').select('id,modulo,versao,conteudo,ativo').eq('modulo', 'mentor').eq('ativo', true)
  const rows = policyQuery.data || []
  const policyRecord = !policyQuery.error && rows.length === 1 ? rows[0] : null
  let facts = null
  let unavailableSource = policyQuery.error ? 'conhecimento_modulo' : null
  if (resolveMentorV2Policy(policyRecord).ok) {
    const [context, demands, subjects, topics, history, times, objectives, commitments] = await Promise.all([
      supabase.from('mentor_contexto').select('id,vigente_desde,semana_inicio,dados').eq('id', 1).maybeSingle(),
      readAll(() => supabase.from('sessao').select('id,chave_mentor,origem,objetivo_id,materia_id,topico_id,material_id,tipo,data,status,ordem,duracao_estimada,prioridade,movida_em,ordenada_em,cancelamento_origem,concluida_em').gte('data', inicio).lte('data', target.semana_fim)),
      readAll(() => supabase.from('materia').select('id,objetivo_id')),
      readAll(() => supabase.from('topico').select('id,materia_id,nome')),
      readAll(() => supabase.from('sessao').select('id,objetivo_id,materia_id,topico_id,material_id,tipo,data,status,duracao_estimada,concluida_em,cancelamento_origem,chave_mentor,origem').lt('data', inicio)),
      readAll(() => supabase.from('tempo_estudo').select('id,sessao_id,objetivo_id,status,segundos_acumulados,finalizado_em').eq('status', 'concluido').lte('finalizado_em', instanteReferencia)),
      readAll(() => supabase.from('objetivo').select('id,tipo')),
      // Completed events can still block a date when explicitly referenced by
      // availability. Priority/load calculators separately filter pending events.
      readAll(() => supabase.from('compromisso').select('id,objetivo_id,materia_id,tipo,data,concluido')),
    ])
    const error = [context, demands, subjects, topics, history, times, objectives, commitments].find((entry) => entry.error)?.error
    if (error) unavailableSource = 'mentor_contexto/sessao/materia/topico/tempo_estudo/objetivo/compromisso'
    else facts = { context: context.data ? { id: context.data.id, vigente_desde: context.data.vigente_desde,
      disponibilidade: context.data.dados?.disponibilidade || null, rotina_pratica: context.data.dados?.rotina_pratica || {},
      capacidade_inicial: context.data.dados?.capacidade_inicial || null,
      objetivo_principal_id: context.data.dados?.objetivo_principal_id || null,
      ...((context.data.dados?.eventos_encontro || []).some((row) => row.semana_alvo === inicio)
        ? { eventos_encontro: context.data.dados.eventos_encontro.filter((row) => row.semana_alvo === inicio) } : {}) } : null,
      demands: demands.data, subjects: subjects.data, topics: topics.data,
      loadSources: { history: history.data, times: times.data, objectives: objectives.data, commitments: commitments.data } }
    if (facts && policyRecord.conteudo.politica.regras.some((rule) => rule.id === 'PRIORIZACAO_CURRICULAR_SEMANAL')) {
      const [materials, progress, links, reviews, questions, attempts] = await Promise.all([
        readAll(() => supabase.from('material').select('id,objetivo_id,materia_id,nome,status,ordem_curso,estado_extracao')),
        readAll(() => supabase.from('material_progresso').select('material_id,estado,iniciado_em,concluido_em,atualizado_em'), 'material_id'),
        readAll(() => supabase.from('compromisso_topico').select('compromisso_id,topico_id').order('topico_id'), 'compromisso_id'),
        readAll(() => supabase.from('revisao_item').select('id,questao_id,motivo,status,agendada_para')),
        readAll(() => supabase.from('questao').select('id,topico_id')),
        readAll(() => supabase.from('registro').select('id,questao_id,resultado,classificacao,criado_em').lte('criado_em', instanteReferencia)),
      ])
      if ([materials, progress, links, reviews, questions, attempts].some((entry) => entry.error)) {
        unavailableSource = 'material/material_progresso/compromisso_topico/revisao_item/questao/registro'; facts = null
      } else facts.prioritySources = { materials: materials.data, progress: progress.data,
        commitmentTopics: links.data.filter((link) => commitments.data.some((row) => row.id === link.compromisso_id)),
        reviews: reviews.data, questions: questions.data, attempts: attempts.data }
    }
    if (facts && policyRecord.conteudo.politica.regras.some((rule) => rule.id === 'GERACAO_PLANO_SEMANAL')) {
      const [identities, cards] = await Promise.all([
        readAll(() => supabase.from('sessao').select('id,chave_mentor,data,status,movida_em,ordenada_em,cancelamento_origem').like('chave_mentor', `v2:${inicio}:%`)),
        readAll(() => supabase.from('question_card').select('id,topico_id')),
      ])
      if (identities.error || cards.error) { unavailableSource = 'sessao/question_card'; facts = null }
      else { facts.planIdentities = identities.data; facts.prioritySources.cards = cards.data }
    }
  }
  const evaluationId = createHash('sha256').update(stableMentorJSON({ policyRecord, facts, inicio, instanteReferencia, versaoMotor: MENTOR_V2_ENGINE_VERSION })).digest('hex')
  const evaluation = evaluateMentorV2({ policyRecord, facts, weekStart: inicio, referenceInstant: instanteReferencia, evaluationId })
  if (rows.length > 1) {
    evaluation.reason_codes = ['DATA_INCONSISTENCY']
    evaluation.limitacoes = ['MULTIPLAS_POLICIES_ATIVAS']
    evaluation.explicacao = 'Há mais de uma policy ativa do Mentor. O plano foi preservado.'
    evaluation.evidencias_utilizadas[0].valor = 'MULTIPLAS_POLICIES_ATIVAS'
  }
  if (unavailableSource) {
    evaluation.reason_codes = ['DATA_UNAVAILABLE']
    evaluation.limitacoes = ['FALHA_LEITURA_FONTE']
    evaluation.evidencias_utilizadas = [{ evidencia_id: 'limite', natureza: 'CONTEXTO', fonte: unavailableSource, valor: 'FALHA_LEITURA_FONTE', corte: instanteReferencia }]
    evaluation.explicacao = 'Uma fonte factual não pôde ser lida. O plano foi preservado.'
  }
  // Persist only typed evaluations of a valid policy, not unavailable legacy configs.
  if (persist && evaluation.resultado !== 'NAO_AVALIAVEL') {
    const saved = await supabase.from('mentor_decisao').upsert({ chave_operacao: evaluationId,
      tipo: 'avaliacao_mentor_v2', decisao: evaluation.resultado, justificativa: evaluation.explicacao,
      dados: { modelo: 'MENTOR_V2', semana_inicio: inicio, avaliacao: evaluation } },
    { onConflict: 'chave_operacao', ignoreDuplicates: true })
    if (saved.error) throw saved.error
  }
  return evaluation
}

export async function readMentorWeekV2({ supabase, inicio, instanteReferencia }) {
  const saved = await supabase.from('mentor_decisao').select('dados').eq('tipo', 'avaliacao_mentor_v2')
    .eq('dados->>semana_inicio', inicio).order('criado_em', { ascending: false }).limit(1).maybeSingle()
  if (saved.error) throw saved.error
  if (saved.data?.dados?.modelo === 'MENTOR_V2') {
    const evaluation = saved.data.dados.avaliacao
    if (evaluation?.versao_contrato !== MENTOR_V2_CONTRACT || evaluation.alvo_temporal?.semana_inicio !== inicio
      || !['DECISOES_EMITIDAS', 'SEM_ALTERACAO'].includes(evaluation.resultado) || !Array.isArray(evaluation.decisoes)) throw new Error('Avaliação V2 registrada inválida.')
    evaluation.decisoes.forEach(validateMentorV2Decision)
    return { ...evaluation, origem: 'decisao_registrada' }
  }
  return { ...(await evaluateMentorWeekV2({ supabase, inicio, instanteReferencia })), origem: 'avaliacao_sem_aplicacao' }
}
