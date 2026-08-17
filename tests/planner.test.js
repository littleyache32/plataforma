import { describe, expect, it } from 'vitest'
import { adherenceAdjustment, buildMentorWeek, canGenerateMentorWeek, planOverdueMoves, validateMentorPlan, weeklyLoadProfile } from '../shared/planner.js'

const catalog = [
  { id: 'bacen', tipo: 'concurso', materias: [{ id: 'cont', nome: 'Contabilidade', topicos: [{ id: 'cont-1', nome: 'Balanço' }] }] },
  { id: 'facul', tipo: 'faculdade', materias: [{ id: 'civil', nome: 'Direito Civil', topicos: [{ id: 'civil-1', nome: 'Pessoas' }] }] },
]

describe('buildMentorWeek', () => {
  it('inicia com dois blocos de Faculdade e dois de BACEN nos dias uteis, sem pratica', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog, pendingReviews: 3 })
    expect(result).toHaveLength(24)
    expect(result.every((item) => item.tipo === 'estudo')).toBe(true)
    expect(result.some((item) => item.tipo === 'exercicio' || item.objetivo_id === 'bacen' && item.tipo === 'especial')).toBe(false)
    expect(Math.max(...result.map((item) => item.duracao_estimada))).toBe(50)
  })

  it('limita sabado e domingo a duas horas na primeira semana', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog, pendingReviews: 1 })
    const weekend = result.filter((item) => item.data >= '2026-08-22')
    const totals = weekend.reduce((map, item) => map.set(item.data, (map.get(item.data) || 0) + item.duracao_estimada), new Map())
    expect([...totals.values()]).toEqual([100, 100])
    expect(weekend.every((item) => item.objetivo_id === 'bacen')).toBe(true)
  })

  it('reserva dois blocos para faculdade e dois para BACEN de segunda a sexta', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog })
    const total = (day) => result.filter((item) => item.data === day).reduce((sum, item) => sum + item.duracao_estimada, 0)
    expect(total('2026-08-17')).toBe(200)
    expect(total('2026-08-21')).toBe(200)
    expect(total('2026-08-23')).toBe(100)
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
    expect(facultyStudy).toHaveLength(8)
    expect(facultyStudy.every((item) => /Recuperar conteúdo atrasado|Continuar recuperação/.test(item.titulo))).toBe(true)
    expect(facultyStudy.every((item) => item.topico_id === null)).toBe(true)
    expect(result.some((item) => item.materia_id === 'texto')).toBe(false)
  })

  it('distribui faculdade de segunda a sexta e reserva o restante para BACEN', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog })
    for (let day = 17; day <= 23; day += 1) {
      const items = result.filter((item) => item.data === `2026-08-${day}`)
      expect(items.filter((item) => item.objetivo_id === 'facul').map((item) => item.duracao_estimada)).toEqual(day <= 21 ? [50, 50] : [])
      expect(items.filter((item) => item.objetivo_id === 'bacen').map((item) => item.duracao_estimada)).toEqual([50, 50])
    }
  })

  it('ativa exatamente trinta minutos de cards por dia depois da segunda semana', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-31', catalog })
    expect(result.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'bacen')).toHaveLength(5)
    expect(result.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'facul')).toHaveLength(2)
    expect(result.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'facul').map((item) => item.data)).toEqual(['2026-09-05', '2026-09-06'])
    expect(result.filter((item) => item.tipo === 'especial').every((item) => item.duracao_estimada === 30)).toBe(true)
  })

  it('transforma questões com revisão prevista em demanda do mentor', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-31', catalog, scheduledQuestionReviews: [{ dueDate: '2026-09-02', topicId: 'cont-1', count: 7 }] })
    expect(result).toContainEqual(expect.objectContaining({ data: '2026-09-02', topico_id: 'cont-1', tipo: 'revisao', duracao_estimada: 50, titulo: expect.stringContaining('7 questões') }))
  })

  it('respeita as quatro disciplinas fixas da faculdade com dois blocos durante a recuperacao', () => {
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
      ['2026-08-17', 'pessoas', 50], ['2026-08-17', 'pessoas', 50],
      ['2026-08-18', 'crime', 50], ['2026-08-18', 'crime', 50],
      ['2026-08-19', 'justica', 50], ['2026-08-19', 'justica', 50],
      ['2026-08-20', 'constituicao', 50], ['2026-08-20', 'constituicao', 50],
    ])
  })

  it('reduz a faculdade para um bloco quando o mentorado informa que esta em dia', () => {
    const result = buildMentorWeek({
      weekStart: '2026-08-17',
      catalog,
      weeklyMeeting: { classificacoes: ['faculdade_em_dia'] },
    })
    const monday = result.filter((item) => item.data === '2026-08-17')
    expect(monday.filter((item) => item.objetivo_id === 'facul')).toHaveLength(1)
    expect(monday.filter((item) => item.objetivo_id === 'bacen')).toHaveLength(2)
    expect(monday.find((item) => item.objetivo_id === 'facul')).toMatchObject({ topico_id: null, titulo: expect.stringContaining('Aula dada, aula estudada') })
    expect(monday.reduce((sum, item) => sum + item.duracao_estimada, 0)).toBe(150)
  })

  it('mantem a recuperacao acumulada depois da fase inicial enquanto a faculdade estiver atrasada', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-31', catalog, weeklyMeeting: { classificacoes: ['faculdade_atrasada'] } })
    const faculty = result.filter((item) => item.data === '2026-08-31' && item.objetivo_id === 'facul' && item.tipo === 'estudo')
    expect(faculty).toHaveLength(2)
    expect(faculty.every((item) => item.topico_id === null && /conteúdo atrasado/.test(item.titulo))).toBe(true)
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
    expect(preparation).toMatchObject({ data: '2026-08-18', tipo: 'estudo', duracao_estimada: 100, materia_id: 'civil' })
    const bacenOnPreparationDay = result.filter((item) => item.data === '2026-08-18' && item.objetivo_id === 'bacen')
    expect(bacenOnPreparationDay).toHaveLength(2)
  })

  it('prepara compromisso pelo topico explicitamente vinculado', () => {
    const expanded = [{ id: 'facul', tipo: 'faculdade', materias: [{ id: 'civil', nome: 'Direito Civil', topicos: [{ id: 'pessoas', nome: 'Pessoas' }, { id: 'negocios', nome: 'Negócios jurídicos' }] }] }]
    const result = buildMentorWeek({
      weekStart: '2026-09-07',
      catalog: expanded,
      commitments: [{ id: 'prova-2', objetivo_id: 'facul', materia_id: 'civil', titulo: 'Prova', tipo: 'prova', data: '2026-09-10', peso: 5, duracao_minutos: 120, concluido: false, topicos: [{ topico_id: 'negocios' }] }],
    })
    expect(result.find((item) => item.chave_mentor.endsWith('preparo:prova-2'))).toMatchObject({ topico_id: 'negocios' })
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

  it('uma amostra ruim nao domina toda a agenda de pratica', () => {
    const expanded = [{ id: 'bacen', tipo: 'concurso', materias: [{ id: 'cont', nome: 'Contabilidade', topicos: [{ id: 'fraco', nome: 'Fraco' }, { id: 'outro', nome: 'Outro' }] }] }]
    const result = buildMentorWeek({ weekStart: '2026-09-07', catalog: expanded, priorities: [{ id: 'fraco', prioridade_calculada: 9 }] })
    const practice = result.filter((item) => item.chave_mentor.includes('questoes-bacen'))
    expect(practice.filter((item) => item.topico_id === 'fraco').length).toBeLessThan(practice.length)
    expect(practice.some((item) => item.topico_id === 'outro')).toBe(true)
  })

  it('reduz apenas o estudo BACEN quando a aderencia fica abaixo de 70%', () => {
    const result = buildMentorWeek({
      weekStart: '2026-08-31',
      catalog,
      adherenceHistory: [{ inicio: '2026-08-24', planejadas: 10, concluidas: 6 }],
    })
    expect(adherenceAdjustment([{ planejadas: 10, concluidas: 6 }]).nivel).toBe('reduzir')
    const totals = result.reduce((map, item) => map.set(item.data, (map.get(item.data) || 0) + item.duracao_estimada), new Map())
    expect(Math.max(...totals.values())).toBeLessThanOrEqual(230)
    expect(result.filter((item) => item.tipo === 'especial' && item.objetivo_id === 'bacen')).toHaveLength(5)
    expect(result.filter((item) => item.chave_mentor.includes('questoes-bacen'))).toHaveLength(7)
  })

  it('aumenta o estudo BACEN somente apos duas semanas com pelo menos 85%', () => {
    const oneWeek = adherenceAdjustment([{ planejadas: 10, concluidas: 9 }])
    const twoWeeks = [{ planejadas: 10, concluidas: 9, media_segunda_sexta: 180, media_real_segunda_sexta: 240 }, { planejadas: 12, concluidas: 11, media_segunda_sexta: 180, media_real_segunda_sexta: 240 }]
    const result = buildMentorWeek({ weekStart: '2026-09-07', catalog, adherenceHistory: twoWeeks })
    expect(oneWeek.nivel).toBe('manter')
    expect(adherenceAdjustment(twoWeeks).nivel).toBe('aumentar')
    const monday = result.filter((item) => item.data === '2026-09-07').reduce((sum, item) => sum + item.duracao_estimada, 0)
    expect(monday).toBe(280)
  })

  it('usa o encontro semanal apenas como freio conservador de carga', () => {
    const sustainable = [{ planejadas: 10, concluidas: 9, media_segunda_sexta: 180, media_real_segunda_sexta: 240 }, { planejadas: 10, concluidas: 9, media_segunda_sexta: 180, media_real_segunda_sexta: 240 }]
    expect(adherenceAdjustment([], { carga_percebida: 'leve' }).nivel).toBe('manter')
    expect(adherenceAdjustment(sustainable, { carga_percebida: 'leve' }).nivel).toBe('aumentar')
    expect(adherenceAdjustment(sustainable, { carga_percebida: 'pesada' })).toMatchObject({ nivel: 'reduzir', motivo: 'encontro_semanal_indica_sobrecarga' })
  })

  it('mantem quatro blocos nos dias uteis e dois no fim de semana na segunda semana', () => {
    const result = buildMentorWeek({
      weekStart: '2026-08-24',
      catalog,
      adherenceHistory: [{ planejadas: 21, concluidas: 2 }],
    })
    const totals = result.reduce((map, item) => map.set(item.data, (map.get(item.data) || 0) + item.duracao_estimada), new Map())
    expect([...totals.values()]).toEqual([200, 200, 200, 200, 200, 100, 100])
    expect(result.every((item) => item.tipo === 'estudo')).toBe(true)
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
    expect(bacenStudy).toHaveLength(14)
    expect(new Set(bacenStudy.map((item) => item.topico_id)).size).toBe(14)
  })

  it('aumenta a carga total em uma hora somente com duas semanas sustentaveis', () => {
    const history = [
      { planejadas: 10, concluidas: 9, minutos_planejados: 600, minutos_concluidos: 540, media_segunda_sexta: 180, media_real_segunda_sexta: 240, pendencias: 1 },
      { planejadas: 10, concluidas: 9, minutos_planejados: 600, minutos_concluidos: 540, media_segunda_sexta: 180, media_real_segunda_sexta: 240, pendencias: 1 },
    ]
    expect(weeklyLoadProfile('2026-09-07', history)).toMatchObject({ segunda_sexta: 250, sabado: 150, domingo: 150, nivel: 'aumentar' })
  })

  it('nao aumenta carga com acumulo e nao aplica teto fixo', () => {
    const backlog = [
      { planejadas: 10, concluidas: 9, media_segunda_sexta: 420, pendencias: 1 },
      { planejadas: 10, concluidas: 9, media_segunda_sexta: 420, pendencias: 4 },
    ]
    expect(weeklyLoadProfile('2026-09-07', backlog)).toMatchObject({ segunda_sexta: 400, sabado: 250, domingo: 250, nivel: 'manter' })
  })

  it('limita a tres pendencias transferidas e nao estoura a capacidade diaria', () => {
    const overdue = Array.from({ length: 6 }, (_, index) => ({ id: `p${index}`, data: '2026-08-10', status: 'planejada', prioridade: 1, duracao_estimada: 30 }))
    const moves = planOverdueMoves(overdue, '2026-08-12', '2026-08-16')
    expect(moves).toHaveLength(3)
  })

  it('bloqueia duplicidade e so aplica teto quando ele for explicitamente fornecido', () => {
    expect(validateMentorPlan([{ chave_mentor: 'a', data: '2026-09-01', duracao_estimada: 60 }, { chave_mentor: 'a', data: '2026-09-01', duracao_estimada: 60 }]).reason).toBe('demanda_duplicada')
    expect(validateMentorPlan([{ chave_mentor: 'a', data: '2026-09-01', duracao_estimada: 300 }, { chave_mentor: 'b', data: '2026-09-01', duracao_estimada: 200 }]).valid).toBe(true)
    expect(validateMentorPlan([{ chave_mentor: 'a', data: '2026-09-01', duracao_estimada: 300 }, { chave_mentor: 'b', data: '2026-09-01', duracao_estimada: 200 }], { dailyLimit: 480 }).reason).toBe('limite_diario_excedido')
  })
})
