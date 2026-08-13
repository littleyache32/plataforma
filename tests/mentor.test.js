import { describe, expect, it } from 'vitest'
import { calculateTopicDiagnosis, mentorPhase, scoreboard } from '../shared/mentor.js'

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
    expect(result.probabilidade_dominio).toBeLessThan(50)
    expect(result.versao_politica).toBe('2026.08.2')
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

describe('mentorPhase', () => {
  it('nao cria uma fase de pratica antes do inicio da mentoria', () => {
    expect(mentorPhase('2026-08-12').id).toBe('aguardando_inicio')
  })
  it('mantem as duas primeiras semanas exclusivamente para construcao da base', () => {
    expect(mentorPhase('2026-08-17').id).toBe('construcao_base')
    expect(mentorPhase('2026-08-23').descricao).toContain('sem questões')
  })

  it('libera a preparacao adaptativa a partir de setembro', () => {
    expect(mentorPhase('2026-09-07').id).toBe('adaptativa')
  })
})

