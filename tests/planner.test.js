import { describe, expect, it } from 'vitest'
import { buildMentorWeek, canGenerateMentorWeek, planOverdueMoves } from '../shared/planner.js'

const catalog = [
  { id: 'bacen', tipo: 'concurso', materias: [{ id: 'cont', nome: 'Contabilidade', topicos: [{ id: 'cont-1', nome: 'Balanço' }] }] },
  { id: 'facul', tipo: 'faculdade', materias: [{ id: 'civil', nome: 'Direito Civil', topicos: [{ id: 'civil-1', nome: 'Pessoas' }] }] },
]

describe('buildMentorWeek', () => {
  it('usa somente estudo nas duas primeiras semanas', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog, pendingReviews: 3 })
    expect(result).toHaveLength(21)
    expect(result.every((item) => item.tipo === 'estudo')).toBe(true)
    expect(Math.max(...result.map((item) => item.duracao_estimada))).toBe(60)
  })

  it('mantem tres horas no sabado e domingo sem revisão ou exercícios', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog, pendingReviews: 1 })
    const weekend = result.filter((item) => item.data >= '2026-08-15')
    const totals = weekend.reduce((map, item) => map.set(item.data, (map.get(item.data) || 0) + item.duracao_estimada), new Map())
    expect([...totals.values()]).toEqual([180, 180])
    expect(result.some((item) => item.tipo !== 'estudo')).toBe(false)
  })

  it('mantem exatamente tres horas por dia na fase inicial', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog })
    const total = (day) => result.filter((item) => item.data === day).reduce((sum, item) => sum + item.duracao_estimada, 0)
    expect(total('2026-08-10')).toBe(180)
    expect(total('2026-08-14')).toBe(180)
  })

  it('mantem chaves estaveis para impedir duplicidade ao recarregar', () => {
    const first = buildMentorWeek({ weekStart: '2026-08-10', catalog })
    const second = buildMentorWeek({ weekStart: '2026-08-10', catalog })
    expect(second.map((item) => item.chave_mentor)).toEqual(first.map((item) => item.chave_mentor))
  })

  it('so libera a proxima semana a partir do domingo', () => {
    expect(canGenerateMentorWeek({ weekStart: '2026-08-10', today: '2026-08-07' })).toBe(true)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-17', today: '2026-08-15' })).toBe(false)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-17', today: '2026-08-16' })).toBe(true)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-17', today: '2026-08-18' })).toBe(true)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-03', today: '2026-08-07' })).toBe(false)
  })

  it('constroi base da faculdade e exclui producao de texto', () => {
    const withWriting = [...catalog, { id: 'facul-2', tipo: 'faculdade', materias: [{ id: 'texto', nome: 'Análise e Produção de Texto', topicos: [{ id: 'texto-1', nome: 'Redação' }] }] }]
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog: withWriting })
    const facultyStudy = result.filter((item) => item.tipo === 'estudo' && item.objetivo_id !== 'bacen' && item.data <= '2026-08-13')
    expect(facultyStudy).toHaveLength(4)
    expect(facultyStudy.every((item) => item.titulo.startsWith('Aula dada, aula estudada'))).toBe(true)
    expect(result.some((item) => item.materia_id === 'texto')).toBe(false)
  })

  it('distribui faculdade de segunda a quinta e reserva o restante para BACEN', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog })
    for (let day = 10; day <= 16; day += 1) {
      const items = result.filter((item) => item.data === `2026-08-${day}`)
      expect(items.filter((item) => item.objetivo_id === 'facul').map((item) => item.duracao_estimada)).toEqual(day <= 13 ? [60] : [])
      expect(items.filter((item) => item.objetivo_id === 'bacen').map((item) => item.duracao_estimada)).toEqual(day <= 13 ? [60, 60] : [60, 60, 60])
    }
  })

  it('ativa cards BACEN diariamente e cards da faculdade em dois dias depois da adaptação', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-24', catalog })
    expect(result.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'bacen')).toHaveLength(7)
    expect(result.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'facul')).toHaveLength(2)
  })

  it('respeita as quatro disciplinas fixas da faculdade com uma hora por dia', () => {
    const facultySubjects = [
      ['pessoas', 'Direito das Pessoas e dos Negócios Jurídicos'],
      ['crime', 'Teoria do Crime'],
      ['justica', 'Teorias da Justiça'],
      ['constituicao', 'Teoria da Constituição e Direitos Fundamentais'],
    ].map(([id, nome]) => ({ id, nome, topicos: [{ id: `${id}-1`, nome: 'Conteúdo' }] }))
    const expanded = [catalog[0], { id: 'facul', tipo: 'faculdade', materias: facultySubjects }]
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog: expanded })
    const study = result.filter((item) => item.tipo === 'estudo' && item.objetivo_id === 'facul' && item.data <= '2026-08-13')
    expect(study.map((item) => [item.data, item.materia_id, item.duracao_estimada])).toEqual([
      ['2026-08-10', 'pessoas', 60],
      ['2026-08-11', 'crime', 60],
      ['2026-08-12', 'justica', 60],
      ['2026-08-13', 'constituicao', 60],
    ])
  })

  it('transforma provas e entregas em prioridade com preparacao antecipada', () => {
    const result = buildMentorWeek({
      weekStart: '2026-08-10',
      catalog,
      commitments: [{ id: 'prova-1', objetivo_id: 'facul', materia_id: 'civil', titulo: 'Prova de Direito Civil', tipo: 'prova', data: '2026-08-13', peso: 5, duracao_minutos: 120, concluido: false }],
    })
    const exam = result.find((item) => item.chave_mentor.endsWith('compromisso:prova-1'))
    const preparation = result.find((item) => item.chave_mentor.endsWith('preparo:prova-1'))
    expect(exam).toMatchObject({ data: '2026-08-13', tipo: 'prova', duracao_estimada: 120, prioridade: 1 })
    expect(preparation).toMatchObject({ data: '2026-08-11', tipo: 'revisao', duracao_estimada: 90, materia_id: 'civil' })
  })

  it('remaneja toda pendencia vencida, inclusive entre semanas', () => {
    const moves = planOverdueMoves([
      { id: 'alta', data: '2026-08-10', status: 'planejada', prioridade: 1, duracao_estimada: 60 },
      { id: 'manual', data: '2026-08-10', status: 'planejada', prioridade: 1, duracao_estimada: 60, movida_em: '2026-08-10T12:00:00Z' },
      { id: 'feita', data: '2026-08-10', status: 'feita', prioridade: 1, duracao_estimada: 60 },
      { id: 'carga', data: '2026-08-12', status: 'planejada', prioridade: 2, duracao_estimada: 240 },
    ], '2026-08-12', '2026-08-16')
    expect(moves).toEqual([{ id: 'alta', data: '2026-08-13' }, { id: 'manual', data: '2026-08-14' }])
  })

  it('atribui uma ordem estavel para cada demanda dentro do dia', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog })
    const monday = result.filter((item) => item.data === '2026-08-10')
    expect(monday.map((item) => item.ordem)).toEqual([0, 1, 2])
  })

  it('prioriza topico fraco na recalibracao diaria', () => {
    const expanded = [{ id: 'bacen', tipo: 'concurso', materias: [{ id: 'cont', nome: 'Contabilidade', topicos: [{ id: 'forte', nome: 'Fortes' }, { id: 'fraco', nome: 'Fracos' }] }] }]
    const result = buildMentorWeek({ weekStart: '2026-08-10', catalog: expanded, priorities: [{ id: 'fraco' }] })
    expect(result.some((item) => item.topico_id === 'fraco')).toBe(true)
  })
})
