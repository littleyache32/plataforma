// Structural references only. No scheduling, prioritization, database writes or FSRS.
export const REVIEW_V2_CONTRACT = 'revisao-v2/1'
const SOURCES = Object.freeze({
  RETESTE_QUESTAO: { entity: 'revisao_item', target: 'questao' },
  SRS_QUESTION_CARD: { entity: 'question_card', target: 'question_card' },
})

function identifier(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Referência de revisão sem ID válido.')
  return value
}

export function createReviewSourceReference({ tipo, entidade, id, alvo }) {
  const source = SOURCES[tipo]
  if (!source || entidade !== source.entity || alvo?.entidade !== source.target) {
    throw new Error('Fonte de revisão incompatível: reteste de questão e SRS de card são distintos.')
  }
  const sourceId = identifier(id), targetId = identifier(alvo.id)
  if (tipo === 'SRS_QUESTION_CARD' && sourceId !== targetId) throw new Error('SRS deve referenciar o próprio Question Card.')
  return { tipo, entidade, id: sourceId, alvo: { entidade: source.target, id: targetId } }
}

// A queue item references a need/schedule, not a planned session or practice event.
// Null means no canonical schedule supplied, never "due now".
export function createReviewQueueReference({ fonte, agendada_para = null }) {
  const reference = createReviewSourceReference(fonte)
  if (agendada_para !== null && (typeof agendada_para !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(agendada_para)
    || !Number.isFinite(Date.parse(agendada_para)))) throw new Error('Agendamento de revisão inválido ou sem fuso explícito.')
  return { versao: REVIEW_V2_CONTRACT, chave: `${reference.tipo}:${reference.id}`, fonte: reference, agendada_para }
}

// This is a link to an existing Mentor decision/session, not a command to create it.
// One modality/source is sufficient; question + card is not mandatory.
export function createPlannedReviewReference({ sessao_id, decisao_id, fontes }) {
  if (!Array.isArray(fontes) || !fontes.length) throw new Error('Informe a fonte da revisão planejada.')
  const references = fontes.map(createReviewSourceReference)
  if (new Set(references.map((row) => `${row.tipo}:${row.id}`)).size !== references.length) {
    throw new Error('Fonte de revisão duplicada na demanda.')
  }
  return { versao: REVIEW_V2_CONTRACT, sessao_id: identifier(sessao_id), decisao_id: identifier(decisao_id), fontes: references }
}
