import { selectQuestionRetest } from './mentor-v2-question-retest.js'

// Local evidence criteria of the ONE Mentor. Not a scheduler or a mastery score.
export const REVIEW_LOCAL_POLICY = Object.freeze({ id: 'REVIEW_LOCAL_EVIDENCE', versao: 'review-local-v2/2',
  erros_minimos: 3, questoes_distintas_minimas: 2, dias_distintos_minimos: 2, recuperacao_positivos_minimos: 2 })
const day = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
const distinct = (rows, field) => new Set(rows.map((row) => row[field]).filter(Boolean)).size
const metadata = (q) => q?.metadados_revisao || {}
const proven = (m) => typeof m.fonte === 'string' && m.fonte.trim() && typeof m.evidencia === 'string'
  && m.evidencia.trim() && Number.isFinite(Date.parse(m.atualizado_em))
export function questionEquivalence(original, candidate, corte = null) {
  if (original.id === candidate.id) return { conceito_id: metadata(original).conceito_id || `questao:${original.id}`, criterio: 'MESMA_QUESTAO' }
  const a = metadata(original), b = metadata(candidate)
  if (!proven(a) || !proven(b) || (corte && [a, b].some((m) => Date.parse(m.atualizado_em) > Date.parse(corte)))) return null
  const scope = original.topico_id === candidate.topico_id
  if (scope && a.conceito_id && a.conceito_id === b.conceito_id) return { conceito_id: a.conceito_id, criterio: 'CONCEITO_DOCUMENTADO' }
  if (scope && a.erro_alvo && a.erro_alvo === b.erro_alvo) return { conceito_id: `erro:${a.erro_alvo}`, criterio: 'ERRO_ALVO_DOCUMENTADO' }
  if (scope && a.subassunto && a.subassunto === b.subassunto && a.objetivo_pedagogico
    && a.objetivo_pedagogico === b.objetivo_pedagogico && Array.isArray(a.tags_curriculares)
    && a.tags_curriculares.some((tag) => b.tags_curriculares?.includes(tag))) {
    return { conceito_id: `subassunto:${a.subassunto}:${a.objetivo_pedagogico}`, criterio: 'SUBASSUNTO_OBJETIVO_TAGS' }
  }
  return null // subject, broad topic, PDF size and lexical resemblance are NOT proof
}

export function questionReviewObservations({ questao, revisao, questoes, registros, corte, unidades = [], progressos = [] }) {
  const compatible = questoes.filter((q) => questionEquivalence(questao, q, corte))
  if (!compatible.some((q) => q.id === questao.id)) compatible.push(questao)
  const ids = new Set(compatible.map((q) => q.id)), seen = new Map()
  for (const row of registros) {
    if (!ids.has(row.questao_id) || !Number.isFinite(Date.parse(row.criado_em)) || Date.parse(row.criado_em) > Date.parse(corte)) continue
    if (seen.has(row.id) && JSON.stringify(seen.get(row.id)) !== JSON.stringify(row)) throw new Error('Tentativas divergentes com o mesmo ID.')
    seen.set(row.id, row)
  }
  const history = [...seen.values()].sort((a, b) => a.criado_em.localeCompare(b.criado_em) || a.id.localeCompare(b.id))
  const errors = history.filter((r) => r.resultado === 'erro'), lastError = errors.at(-1)
  const after = lastError ? history.filter((r) => Date.parse(r.criado_em) > Date.parse(lastError.criado_em)) : []
  // Only an explicit canonical execution link can fulfill THIS need.
  const execution = history.filter((r) => r.revisao_item_id === revisao.id)
  const positive = after.filter((r) => r.revisao_item_id === revisao.id && r.resultado === 'acerto' && r.classificacao === 'certeza')
  const recovered = positive.length >= REVIEW_LOCAL_POLICY.recuperacao_positivos_minimos
    && distinct(positive, 'questao_id') >= REVIEW_LOCAL_POLICY.questoes_distintas_minimas
    && new Set(positive.map((r) => day(r.criado_em))).size >= REVIEW_LOCAL_POLICY.dias_distintos_minimos
  const missing = errors.filter((r) => r.classificacao === 'sem_conhecimento')
  const sufficient = (rows) => !recovered && rows.length >= REVIEW_LOCAL_POLICY.erros_minimos
    && distinct(rows, 'questao_id') >= REVIEW_LOCAL_POLICY.questoes_distintas_minimas
    && new Set(rows.map((r) => day(r.criado_em))).size >= REVIEW_LOCAL_POLICY.dias_distintos_minimos
  const persistent = sufficient(missing)
  const sourceRefs = [...compatible.map((q) => ({ entidade: 'questao', id: q.id })),
    { entidade: 'revisao_item', id: revisao.id }, ...history.map((r) => ({ entidade: 'registro', id: r.id }))]
  const m = metadata(questao), local = { fontes: sourceRefs, regra_ref: REVIEW_LOCAL_POLICY }
  const concept = questionEquivalence(questao, compatible.find((q) => q.id !== questao.id) || questao, corte).conceito_id
  const unit = proven(m) && m.conceito_id ? unidades.filter((u) => u.topico_id === questao.topico_id
    && u.conceito_id === m.conceito_id && Number.isInteger(u.pagina_inicial) && Number.isInteger(u.pagina_final)
    && u.pagina_final >= u.pagina_inicial && u.pagina_inicial > 0
    && progressos.some((p) => p.material_id === u.material_id && p.estado === 'concluido'
      && p.concluido_em && Date.parse(p.concluido_em) <= Date.parse(corte)))
    .sort((a, b) => a.id.localeCompare(b.id))[0] : null
  const gapSources = unit ? [...sourceRefs, { entidade: 'material_unidade_curricular', id: unit.id },
    { entidade: 'material_progresso', id: unit.material_id }] : sourceRefs
  const importance = proven(m) && Date.parse(m.atualizado_em) <= Date.parse(corte)
    && ['LOW', 'MEDIUM', 'HIGH'].includes(m.incidencia) ? m.incidencia : 'UNKNOWN'
  const last = history.at(-1), signal = (valor) => ({ ...local, valor })
  return { conceito_id: concept, historico: history, ultima_tentativa: last || null, erro_alvo: lastError || null,
    atendimento: recovered ? 'ATENDIDA' : execution.length ? 'PARCIAL' : 'NAO_EXECUTADA',
    execucoes: execution.map((r) => ({ registro_id: r.id, questao_id: r.questao_id, sessao_id: r.sessao_id || null,
      revisao_item_id: r.revisao_item_id, resultado: r.resultado, classificacao: r.classificacao, criado_em: r.criado_em })),
    lacuna_persistente: persistent, erro_persistente: sufficient(errors),
    duvida_persistente: sufficient(history.filter((r) => ['duvida', 'eliminacao'].includes(r.classificacao))), fontes: gapSources,
    lacuna: unit && persistent ? { confirmada: true, regra_ref: REVIEW_LOCAL_POLICY, fontes: gapSources, topico_id: questao.topico_id,
      conteudo_previamente_estudado: true, unidade: unit } : null,
    observacoes: { volume: history.length, dias_distintos: new Set(history.map((r) => day(r.criado_em))).size,
      sessoes_distintas: distinct(history, 'sessao_id'), exposicoes: history.length,
      retestes: execution.length, persistencia: errors.length, desempenho_posterior: after,
      incidencia: importance, cobertura: unit ? 'ESTUDADA' : 'UNKNOWN',
      recencia_segundos: last ? (Date.parse(corte) - Date.parse(last.criado_em)) / 1000 : null },
    sinais: { persistencia_erro: signal(errors.length), retestes_anteriores: signal(execution.length),
      volume_evidencia: signal(history.length), importancia: signal(importance),
      cobertura: signal(unit ? true : 'UNKNOWN'), recencia_segundos: signal(last ? (Date.parse(corte) - Date.parse(last.criado_em)) / 1000 : 'UNKNOWN') },
    candidatos: compatible.map((q) => ({ id: q.id, topico_id: q.topico_id, conceito_id: concept,
      ativo: q.ativa === true && !q.marcada_errada && q.estado !== 'arquivada', elegivel: true, angulo_id: metadata(q).angulo_id || null,
      ...(q.id !== questao.id ? { equivalencia: { confirmada: true, regra_ref: REVIEW_LOCAL_POLICY,
        conceito_id: concept, questao_original_id: questao.id, criterio: questionEquivalence(questao, q, corte).criterio,
        angulo_original_id: m.angulo_id || null, angulo_alternativa_id: metadata(q).angulo_id || null,
        fontes: [{ entidade: 'questao', id: questao.id }, { entidade: 'questao', id: q.id }] } } : {}) })),
  }
}

export function chooseOperationalRetest({ qualified, observations, policy_ref }) {
  return selectQuestionRetest({ elegibilidade: qualified.elegibilidade, evidencia: qualified.evidencia,
    conceito_id: observations.conceito_id, questoes: observations.candidatos,
    historico: observations.historico.map((r) => ({ ...r, conceito_id: observations.conceito_id })),
    historico_completo: true, fontes: observations.fontes, policy_ref,
    // A current, qualified local need authorizes reuse, not an error + fixed interval.
    repeticao_original: { confirmada: qualified.elegibilidade.elegivel, regra_ref: REVIEW_LOCAL_POLICY,
      questao_id: qualified.evidencia.alvo.id, nao_antes_de: qualified.elegibilidade.corte, fontes: observations.fontes },
  })
}
