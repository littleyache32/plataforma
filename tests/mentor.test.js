import { describe, expect, it } from 'vitest'
import { buildScenarios, calculateCardRetention, calculateStudyEfficiency, calculateTopicDiagnosis, classifyQuestionAttempts, diversifyPriorities, mentorPhase, scoreboard, topicSignals } from '../shared/mentor.js'

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
  it('nao recomenda antes de 10 respostas', () => {
    const result = calculateTopicDiagnosis(Array.from({ length: 9 }, (_, i) => record('erro', 'certeza', i)))
    expect(result.status).toBe('coletando_dados')
    expect(result.faltam).toBe(1)
  })

  it('prioriza falsa certeza em amostra suficiente', () => {
    const records = Array.from({ length: 10 }, (_, i) => i < 4 ? record('erro', 'certeza', i) : record('acerto', 'duvida', i))
    const result = calculateTopicDiagnosis(records)
    expect(result.status).toBe('prioridade')
    expect(result.falsa_certeza).toBeGreaterThan(30)
    expect(result.probabilidade_dominio).toBeLessThan(50)
    expect(result.versao_politica).toBe('2026.09.21.1')
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

describe('evidencias integradas', () => {
  it('nao conclui retencao nem reage a um unico card', () => {
    const result = calculateCardRetention([{ resultado: 'novamente', criado_em: new Date().toISOString() }])
    expect(result).toMatchObject({ status: 'coletando_dados', amostra: 1, faltam: 4 })
  })

  it('identifica retencao fraca apenas com amostra minima', () => {
    const records = Array.from({ length: 5 }, (_, index) => ({ resultado: index < 2 ? 'novamente' : 'dificil', criado_em: new Date(Date.now() - index * 60000).toISOString() }))
    expect(calculateCardRetention(records).status).toBe('retencao_fraca')
  })

  it('nao usa tempo isolado como sinal de baixa eficiencia', () => {
    const timer = [{ status: 'concluido', segundos_acumulados: 7200 }]
    expect(calculateStudyEfficiency(timer, { status: 'prioridade' }, { status: 'retencao_fraca' })).toMatchObject({ status: 'coletando_dados', sinal_confirmado: false })
  })

  it('cards fracos sem fraqueza em questoes recomendam revisao de cards', () => {
    const signal = topicSignals({ diagnosis: { status: 'estavel', dominio: 80, probabilidade_dominio: 80, falsa_certeza: 0, incerteza_estimativa: 10 }, cardRetention: { status: 'retencao_fraca' } })
    expect(signal.acao_recomendada).toBe('revisar_cards')
  })

  it('diversifica prioridades entre disciplinas', () => {
    const result = diversifyPriorities([
      { id: 'a', materia_id: 'm1', prioridade_calculada: 5 },
      { id: 'b', materia_id: 'm1', prioridade_calculada: 4 },
      { id: 'c', materia_id: 'm2', prioridade_calculada: 3 },
    ], 3, 1)
    expect(result.map((item) => item.id)).toEqual(['a', 'c'])
  })

  it('separa questão inédita, repetição imediata e reteste espaçado', () => {
    const base = new Date('2026-08-01T12:00:00.000Z')
    const attempts = classifyQuestionAttempts([
      { ...record('erro', 'certeza'), questao_id: 'q1', criado_em: base.toISOString() },
      { ...record('acerto', 'certeza'), questao_id: 'q1', criado_em: new Date(base.getTime() + 60 * 60 * 1000).toISOString() },
      { ...record('acerto', 'certeza'), questao_id: 'q1', criado_em: new Date(base.getTime() + 3 * 86_400_000).toISOString() },
    ])
    expect(attempts.filter((item) => item.inedita)).toHaveLength(1)
    expect(attempts.filter((item) => item.reteste_espacado)).toHaveLength(1)
    expect(attempts.find((item) => !item.inedita && !item.reteste_espacado)).toBeTruthy()
  })

  it('não confunde acerto imediato com retenção confirmada', () => {
    const records = Array.from({ length: 10 }, (_, index) => ({
      ...record('acerto', 'certeza', index),
      questao_id: `q${index}`,
    }))
    const result = calculateTopicDiagnosis(classifyQuestionAttempts(records))
    expect(result).toMatchObject({ status: 'coletando_retencao', questoes_ineditas_avaliadas: 10, retestes_espacados: 0, retencao_confirmada: false })
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

describe('buildScenarios', () => {
  it('nao inventa prazo nem capacidade quando faltam dados reais', () => {
    expect(buildScenarios({ coveredTopics: 10, totalTopics: 100 })).toEqual([])
    expect(buildScenarios({ coveredTopics: 10, totalTopics: 100, daysRemaining: 180 })).toEqual([])
  })

  it('projeta cenarios somente com prazo e tempo semanal validos', () => {
    expect(buildScenarios({ coveredTopics: 10, totalTopics: 100, daysRemaining: 180, weeklyMinutes: 600 })).toHaveLength(3)
  })
})

