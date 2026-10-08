import { REVIEW_ELIGIBILITY_CONTRACT } from './review-v2-eligibility.js'

export const REVIEW_METHOD_CONTRACT = 'metodo-revisao-v2/1'
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
const sourceKey = (row) => `${row.entidade}:${row.id}`

// Internal domain of the ONE Mentor. No database writes, demand generation,
// independent policy defaults, FSRS calculation or whole-course restart.
export function selectMentorReviewMethod({ elegibilidade, topico_id = null, recursos, slots, modalidades,
  policy_ref, fontes, combinacao = null, lacuna = null }) {
  if (elegibilidade?.versao !== REVIEW_ELIGIBILITY_CONTRACT || !nonempty(elegibilidade.alvo?.id)
    || !nonempty(policy_ref?.id) || !nonempty(policy_ref?.versao) || !Array.isArray(fontes)
    || fontes.some((row) => !nonempty(row.entidade) || !nonempty(row.id)) || !Array.isArray(slots)
    || !Array.isArray(modalidades) || !recursos) throw new Error('Entradas de método de revisão inválidas.')
  const sourceSet = new Set(fontes.map(sourceKey))
  const qualified = (value) => value?.confirmada === true && nonempty(value.regra_ref?.id) && nonempty(value.regra_ref?.versao)
    && Array.isArray(value.fontes) && value.fontes.length > 0 && value.fontes.every((row) => sourceSet.has(sourceKey(row)))
  for (const slot of slots) {
    if (!['QUESTOES', 'QUESTION_CARDS', 'ESTUDO'].includes(slot.atividade) || ![30, 50].includes(slot.duracao_minutos)
      || !nonempty(slot.id)) throw new Error('Slot de revisão inválido.')
  }
  if (new Set(slots.map((row) => row.id)).size !== slots.length) throw new Error('Slot duplicado.')
  const availableSlot = (activity) => modalidades.includes(activity) ? slots.find((row) => row.atividade === activity) : null
  const items = (name, entity) => {
    const rows = recursos[name] || []
    if (!Array.isArray(rows) || rows.some((row) => !nonempty(row.id))) throw new Error('Recursos de revisão inválidos.')
    if (new Set(rows.map((row) => row.id)).size !== rows.length) throw new Error('Recurso duplicado.')
    // Unreleased, inactive or insufficiently eligible resources are never manufactured.
    return rows.filter((row) => row.ativo === true && row.elegivel === true
      && sourceSet.has(`${entity}:${row.id}`)
      && (topico_id ? row.topico_id === topico_id : elegibilidade.alvo.entidade === entity && row.id === elegibilidade.alvo.id))
      .sort((a, b) => a.id.localeCompare(b.id))
  }
  const questions = items('questoes', 'questao'), cards = items('cards', 'question_card')
  const questionSlot = availableSlot('QUESTOES'), cardSlot = availableSlot('QUESTION_CARDS')
  const questionMethod = questions.length > 1 ? 'BATERIA_QUESTOES' : 'QUESTAO_INDIVIDUAL'
  const component = (metodo, slot, entity, rows, finalidade) => ({ metodo, slot_id: slot.id,
    tipo_atividade: slot.atividade, duracao_minutos: slot.duracao_minutos,
    referencias: rows.map((row) => ({ entidade: entity, id: row.id })), finalidade })
  const answer = (metodo, components, codes, qualification = null) => ({ versao: REVIEW_METHOD_CONTRACT,
    resultado: metodo ? 'METODO_SELECIONADO' : 'METODO_PENDENTE', metodo, componentes: components,
    reason_codes: codes, policy_ref: structuredClone(policy_ref), alvo: structuredClone(elegibilidade.alvo),
    corte: elegibilidade.corte, fontes: structuredClone(fontes),
    qualificacao_utilizada: qualification ? structuredClone(qualification) : null,
    cria_demanda: false, altera_progresso: false, reinicia_curso: false })
  if (!elegibilidade.elegivel || elegibilidade.resultado !== 'ELEGIVEL') {
    return answer(null, [], ['REVIEW_METHOD_REQUIRES_ELIGIBILITY'])
  }

  // A real, bounded conceptual gap is a separate exceptional method, never a
  // fallback for a missing question/card or an isolated wrong answer.
  if (lacuna?.confirmada === true) {
    const theorySlot = availableSlot('ESTUDO')
    const unit = lacuna.unidade
    if (!qualified(lacuna) || !nonempty(topico_id) || lacuna.topico_id !== topico_id
      || lacuna.conteudo_previamente_estudado !== true || !nonempty(unit?.id) || !nonempty(unit.material_id)
      || !sourceSet.has(`material_unidade_curricular:${unit.id}`)
      || !sourceSet.has(`material_progresso:${unit.material_id}`)
      || !lacuna.fontes.some((row) => ['registro', 'question_card_registro'].includes(row.entidade))) {
      return answer(null, [], ['REVIEW_CONCEPTUAL_GAP_NOT_PROVEN'])
    }
    if (!theorySlot) return answer(null, [], ['REVIEW_THEORY_SLOT_UNAVAILABLE'])
    return answer('RETORNO_PONTUAL_TEORIA', [component('RETORNO_PONTUAL_TEORIA', theorySlot, 'material_unidade_curricular', [unit], 'CORRIGIR_LACUNA_CONCEITUAL')],
      ['REVIEW_CONCEPTUAL_GAP_CONFIRMED', 'REVIEW_THEORY_RETURN_BOUNDED'], lacuna)
  }

  if (combinacao?.confirmada === true) {
    if (!qualified(combinacao) || combinacao.finalidade_cards !== 'RECUPERACAO_ATIVA'
      || combinacao.finalidade_questoes !== 'APLICACAO_DO_CONCEITO'
      || !combinacao.fontes.some((row) => row.entidade === 'questao' && questions.some((q) => q.id === row.id))
      || !combinacao.fontes.some((row) => row.entidade === 'question_card' && cards.some((c) => c.id === row.id))) {
      return answer(null, [], ['REVIEW_COMBINATION_NOT_JUSTIFIED'])
    }
    if (!questionSlot || !cardSlot || !questions.length || !cards.length) return answer(null, [], ['REVIEW_COMBINATION_RESOURCES_UNAVAILABLE'])
    return answer('COMBINACAO', [component('QUESTION_CARDS', cardSlot, 'question_card', cards, 'RECUPERACAO_ATIVA'),
      component(questionMethod, questionSlot, 'questao', questions, 'APLICACAO_DO_CONCEITO')],
      ['REVIEW_COMPLEMENTARY_METHODS_JUSTIFIED', 'REVIEW_SEPARATE_CAPACITY_SLOTS'], combinacao)
  }

  // The source of the eligible need defines continuity; mere availability of
  // both resources does not justify combining them or changing the modality.
  if (elegibilidade.alvo.entidade === 'questao' && questions.some((row) => row.id === elegibilidade.alvo.id) && questionSlot) {
    return answer(questionMethod, [component(questionMethod, questionSlot, 'questao', questions, 'RETESTAR_APLICACAO')],
      [questionMethod === 'BATERIA_QUESTOES' ? 'REVIEW_QUESTION_BATCH_SCOPED' : 'REVIEW_TARGETED_SINGLE_QUESTION'])
  }
  if (elegibilidade.alvo.entidade === 'question_card' && cards.some((row) => row.id === elegibilidade.alvo.id) && cardSlot) {
    return answer('QUESTION_CARDS', [component('QUESTION_CARDS', cardSlot, 'question_card', cards, 'RECUPERACAO_ATIVA')], ['REVIEW_CARD_RETRIEVAL'])
  }
  return answer(null, [], ['REVIEW_METHOD_RESOURCES_OR_CAPACITY_UNAVAILABLE', 'REVIEW_NO_AUTOMATIC_THEORY_FALLBACK'])
}
