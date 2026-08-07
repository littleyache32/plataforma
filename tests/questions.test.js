import { describe, expect, it } from 'vitest'
import { normalizeQuestion } from '../api/_lib/questions.js'

const base = { topicoId: 'topic', origem: 'ia', evidencias: [{ id: 1, texto: 'Trecho oficial verificavel.', titulo: 'Fonte oficial', url: 'https://gov.br/fonte' }] }

describe('normalizeQuestion', () => {
  it('aceita CE sem alternativas', () => {
    const result = normalizeQuestion({ tipo: 'CE', enunciado: 'Item.', alternativas: null, gabarito: 'C', explicacao: 'Correto.', evidencia_id: 1 }, base)
    expect(result.alternativas).toBeNull()
    expect(result.fonte).toContain('gov.br')
  })

  it('recusa ME sem as cinco alternativas', () => {
    expect(() => normalizeQuestion({ tipo: 'ME', enunciado: 'Item.', alternativas: { A: 'a' }, gabarito: 'A', explicacao: 'Explica.', evidencia_id: 1 }, base)).toThrow('cinco alternativas')
  })

  it('recusa evidencia inexistente', () => {
    expect(() => normalizeQuestion({ tipo: 'CE', enunciado: 'Item.', alternativas: null, gabarito: 'E', explicacao: 'Explica.', evidencia_id: 99 }, base)).toThrow('evidencia individual')
  })
})
