import { describe, expect, it } from 'vitest'
import { parseJson } from '../api/_lib/gemini.js'
import { normalizeQuestion } from '../api/_lib/questions.js'

const base = { topicoId: 'topic', origem: 'ia', evidencias: [{ id: 1, texto: 'Trecho oficial verificavel.', titulo: 'Fonte oficial', url: 'https://gov.br/fonte' }] }

describe('normalizeQuestion', () => {
  it('aceita CE sem alternativas', () => {
    const result = normalizeQuestion({ tipo: 'CE', enunciado: 'Item.', alternativas: null, gabarito: 'C', explicacao: 'Correto.', evidencia_id: 1, dificuldade: 2 }, base)
    expect(result.alternativas).toBeNull()
    expect(result.fonte).toContain('gov.br')
  })

  it('recusa ME sem as cinco alternativas', () => {
    expect(() => normalizeQuestion({ tipo: 'ME', enunciado: 'Item.', alternativas: { A: 'a' }, gabarito: 'A', explicacao: 'Explica.', evidencia_id: 1, dificuldade: 3 }, base)).toThrow('cinco alternativas')
  })

  it('recusa evidencia inexistente', () => {
    expect(() => normalizeQuestion({ tipo: 'CE', enunciado: 'Item.', alternativas: null, gabarito: 'E', explicacao: 'Explica.', evidencia_id: 99, dificuldade: 3 }, base)).toThrow('evidencia individual')
  })
})

describe('parseJson', () => {
  it('aceita JSON envolvido por texto acidental do modelo', () => {
    expect(parseJson('Aqui esta o resultado:\n{"questoes": []}\nFim.')).toEqual({ questoes: [] })
  })

  it('recusa resposta sem objeto JSON valido', () => {
    expect(() => parseJson('resultado indisponivel')).toThrow('Resposta JSON invalida')
  })
})
