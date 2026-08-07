import { describe, expect, it } from 'vitest'
import { calculateTopicDiagnosis, scoreboard } from '../shared/mentor.js'

function record(resultado, classificacao, index = 0) {
  return { resultado, classificacao, criado_em: new Date(Date.now() - index * 60000).toISOString() }
}

describe('scoreboard', () => {
  it('calcula acerto bruto, dominio e falsa certeza separadamente', () => {
    const result = scoreboard([
      record('acerto', 'certeza'),
      record('acerto', 'eliminacao'),
      record('erro', 'certeza'),
      record('erro', 'duvida'),
    ])
    expect(result).toEqual({ total: 4, acerto_bruto: 50, acerto_com_certeza: 25, falsa_certeza: 25 })
  })
})

describe('calculateTopicDiagnosis', () => {
  it('nao recomenda antes de 20 respostas', () => {
    const result = calculateTopicDiagnosis(Array.from({ length: 19 }, (_, i) => record('erro', 'certeza', i)))
    expect(result.status).toBe('coletando_dados')
    expect(result.faltam).toBe(1)
  })

  it('prioriza falsa certeza em amostra suficiente', () => {
    const records = Array.from({ length: 20 }, (_, i) => i < 8 ? record('erro', 'certeza', i) : record('acerto', 'duvida', i))
    const result = calculateTopicDiagnosis(records)
    expect(result.status).toBe('prioridade')
    expect(result.falsa_certeza).toBeGreaterThan(30)
  })

  it('reduz prioridade quando as respostas recentes mostram melhora real', () => {
    const records = [
      ...Array.from({ length: 5 }, (_, i) => record('acerto', 'certeza', i)),
      ...Array.from({ length: 5 }, (_, i) => record('erro', 'duvida', i + 5)),
      ...Array.from({ length: 10 }, (_, i) => record('erro', 'duvida', i + 10)),
    ]
    expect(calculateTopicDiagnosis(records).status).toBe('melhorando')
  })
})

