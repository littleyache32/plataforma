import { describe, expect, it } from 'vitest'
import { evaluateMentorV2, validateMentorV2Decision, MENTOR_V2_PRIORITY_RULE } from '../shared/mentor-v2-policy.js'

const material = (id, subject, goal, order) => ({ id, materia_id: subject, objetivo_id: goal, ordem_curso: order,
  status: 'aceito', estado_extracao: 'texto' })
function fixture() {
  return { context: { id: 1, rotina_pratica: {}, objetivo_principal_id: 'contest' },
    subjects: [{ id: 'a', objetivo_id: 'contest' }, { id: 'b', objetivo_id: 'contest' }, { id: 'c', objetivo_id: 'faculty' }, { id: 'd', objetivo_id: 'faculty' }],
    topics: [{ id: 'ta', materia_id: 'a' }, { id: 'td', materia_id: 'd' }],
    demands: ['contest', 'contest', 'faculty'].map((goal, i) => ({ id: `slot-${i}`, objetivo_id: goal,
      materia_id: goal === 'contest' ? 'a' : 'c', tipo: 'estudo', status: 'planejada', data: '2030-03-04',
      duracao_estimada: i === 1 ? 30 : 50, ordem: i })),
    loadSources: { history: [], times: [], objectives: [{ id: 'contest', tipo: 'concurso' }, { id: 'faculty', tipo: 'faculdade' }], commitments: [] },
    prioritySources: { materials: [material('a1', 'a', 'contest', 1), material('a2', 'a', 'contest', 2),
      material('b1', 'b', 'contest', 1), material('c1', 'c', 'faculty', 1), material('d1', 'd', 'faculty', 1)],
      progress: [], commitmentTopics: [], reviews: [], questions: [], attempts: [] } }
}
function policy() { return { id: 'p', modulo: 'mentor', ativo: true, versao: 'v2-priority-test', conteudo: { politica: {
  modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO'],
  regras: [{ id: 'CONTINUIDADE_PLANO_EXISTENTE', habilitada: true }, { id: MENTOR_V2_PRIORITY_RULE, habilitada: true }],
} } } }
const run = (facts = fixture(), record = policy()) => evaluateMentorV2({ facts, policyRecord: record,
  weekStart: '2030-03-04', referenceInstant: '2030-03-04T15:00:00Z', evaluationId: 'test-priority' })
const selected = (result) => result.decisoes.filter((row) => row.tipo_decisao === 'PRIORIZAR_MATERIA')
const ids = (result) => selected(result).map((row) => row.parametros.selecao.material_id)
const complete = (id) => ({ material_id: id, estado: 'concluido', concluido_em: '2030-03-01T15:00:00Z' })

describe('priorização central V2', () => {
  it('seleciona currículo dentro dos slots 50/30, preservando concurso e Faculdade sem ampliar carga', () => {
    const result = run()
    expect(ids(result)).toEqual(['a1', 'b1', 'c1'])
    expect(selected(result).map((row) => row.duracao_minutos)).toEqual([50, 30, 50])
    expect(selected(result).every(validateMentorV2Decision)).toBe(true)
    expect(result.carga_semanal.carga_proposta).toMatchObject({ demandas: 3, minutos: 130 })
    expect(result.reason_codes).toEqual(expect.arrayContaining(['STRUCTURAL_CONTEST_PRIORITY', 'FACULTY_CONTINUITY']))
  })
  it('mesmos dados produzem a mesma seleção sem modificar nenhum fato', () => {
    const facts = fixture(), before = structuredClone(facts)
    expect(run(facts)).toEqual(run(facts)); expect(facts).toEqual(before)
  })
  it('ordem incidental de consulta não altera decisões de priorização', () => {
    const facts = fixture(), other = structuredClone(facts)
    other.demands.reverse(); other.prioritySources.materials.reverse(); other.subjects.reverse()
    expect(selected(run(facts))).toEqual(selected(run(other)))
  })
  it('concluído nunca reaparece e a ordem real avança ao primeiro pendente', () => {
    const facts = fixture(); facts.prioritySources.progress = [complete('a1')]
    expect(ids(run(facts))[0]).toBe('a2')
  })
  it('em andamento continua no mesmo material em blocos separados, sem conclusão implícita', () => {
    const facts = fixture(); facts.prioritySources.progress = [{ material_id: 'a1', estado: 'em_andamento', concluido_em: null }]
    const result = run(facts)
    expect(ids(result).slice(0, 2)).toEqual(['a1', 'a1'])
    expect(selected(result)[0].reason_codes).toContain('MATERIAL_IN_PROGRESS')
    expect(facts.prioritySources.progress[0].estado).toBe('em_andamento')
  })
  it('bloco feito não conclui PDF nem avança currículo', () => {
    const facts = fixture(); facts.loadSources.history = [{ id: 'old', materia_id: 'a', material_id: 'a1',
      objetivo_id: 'contest', tipo: 'estudo', status: 'feita', data: '2030-03-01', duracao_estimada: 50, concluida_em: '2030-03-01T15:00:00Z' }]
    expect(ids(run(facts))).toContain('a1'); expect(ids(run(facts))).not.toContain('a2')
  })
  it('conclusão explícita do material em andamento permite avançar', () => {
    const facts = fixture(); facts.prioritySources.progress = [complete('a1'), complete('b1')]
    expect(ids(run(facts)).slice(0, 2)).toEqual(['a2', 'a2'])
  })
  it('base inteiramente concluída não reinicia curso', () => {
    const facts = fixture(); facts.prioritySources.progress = facts.prioritySources.materials.map((row) => complete(row.id))
    const result = run(facts)
    expect(selected(result)).toEqual([]); expect(result.priorizacao.slots_sem_conteudo).toHaveLength(3)
    expect(result.reason_codes).toContain('NO_ELIGIBLE_CURRICULUM')
    expect(result.dominio).toBe('UNKNOWN')
  })
  it('prova confirmada prioriza conteúdo acadêmico sem criar bloco extra nem roubar concurso', () => {
    const facts = fixture(); facts.loadSources.commitments = [{ id: 'exam', objetivo_id: 'faculty', materia_id: 'd',
      tipo: 'prova', data: '2030-03-06', concluido: false }]
    const result = run(facts)
    expect(ids(result)).toEqual(['a1', 'b1', 'd1'])
    expect(selected(result)[2].reason_codes).toContain('CONFIRMED_DEADLINE')
    expect(result.carga_semanal.carga_proposta.minutos).toBe(130)
  })
  it('vínculo compromisso_topico identifica a matéria sem inventar vínculo material-tópico', () => {
    const facts = fixture(); facts.loadSources.commitments = [{ id: 'exam', objetivo_id: 'faculty', materia_id: null,
      tipo: 'trabalho', data: '2030-03-06', concluido: false }]
    facts.prioritySources.commitmentTopics = [{ compromisso_id: 'exam', topico_id: 'td' }]
    const decision = selected(run(facts))[2]
    expect(decision.materia_id).toBe('d'); expect(decision.topico_id).toBeNull()
  })
  it.each([['2030-03-11', false], ['2030-03-06', true]])('compromisso fora da janela ou concluído não monopoliza prioridade: %s/%s', (data, concluido) => {
    const facts = fixture(); facts.loadSources.commitments = [{ id: 'exam', objetivo_id: 'faculty', materia_id: 'd', tipo: 'prova', data, concluido }]
    expect(ids(run(facts))[2]).toBe('c1')
  })
  it('recência desempata alternativas equivalentes sem inferir esquecimento', () => {
    const facts = fixture(); facts.loadSources.history = [{ id: 'old', objetivo_id: 'contest', materia_id: 'a', tipo: 'estudo',
      status: 'feita', data: '2030-03-01', duracao_estimada: 50, concluida_em: '2030-03-01T15:00:00Z' }]
    expect(ids(run(facts))[0]).toBe('b1')
  })
  it('falta mantém material elegível sem transportar sessão nem compensar minutos', () => {
    const facts = fixture(); facts.loadSources.history = [{ id: 'lost', objetivo_id: 'contest', materia_id: 'a', material_id: 'a1',
      tipo: 'estudo', status: 'nao_concluida', data: '2030-03-01', duracao_estimada: 50 }]
    const result = run(facts)
    expect(ids(result)).toContain('a1'); expect(selected(result).some((row) => row.demanda_id === 'lost')).toBe(false)
    expect(result.carga_semanal.carga_proposta.minutos).toBe(130)
  })
  it.each(['feita', 'cancelada', 'nao_concluida'])('não utiliza %s como nova capacidade nem recria exclusão', (status) => {
    const facts = fixture(); facts.demands[0].status = status; facts.demands[0].cancelamento_origem = 'usuario'
    expect(selected(run(facts)).some((row) => row.demanda_id === 'slot-0')).toBe(false)
  })
  it.each(['movida_em', 'ordenada_em'])('preserva edição manual %s sem sugerir outra seleção para esse slot', (field) => {
    const facts = fixture(); facts.demands[0][field] = '2030-03-04T14:00:00Z'
    expect(selected(run(facts)).some((row) => row.demanda_id === 'slot-0')).toBe(false)
  })
  it('sem base de carga não inventa semana nem proporção concurso/Faculdade', () => {
    const facts = fixture(); facts.demands = []
    expect(selected(run(facts))).toEqual([])
    expect(run(facts).carga_semanal.carga_proposta).toBeNull()
  })
  it('observação isolada de erro com certeza não reordena matéria nem reinicia teoria', () => {
    const facts = fixture(), before = ids(run(facts))
    facts.prioritySources.questions = [{ id: 'q', topico_id: 'ta' }]
    facts.prioritySources.attempts = [{ id: 'answer', questao_id: 'q', resultado: 'erro', classificacao: 'certeza', criado_em: '2030-03-04T14:00:00Z' }]
    const result = run(facts)
    expect(ids(result)).toEqual(before)
    expect(result.decisoes.some((row) => row.tipo_decisao === 'RETORNO_PONTUAL_TEORIA')).toBe(false)
    expect(result.limitacoes).toContain('SUFICIENCIA_DESEMPENHO_REVISAO_RETESTE_NAO_DEFINIDA')
  })
  it('necessidade de revisão e reteste preserva agenda real sem liberar prática ou influenciar por amostra isolada', () => {
    const facts = fixture(); facts.prioritySources.questions = [{ id: 'q', topico_id: 'ta' }]
    facts.prioritySources.reviews = [{ id: 'r', questao_id: 'q', motivo: 'checagem', status: 'pendente', agendada_para: '2030-03-04T14:00:00Z' }]
    const result = run(facts)
    expect(result.priorizacao.sinais.necessidades_revisao[0]).toMatchObject({ vencida_no_corte: true, reteste: true, materia_id: 'a' })
    expect(selected(result).every((row) => row.tipo_atividade === 'ESTUDO')).toBe(true)
    expect(ids(result)).toEqual(['a1', 'b1', 'c1'])
  })
  it('review futura não é classificada como vencida', () => {
    const facts = fixture(); facts.prioritySources.questions = [{ id: 'q', topico_id: 'ta' }]
    facts.prioritySources.reviews = [{ id: 'r', questao_id: 'q', motivo: 'erro', status: 'pendente', agendada_para: '2030-03-05T14:00:00Z' }]
    expect(run(facts).priorizacao.sinais.necessidades_revisao[0].vencida_no_corte).toBe(false)
  })
  it('OCR pendente não é pulado para a aula seguinte', () => {
    const facts = fixture(); facts.prioritySources.materials[0].estado_extracao = 'pendente_ocr'
    expect(ids(run(facts))).not.toContain('a2')
    expect(run(facts).priorizacao.sinais.lacunas).toContainEqual({ materia_id: 'a', motivo: 'MATERIAL_ATUAL_PENDENTE_OCR' })
  })
  it('ordem ausente impede inventar sequência por nome ou UUID', () => {
    const facts = fixture(); facts.prioritySources.materials[0].ordem_curso = null
    expect(ids(run(facts))).not.toContain('a1'); expect(ids(run(facts))).not.toContain('a2')
  })
  it('fontes ausentes bloqueiam avaliação sem decisões parciais', () => {
    const facts = fixture(); delete facts.prioritySources
    expect(run(facts)).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [], reason_codes: ['DATA_UNAVAILABLE'] })
  })
  it('priorização não é ativada silenciosamente em registro só de continuidade', () => {
    const record = policy(); record.conteudo.politica.regras.pop()
    expect(selected(run(fixture(), record))).toEqual([])
  })
  it('progresso contraditório ou objetivo principal inválido é recusado', () => {
    const facts = fixture(); facts.prioritySources.progress = [{ material_id: 'a1', estado: 'concluido', concluido_em: null }]
    expect(run(facts).resultado).toBe('NAO_AVALIAVEL')
    facts.prioritySources.progress = []; facts.context.objetivo_principal_id = 'faculty'
    expect(run(facts).resultado).toBe('NAO_AVALIAVEL')
  })
  it('contrato recusa seleção que diverge de matéria ou perde material relacionado', () => {
    const decision = structuredClone(selected(run())[0]); decision.materia_id = 'other'
    expect(() => validateMentorV2Decision(decision)).toThrow()
    decision.materia_id = 'a'; decision.alvos_relacionados = []
    expect(() => validateMentorV2Decision(decision)).toThrow()
  })
})
