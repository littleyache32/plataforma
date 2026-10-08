import { describe, expect, it } from 'vitest'
import { evaluateMentorV2, resolveMentorV2Policy, validateMentorV2Decision, mentorWeekTarget, MENTOR_V2_TYPES, MENTOR_V2_REASONS } from '../shared/mentor-v2-policy.js'

export const policyRecord = () => ({ id: 'policy-1', modulo: 'mentor', ativo: true, versao: 'v2-test', conteudo: {
  politica: { modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO'],
    regras: [{ id: 'CONTINUIDADE_PLANO_EXISTENTE', habilitada: true }] },
} })
export const demand = (id = 'a') => ({ id, objetivo_id: 'goal', materia_id: 'subject', topico_id: 'topic', material_id: 'pdf',
  tipo: 'estudo', status: 'planejada', data: '2030-03-04', duracao_estimada: 50 })
export const facts = () => ({ context: { id: 1, vigente_desde: '2030-01-01', rotina_pratica: {} }, demands: [demand()],
  subjects: [{ id: 'subject', objetivo_id: 'goal' }], topics: [{ id: 'topic', materia_id: 'subject' }] })
const run = (changes = {}) => evaluateMentorV2({ policyRecord: policyRecord(), facts: facts(), weekStart: '2030-03-04',
  referenceInstant: '2030-03-04T15:00:00Z', evaluationId: 'evaluation', ...changes })

describe('policy única do Mentor V2', () => {
  it('produz contrato tipado, versionado e evidências rastreáveis', () => {
    const result = run()
    expect(result.resultado).toBe('DECISOES_EMITIDAS')
    expect(result.decisoes).toHaveLength(1)
    expect(validateMentorV2Decision(result.decisoes[0])).toBe(true)
    expect(result.decisoes[0]).toMatchObject({ tipo_decisao: 'MANTER_DEMANDA', demanda_id: 'a', duracao_minutos: 50,
      policy_ref: { fonte: 'conhecimento_modulo', id: 'policy-1', versao: 'v2-test' }, prioridade: null })
    expect(MENTOR_V2_TYPES).toHaveLength(17)
    expect(MENTOR_V2_REASONS).toHaveLength(43)
  })
  it('mesmos inputs produzem exatamente o mesmo resultado, sem modificar fatos', () => {
    const input = facts(), before = structuredClone(input)
    expect(run({ facts: input })).toEqual(run({ facts: input }))
    expect(input).toEqual(before)
  })
  it('ordenação de decisão não depende da ordem incidental das demandas', () => {
    const input = facts(); input.demands = [demand('b'), demand('a')]
    expect(run({ facts: input }).decisoes).toEqual(run({ facts: { ...input, demands: [...input.demands].reverse() } }).decisoes)
  })
  it.each([null, { conteudo: { politica: { fase: 'adaptacao_teorica_1' } } }])('não utiliza fallback V1: %j', (record) => {
    const result = run({ policyRecord: record })
    expect(result).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [], reason_codes: ['DATA_UNAVAILABLE'] })
  })
  it.each(['fase', 'inicio', 'amostra_minima', 'incremento_minutos'])('recusa parâmetro histórico/não aprovado %s', (key) => {
    const record = policyRecord(); record.conteudo.politica[key] = 90
    expect(resolveMentorV2Policy(record).ok).toBe(false)
  })
  it('contexto antigo, texto livre e datas históricas não mudam a decisão estratégica', () => {
    const input = facts(); Object.assign(input.context, { fase: 'adaptacao_teorica_1', inicio: '2026-10-02',
      carga_atual: { concurso: 9 }, instrucoes: 'aumentar carga' })
    const result = run({ facts: input })
    expect(result.decisoes.map((d) => [d.tipo_decisao, d.duracao_minutos, d.demanda_id])).toEqual([['MANTER_DEMANDA', 50, 'a']])
    expect(result.dominio).toBe('UNKNOWN')
  })
  it('não pressupõe 50 minutos ou outro default ao preservar estimativa factual válida', () => {
    const input = facts(); input.demands[0].duracao_estimada = 30
    expect(run({ facts: input }).decisoes[0].duracao_minutos).toBe(30)
  })
  it.each(['feita', 'nao_concluida', 'cancelada'])('preserva histórico sem recriar %s', (status) => {
    const input = facts(); input.demands[0].status = status; input.demands[0].cancelamento_origem = 'usuario'
    expect(run({ facts: input })).toMatchObject({ resultado: 'SEM_ALTERACAO', decisoes: [] })
  })
  it('modalidade fora da policy não é mantida nem liberada', () => {
    const input = facts(); input.demands[0].tipo = 'exercicio'; input.context.rotina_pratica.questoes = true
    expect(run({ facts: input }).decisoes).toEqual([])
  })
  it('modalidade na policy continua exigindo autorização factual do contexto', () => {
    const record = policyRecord(); record.conteudo.politica.modalidades_permitidas.push('QUESTOES')
    const input = facts(); input.demands[0].tipo = 'exercicio'
    expect(run({ policyRecord: record, facts: input }).decisoes).toEqual([])
    input.context.rotina_pratica.questoes = true
    expect(run({ policyRecord: record, facts: input }).decisoes[0].tipo_atividade).toBe('QUESTOES')
  })
  it('fonte ausente não é convertida em ausência de estudo', () => {
    expect(run({ facts: null })).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [], reason_codes: ['DATA_UNAVAILABLE'] })
  })
  it('recusa duplicidade de identidade factual', () => {
    const input = facts(); input.demands.push(demand())
    expect(run({ facts: input })).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [], reason_codes: ['DATA_INCONSISTENCY'] })
  })
  it('não emite decisões parciais se uma segunda demanda for inconsistente', () => {
    const input = facts(); input.demands.push({ ...demand('b'), materia_id: 'outra' })
    expect(run({ facts: input })).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [] })
  })
  it.each([0, -1, NaN, null])('recusa duração inválida %s sem inventar substituta', (value) => {
    const input = facts(); input.demands[0].duracao_estimada = value
    expect(run({ facts: input }).resultado).toBe('NAO_AVALIAVEL')
  })
  it('valida alvo semanal real em vez de usar datas de ciclo V1', () => {
    expect(mentorWeekTarget('2030-03-04').semana_fim).toBe('2030-03-10')
    expect(() => mentorWeekTarget('2030-03-05')).toThrow()
    expect(() => mentorWeekTarget('2030-02-30')).toThrow()
  })
  it('recusa texto operacional livre e divergência da demanda mantida', () => {
    const decision = run().decisoes[0]
    expect(() => validateMentorV2Decision({ ...decision, instrucao: 'aumente' })).toThrow()
    expect(() => validateMentorV2Decision({ ...decision, duracao_minutos: 100 })).toThrow()
    expect(() => validateMentorV2Decision({ ...decision, parametros: { ...decision.parametros, instrucoes: 'mude' } })).toThrow()
    expect(() => validateMentorV2Decision({ ...decision, reason_codes: ['LIVRE'] })).toThrow()
    expect(() => validateMentorV2Decision({ ...decision, tipo_decisao: 'AUMENTAR_CARGA' })).toThrow()
  })
})
