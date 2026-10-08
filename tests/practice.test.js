import { describe, expect, it } from 'vitest'
import { practiceTransition, selectPracticeQuestion, shouldShowExplanation } from '../shared/practice.js'

describe('ciclo de pratica', () => {
  it('manda falsa certeza para revisao imediata com prioridade maxima', () => {
    const result = practiceTransition({ resultado: 'erro', classificacao: 'certeza', tentativas: 2, now: 0 })
    expect(result).toMatchObject({ estado: 'revisao', motivo: 'falsa_certeza', prioridade: 1 })
    expect(result.proximaRevisao).toBe(new Date(0).toISOString())
  })
  it('so considera dominada depois de tres acertos com certeza acumulados', () => {
    expect(practiceTransition({ resultado: 'acerto', classificacao: 'certeza', tentativas: 1, now: 0 }).estado).toBe('aprendendo')
    expect(practiceTransition({ resultado: 'acerto', classificacao: 'certeza', tentativas: 2, acertosSeguidos: 2, intervaloDias: 7, now: 0 }).estado).toBe('dominada')
  })
  it('prioriza revisao vencida e depois questao menos tentada', () => {
    const selected = selectPracticeQuestion([
      { id: 'nova', quantidade_tentativas: 0, proxima_revisao: null, ultima_resolucao: null },
      { id: 'devida', quantidade_tentativas: 2, proxima_revisao: new Date(0).toISOString(), ultima_resolucao: new Date(0).toISOString() },
    ], 1000)
    expect(selected.id).toBe('devida')
  })
})

describe('exibicao do gabarito comentado', () => {
  it('mostra explicacao em erro, duvida e sem conhecimento', () => {
    expect(shouldShowExplanation({ resultado: 'erro', classificacao: 'certeza' })).toBe(true)
    expect(shouldShowExplanation({ resultado: 'acerto', classificacao: 'duvida' })).toBe(true)
    expect(shouldShowExplanation({ resultado: 'acerto', classificacao: 'sem_conhecimento' })).toBe(true)
  })
  it('expande o intervalo após acerto e reduz após erro', () => {
    const correct = practiceTransition({ resultado: 'acerto', classificacao: 'certeza', tentativas: 3, acertosSeguidos: 3, intervaloDias: 7, fatorFacilidade: 2.5, now: 0 })
    expect(correct.intervaloDias).toBe(18)
    const wrong = practiceTransition({ resultado: 'erro', classificacao: 'duvida', tentativas: 3, acertosSeguidos: 3, intervaloDias: 18, fatorFacilidade: 2.55, now: 0 })
    expect(wrong).toMatchObject({ intervaloDias: 2, lapsos: 1, acertosSeguidos: 0, estado: 'revisao' })
  })

  it('mostra o gabarito comentado depois de todo acerto', () => {
    expect(shouldShowExplanation({ resultado: 'acerto', classificacao: 'certeza' })).toBe(true)
    expect(shouldShowExplanation({ resultado: 'acerto', classificacao: 'eliminacao' })).toBe(true)
  })

  it('nao envia acerto por eliminacao para a fila especial de revisao', () => {
    const result = practiceTransition({ resultado: 'acerto', classificacao: 'eliminacao', now: 0 })
    expect(result).toMatchObject({ estado: 'aprendendo', motivo: null, prioridade: null })
  })
})
