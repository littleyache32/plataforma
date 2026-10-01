import { describe, expect, it } from 'vitest'
import { adherenceAdjustment, buildMentorWeek, canGenerateMentorWeek, completedMaterialIdsFromProgress, currentPhaseCarryover, dailyCapacity, equivalentActiveDemand, planOverdueMoves, practiceEligibility, reconcileMentorDemands, validateMentorPlan, weeklyLoadProfile } from '../shared/planner.js'

const catalog = [
  { id: 'bacen', tipo: 'concurso', materias: [{ id: 'cont', nome: 'Contabilidade', topicos: [{ id: 'cont-1', nome: 'Balanço' }] }] },
  { id: 'facul', tipo: 'faculdade', materias: [{ id: 'civil', nome: 'Direito Civil', topicos: [{ id: 'civil-1', nome: 'Pessoas' }] }] },
]

const currentContext = {
  fase: 'construcao_habito_base_teorica', vigente_desde: '2026-09-24', semana_inicio: '2026-09-28',
  carga_atual: { blocos_dia: 3, concurso: 2, faculdade: 1, minutos_bloco: 50 },
}
const newCycleContext = {
  fase: 'adaptacao_teorica_1', vigente_desde: '2026-10-02', semana_inicio: '2026-10-02',
  carga_atual: { concurso: 3, faculdade: 1, minutos_bloco: 50 },
}

describe('buildMentorWeek', () => {
  it('não reconstrói dias antes de 02/10 e aplica 2+1 até 08/10', () => {
    const result = buildMentorWeek({ weekStart: '2026-09-28', catalog, menteeContext: newCycleContext, commitments: [{ id: 'prova-1', objetivo_id: 'facul', materia_id: 'civil', titulo: 'Prova 01/10', tipo: 'prova', data: '2026-10-01', peso: 5, duracao_minutos: 90 }] })
    expect(result).toHaveLength(9)
    expect(result.every((item) => item.data >= '2026-10-02' && item.tipo === 'estudo' && item.duracao_estimada === 50)).toBe(true)
    for (const date of ['2026-10-02', '2026-10-03', '2026-10-04']) {
      expect(result.filter((item) => item.data === date && item.objetivo_id === 'bacen')).toHaveLength(2)
      expect(result.filter((item) => item.data === date && item.objetivo_id === 'facul')).toHaveLength(1)
    }
  })
  it('aplica 3+1 de 09/10 a 15/10 sem prática, e mantém a mesma aula até conclusão explícita', () => {
    const studyUnits = [
      { id: 'aula-1', objectiveId: 'bacen', context: 'concurso', subjectId: 'cont', subject: 'Contabilidade', name: 'Aula 1.pdf', order: 1 },
      { id: 'aula-2', objectiveId: 'bacen', context: 'concurso', subjectId: 'cont', subject: 'Contabilidade', name: 'Aula 2.pdf', order: 2 },
    ]
    const result = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext, studyUnits })
    expect(result.filter((item) => item.data === '2026-10-08')).toHaveLength(3)
    for (const date of ['2026-10-09', '2026-10-10', '2026-10-11']) {
      expect(result.filter((item) => item.data === date)).toHaveLength(4)
    }
    expect(result.filter((item) => item.objetivo_id === 'bacen').every((item) => item.material_id === 'aula-1')).toBe(true)
    expect(result.every((item) => item.tipo === 'estudo' && item.duracao_estimada === 50)).toBe(true)
    const advanced = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext, studyUnits, completedMaterialIds: ['aula-1'] })
    expect(advanced.filter((item) => item.objetivo_id === 'bacen').every((item) => item.material_id === 'aula-2')).toBe(true)
  })
  it('separa carga planejada de capacidade e não inventa aula presencial de sexta a domingo', () => {
    const first = buildMentorWeek({ weekStart: '2026-09-28', catalog, menteeContext: newCycleContext })
    const second = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext })
    for (const date of ['2026-10-02', '2026-10-03', '2026-10-04', '2026-10-09', '2026-10-10', '2026-10-11']) {
      const items = [...first, ...second].filter((item) => item.data === date)
      const capacity = dailyCapacity(date, items.length)
      expect(capacity.academicAvailability).toBe('NON_CLASS_DAY')
      expect(items.find((item) => item.objetivo_id === 'facul').titulo).toMatch(/^Estudo:/)
      expect(items.find((item) => item.objetivo_id === 'facul').titulo).not.toMatch(/aula dada|aula estudada|aula de sexta|aula de sábado|aula de domingo/i)
      expect(items).toHaveLength(date < '2026-10-09' ? 3 : 4)
      expect(capacity.max_blocks).toBe(date.endsWith('03') || date.endsWith('10') ? 5 : date.endsWith('04') || date.endsWith('11') ? 4 : 9)
      expect(capacity.scheduled_blocks).toBeLessThanOrEqual(capacity.max_blocks)
    }
    expect(dailyCapacity('2026-10-05').academicAvailability).toBe('CLASS_DAY')
    expect(validateMentorPlan(second).valid).toBe(true)
  })
  it('só associa uma demanda à aula presencial realmente registrada e ainda não estudada', () => {
    const known = [{ date: '2026-10-05', subjectId: 'civil', content: 'Pessoas naturais', studied: false }]
    const withClass = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext, academicClasses: known })
    expect(withClass.find((item) => item.data === '2026-10-05' && item.objetivo_id === 'facul').titulo).toContain('aula ministrada em 2026-10-05: Pessoas naturais')
    const studied = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext, academicClasses: [{ ...known[0], studied: true }] })
    expect(studied.find((item) => item.data === '2026-10-05' && item.objetivo_id === 'facul').titulo).toMatch(/^Estudo:/)
  })
  it('não transforma faltas da semana ou de sábado em blocos extras de fim de semana', () => {
    const baseline = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext })
    const failures = [{ inicio: '2026-10-02', planejadas: 21, concluidas: 1, pendencias: 20 }]
    const retry = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext, adherenceHistory: failures })
    for (const date of ['2026-10-10', '2026-10-11']) {
      expect(retry.filter((item) => item.data === date)).toHaveLength(baseline.filter((item) => item.data === date).length)
    }
  })
  it('usa conclusão explícita do PDF como única fonte de avanço e preserva conclusões anteriores ao ciclo', () => {
    const progress = [
      { material_id: 'old', estado: 'concluido', concluido_em: '2026-09-20T12:00:00Z' },
      { material_id: 'current', estado: 'em_andamento', concluido_em: null },
    ]
    expect(completedMaterialIdsFromProgress(progress)).toEqual(['old'])
    const units = ['old', 'current', 'next'].map((id, index) => ({ id, objectiveId: 'bacen', context: 'concurso', subjectId: 'cont', subject: 'Contabilidade', name: `${index + 1}. Aula.pdf`, order: index + 1 }))
    const finished = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext, studyUnits: units, completedMaterialIds: ['old', 'current', 'next'] })
    expect(finished.filter((item) => item.objetivo_id === 'bacen')).toHaveLength(0)
    const awaitingOcr = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext, studyUnits: [{ ...units[0], eligible: false }, ...units.slice(1)] })
    expect(awaitingOcr.filter((item) => item.objetivo_id === 'bacen')).toHaveLength(0)
    const continuing = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext, studyUnits: units, completedMaterialIds: completedMaterialIdsFromProgress(progress) })
    expect(continuing.filter((item) => item.objetivo_id === 'bacen').every((item) => item.material_id === 'current')).toBe(true)
    const advanced = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext, studyUnits: units, completedMaterialIds: ['old', 'current'] })
    expect(advanced.filter((item) => item.objetivo_id === 'bacen').every((item) => item.material_id === 'next')).toBe(true)
    expect(completedMaterialIdsFromProgress(progress)).toEqual(['old'])
  })
  it('reexecução mantém chaves estáveis e reconhece demanda ativa equivalente sem fundir dois blocos', () => {
    const plan = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext })
    expect(buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext }).map((item) => item.chave_mentor)).toEqual(plan.map((item) => item.chave_mentor))
    const first = plan.find((item) => item.objetivo_id === 'bacen')
    const equivalent = { ...first, chave_mentor: 'legacy-key', status: 'planejada' }
    expect(equivalentActiveDemand(first, [equivalent])).toEqual(equivalent)
    const nextBlock = plan.find((item) => item.objetivo_id === 'bacen' && item.data === first.data && item.ordem !== first.ordem)
    expect(equivalentActiveDemand(nextBlock, [equivalent])).toBeNull()
  })
  it('recalcula sem recriar demanda apagada ou sobrescrever concluída', () => {
    const proposed = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext }).slice(0, 3)
    const existing = [
      { ...proposed[0], status: 'cancelada' },
      { ...proposed[1], status: 'feita' },
      { ...proposed[2], status: 'planejada' },
    ]
    const reconciled = reconcileMentorDemands(proposed, existing)
    expect(reconciled.demands.map((item) => item.chave_mentor)).toEqual(proposed.slice(1).map((item) => item.chave_mentor))
    expect(reconciled.recalibrated.map((item) => item.chave_mentor)).toEqual([proposed[2].chave_mentor])
    expect(reconcileMentorDemands(proposed, existing).recalibrated.map((item) => item.chave_mentor)).toEqual([proposed[2].chave_mentor])
  })
  it('bloqueia carga normal acima do teto diário sem transformar teto em meta', () => {
    for (const [date, max] of [['2026-10-05', 9], ['2026-10-10', 5], ['2026-10-11', 4]]) {
      const items = Array.from({ length: max + 1 }, (_, index) => ({ chave_mentor: `${date}:${index}`, data: date, tipo: 'estudo', duracao_estimada: 50 }))
      expect(validateMentorPlan(items).reason).toBe('capacidade_diaria_excedida')
      expect(validateMentorPlan(items.slice(0, max)).valid).toBe(true)
    }
  })
  it('mantém duas demandas independentes de 50 minutos para um material de 100 minutos', () => {
    const studyUnits = [{ id: 'pdf-100', objectiveId: 'bacen', context: 'concurso', subjectId: 'cont', subject: 'Contabilidade', name: 'Aula 1.pdf', order: 1 }]
    const day = buildMentorWeek({ weekStart: '2026-09-28', catalog, menteeContext: newCycleContext, studyUnits }).filter((item) => item.data === '2026-10-02' && item.objetivo_id === 'bacen')
    expect(day).toHaveLength(2)
    expect(day.map((item) => item.duracao_estimada)).toEqual([50, 50])
    expect(new Set(day.map((item) => item.chave_mentor)).size).toBe(2)
    expect(day.every((item) => item.material_id === 'pdf-100')).toBe(true)
  })
  it('usa prioridade do Mentor e conteúdo perdido para substituir seleção futura, sem aumentar blocos', () => {
    const expanded = [{ id: 'bacen', tipo: 'concurso', materias: [
      { id: 'a', nome: 'A', topicos: [{ id: 'ta', nome: 'A' }] },
      { id: 'b', nome: 'B', topicos: [{ id: 'tb', nome: 'B' }] },
      { id: 'c', nome: 'C', topicos: [{ id: 'tc', nome: 'C' }] },
    ] }, catalog[1]]
    const units = ['a', 'b', 'c'].map((id) => ({ id: `pdf-${id}`, objectiveId: 'bacen', context: 'concurso', subjectId: id, subject: id, name: `Aula ${id}.pdf`, order: 1 }))
    const baseline = buildMentorWeek({ weekStart: '2026-10-05', catalog: expanded, menteeContext: newCycleContext, studyUnits: units })
    const prioritized = buildMentorWeek({ weekStart: '2026-10-05', catalog: expanded, menteeContext: newCycleContext, studyUnits: units, priorities: [{ id: 'tb', materia_id: 'b' }] })
    const pending = buildMentorWeek({ weekStart: '2026-10-05', catalog: expanded, menteeContext: newCycleContext, studyUnits: units, pendingMaterialIds: ['pdf-c'] })
    expect(prioritized.find((item) => item.objetivo_id === 'bacen').material_id).toBe('pdf-b')
    expect(pending.find((item) => item.objetivo_id === 'bacen').material_id).toBe('pdf-c')
    for (const date of ['2026-10-05', '2026-10-10', '2026-10-11']) {
      expect(pending.filter((item) => item.data === date)).toHaveLength(baseline.filter((item) => item.data === date).length)
    }
  })
  it('após 15/10 usa fase adaptativa sem liberar prática nem voltar ao planejamento antigo', () => {
    const adaptive = { ...newCycleContext, fase: 'base_teorica_adaptativa' }
    const result = buildMentorWeek({ weekStart: '2026-10-12', catalog, menteeContext: adaptive })
    for (const date of ['2026-10-12', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']) {
      expect(result.filter((item) => item.data === date)).toHaveLength(4)
    }
    expect(result.every((item) => item.tipo === 'estudo' && item.duracao_estimada === 50)).toBe(true)
  })
  it('prova de Justiça muda a disciplina acadêmica sem criar bloco extra', () => {
    const expanded = [catalog[0], { id: 'facul', tipo: 'faculdade', materias: [
      { id: 'civil', nome: 'Direito Civil', topicos: [{ id: 'civil-1', nome: 'Pessoas' }] },
      { id: 'justica', nome: 'Teorias da Justiça', topicos: [{ id: 'justica-1', nome: 'Justiça' }] },
    ] }]
    const result = buildMentorWeek({ weekStart: '2026-10-12', catalog: expanded, menteeContext: newCycleContext, commitments: [{ id: 'prova', tipo: 'prova', materia_id: 'justica', data: '2026-10-14', concluido: false }] })
    for (const date of ['2026-10-12', '2026-10-13', '2026-10-14']) {
      const faculty = result.filter((item) => item.data === date && item.objetivo_id === 'facul')
      expect(faculty).toHaveLength(1)
      expect(faculty[0].materia_id).toBe('justica')
    }
  })
  it('conteúdo acadêmico pendente volta ao bloco existente, salvo compromisso próximo', () => {
    const expanded = [catalog[0], { id: 'facul', tipo: 'faculdade', materias: [
      { id: 'civil', nome: 'Direito Civil', topicos: [{ id: 'civil-1', nome: 'Pessoas' }] },
      { id: 'justica', nome: 'Teorias da Justiça', topicos: [{ id: 'justica-1', nome: 'Justiça' }] },
    ] }]
    const baseline = buildMentorWeek({ weekStart: '2026-10-05', catalog: expanded, menteeContext: newCycleContext })
    const pending = buildMentorWeek({ weekStart: '2026-10-05', catalog: expanded, menteeContext: newCycleContext, pendingFacultySubjectIds: ['justica'] })
    expect(pending.find((item) => item.data === '2026-10-05' && item.objetivo_id === 'facul').materia_id).toBe('justica')
    expect(pending.filter((item) => item.data === '2026-10-05')).toHaveLength(baseline.filter((item) => item.data === '2026-10-05').length)
    const exam = buildMentorWeek({ weekStart: '2026-10-12', catalog: expanded, menteeContext: newCycleContext, pendingFacultySubjectIds: ['civil'], commitments: [{ tipo: 'prova', materia_id: 'justica', data: '2026-10-14', concluido: false }] })
    expect(exam.find((item) => item.data === '2026-10-12' && item.objetivo_id === 'facul').materia_id).toBe('justica')
  })
  it('depois de 15/10 a carga só muda por sinal de aderência e no máximo um bloco', () => {
    const adaptive = { ...newCycleContext, fase: 'base_teorica_adaptativa' }
    const maintain = weeklyLoadProfile('2026-10-19', [], {}, null, adaptive)
    expect(maintain.segunda_sexta).toBe(200)
    const low = weeklyLoadProfile('2026-10-19', [{ inicio: '2026-10-09', planejadas: 28, concluidas: 4, pendencias: 24 }], {}, null, adaptive)
    expect(low.segunda_sexta).toBe(150)
    const highHistory = ['2026-10-02', '2026-10-09'].map((inicio) => ({ inicio, planejadas: 21, concluidas: 21, pendencias: 0, media_real_segunda_sexta: 230, media_segunda_sexta: 150 }))
    const high = weeklyLoadProfile('2026-10-19', highHistory, {}, null, adaptive)
    expect(high.segunda_sexta).toBe(250)
    expect(high.segunda_sexta - maintain.segunda_sexta).toBe(50)
    const evaluated = { ...adaptive, carga_atual: { concurso: 4, faculdade: 1, minutos_bloco: 50 }, ultima_avaliacao_semana: '2026-10-19' }
    expect(weeklyLoadProfile('2026-10-19', highHistory, {}, null, evaluated).segunda_sexta).toBe(250)
    expect(weeklyLoadProfile('2026-10-26', highHistory, {}, null, evaluated).segunda_sexta).toBe(300)
  })
  it('mantém a ordem do pacote original mesmo quando o catálogo legado o divide em matérias', () => {
    const studyUnits = [
      { id: 'aula-3', objectiveId: 'bacen', context: 'concurso', subjectId: 'antiga-b', subject: 'Gestão Pública', courseSubject: 'Gestão Pública', name: '3. Governança.pdf', order: 3 },
      { id: 'aula-1', objectiveId: 'bacen', context: 'concurso', subjectId: 'antiga-a', subject: 'Gestão Pública', courseSubject: 'Gestão Pública', name: '1. Introdução.pdf', order: 1 },
      { id: 'aula-2', objectiveId: 'bacen', context: 'concurso', subjectId: 'antiga-b', subject: 'Gestão Pública', courseSubject: 'Gestão Pública', name: '2. Estado.pdf', order: 2 },
    ]
    const first = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext, studyUnits })
    expect(first.filter((item) => item.objetivo_id === 'bacen').every((item) => item.material_id === 'aula-1')).toBe(true)
    const second = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: newCycleContext, studyUnits, completedMaterialIds: ['aula-1'] })
    expect(second.filter((item) => item.objetivo_id === 'bacen').every((item) => item.material_id === 'aula-2')).toBe(true)
  })
  it('recusa estudo comum de 60, 90 ou 100 minutos', () => {
    for (const duration of [60, 90, 100]) {
      expect(validateMentorPlan([{ chave_mentor: `estudo-${duration}`, data: '2026-10-02', tipo: 'estudo', duracao_estimada: duration }])).toMatchObject({ valid: false, reason: 'duracao_estudo_invalida' })
    }
    expect(validateMentorPlan([{ chave_mentor: 'estudo-50', data: '2026-10-02', tipo: 'estudo', duracao_estimada: 50 }]).valid).toBe(true)
    expect(validateMentorPlan([{ chave_mentor: 'prova-100', data: '2026-10-02', tipo: 'prova', duracao_estimada: 100 }]).valid).toBe(true)
  })
  it('nao transporta pendencias anteriores ao contexto atual para a nova semana', () => {
    const prior = { id: 'anterior', data: '2026-09-21', status: 'planejada', duracao_estimada: 50 }
    const current = { id: 'atual', data: '2026-09-28', status: 'planejada', duracao_estimada: 50 }
    expect(currentPhaseCarryover([prior, current], currentContext)).toEqual([current])
    expect(currentPhaseCarryover([prior, current], null)).toEqual([prior, current])
  })
  it('usa o contexto atual: um bloco de Faculdade e dois de concurso todos os dias, sem pratica', () => {
    const result = buildMentorWeek({ weekStart: '2026-09-28', catalog, menteeContext: currentContext })
    for (let day = 28; day <= 30; day += 1) {
      const date = `2026-09-${day}`
      expect(result.filter((item) => item.data === date && item.objetivo_id === 'facul')).toHaveLength(1)
      expect(result.filter((item) => item.data === date && item.objetivo_id === 'bacen')).toHaveLength(2)
    }
    for (let day = 1; day <= 4; day += 1) {
      const date = `2026-10-0${day}`
      expect(result.filter((item) => item.data === date && item.objetivo_id === 'facul')).toHaveLength(1)
      expect(result.filter((item) => item.data === date && item.objetivo_id === 'bacen')).toHaveLength(2)
    }
    expect(result.every((item) => item.tipo === 'estudo')).toBe(true)
  })

  it('mantem as quatro materias da Faculdade no ciclo de segunda a quinta', () => {
    const names = ['Direito das Pessoas e dos Negócios Jurídicos', 'Teoria do Crime', 'Teoria da Justiça', 'Teoria da Constituição e Direitos Fundamentais']
    const fullCatalog = [catalog[0], { id: 'facul', tipo: 'faculdade', materias: names.map((nome, index) => ({ id: `f${index}`, nome, topicos: [{ id: `t${index}`, nome: 'Introdução' }] })) }]
    const result = buildMentorWeek({ weekStart: '2026-09-28', catalog: fullCatalog, menteeContext: currentContext })
    expect(result.filter((item) => item.objetivo_id === 'facul' && item.data <= '2026-10-01').map((item) => item.materia_id)).toEqual(['f0', 'f1', 'f2', 'f3'])
  })

  it('nao herda carga das semanas excepcionais para a fase atual', () => {
    const history = [{ inicio: '2026-09-21', planejadas: 20, concluidas: 20, media_segunda_sexta: 450, media_real_segunda_sexta: 500 }]
    expect(weeklyLoadProfile('2026-09-28', history, {}, null, currentContext)).toMatchObject({ segunda_sexta: 150, sabado: 150, domingo: 150, nivel: 'manter' })
  })

  it('oferece o primeiro bloco adicional ao concurso apenas apos duas semanas constantes', () => {
    const history = ['2026-09-28', '2026-10-05'].map((inicio) => ({ inicio, planejadas: 21, concluidas: 19, minutos_planejados: 1050, minutos_concluidos: 950, pendencias: 2 }))
    expect(weeklyLoadProfile('2026-10-12', history, {}, null, currentContext)).toMatchObject({ segunda_sexta: 200, sabado: 200, domingo: 200, nivel: 'aumentar' })
    const result = buildMentorWeek({ weekStart: '2026-10-12', catalog, adherenceHistory: history, menteeContext: currentContext })
    expect(result.filter((item) => item.data === '2026-10-12' && item.objetivo_id === 'facul')).toHaveLength(1)
    expect(result.filter((item) => item.data === '2026-10-12' && item.objetivo_id === 'bacen')).toHaveLength(3)
    expect(result.every((item) => item.tipo === 'estudo')).toBe(true)
  })
  it('inicia com dois blocos de Faculdade e dois de BACEN nos dias uteis, sem pratica', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog, pendingReviews: 3 })
    expect(result).toHaveLength(26)
    expect(result.every((item) => item.tipo === 'estudo')).toBe(true)
    expect(result.some((item) => item.tipo === 'exercicio' || item.objetivo_id === 'bacen' && item.tipo === 'especial')).toBe(false)
    expect(Math.max(...result.map((item) => item.duracao_estimada))).toBe(50)
  })

  it('reserva dois blocos BACEN e um da faculdade no fim de semana', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog, pendingReviews: 1 })
    const weekend = result.filter((item) => item.data >= '2026-08-22')
    const totals = weekend.reduce((map, item) => map.set(item.data, (map.get(item.data) || 0) + item.duracao_estimada), new Map())
    expect([...totals.values()]).toEqual([150, 150])
    expect(weekend.filter((item) => item.objetivo_id === 'facul')).toHaveLength(2)
  })

  it('reserva dois blocos para faculdade e dois para BACEN de segunda a sexta', () => {
    const result = buildMentorWeek({ weekStart: '2026-08-17', catalog })
    const total = (day) => result.filter((item) => item.data === day).reduce((sum, item) => sum + item.duracao_estimada, 0)
    expect(total('2026-08-17')).toBe(200)
    expect(total('2026-08-21')).toBe(200)
    expect(total('2026-08-23')).toBe(150)
  })

  it('mantem chaves estaveis para impedir duplicidade ao recarregar', () => {
    const first = buildMentorWeek({ weekStart: '2026-08-17', catalog })
    const second = buildMentorWeek({ weekStart: '2026-08-17', catalog })
    expect(second.map((item) => item.chave_mentor)).toEqual(first.map((item) => item.chave_mentor))
  })

  it('so libera a proxima semana a partir do domingo', () => {
    expect(canGenerateMentorWeek({ weekStart: '2026-09-21', today: '2026-09-20' })).toBe(true)
    expect(canGenerateMentorWeek({ weekStart: '2026-09-14', today: '2026-09-13' })).toBe(false)
    expect(canGenerateMentorWeek({ weekStart: '2026-09-14', today: '2026-09-12' })).toBe(false)
    expect(canGenerateMentorWeek({ weekStart: '2026-09-14', today: '2026-09-15' })).toBe(false)
    expect(canGenerateMentorWeek({ weekStart: '2026-09-07', today: '2026-09-12' })).toBe(false)
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
      expect(items.filter((item) => item.objetivo_id === 'facul').map((item) => item.duracao_estimada)).toEqual(day <= 21 ? [50, 50] : [50])
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
    const preparation = result.filter((item) => item.chave_mentor.includes('preparo:prova-1:'))
    expect(exam).toMatchObject({ data: '2026-08-20', tipo: 'prova', duracao_estimada: 120, prioridade: 1 })
    expect(preparation).toHaveLength(2)
    expect(preparation.every((item) => item.data === '2026-08-18' && item.tipo === 'estudo' && item.duracao_estimada === 50 && item.materia_id === 'civil')).toBe(true)
    expect(result.filter((item) => !['prova', 'simulado'].includes(item.tipo)).every((item) => item.duracao_estimada <= 90)).toBe(true)
    const bacenOnPreparationDay = result.filter((item) => item.data === '2026-08-18' && item.objetivo_id === 'bacen')
    expect(bacenOnPreparationDay).toHaveLength(2)
  })

  it('divide a preparacao academica pesada em dois registros de 50 minutos', () => {
    const result = buildMentorWeek({
      weekStart: '2026-10-05',
      catalog,
      commitments: [{ id: 'prova-outubro', objetivo_id: 'facul', materia_id: 'civil', titulo: 'Prova de Direito Civil', tipo: 'prova', data: '2026-10-14', peso: 5, duracao_minutos: 120, concluido: false }],
    })
    expect(result.filter((item) => item.chave_mentor.includes('preparo:prova-outubro:')).map((item) => item.duracao_estimada)).toEqual([50, 50])
    expect(result.filter((item) => item.tipo === 'estudo').every((item) => item.duracao_estimada === 50)).toBe(true)
  })

  it('prepara compromisso pelo topico explicitamente vinculado', () => {
    const expanded = [{ id: 'facul', tipo: 'faculdade', materias: [{ id: 'civil', nome: 'Direito Civil', topicos: [{ id: 'pessoas', nome: 'Pessoas' }, { id: 'negocios', nome: 'Negócios jurídicos' }] }] }]
    const result = buildMentorWeek({
      weekStart: '2026-09-07',
      catalog: expanded,
      commitments: [{ id: 'prova-2', objetivo_id: 'facul', materia_id: 'civil', titulo: 'Prova', tipo: 'prova', data: '2026-09-10', peso: 5, duracao_minutos: 120, concluido: false, topicos: [{ topico_id: 'negocios' }] }],
    })
    expect(result.find((item) => item.chave_mentor.endsWith('preparo:prova-2:1'))).toMatchObject({ topico_id: 'negocios' })
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
    expect([...totals.values()]).toEqual([200, 200, 200, 200, 200, 150, 150])
    expect(result.every((item) => item.tipo === 'estudo')).toBe(true)
  })

  it('planeja questões e cards BACEN somente após duas semanas aderentes e para tópicos já estudados', () => {
    const expanded = [{ id: 'bacen', tipo: 'concurso', materias: [{ id: 'cont', nome: 'Contabilidade', topicos: [{ id: 'estudado', nome: 'Estudado' }, { id: 'avancado', nome: 'Avançado' }] }] }, catalog[1]]
    const adherenceHistory = [
      { planejadas: 10, concluidas: 9, minutos_planejados: 500, minutos_concluidos: 450 },
      { planejadas: 10, concluidas: 9, minutos_planejados: 500, minutos_concluidos: 450 },
    ]
    const result = buildMentorWeek({ weekStart: '2026-10-12', catalog: expanded, studiedTopicIds: ['estudado'], adherenceHistory })
    const practice = result.filter((item) => item.objetivo_id === 'bacen' && ['especial', 'exercicio'].includes(item.tipo))
    expect(practice.length).toBeGreaterThan(0)
    expect(practice.every((item) => item.topico_id === 'estudado')).toBe(true)
  })

  it('mantem somente estudo se as duas semanas basicas nao atingirem boa aderencia', () => {
    const lowAdherence = [
      { planejadas: 10, concluidas: 8, minutos_planejados: 500, minutos_concluidos: 400 },
      { planejadas: 10, concluidas: 7, minutos_planejados: 500, minutos_concluidos: 350 },
    ]
    expect(practiceEligibility('2026-10-12', lowAdherence)).toMatchObject({ eligible: false, reason: 'aderencia_insuficiente' })
    const result = buildMentorWeek({ weekStart: '2026-10-12', catalog, adherenceHistory: lowAdherence })
    expect(result.every((item) => item.tipo === 'estudo')).toBe(true)
  })

  it('limita Faculdade a dois blocos por dia e prioriza BACEN na semana de recuperacao', () => {
    const result = buildMentorWeek({ weekStart: '2026-09-28', catalog })
    const facultyByDay = result.filter((item) => item.objetivo_id === 'facul').reduce((map, item) => map.set(item.data, (map.get(item.data) || 0) + 1), new Map())
    expect(Math.max(...facultyByDay.values())).toBeLessThanOrEqual(2)
    expect(result.filter((item) => item.objetivo_id === 'bacen').length).toBeGreaterThan(result.filter((item) => item.objetivo_id === 'facul').length)
    expect(result.every((item) => item.tipo === 'estudo')).toBe(true)
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

  it('limita a tres pendencias transferidas para evitar novo acumulo', () => {
    const overdue = Array.from({ length: 6 }, (_, index) => ({ id: `p${index}`, data: '2026-08-10', status: 'planejada', prioridade: 1, duracao_estimada: 30 }))
    const moves = planOverdueMoves(overdue, '2026-08-12', '2026-08-16')
    expect(moves).toHaveLength(3)
  })

  it('reinicia em 14 de setembro com quatro demandas uteis e duas no fim de semana', () => {
    const facultySubjects = [
      ['pessoas', 'Direito das Pessoas e dos Negócios Jurídicos'],
      ['crime', 'Teoria do Crime'],
      ['justica', 'Teorias da Justiça'],
      ['constituicao', 'Teoria da Constituição e Direitos Fundamentais'],
    ].map(([id, nome]) => ({ id, nome, topicos: [{ id: `${id}-1`, nome: 'Conteúdo' }] }))
    const expanded = [catalog[0], { id: 'facul', tipo: 'faculdade', materias: facultySubjects }]
    const result = buildMentorWeek({ weekStart: '2026-09-14', catalog: expanded, pendingReviews: 20 })
    const counts = Array.from({ length: 7 }, (_, offset) => {
      const date = new Date('2026-09-14T12:00:00Z'); date.setUTCDate(date.getUTCDate() + offset)
      return result.filter((item) => item.data === date.toISOString().slice(0, 10)).length
    })
    expect(counts).toEqual([4, 4, 4, 4, 4, 2, 2])
    expect(result).toHaveLength(24)
    expect(result.every((item) => item.tipo === 'estudo' && item.duracao_estimada === 50)).toBe(true)
    expect(result.filter((item) => item.titulo === 'Preparar prova: Teoria do Crime')).toHaveLength(7)
    expect(result.filter((item) => item.data === '2026-09-18' && item.objetivo_id === 'bacen')).toHaveLength(3)
  })

  it('retoma em 21 de setembro com preparacao intensiva, BACEN no dia da prova e rotina gradual', () => {
    const facultySubjects = [
      ['pessoas', 'Direito das Pessoas e dos Negócios Jurídicos'],
      ['crime', 'Teoria do Crime'],
      ['justica', 'Teorias da Justiça'],
      ['constituicao', 'Teoria da Constituição e Direitos Fundamentais'],
    ].map(([id, nome]) => ({ id, nome, topicos: [{ id: `${id}-1`, nome: 'Conteúdo' }] }))
    const expanded = [catalog[0], { id: 'facul', tipo: 'faculdade', materias: facultySubjects }]
    const result = buildMentorWeek({ weekStart: '2026-09-21', catalog: expanded, scheduledQuestionReviews: [{ dueDate: '2026-09-21', topicId: 'cont-1', count: 10 }] })
    expect(result.filter((item) => item.data === '2026-09-21' && item.materia_id === 'crime')).toHaveLength(7)
    expect(result.filter((item) => item.data === '2026-09-21' && item.objetivo_id === 'bacen')).toHaveLength(2)
    expect(result.filter((item) => item.data === '2026-09-22' && item.objetivo_id === 'facul')).toHaveLength(0)
    expect(result.filter((item) => item.data === '2026-09-22' && item.objetivo_id === 'bacen')).toHaveLength(2)
    expect(result.some((item) => ['exercicio', 'especial', 'revisao'].includes(item.tipo))).toBe(false)
    expect(result.filter((item) => item.data === '2026-09-26')).toHaveLength(3)
    expect(result.filter((item) => item.data === '2026-09-27')).toHaveLength(3)
  })

  it('segue a ordem original dos PDFs sem saltar aulas', () => {
    const studyUnits = [
      { id: 'c2', objectiveId: 'bacen', context: 'concurso', subjectId: 'cont', subject: 'Contabilidade', name: '2. Patrimônio.pdf', order: 2 },
      { id: 'c1', objectiveId: 'bacen', context: 'concurso', subjectId: 'cont', subject: 'Contabilidade', name: '1. Introdução.pdf', order: 1 },
      { id: 'd1', objectiveId: 'bacen', context: 'concurso', subjectId: 'dir', subject: 'Direito', name: '1. Estado.pdf', order: 1 },
    ]
    const expanded = [{ id: 'bacen', tipo: 'concurso', materias: [{ id: 'cont', nome: 'Contabilidade', topicos: [{ id: 'c', nome: 'Tópico' }] }, { id: 'dir', nome: 'Direito', topicos: [{ id: 'd', nome: 'Tópico' }] }] }, catalog[1]]
    const result = buildMentorWeek({ weekStart: '2026-08-24', catalog: expanded, studyUnits })
    const bacen = result.filter((item) => item.objetivo_id === 'bacen')
    expect(bacen.slice(0, 3).map((item) => item.material_id)).toEqual(['c1', 'd1', 'c1'])
    expect(bacen[0].titulo).toContain('Aula 1')
  })

  it('bloqueia duplicidade e aceita um teto explícito mais restritivo', () => {
    expect(validateMentorPlan([{ chave_mentor: 'a', data: '2026-09-01', duracao_estimada: 60 }, { chave_mentor: 'a', data: '2026-09-01', duracao_estimada: 60 }]).reason).toBe('demanda_duplicada')
    expect(validateMentorPlan([{ chave_mentor: 'a', data: '2026-09-01', duracao_estimada: 300 }, { chave_mentor: 'b', data: '2026-09-01', duracao_estimada: 200 }]).valid).toBe(true)
    expect(validateMentorPlan([{ chave_mentor: 'a', data: '2026-09-01', duracao_estimada: 300 }, { chave_mentor: 'b', data: '2026-09-01', duracao_estimada: 200 }], { dailyLimit: 480 }).reason).toBe('limite_diario_excedido')
  })
})
