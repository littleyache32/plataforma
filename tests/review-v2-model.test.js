import { describe, expect, it } from 'vitest'
import { createReviewSourceReference, createReviewQueueReference, createPlannedReviewReference } from '../shared/review-v2-model.js'

const question = { tipo: 'RETESTE_QUESTAO', entidade: 'revisao_item', id: 'need-1', alvo: { entidade: 'questao', id: 'question-1' } }
const card = { tipo: 'SRS_QUESTION_CARD', entidade: 'question_card', id: 'card-1', alvo: { entidade: 'question_card', id: 'card-1' } }

describe('base estrutural de revisão V2, Fase 4.1', () => {
  it('distingue ocorrência de reteste da questão respondida', () => {
    expect(createReviewSourceReference(question)).toEqual(question)
    expect(question.id).not.toBe(question.alvo.id)
  })
  it('SRS pertence ao card, não ao reteste de questão', () => {
    expect(createReviewSourceReference(card)).toEqual(card)
    expect(() => createReviewSourceReference({ ...card, entidade: 'revisao_item' })).toThrow('incompatível')
    expect(() => createReviewSourceReference({ ...question, alvo: card.alvo })).toThrow('incompatível')
  })
  it('não aceita outro card como alvo do SRS', () => {
    expect(() => createReviewSourceReference({ ...card, id: 'other-card' })).toThrow('próprio')
  })
  it('Central projeta referências sem criar decisão ou demanda', () => {
    const queue = createReviewQueueReference({ fonte: question })
    expect(queue).not.toHaveProperty('sessao_id')
    expect(queue).not.toHaveProperty('decisao_id')
    expect(queue.agendada_para).toBeNull()
    expect(queue.chave).not.toBe(createReviewQueueReference({ fonte: card }).chave)
  })
  it.each([question, card])('uma fonte basta para vincular revisão planejada: $tipo', (fonte) => {
    const plan = createPlannedReviewReference({ sessao_id: 'session', decisao_id: 'decision', fontes: [fonte] })
    expect(plan.fontes).toHaveLength(1)
    expect(plan).not.toHaveProperty('agendada_para')
    expect(plan).not.toHaveProperty('resultado')
  })
  it('rejeita vínculo duplicado e plano sem origem', () => {
    expect(() => createPlannedReviewReference({ sessao_id: 's', decisao_id: 'd', fontes: [question, question] })).toThrow('duplicada')
    expect(() => createPlannedReviewReference({ sessao_id: 's', fontes: [card] })).toThrow('ID válido')
    expect(() => createPlannedReviewReference({ sessao_id: 's', decisao_id: 'd', fontes: [] })).toThrow('fonte')
  })
  it.each(['2026-10-08T12:00:00-03:00', '2026-12-07T15:00:00Z', '2036-10-07T15:00:00Z'])('preserva data canônica sem intervalo fixo ou horizonte máximo: %s', (agendada_para) => {
    expect(createReviewQueueReference({ fonte: question, agendada_para }).agendada_para).toBe(agendada_para)
  })
  it.each(['tomorrow', '2026-10-08T12:00:00'])('recusa agendamento inválido/ambíguo: %s', (agendada_para) => {
    expect(() => createReviewQueueReference({ fonte: question, agendada_para })).toThrow('Agendamento')
  })
  it('não altera fontes nem incorpora comando estratégico fornecido na referência', () => {
    const before = structuredClone(question)
    const output = createReviewSourceReference({ ...question, intervalo_dias: 2, prioridade: 1 })
    expect(output).toEqual(before)
    expect(question).toEqual(before)
  })
})
