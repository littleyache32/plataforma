import { describe, expect, it } from 'vitest'
import { adherenceAdjustment, buildMentorWeek, canGenerateMentorWeek, planOverdueMoves, validateMentorPlan } from '../shared/planner.js'

const catalog = [
  { id: 'bacen', tipo: 'concurso', materias: [{ id: 'cont', nome: 'Contabilidade', topicos: [{ id: 'cont-1', nome: 'Balanço' }] }] },
  { id: 'facul', tipo: 'faculdade', materias: [{ id: 'civil', nome: 'Direito Civil', topicos: [{ id: 'civil-1', nome: 'Pessoas' }] }] },
]

describe('buildMentorWeek', () => {
  it('usa três horas de BACEN por dia e somente os cards de faculdade autorizados na fase inicial', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog, pendingReviews: 3 })
    expect(result).toHaveLength(27)
    expect(result.filter((item) => item.tipo === 'estudo')).toHaveLength(25)
    expect(result.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'facul')).toHaveLength(2)
    expect(result.some((item) => item.tipo === 'exercicio' || item.objetivo_id === 'bacen' && item.tipo === 'especial')).toBe(false)
    expect(Math.max(...result.map((item) => item.duracao_estimada))).toBe(60)
  })

  it('mantem três horas de BACEN e trinta minutos de cards da faculdade no sábado e domingo', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog, pendingReviews: 1 })
    const weekend = result.filter((item) => item.data >= '2026-08-22')
    const totals = weekend.reduce((map, item) => map.set(item.data, (map.get(item.data) || 0) + item.duracao_estimada), new Map())
    expect([...totals.values()]).toEqual([210, 210])
    expect(weekend.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'facul')).toHaveLength(2)
  })

  it('soma uma hora de faculdade de segunda a quinta sem reduzir as três horas do BACEN', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog })
    const total = (day) => result.filter((item) => item.data === day).reduce((sum, item) => sum + item.duracao_estimada, 0)
    expect(total('2026-08-17')).toBe(240)
    expect(total('2026-08-21')).toBe(180)
    expect(total('2026-08-23')).toBe(210)
  })

  it('mantem chaves estaveis para impedir duplicidade ao recarregar', () => {
    const first = buildMentorWeek({ weekStart: '2026-08-17', catalog })
    const second = buildMentorWeek({ weekStart: '2026-08-17', catalog })
    expect(second.map((item) => item.chave_mentor)).toEqual(first.map((item) => item.chave_mentor))
  })

  it('so libera a proxima semana a partir do domingo', () => {
    expect(canGenerateMentorWeek({ weekStart: '2026-08-17', today: '2026-08-16' })).toBe(true)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-17', today: '2026-08-15' })).toBe(false)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-17', today: '2026-08-16' })).toBe(true)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-17', today: '2026-08-18' })).toBe(true)
    expect(canGenerateMentorWeek({ weekStart: '2026-08-03', today: '2026-08-07' })).toBe(false)
  })

  it('constroi base da faculdade e exclui producao de texto', () => {
    const withWriting = [...catalog, { id: 'facul-2', tipo: 'faculdade', materias: [{ id: 'texto', nome: 'Análise e Produção de Texto', topicos: [{ id: 'texto-1', nome: 'Redação' }] }] }]
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog: withWriting })
    const facultyStudy = result.filter((item) => item.tipo === 'estudo' && item.objetivo_id !== 'bacen' && item.data <= '2026-08-20')
    expect(facultyStudy).toHaveLength(4)
    expect(facultyStudy.every((item) => item.titulo.startsWith('Aula dada, aula estudada'))).toBe(true)
    expect(result.some((item) => item.materia_id === 'texto')).toBe(false)
  })

  it('distribui faculdade de segunda a quinta e reserva o restante para BACEN', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog })
    for (let day = 17; day <= 23; day += 1) {
      const items = result.filter((item) => item.data === `2026-08-${day}`)
      expect(items.filter((item) => item.objetivo_id === 'facul').map((item) => item.duracao_estimada)).toEqual(day <= 20 ? [60] : day >= 22 ? [30] : [])
      expect(items.filter((item) => item.objetivo_id === 'bacen').map((item) => item.duracao_estimada)).toEqual([60, 60, 60])
    }
  })

  it('ativa cards BACEN diariamente e cards da faculdade em dois dias depois da adaptação', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-31', catalog })
    expect(result.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'bacen')).toHaveLength(7)
    expect(result.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'facul')).toHaveLength(2)
    expect(result.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'facul').map((item) => item.data)).toEqual(['2026-09-05', '2026-09-06'])
  })

  it('transforma questões com revisão prevista em demanda do mentor', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-31', catalog, scheduledQuestionReviews: [{ dueDate: '2026-09-02', topicId: 'cont-1', count: 7 }] })
    expect(result).toContainEqual(expect.objectContaining({ data: '2026-09-02', topico_id: 'cont-1', tipo: 'revisao', duracao_estimada: 30, titulo: expect.stringContaining('7 questões') }))
  })

  it('respeita as quatro disciplinas fixas da faculdade com uma hora por dia', () => {
    const facultySubjects = [
      ['pessoas', 'Direito das Pessoas e dos Negócios Jurídicos'],
      ['crime', 'Teoria do Crime'],
      ['justica', 'Teorias da Justiça'],
      ['constituicao', 'Teoria da Constituição e Direitos Fundamentais'],
    ].map(([id, nome]) => ({ id, nome, topicos: [{ id: `${id}-1`, nome: 'Conteúdo' }] }))
    const expanded = [catalog[0], { id: 'facul', tipo: 'faculdade', materias: facultySubjects }]
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog: expanded })
    const study = result.filter((item) => item.tipo === 'estudo' && item.objetivo_id === 'facul' && item.data <= '2026-08-20')
    expect(study.map((item) => [item.data, item.materia_id, item.duracao_estimada])).toEqual([
      ['2026-08-17', 'pessoas', 60],
      ['2026-08-18', 'crime', 60],
      ['2026-08-19', 'justica', 60],
      ['2026-08-20', 'constituicao', 60],
    ])
  })

  it('transforma provas e entregas em prioridade com preparacao antecipada', () => {
    const result = buildMentorWeek({
      weekStart: '2026-08-17',
      catalog,
      commitments: [{ id: 'prova-1', objetivo_id: 'facul', materia_id: 'civil', titulo: 'Prova de Direito Civil', tipo: 'prova', data: '2026-08-20', peso: 5, duracao_minutos: 120, concluido: false }],
    })
    const exam = result.find((item) => item.chave_mentor.endsWith('compromisso:prova-1'))
    const preparation = result.find((item) => item.chave_mentor.endsWith('preparo:prova-1'))
    expect(exam).toMatchObject({ data: '2026-08-20', tipo: 'prova', duracao_estimada: 120, prioridade: 1 })
    expect(preparation).toMatchObject({ data: '2026-08-18', tipo: 'revisao', duracao_estimada: 90, materia_id: 'civil' })
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
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog })
    const monday = result.filter((item) => item.data === '2026-08-17')
    expect(monday.map((item) => item.ordem)).toEqual([0, 1, 2, 3])
  })

  it('prioriza topico fraco na recalibracao diaria', () => {
    const expanded = [{ id: 'bacen', tipo: 'concurso', materias: [{ id: 'cont', nome: 'Contabilidade', topicos: [{ id: 'forte', nome: 'Fortes' }, { id: 'fraco', nome: 'Fracos' }] }] }]
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog: expanded, priorities: [{ id: 'fraco' }] })
    expect(result.some((item) => item.topico_id === 'fraco')).toBe(true)
  })

  it('reduz apenas o estudo BACEN quando a aderencia fica abaixo de 70%', () => {
    const result = buildMentorWeek({
      weekStart: '2026-08-31',
      catalog,
      adherenceHistory: [{ inicio: '2026-08-24', planejadas: 10, concluidas: 6 }],
    })
    expect(adherenceAdjustment([{ planejadas: 10, concluidas: 6 }]).nivel).toBe('reduzir')
    expect(result.filter((item) => item.chave_mentor.includes('estudo-bacen')).every((item) => item.duracao_estimada === 30)).toBe(true)
    expect(result.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'bacen')).toHaveLength(7)
    expect(result.filter((item) => item.chave_mentor.includes('questoes-bacen'))).toHaveLength(7)
  })

  it('aumenta o estudo BACEN somente apos duas semanas com pelo menos 85%', () => {
    const oneWeek = adherenceAdjustment([{ planejadas: 10, concluidas: 9 }])
    const twoWeeks = [{ planejadas: 10, concluidas: 9 }, { planejadas: 12, concluidas: 11 }]
    const result = buildMentorWeek({ weekStart: '2026-08-31', catalog, adherenceHistory: twoWeeks })
    expect(oneWeek.nivel).toBe('manter')
    expect(adherenceAdjustment(twoWeeks).nivel).toBe('aumentar')
    expect(result.filter((item) => item.chave_mentor.includes('estudo-bacen')).every((item) => item.duracao_estimada === 90)).toBe(true)
  })

  it('nao altera a carga fixa das duas semanas iniciais por causa da aderencia', () => {
    const result = buildMentorWeek({
      weekStart: '2026-08-24',
      catalog,
      adherenceHistory: [{ planejadas: 21, concluidas: 2 }],
    })
    const totals = result.reduce((map, item) => map.set(item.data, (map.get(item.data) || 0) + item.duracao_estimada), new Map())
    expect([...totals.values()]).toEqual([240, 240, 240, 240, 180, 210, 210])
    expect(result.filter((item) => item.tipo === 'especial').every((item) => item.objetivo_id === 'facul')).toBe(true)
  })

  it('planeja questões e cards BACEN somente para tópicos já estudados', () => {
    const expanded = [{ id: 'bacen', tipo: 'concurso', materias: [{ id: 'cont', nome: 'Contabilidade', topicos: [{ id: 'estudado', nome: 'Estudado' }, { id: 'avancado', nome: 'Avançado' }] }] }, catalog[1]]
    const result = buildMentorWeek({ weekStart: '2026-08-31', catalog: expanded, studiedTopicIds: ['estudado'] })
    const practice = result.filter((item) => item.objetivo_id === 'bacen' && ['especial', 'exercicio'].includes(item.tipo))
    expect(practice.length).toBeGreaterThan(0)
    expect(practice.every((item) => item.topico_id === 'estudado')).toBe(true)
  })

  it('maximiza tópicos BACEN diferentes durante a construção inicial da base', () => {
    const subjects = Array.from({ length: 7 }, (_, subject) => ({ id: `m${subject}`, nome: `Matéria ${subject}`, topicos: Array.from({ length: 3 }, (_, topic) => ({ id: `m${subject}-t${topic}`, nome: `Tópico ${topic}` })) }))
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog: [{ id: 'bacen', tipo: 'concurso', materias: subjects }, catalog[1]] })
    const bacenStudy = result.filter((item) => item.objetivo_id === 'bacen' && item.tipo === 'estudo')
    expect(bacenStudy).toHaveLength(21)
    expect(new Set(bacenStudy.map((item) => item.topico_id)).size).toBe(21)
  })

  it('limita a tres pendencias transferidas e nao estoura a capacidade diaria', () => {
    const overdue = Array.from({ length: 6 }, (_, index) => ({ id: `p${index}`, data: '2026-08-10', status: 'planejada', prioridade: 1, duracao_estimada: 30 }))
    const moves = planOverdueMoves(overdue, '2026-08-12', '2026-08-16')
    expect(moves).toHaveLength(3)
  })

  it('bloqueia chaves duplicadas e carga acima do limite diario', () => {
    expect(validateMentorPlan([{ chave_mentor: 'a', data: '2026-09-01', duracao_estimada: 60 }, { chave_mentor: 'a', data: '2026-09-01', duracao_estimada: 60 }]).reason).toBe('demanda_duplicada')
    expect(validateMentorPlan([{ chave_mentor: 'a', data: '2026-09-01', duracao_estimada: 300 }, { chave_mentor: 'b', data: '2026-09-01', duracao_estimada: 200 }]).reason).toBe('limite_diario_excedido')
  })
})
