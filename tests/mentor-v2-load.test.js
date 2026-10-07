import { describe, expect, it } from 'vitest'
import { evaluateMentorV2, validateMentorV2Decision } from '../shared/mentor-v2-policy.js'

const policyRecord = { id: 'policy', modulo: 'mentor', ativo: true, versao: 'v2-test', conteudo: { politica: {
  modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO'],
  regras: [{ id: 'CONTINUIDADE_PLANO_EXISTENTE', habilitada: true }],
} } }
const demand = (id, changes = {}) => ({ id, objetivo_id: 'concurso', materia_id: null, topico_id: null,
  data: '2030-03-04', status: 'planejada', tipo: 'estudo', duracao_estimada: 50, ...changes })
const historical = (id, changes = {}) => demand(id, { data: '2030-02-25', status: 'feita', concluida_em: '2030-02-25T15:00:00Z', ...changes })
const facts = () => ({ context: { id: 1, vigente_desde: '2030-01-01' }, subjects: [], topics: [],
  demands: [demand('c30', { duracao_estimada: 30 }), demand('c50'), demand('f50', { objetivo_id: 'faculdade' })],
  loadSources: { history: [], times: [], commitments: [], objectives: [{ id: 'concurso', tipo: 'concurso' }, { id: 'faculdade', tipo: 'faculdade' }] } })
const evaluate = (input = facts(), changes = {}) => evaluateMentorV2({ policyRecord, facts: input,
  weekStart: '2030-03-04', referenceInstant: '2030-03-04T15:00:00Z', evaluationId: 'evaluation', ...changes })

describe('carga semanal V2, Fase 3.6', () => {
  it('mantém base explícita de blocos 30/50, sem teto permanente', () => {
    const result = evaluate(), load = result.carga_semanal
    expect(load).toMatchObject({ acao: 'MANTER', base_e_teto_permanente: false,
      prioridade_capacidade_adicional: 'CONCURSO', faculdade: 'CONTINUIDADE', alteracao_carga_autorizada: false,
      carga_proposta: { demandas: 3, minutos: 130 } })
    expect(load.carga_proposta.por_objetivo).toEqual([
      { objetivo_id: 'concurso', tipo_objetivo: 'concurso', demandas: 2, minutos: 80, blocos_30: 1, blocos_50: 1 },
      { objetivo_id: 'faculdade', tipo_objetivo: 'faculdade', demandas: 1, minutos: 50, blocos_30: 0, blocos_50: 1 },
    ])
    expect(load.carga_proposta).toEqual(load.carga_observada)
    result.decisoes.forEach((d) => expect(validateMentorV2Decision(d)).toBe(true))
  })
  it('boa semana isolada não aumenta carga', () => {
    const input = facts(); input.loadSources.history = [historical('h1'), historical('h2')]
    const result = evaluate(input)
    expect(result.carga_semanal.sinais.historico[0]).toMatchObject({ aderencia: 1, janela_fechada: true })
    expect(result.reason_codes).toContain('ISOLATED_WEEK_NOT_PROGRESSION')
    expect(result.carga_semanal.carga_proposta.minutos).toBe(130)
  })
  it('duas boas semanas sem policy de progressão também mantêm carga', () => {
    const input = facts(); input.loadSources.history = [historical('h1'), historical('h2', { data: '2030-02-18', concluida_em: '2030-02-18T15:00:00Z' })]
    const result = evaluate(input)
    expect(result.carga_semanal.sinais.historico.map((w) => w.aderencia)).toEqual([1, 1])
    expect(result.reason_codes).toContain('LOAD_CHANGE_POLICY_UNDEFINED')
    expect(result.carga_semanal.acao).toBe('MANTER')
  })
  it('baixa aderência é observação, não corte numérico arbitrário', () => {
    const input = facts(); input.loadSources.history = [historical('h1', { status: 'nao_concluida', concluida_em: null }), historical('h2')]
    const result = evaluate(input)
    expect(result.carga_semanal.sinais.historico[0].aderencia).toBe(0.5)
    expect(result.carga_semanal.acao).toBe('MANTER')
    expect(result.carga_semanal.alteracao_carga_autorizada).toBe(false)
  })
  it('duas faltas não viram dois blocos extras nem dívida de minutos', () => {
    const input = facts(); input.loadSources.history = [historical('h1', { status: 'nao_concluida', concluida_em: null }), historical('h2', { status: 'nao_concluida', concluida_em: null })]
    const result = evaluate(input)
    expect(result.carga_semanal.sinais.pendencias).toMatchObject({ demandas: 2, divida_minutos: 0 })
    expect(result.reason_codes).toContain('NO_HOUR_DEBT')
    expect(result.decisoes).toHaveLength(3)
  })
  it('cancelamento do Mentor e exclusão manual não são faltas do aluno', () => {
    const input = facts(); input.loadSources.history = [historical('ok'), historical('mentor', { status: 'cancelada', cancelamento_origem: 'mentor' }),
      historical('manual', { status: 'cancelada', cancelamento_origem: 'usuario' })]
    const result = evaluate(input)
    expect(result.carga_semanal.sinais.historico[0]).toMatchObject({ demandas_elegiveis: 1, aderencia: 1,
      cancelamentos_mentor: 1, exclusoes_manuais: 1 })
    expect(result.carga_semanal.sinais.pendencias.demandas).toBe(0)
  })
  it('tempo real excedente e livre não criam entregas ou expansão', () => {
    const input = facts(); input.demands[1] = { ...input.demands[1], status: 'feita', concluida_em: '2030-03-04T13:00:00Z' }
    input.loadSources.times = [{ id: 't1', sessao_id: 'c50', status: 'concluido', segundos_acumulados: 4020, finalizado_em: '2030-03-04T13:00:00Z' },
      { id: 't2', sessao_id: null, status: 'concluido', segundos_acumulados: 1800, finalizado_em: '2030-03-04T14:00:00Z' }]
    const result = evaluate(input)
    expect(result.carga_semanal.sinais.execucao).toMatchObject({ demandas_concluidas: 1, segundos_reais: 5820, segundos_vinculados: 4020, segundos_livres: 1800 })
    expect(result.carga_semanal.carga_proposta.minutos).toBe(130)
    expect(result.decisoes).toHaveLength(2)
  })
  it('concluir demanda sem timer não inventa tempo real', () => {
    const input = facts(); input.demands[0] = { ...input.demands[0], status: 'feita', concluida_em: '2030-03-04T13:00:00Z' }
    expect(evaluate(input).carga_semanal.sinais.execucao).toMatchObject({ demandas_concluidas: 1, segundos_reais: 0 })
    delete input.loadSources.times
    expect(evaluate(input).carga_semanal.sinais.execucao.segundos_reais).toBeNull()
  })
  it('regularidade usa dias distintos, não número de timers', () => {
    const input = facts(); input.loadSources.history = [historical('h1'), historical('h2'), historical('h3', { data: '2030-02-26', concluida_em: '2030-02-26T15:00:00Z' })]
    expect(evaluate(input).carga_semanal.sinais.historico[0].regularidade).toEqual({ dias_com_entrega: ['2030-02-25', '2030-02-26'], quantidade_dias: 2 })
  })
  it('semana em aberto não vira aderência final nem prova de progressão', () => {
    const input = facts(); input.loadSources.history = [historical('h1', { data: '2030-03-03', concluida_em: '2030-03-03T15:00:00Z' })]
    const result = evaluate(input, { referenceInstant: '2030-03-03T18:00:00Z' })
    expect(result.carga_semanal.sinais.historico[0]).toMatchObject({ janela_fechada: false, aderencia: null })
    expect(result.reason_codes).not.toContain('ISOLATED_WEEK_NOT_PROGRESSION')
  })
  it('conclusão tardia não melhora retroativamente a aderência', () => {
    const input = facts(); input.loadSources.history = [historical('h1', { concluida_em: '2030-03-04T14:00:00Z' })]
    expect(evaluate(input).carga_semanal.sinais.historico[0]).toMatchObject({ aderencia: 0, concluidas_no_prazo: 0 })
  })
  it('conclusão sem timestamp deixa aderência desconhecida', () => {
    const input = facts(); input.loadSources.history = [historical('h1', { concluida_em: null })]
    expect(evaluate(input).carga_semanal.sinais.historico[0]).toMatchObject({ aderencia: null, conclusoes_sem_instante: 1 })
  })
  it('prova na semana é considerada sem transformar prazo em blocos adicionais', () => {
    const input = facts(); input.loadSources.commitments = [{ id: 'exam', objetivo_id: 'faculdade', tipo: 'prova', data: '2030-03-06', concluido: false }]
    const result = evaluate(input)
    expect(result.reason_codes).toContain('CONFIRMED_DEADLINE')
    expect(result.carga_semanal.sinais.compromissos[0]).toMatchObject({ id: 'exam', dias_ate: 2 })
    expect(result.carga_semanal.carga_proposta.minutos).toBe(130)
  })
  it('prova concluída e prazo fora da semana não produzem urgência artificial', () => {
    const input = facts(); input.loadSources.commitments = [{ id: 'done', data: '2030-03-06', concluido: true }, { id: 'future', data: '2030-04-01', concluido: false }]
    expect(evaluate(input).reason_codes).not.toContain('CONFIRMED_DEADLINE')
  })
  it('eventos de prova/aula não viram blocos comuns', () => {
    const input = facts(); input.demands.push(demand('exam', { tipo: 'prova', duracao_estimada: 120 }), demand('class', { tipo: 'aula', duracao_estimada: 100 }))
    expect(evaluate(input).carga_semanal.carga_observada.minutos).toBe(130)
  })
  it('nova modalidade não gera carga por si só e configuração histórica não libera progressão', () => {
    const input = facts(); input.context.carga_atual = { concurso: 10 }; input.context.fase = 'adaptacao_teorica_1'
    input.signals = [{ sinal_id: 'good', nome: 'aderencia', fonte: 'sessao', escopo: {}, janela: {}, valor: 1 }]
    const result = evaluate(input)
    expect(result.carga_semanal.acao).toBe('MANTER')
    expect(result.decisoes.some((d) => d.tipo_decisao !== 'MANTER_DEMANDA')).toBe(false)
  })
  it.each(['leve', 'normal', 'pesada'])('não utiliza feedback subjetivo %s', (feedback) => {
    const input = facts(); input.context.carga_percebida = feedback
    expect(evaluate(input).carga_semanal).toEqual(evaluate().carga_semanal)
  })
  it('sem plano vigente não importa carga antiga nem afirma que zero é uma carga decidida', () => {
    const input = facts(); input.demands = []; input.loadSources.history = [historical('h1')]
    expect(evaluate(input).carga_semanal).toMatchObject({ acao: 'MANTER', situacao: 'SEM_BASE_VIGENTE', carga_proposta: null })
  })
  it('ordem incidental de histórico/tempo não muda a avaliação de carga', () => {
    const input = facts(); input.loadSources.history = [historical('h2'), historical('h1')]
    const result = evaluate(input)
    const before = structuredClone(input)
    expect(evaluate({ ...input, loadSources: { ...input.loadSources, history: [...input.loadSources.history].reverse() } }).carga_semanal).toEqual(result.carga_semanal)
    expect(input).toEqual(before)
  })
  it('datas UTC próximas à meia-noite são classificadas em Brasília', () => {
    const input = facts(); input.loadSources.times = [{ id: 't1', status: 'concluido', segundos_acumulados: 1800, finalizado_em: '2030-03-04T01:00:00Z' }]
    expect(evaluate(input).carga_semanal.sinais.execucao.segundos_reais).toBe(0)
  })
  it('duração factual inválida não é corrigida inventando 50 minutos', () => {
    const input = facts(); input.demands[0].duracao_estimada = -1
    expect(evaluate(input)).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [], reason_codes: ['DATA_INCONSISTENCY'] })
  })
})
