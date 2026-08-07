import { describe, expect, it } from 'vitest'
import { normalizeQuestion } from '../api/_lib/questions.js'

const base = { topicoId: 'topic', origem: 'ia', sources: [{ titulo: 'Fonte oficial', url: 'https://gov.br/fonte' }] }

describe('normalizeQuestion', () => {
  it('aceita CE sem alternativas', () => {
    const result = normalizeQuestion({ tipo: 'CE', enunciado: 'Item.', alternativas: null, gabarito: 'C', explicacao: 'Correto.', trecho_fonte: 'Trecho.' }, base)
    expect(result.alternativas).toBeNull()
    expect(result.fonte).toContain('gov.br')
  })

  it('recusa ME sem as cinco alternativas', () => {
    expect(() => normalizeQuestion({ tipo: 'ME', enunciado: 'Item.', alternativas: { A: 'a' }, gabarito: 'A', explicacao: 'Explica.', trecho_fonte: 'Trecho.' }, base)).toThrow('cinco alternativas')
  })
})
