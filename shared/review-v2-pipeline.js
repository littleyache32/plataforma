import { questionReviewEvidence } from './review-v2-evidence.js'
import { assessQuestionCorrectionSignal } from './mentor-v2-question-signals.js'
import { evaluateReviewEligibility } from './review-v2-eligibility.js'
import { selectMentorReviewMethod } from './mentor-v2-review-method.js'
import { readInitialMentorCapacity } from './mentor-v2-capacity.js'
import { selectQuestionRetest } from './mentor-v2-question-retest.js'
import { operationalReviewSignals, questionEquivalence } from './review-v2-operational.js'

// Shared local qualification for the Central and the ONE Mentor. No dates,
// mastery thresholds, conceptual gaps or FSRS results are manufactured here.
export function qualifyQuestionReview({ registro, questao, revisao, corte, policy_ref, registros = [registro], questoes = [questao] }) {
  const operational = operationalReviewSignals({ questao, revisao, registros, questoes, corte })
  const evidencia = questionReviewEvidence({ registro, questao, corte })
  evidencia.fontes.push({ entidade: 'revisao_item', id: revisao.id })
  evidencia.fontes = [...new Map([...evidencia.fontes, ...operational.fontes].map((row) => [`${row.entidade}:${row.id}`, row])).values()]
  evidencia.observacoes.operacionais = operational.observacoes
  const sinal = assessQuestionCorrectionSignal({ evidencia, policy_ref })
  const qualificacoes = sinal.qualificacoes.map((row) => ({ ...row,
    ...(revisao.agendada_para ? { nao_antes_de: revisao.agendada_para,
      fontes: [...row.fontes, { entidade: 'revisao_item', id: revisao.id }] } : {}) }))
  if (!qualificacoes.length && registro.resultado === 'erro' && operacionalErrorEligible(operational)) qualificacoes.push({ criterio: 'ERRO_RELEVANTE', estado: 'CONFIRMADO', regra_ref: operational.policy_ref, fontes: operational.fontes })
  const elegibilidade = evaluateReviewEligibility({ evidencia, qualificacoes: operational.recovered ? [] : qualificacoes })
  const conceito_id = questao.erro_alvo || questao.conceito_id || questao.topico_id || questao.id
  const candidates = questoes.filter((row) => row.id === questao.id || questionEquivalence(questao, row))
  for (const row of candidates) if (!evidencia.fontes.some((ref) => ref.entidade === 'questao' && ref.id === row.id)) evidencia.fontes.push({ entidade: 'questao', id: row.id })
  const reteste = selectQuestionRetest({ elegibilidade, evidencia, conceito_id, policy_ref, fontes: evidencia.fontes,
    historico: operational.history.map((row) => ({ ...row, conceito_id })), historico_completo: false,
    questoes: candidates.map((row) => ({ id: row.id, topico_id: row.topico_id, conceito_id,
      ativo: row.ativa !== false && !row.marcada_errada && row.estado !== 'arquivada', elegivel: true,
      equivalencia: row.id === questao.id ? null : { confirmada: true, conceito_id, questao_original_id: questao.id,
        regra_ref: { id: questionEquivalence(questao, row), versao: 'equivalencia-factual-v2/1' },
        fontes: [{ entidade: 'questao', id: questao.id }, { entidade: 'questao', id: row.id }] } })),
    repeticao_original: { confirmada: true, questao_id: questao.id, fallback_sem_calendario: true,
      regra_ref: { id: 'RETESTE_LOCAL_SEM_CALENDARIO', versao: 'reteste-v2/2' }, fontes: [{ entidade: 'registro', id: registro.id }] } })
  return { evidencia, sinal, elegibilidade, operational, reteste }
}
const operacionalErrorEligible = (value) => value.history.filter((row) => row.resultado === 'erro').length > 1 && value.observacoes.dias_distintos > 1

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
    const qualified = qualifyQuestionReview({ registro: record, questao: question, revisao: review, corte, policy_ref, registros: source.attempts, questoes: source.questions })
    observations.push({ revisao_id: review.id, ...qualified })
    if (!qualified.elegibilidade.elegivel || facts.context?.rotina_pratica?.questoes !== true
      || facts.context?.rotina_pratica?.revisao_pratica !== true) continue
    const slots = capacity.filter((slot) => slot.atividade === 'REVISAO'
      && (slot.objetivo_id === subject.objetivo_id || (slot.destino === 'PRIORIDADE_ESTRUTURAL' && facts.context.objetivo_principal_id === subject.objetivo_id))
      && (!slot.materia_id || slot.materia_id === subject.id) && (!slot.topico_id || slot.topico_id === topic.id)
      && (!slot.revisao_id || slot.revisao_id === review.id))
    const selected = source.questions.find((row) => row.id === qualified.reteste.questao_id)
    const methodEligibility = { ...qualified.elegibilidade, alvo: { ...qualified.elegibilidade.alvo, id: selected?.id || question.id } }
    const methods = [...new Set(slots.map((slot) => slot.duracao_minutos))].map((minutes) => selectMentorReviewMethod({
      elegibilidade: methodEligibility, topico_id: topic.id, fontes: qualified.evidencia.fontes, policy_ref,
      modalidades, slots: [{ id: `review-method-${review.id}-${minutes}`, atividade: 'QUESTOES', duracao_minutos: minutes }],
      recursos: { questoes: selected ? [{ id: selected.id, topico_id: selected.topico_id, ativo: true, elegivel: true }] : [] },
    }))
    items.push({ fonte: { tipo: 'RETESTE_QUESTAO', entidade: 'revisao_item', id: review.id, alvo: { entidade: 'questao', id: question.id } },
      objetivo_id: subject.objetivo_id, materia_id: subject.id, topico_id: topic.id,
      evidencia: qualified.evidencia, elegibilidade: qualified.elegibilidade, reteste: qualified.reteste,
      sinais_operacionais: qualified.operational, agendada_para: review.agendada_para || null,
      metodo: methods[0] || null, metodos_por_duracao: methods })
  }
  return { itens: items, observacoes: observations }
}
