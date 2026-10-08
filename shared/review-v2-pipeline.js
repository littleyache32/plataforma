import { questionReviewEvidence } from './review-v2-evidence.js'
import { assessQuestionCorrectionSignal } from './mentor-v2-question-signals.js'
import { evaluateReviewEligibility } from './review-v2-eligibility.js'
import { selectMentorReviewMethod } from './mentor-v2-review-method.js'
import { readInitialMentorCapacity } from './mentor-v2-capacity.js'
import { questionReviewObservations, chooseOperationalRetest, REVIEW_LOCAL_POLICY } from './review-v2-operational.js'

// Shared local qualification for the Central and the ONE Mentor. No dates,
// mastery thresholds, conceptual gaps or FSRS results are manufactured here.
export function qualifyQuestionReview({ registro, questao, revisao, corte, policy_ref, observacoes = null }) {
  const evidencia = questionReviewEvidence({ registro, questao, corte,
    contexto: registro.revisao_item_id ? { tipo: 'RETESTE', referencia: { entidade: 'revisao_item', id: registro.revisao_item_id } } : null,
    erroAlvo: observacoes?.erro_alvo || null })
  evidencia.fontes.push({ entidade: 'revisao_item', id: revisao.id })
  if (observacoes) {
    evidencia.fontes = [...new Map([...evidencia.fontes, ...observacoes.fontes].map((r) => [`${r.entidade}:${r.id}`, r])).values()]
    evidencia.observacoes.operacionais = observacoes.observacoes
    evidencia.observacoes.atendimento = observacoes.atendimento
    evidencia.observacoes.execucoes = observacoes.execucoes
  }
  const sinal = assessQuestionCorrectionSignal({ evidencia, policy_ref })
  const operational = [observacoes?.erro_persistente && 'ERRO_RELEVANTE', observacoes?.duvida_persistente && 'DUVIDA_PERSISTENTE'].filter(Boolean)
    .map((criterio) => ({ criterio, estado: 'CONFIRMADO', regra_ref: REVIEW_LOCAL_POLICY, fontes: observacoes.fontes }))
  // Historical calendar remains a fact, never a mandatory V1 retest interval.
  const qualificacoes = [...sinal.qualificacoes, ...operational]
  return { evidencia, sinal, elegibilidade: evaluateReviewEligibility({ evidencia, qualificacoes }) }
}

export function projectMentorQuestionReviews({ facts, corte, policy_ref, modalidades }) {
  const source = facts.prioritySources, items = [], observations = []
  const latest = new Map()
  for (const row of source.attempts) {
    if (!Number.isFinite(Date.parse(row.criado_em)) || Date.parse(row.criado_em) > Date.parse(corte)) continue
    const previous = latest.get(row.questao_id)
    if (!previous || Date.parse(row.criado_em) > Date.parse(previous.criado_em)
      || (row.criado_em === previous.criado_em && String(row.id).localeCompare(String(previous.id)) > 0)) latest.set(row.questao_id, row)
  }
  let capacity
  try { capacity = readInitialMentorCapacity(facts.context?.capacidade_inicial)?.slots || [] }
  catch (error) {
    if (error.message !== 'CAPACIDADE_INICIAL_INVALIDA') throw error
    // Preserve the central policy's existing typed refusal. This projection
    // must not turn invalid factual capacity into an uncaught transport error.
    return { itens: [], observacoes: [], pendencias: ['CAPACIDADE_INICIAL_INVALIDA'] }
  }
  for (const review of source.reviews) {
    if (review.status !== 'pendente') continue
    const question = source.questions.find((row) => row.id === review.questao_id)
    const record = latest.get(review.questao_id)
    const topic = facts.topics.find((row) => row.id === question?.topico_id)
    const subject = facts.subjects.find((row) => row.id === topic?.materia_id)
    if (!question || !record || !subject || question.ativa !== true || question.marcada_errada === true || question.estado === 'arquivada') continue
    const local = questionReviewObservations({ questao: question, revisao: review, questoes: source.questions,
      registros: source.attempts, corte, unidades: source.units || [], progressos: source.progress || [] })
    const base = local.execucoes.length ? local.historico.filter((r) => r.questao_id === question.id && r.resultado === 'erro').at(-1) || record : record
    const qualified = qualifyQuestionReview({ registro: base, questao: question, revisao: review, corte, policy_ref, observacoes: local })
    observations.push({ revisao_id: review.id, ...qualified, atendimento: local.atendimento })
    if (local.atendimento === 'ATENDIDA') continue
    if (!qualified.elegibilidade.elegivel || facts.context?.rotina_pratica?.questoes !== true
      || facts.context?.rotina_pratica?.revisao_pratica !== true) continue
    const slots = capacity.filter((slot) => slot.atividade === 'REVISAO'
      && (slot.objetivo_id === subject.objetivo_id || (slot.destino === 'PRIORIDADE_ESTRUTURAL' && facts.context.objetivo_principal_id === subject.objetivo_id))
      && (!slot.materia_id || slot.materia_id === subject.id) && (!slot.topico_id || slot.topico_id === topic.id)
      && (!slot.revisao_id || slot.revisao_id === review.id))
    const retest = chooseOperationalRetest({ qualified, observations: local, policy_ref })
    const methods = [...new Set(slots.map((slot) => slot.duracao_minutos))].map((minutes) => selectMentorReviewMethod({
      elegibilidade: qualified.elegibilidade, topico_id: topic.id, fontes: qualified.evidencia.fontes, policy_ref,
      modalidades, slots: [{ id: `review-method-${review.id}-${minutes}`, atividade: 'QUESTOES', duracao_minutos: minutes },
        { id: `review-theory-${review.id}-${minutes}`, atividade: 'ESTUDO', duracao_minutos: minutes }],
      recursos: { questoes: local.candidatos.filter((q) => q.id === retest.questao_id) }, reteste: retest, lacuna: local.lacuna,
    }))
    items.push({ fonte: { tipo: 'RETESTE_QUESTAO', entidade: 'revisao_item', id: review.id, alvo: { entidade: 'questao', id: question.id } },
      objetivo_id: subject.objetivo_id, materia_id: subject.id, topico_id: topic.id,
      evidencia: qualified.evidencia, elegibilidade: qualified.elegibilidade, sinais: local.sinais,
      reteste: retest, data_legada: review.agendada_para || null, agendada_para: null,
      metodo: methods[0] || null, metodos_por_duracao: methods })
  }
  return { itens: items, observacoes: observations }
}
