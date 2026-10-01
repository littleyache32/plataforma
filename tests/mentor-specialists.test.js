import { describe, expect, it } from 'vitest'
import { calculateMentorSpecialistSignals, MENTOR_SPECIALIST_MODULES } from '../shared/mentor-specialists.js'
import { decideMentorCycle, rankMentorMaterials } from '../shared/mentor-decision.js'
import { buildMentorWeek } from '../shared/planner.js'

const context = {
  fase: 'adaptacao_teorica_1', inicio: '2026-10-02', fim_etapa_1: '2026-10-08', fim_etapa_2: '2026-10-15',
  carga_atual: { concurso: 3, faculdade: 1 }, rotina_pratica: { revisao_pratica: false },
}
const units = [
  { id: 'a1', objectiveId: 'bacen', context: 'concurso', subjectId: 'a', subject: 'A', name: 'Aula 1', order: 1 },
  { id: 'a2', objectiveId: 'bacen', context: 'concurso', subjectId: 'a', subject: 'A', name: 'Aula 2', order: 2 },
  { id: 'b1', objectiveId: 'bacen', context: 'concurso', subjectId: 'b', subject: 'B', name: 'Aula 1', order: 1 },
]
const signals = (changes = {}) => calculateMentorSpecialistSignals({ date: '2026-10-26', context, studyUnits: units, materialProgress: [], ...changes })

describe('seis especialistas como calculadores de sinais', () => {
  it('usa exatamente os seis módulos existentes e mantém domínio desconhecido sem prática', () => {
    expect(MENTOR_SPECIALIST_MODULES).toHaveLength(6)
    expect(Object.keys(signals())).toEqual(['planejamento', 'trilha', 'revisao', 'desempenho', 'academico', 'previsao'])
    expect(signals().desempenho).toMatchObject({ mastery: 'UNKNOWN', acerto: null, retencao: null })
    expect(signals({ reviewItems: [{ status: 'pendente', agendada_para: '2026-10-20' }] }).revisao)
      .toMatchObject({ operacional: false, vencidos: 1, urgencia: 'INACTIVE', modalidade_recomendada: null })
  })

  it('planejamento calcula aderência, carga, capacidade, perdas e backlog sem executar decisão', () => {
    const result = signals({ history: [{ inicio: '2026-10-12', planejadas: 20, concluidas: 18 }, { inicio: '2026-10-19', planejadas: 20, concluidas: 19 }], pendingCount: 2 })
    expect(result.planejamento).toMatchObject({ aderencia: 0.95, carga_atual: { bacen: 3, faculdade: 1 },
      demandas_perdidas: 1, backlog: 2, possibilidades: { manter: true, aumentar: true, reduzir: false } })
    expect(result.planejamento.capacidade_observada_blocos_dia).toBeCloseTo(19 / 7, 1)
  })

  it('trilha preserva material atual e próximo, cobertura por disciplina e pré-requisito evidenciado', () => {
    const result = signals({ materialProgress: [{ material_id: 'a1', estado: 'concluido' }, { material_id: 'a2', estado: 'em_andamento' }],
      prerequisites: [{ material_id: 'a2', fonte: 'edital', evidencia: 'pré-requisito' }, { material_id: 'b1' }] }).trilha
    expect(result).toMatchObject({ total: 3, concluidos: 1, restantes: 2, percentual_coberto: 33.3 })
    expect(result.disciplinas.find((item) => item.nome === 'A')).toMatchObject({ material_atual: { id: 'a2', estado: 'em_andamento' }, proxima_aula: null })
    expect(result.prerequisitos).toHaveLength(1)
  })

  it('acadêmico usa prazos reais e identifica aulas dadas ainda não estudadas', () => {
    const result = signals({ commitments: [{ id: 'p', tipo: 'prova', data: '2026-10-27', materia_id: 'crime' },
      { id: 'e', tipo: 'entrega', data: '2026-10-29', materia_id: 'civil' }],
      academicClasses: [{ id: 'c1', subjectId: 'crime', date: '2026-10-25' }, { id: 'c2', subjectId: 'civil', date: '2026-10-25' }],
      studiedClassIds: ['c2'] }).academico
    expect(result.proxima_prova).toMatchObject({ id: 'p', dias: 1, materia_id: 'crime' })
    expect(result.proxima_entrega).toMatchObject({ id: 'e', dias: 3 })
    expect(result.conteudos_pendentes).toEqual([{ id: 'c1', materia_id: 'crime', data: '2026-10-25' }])
  })

  it('previsão não inventa ritmo; só projeta com janela observada e conclusão datada', () => {
    const provisional = { ...context, data_prova_provisoria: '2026-11-01' }
    expect(signals({ context: provisional }).previsao).toMatchObject({ tipo_data: 'PROVISORIA', ritmo_materiais_semana: null, risco_nao_concluir: 'UNKNOWN' })
    const result = signals({ context: provisional, materialProgress: [
      { material_id: 'a1', estado: 'concluido', concluido_em: '2026-10-10' },
      { material_id: 'b1', estado: 'concluido', concluido_em: '2026-10-20' },
    ] }).previsao
    expect(result.ritmo_materiais_semana).toBeGreaterThan(0)
    expect(result.cobertura_projetada_percentual).toBeGreaterThan(0)
  })

  it('Mentor principal consome os sinais e resolve carga, prazo e bloqueio de prática', () => {
    const specialistSignals = signals({ history: [{ inicio: '2026-10-19', planejadas: 20, concluidas: 12 }],
      commitments: [{ id: 'p', tipo: 'prova', data: '2026-10-27', materia_id: 'crime' }] })
    const result = decideMentorCycle({ date: '2026-10-26', context, specialistSignals })
    expect(result).toMatchObject({ action: 'reduzir', bacenBlocks: 2, mastery: 'UNKNOWN' })
    expect(result.reason_codes).toEqual(expect.arrayContaining(['LOW_ADHERENCE', 'EXAM_NEAR', 'PRACTICE_DISABLED', 'UNKNOWN_MASTERY']))
  })
})

describe('prioridade curricular central e evidenciada', () => {
  it('distingue HIGH, LOW e UNKNOWN com fonte, evidência e data', () => {
    const ranked = rankMentorMaterials({ studyUnits: units, metadata: [
      { material_id: 'a1', incidencia: 'HIGH', dificuldade: 'MEDIUM', fonte: 'edital', evidencia: 'peso', atualizado_em: '2026-10-01' },
      { material_id: 'a2', incidencia: 'LOW', dificuldade: 'LOW', fonte: 'edital', evidencia: 'peso', atualizado_em: '2026-10-01' },
      { material_id: 'b1', incidencia: 'LOW', dificuldade: 'LOW' },
    ] })
    expect(ranked.map((item) => [item.material_id, item.nivel, item.incidencia])).toEqual([
      ['a1', 'P1', 'HIGH'], ['b1', 'P3', 'UNKNOWN'], ['a2', 'P4', 'LOW'],
    ])
    expect(rankMentorMaterials({ studyUnits: units, metadata: [] })).toHaveLength(3)
    expect(rankMentorMaterials({ studyUnits: units, completedMaterialIds: ['a1'] }).find((item) => item.material_id === 'a1')).toBeUndefined()
    expect(ranked).toEqual(rankMentorMaterials({ studyUnits: units, metadata: [
      { material_id: 'a1', incidencia: 'HIGH', dificuldade: 'MEDIUM', fonte: 'edital', evidencia: 'peso', atualizado_em: '2026-10-01' },
      { material_id: 'a2', incidencia: 'LOW', dificuldade: 'LOW', fonte: 'edital', evidencia: 'peso', atualizado_em: '2026-10-01' },
      { material_id: 'b1', incidencia: 'LOW', dificuldade: 'LOW' },
    ] }))
  })

  it('classifica obrigação acadêmica com prazo próximo como P0 sem criar novo bloco', () => {
    const ranked = rankMentorMaterials({ studyUnits: [{ id: 'f1', context: 'faculdade', subjectId: 'crime', eligible: true }],
      date: '2026-10-13', commitments: [{ id: 'prova', tipo: 'prova', materia_id: 'crime', data: '2026-10-14', concluido: false }] })
    expect(ranked[0]).toMatchObject({ nivel: 'P0', reason_codes: ['EXAM_NEAR'], incidencia: 'UNKNOWN' })
  })

  it('planner consulta prioridade do Mentor e mantém P4 elegível para cobertura', () => {
    const catalog = [{ id: 'bacen', tipo: 'concurso', materias: [
      { id: 'a', nome: 'A', topicos: [{ id: 'ta', nome: 'A' }] },
      { id: 'b', nome: 'B', topicos: [{ id: 'tb', nome: 'B' }] },
    ] }, { id: 'facul', tipo: 'faculdade', materias: [{ id: 'f', nome: 'F', topicos: [{ id: 'tf', nome: 'F' }] }] }]
    const materialPriorities = rankMentorMaterials({ studyUnits: [units[0], units[2]], metadata: [
      { material_id: 'a1', incidencia: 'LOW', fonte: 'edital', evidencia: 'baixa', atualizado_em: '2026-10-01' },
      { material_id: 'b1', incidencia: 'HIGH', fonte: 'edital', evidencia: 'alta', atualizado_em: '2026-10-01' },
    ] })
    const plan = buildMentorWeek({ weekStart: '2026-10-05', catalog, menteeContext: context, studyUnits: [units[0], units[2]], materialPriorities })
    expect(plan.find((item) => item.objetivo_id === 'bacen').material_id).toBe('b1')
    expect(plan.filter((item) => item.objetivo_id === 'bacen').some((item) => item.material_id === 'a1')).toBe(true)
    expect(plan.every((item) => item.tipo === 'estudo' && item.duracao_estimada === 50)).toBe(true)
  })
})
