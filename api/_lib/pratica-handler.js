import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './http.js'
import { selectPracticeQuestion, shouldShowExplanation } from '../../shared/practice.js'
import { buildQuestionCard, cardKey, cardTransition, shouldCreateQuestionCard } from '../../shared/cards.js'
import { currentPracticeFlags } from '../../shared/study-access.js'

import { randomUUID } from 'node:crypto'
import { plannedQuestionReview, validateReviewExecution, reconcileQuestionReview } from './review-v2-execution.js'
import { readQuestionReviewFacts, readReviewRows } from './review-v2-facts.js'
import { projectReviewCenter } from '../../shared/review-v2-center.js'
import { resolveMentorV2Policy } from '../../shared/mentor-v2-policy.js'

const classifications = ['certeza', 'duvida', 'eliminacao', 'sem_conhecimento']

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    const practiceFlags = await currentPracticeFlags(supabase)
    if (!practiceFlags.questoes) return res.status(423).json({ error: 'Questões ainda não foram liberadas pelo Mentor neste ciclo.' })
    if (req.method === 'GET') {
      const topicoId = queryParam(req, 'topicoId')
      const materiaId = queryParam(req, 'materiaId')
      let questaoId = queryParam(req, 'questaoId')
      const planned = await plannedQuestionReview(supabase, queryParam(req, 'sessaoId'))
      let reviewContext = planned ? { revisaoId: planned.revisaoId, sessaoId: planned.sessaoId } : null
      if (planned) questaoId = planned.questaoIds[0]
      const requestedReview = queryParam(req, 'revisaoId')
      if (requestedReview) reviewContext = { revisaoId: requestedReview, sessaoId: planned?.sessaoId || null }
      const somenteRevisao = queryParam(req, 'revisao') === '1'
      const somenteCaderno = queryParam(req, 'caderno') === '1'
      if ((somenteRevisao || somenteCaderno || requestedReview || planned) && !practiceFlags.revisao_pratica) return res.status(423).json({ error: 'Revisão prática não liberada neste ciclo.' })
      if (!topicoId && !materiaId && !questaoId) return res.status(400).json({ error: 'Materia, topico ou questao obrigatorio.' })

      let query = supabase.from('questao')
        .select('id,tipo,enunciado,alternativas,origem,estado,quantidade_tentativas,ultima_resolucao,proxima_revisao,topico:topico_id(id,nome,materia_id,materia:materia_id(id,objetivo:objetivo_id(tipo)))', { count: 'exact' })
        .eq('marcada_errada', false)
        .eq('ativa', true)
        .neq('estado', 'arquivada')
      if (somenteCaderno && !questaoId) {
        const { data: notebookItems, error: notebookError } = await supabase.from('revisao_item').select('questao_id').eq('status', 'pendente')
        if (notebookError) throw notebookError
        const notebookQuestionIds = (notebookItems || []).map((item) => item.questao_id)
        if (!notebookQuestionIds.length) return res.status(404).json({ error: 'Seu Caderno de Questões está vazio.' })
        query = query.in('id', notebookQuestionIds)
      }
      if ((somenteRevisao || somenteCaderno || requestedReview) && !planned) {
        const now = new Date().toISOString()
        const policies = await supabase.from('conhecimento_modulo').select('id,modulo,versao,conteudo,ativo').eq('modulo', 'mentor').eq('ativo', true)
        if (policies.error) throw policies.error
        const policy = resolveMentorV2Policy(policies.data?.length === 1 ? policies.data[0] : null)
        const facts = await readQuestionReviewFacts(supabase, now)
        const center = projectReviewCenter({ ...facts, cards: [], corte: now, policy_ref: policy.ok ? policy.ref : null, flags: practiceFlags })
        const item = center.itens.find((row) => row.pode_revisar && (!requestedReview || row.id === requestedReview)
          && (!topicoId || row.topico_id === topicoId) && (!materiaId || row.materia_id === materiaId))
        if (!item) return res.status(404).json({ error: 'Nenhum reteste qualificado disponível neste foco.' })
        questaoId = item.item_id
        reviewContext = { revisaoId: item.id, sessaoId: null }
      }
      if (questaoId) query = query.eq('id', questaoId).limit(1)
      else if (topicoId) query = query.eq('topico_id', topicoId).limit(1000)
      else {
        const { data: subjectTopics, error: topicsError } = await supabase.from('topico').select('id').eq('materia_id', materiaId)
        if (topicsError) throw topicsError
        const topicIds = (subjectTopics || []).map((item) => item.id)
        if (!topicIds.length) return res.status(404).json({ error: 'Esta disciplina ainda nao possui topicos.' })
        query = query.in('topico_id', topicIds).limit(1000)
      }
      const { data: questions, error } = await query
      if (error) throw error
      const eligibleQuestions = questions || []
      // V2 release is canonical context, not a historical date or session=material.
      const question = questaoId ? eligibleQuestions[0] : selectPracticeQuestion(eligibleQuestions.map((q) => ({ ...q, proxima_revisao: null })))
      if (!question) return res.status(404).json({ error: somenteRevisao ? 'As revisões programadas deste foco foram concluídas.' : 'Nao ha questoes disponiveis. Gere um lote em Administracao.' })
      return res.status(200).json({ questao: question, disponiveis: eligibleQuestions.length, revisao_contexto: reviewContext })
    }

    const { questaoId, resposta, classificacao, tempo, revisaoId, sessaoId } = req.body || {}
    if ((revisaoId || sessaoId) && !practiceFlags.revisao_pratica) return res.status(423).json({ error: 'Revisão prática não liberada neste ciclo.' })
    if (!questaoId || !classifications.includes(classificacao) || !Number.isInteger(tempo) || tempo < 0) {
      return res.status(400).json({ error: 'Resposta, classificacao e tempo validos sao obrigatorios.' })
    }
    const operacaoId = req.body?.operacaoId || randomUUID()
    let priorRecord = null
    if (operacaoId) {
      const prior = await supabase.from('registro').select('id,questao_id,resultado,classificacao,tempo,revisao_item_id,sessao_id').eq('operacao_id', operacaoId).maybeSingle()
      if (prior.error) throw prior.error
      priorRecord = prior.data
      if (priorRecord && (priorRecord.questao_id !== questaoId || priorRecord.classificacao !== classificacao || priorRecord.tempo !== tempo
        || (revisaoId && priorRecord.revisao_item_id !== revisaoId) || (sessaoId && priorRecord.sessao_id !== sessaoId))) return res.status(409).json({ error: 'Operação já utilizada com outros fatos.' })
    }
    const { data: question, error } = await supabase.from('questao')
      .select('id,topico_id,metadados_revisao,tipo,gabarito,enunciado,explicacao,comentarios_alternativas,fonte,trecho_fonte,quantidade_tentativas,intervalo_dias,fator_facilidade,lapsos,acertos_seguidos,topico:topico_id(id,nome,materia:materia_id(id,objetivo_id,objetivo:objetivo_id(tipo)))')
      .eq('id', questaoId).eq('marcada_errada', false).eq('ativa', true).single()
    if (error) throw error

    const answer = String(resposta || '').toUpperCase()
    const validAnswers = question.tipo === 'CE' ? ['C', 'E'] : ['A', 'B', 'C', 'D', 'E']
    if (!validAnswers.includes(answer)) return res.status(400).json({ error: 'Resposta invalida para o tipo da questao.' })
    const resultado = answer === question.gabarito ? 'acerto' : 'erro'
    const now = new Date().toISOString()
    if (priorRecord && priorRecord.resultado !== resultado) return res.status(409).json({ error: 'Operação já utilizada com outra resposta.' })
    const link = await validateReviewExecution(supabase, { question, revisaoId, sessaoId, corte: now, repetida: Boolean(priorRecord) })
    const candidate = link.need ? { data: link.need } : await supabase.from('revisao_item').select('id,questao_id,motivo,status,agendada_para').eq('questao_id', question.id).eq('status', 'pendente').maybeSingle()
    if (candidate.error) throw candidate.error
    let need = candidate.data
    const motivo = resultado === 'erro' ? classificacao === 'certeza' ? 'falsa_certeza' : classificacao === 'sem_conhecimento' ? 'baixa_confianca' : 'erro'
      : ['duvida', 'sem_conhecimento'].includes(classificacao) ? 'checagem' : null
    if (motivo && !need && !priorRecord) {
      const created = await supabase.from('revisao_item').insert({ questao_id: question.id, motivo,
        prioridade: motivo === 'falsa_certeza' ? 1 : 2, agendada_para: null })
      if (created.error && created.error.code !== '23505') throw created.error
      const reread = await supabase.from('revisao_item').select('id,questao_id,motivo,status,agendada_para').eq('questao_id', question.id).eq('status', 'pendente').maybeSingle()
      if (reread.error) throw reread.error
      need = reread.data
    }
    if (!priorRecord) {
      const previous = await supabase.from('registro').select('id,criado_em').eq('questao_id', link.original.id).eq('resultado', 'erro').order('criado_em', { ascending: false }).limit(1).maybeSingle()
      if (previous.error) throw previous.error
      const inserted = await supabase.from('registro').insert({ questao_id: question.id, resultado, classificacao, tempo,
        operacao_id: operacaoId, criado_em: now, revisao_item_id: link.need?.id || null,
        sessao_id: link.sessao_id, erro_alvo_id: previous.data?.id || null, topico_id: question.topico_id || question.topico?.id || null })
      if (inserted.error) {
        if (inserted.error.code !== '23505') throw inserted.error
        const retry = await supabase.from('registro').select('id,questao_id,resultado,classificacao,tempo,revisao_item_id,sessao_id').eq('operacao_id', operacaoId).maybeSingle()
        if (retry.error) throw retry.error
        if (!retry.data || retry.data.questao_id !== question.id || retry.data.resultado !== resultado || retry.data.classificacao !== classificacao
          || retry.data.tempo !== tempo || retry.data.revisao_item_id !== (link.need?.id || null) || retry.data.sessao_id !== link.sessao_id) throw inserted.error
        priorRecord = retry.data
      }
    }
    // Reconcile counters from actual facts, not a retry-sensitive increment.
    const records = await readReviewRows(supabase, 'registro', 'id,criado_em', (q) => q.eq('questao_id', question.id))
    const updated = await supabase.from('questao').update({ usada: true,
      ultima_resolucao: records.map((r) => r.criado_em).sort().at(-1) || now,
      quantidade_tentativas: new Set(records.map((r) => r.id)).size }).eq('id', question.id)
    if (updated.error) throw updated.error
    // Legacy dates/intervals/state remain historical; no D+1/D+2 or FSRS write.
    const attendance = await reconcileQuestionReview(supabase, { need, original: link.original, corte: now })

    const topico = question.topico
    const materia = topico?.materia
    if (!priorRecord && practiceFlags.question_cards && topico?.id && materia?.id && materia?.objetivo_id && shouldCreateQuestionCard({ resultado, classificacao })) {
      const chave = cardKey({ topicoId: topico.id, explicacao: question.explicacao })
      const cardSchedule = cardTransition({ resultado: 'revisar' })
      const due = motivo === 'falsa_certeza' ? now : cardSchedule.proximaRevisao
      const { data: existingCard, error: existingCardError } = await supabase.from('question_card').select('id,ocorrencias').eq('chave', chave).maybeSingle()
      if (existingCardError) throw existingCardError
      if (existingCard) {
        const { error: cardError } = await supabase.from('question_card').update({ ocorrencias: existingCard.ocorrencias + 1, questao_id: question.id, proxima_revisao: due }).eq('id', existingCard.id)
        if (cardError) throw cardError
      } else {
        const { count: cardCount, error: cardCountError } = await supabase.from('question_card').select('id', { count: 'exact', head: true }).eq('topico_id', topico.id).eq('ativa', true)
        if (cardCountError) throw cardCountError
        if ((cardCount || 0) < 20) {
          const card = buildQuestionCard({ question, topicName: topico.nome })
          const { error: cardError } = await supabase.from('question_card').insert({
            objetivo_id: materia.objetivo_id,
            materia_id: materia.id,
            topico_id: topico.id,
            questao_id: question.id,
            chave,
            frente: card.frente,
            verso: card.verso,
            resposta_direta: card.respostaDireta,
            explicacao_curta: card.explicacaoCurta,
            dica_escopo: card.dicaEscopo,
            modelo_card: card.modeloCard,
            tipo_card: card.tipoCard,
            fonte: question.fonte,
            trecho_fonte: question.trecho_fonte,
            proxima_revisao: due,
            ativa: true,
            ativo: true,
          })
          if (cardError && cardError.code !== '23505') throw cardError
        }
      }
    }

    const mostrarExplicacao = shouldShowExplanation({ resultado, classificacao })
    return res.status(priorRecord ? 200 : 201).json({
      ...(priorRecord ? { repetida: true } : {}),
      resultado,
      gabarito: question.gabarito,
      mostrar_explicacao: mostrarExplicacao,
      explicacao: question.explicacao,
      comentarios_alternativas: question.comentarios_alternativas,
      fonte: question.fonte,
      trecho_fonte: question.trecho_fonte,
      revisao_imediata: motivo === 'falsa_certeza',
      proxima_revisao: null,
      atendimento: attendance?.atendimento || null,
    })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel processar a pratica.')
  }
}
