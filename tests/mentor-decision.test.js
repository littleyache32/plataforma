import { describe, expect, it } from 'vitest'
import { classifyMentorPriority, decideMentorCycle, MENTOR_STATES } from '../shared/mentor-decision.js'

const context = {
  fase: 'adaptacao_teorica_1', inicio: '2026-10-02', fim_etapa_1: '2026-10-08', fim_etapa_2: '2026-10-15',
  etapa_1: { concurso: 2 }, etapa_2: { concurso: 3 }, carga_atual: { concurso: 3, faculdade: 1 },
}
const window = (inicio, concluidas, planejadas = 20) => ({ inicio, concluidas, planejadas })
const highOne = [window('2026-10-12', 18)]
const highTwo = [window('2026-10-12', 18), window('2026-10-19', 19)]
const decide = (changes = {}) => decideMentorCycle({ date: '2026-10-26', context, curriculum: { remaining: 50 }, ...changes })

describe('motor determinístico do Mentor', () => {
  it('ativa somente os três estados teóricos nesta fase', () => {
    expect(decide({ date: '2026-10-02' }).state).toBe(MENTOR_STATES.ADAPTACAO_1)
    expect(decide({ date: '2026-10-09' }).state).toBe(MENTOR_STATES.ADAPTACAO_2)
    expect(decide().state).toBe(MENTOR_STATES.BASE_TEORICA)
    expect(decide({ date: '2026-10-09' }).bacenBlocks).toBe(3)
  })
  it('alta aderência em uma janela mantém; duas janelas consecutivas tornam aumento elegível', () => {
    expect(decide({ history: highOne })).toMatchObject({ action: 'manter', bacenBlocks: 3 })
    expect(decide({ history: highOne }).reason_codes).toContain('FIRST_HIGH_WINDOW')
    expect(decide({ history: highTwo })).toMatchObject({ action: 'aumentar', bacenBlocks: 4 })
    expect(decide({ history: highTwo }).reason_codes).toContain('LOAD_INCREASE_ELIGIBLE')
  })
  it('faixa de 70% a 84% mantém a carga e não herda semanas históricas', () => {
    expect(decide({ history: [window('2026-10-19', 14)] }).action).toBe('manter')
    expect(decide({ history: [window('2026-10-19', 16)] }).action).toBe('manter')
    expect(decide({ history: [window('2026-09-21', 20), window('2026-10-19', 18)] }).action).toBe('manter')
  })
  it('baixa aderência reduz um nível, sem afetar o bloco da Faculdade', () => {
    expect(decide({ history: [window('2026-10-19', 12)] })).toMatchObject({ action: 'reduzir', bacenBlocks: 2, facultyBlocks: 1 })
    expect(decide({ history: [window('2026-10-19', 12)] }).reason_codes).toContain('LOW_ADHERENCE')
  })
  it('carga pesada bloqueia aumento e, com backlog alto, permite recuo', () => {
    const heavy = { history: highTwo, weeklyMeeting: { carga_percebida: 'pesada' } }
    expect(decide(heavy).action).toBe('manter')
    expect(decide({ ...heavy, pendingCount: 5 })).toMatchObject({ action: 'reduzir', bacenBlocks: 2 })
    expect(decide(heavy).reason_codes).toContain('HEAVY_SELF_REPORTED_LOAD')
  })
  it('backlog e demanda perdida não viram horas extras', () => {
    const result = decide({ history: highTwo, pendingCount: 5 })
    expect(result).toMatchObject({ action: 'manter', bacenBlocks: 3 })
    expect(result.reason_codes).toContain('BACKLOG')
    expect(classifyMentorPriority({ backlog: true })).toContain('BACKLOG')
  })
  it('prova próxima altera motivo, não a quantidade de blocos', () => {
    const result = decide({ commitments: [{ tipo: 'prova', data: '2026-10-27', concluido: false }] })
    expect(result.reason_codes).toContain('EXAM_NEAR')
    expect(result.facultyBlocks).toBe(1)
  })
  it('incidência alta só pesa com evidência; baixa prioridade e pré-requisito ficam explícitos', () => {
    expect(classifyMentorPriority({ incidence: 'alta' })).not.toContain('HIGH_INCIDENCE')
    expect(classifyMentorPriority({ incidence: 'alta', incidenceEvidence: true })).toContain('HIGH_INCIDENCE')
    expect(classifyMentorPriority({ lowPriority: true, prerequisiteReady: false })).toEqual(['PREREQUISITE', 'LOW_PRIORITY'])
  })
  it('material em andamento recebe motivo próprio e não implica domínio', () => {
    expect(classifyMentorPriority({ materialInProgress: true })).toContain('MATERIAL_IN_PROGRESS')
    expect(decide().mastery).toBe('UNKNOWN')
    expect(decide().reason_codes).toContain('UNKNOWN_MASTERY')
  })
  it('base concluída não ativa prática nem aumento teórico sem utilidade', () => {
    const result = decide({ history: highTwo, curriculum: { remaining: 0, baseComplete: true } })
    expect(result).toMatchObject({ state: MENTOR_STATES.BASE_TEORICA, action: 'manter' })
    expect(result.reason_codes).toContain('BASE_COMPLETED_PENDING_TRANSITION')
  })
  it('sem cobertura conhecida não autoriza aumento por alta aderência', () => {
    expect(decide({ history: highTwo, curriculum: {} }).action).toBe('manter')
    expect(decide({ history: highTwo, availability: { max_blocos_dia: 4 } }).reason_codes).toContain('INSUFFICIENT_AVAILABILITY')
  })
  it('recálculo da mesma semana não aplica degrau novamente', () => {
    const evaluated = { ...context, carga_atual: { concurso: 4, faculdade: 1 }, ultima_avaliacao_semana: '2026-10-26' }
    expect(decide({ context: evaluated, history: highTwo, cycleKey: '2026-10-26' })).toMatchObject({ action: 'manter', bacenBlocks: 4 })
  })
  it('mesmos inputs geram decisão e justificativa idênticas sem LLM', () => {
    expect(decide({ history: highTwo })).toEqual(decide({ history: highTwo }))
    expect(decide({ history: highTwo }).explanation.length).toBeGreaterThan(10)
    expect(decide({ history: highTwo }).reason_codes.length).toBeGreaterThan(0)
  })
})
