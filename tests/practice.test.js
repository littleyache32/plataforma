import { describe, expect, it } from 'vitest'
import { practiceTransition, selectPracticeQuestion } from '../shared/practice.js'

describe('ciclo de pratica', () => {
  it('manda falsa certeza para revisao imediata com prioridade maxima', () => {
    const result = practiceTransition({ resultado: 'erro', classificacao: 'certeza', tentativas: 2, now: 0 })
    expect(result).toMatchObject({ estado: 'revisao', motivo: 'falsa_certeza', prioridade: 1 })
    expect(result.proximaRevisao).toBe(new Date(0).toISOString())
  })
  it('so considera dominada depois de tres acertos com certeza acumulados', () => {
    expect(practiceTransition({ resultado: 'acerto', classificacao: 'certeza', tentativas: 1, now: 0 }).estado).toBe('aprendendo')
    expect(practiceTransition({ resultado: 'acerto', classificacao: 'certeza', tentativas: 2, now: 0 }).estado).toBe('dominada')
  })
  it('prioriza revisao vencida e depois questao menos tentada', () => {
    const selected = selectPracticeQuestion([
      { id: 'nova', quantidade_tentativas: 0, proxima_revisao: null, ultima_resolucao: null },
      { id: 'devida', quantidade_tentativas: 2, proxima_revisao: new Date(0).toISOString(), ultima_resolucao: new Date(0).toISOString() },
    ], 1000)
    expect(selected.id).toBe('devida')
  })
})
