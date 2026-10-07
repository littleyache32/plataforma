import { describe, expect, it } from 'vitest'
import { evaluateMentorV2, validateMentorV2Decision } from '../shared/mentor-v2-policy.js'

const policyRecord = { id: 'policy', modulo: 'mentor', ativo: true, versao: 'v2-test', conteudo: { politica: {
  modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO'],
  regras: [{ id: 'CONTINUIDADE_PLANO_EXISTENTE', habilitada: true }],
} } }
const demand = (id, objective, order) => ({ id, objetivo_id: objective, tipo: 'estudo', status: 'planejada',
  materia_id: null, topico_id: null, data: '2030-03-04', duracao_estimada: 50, ordem: order })
const facts = () => ({ context: { id: 1, vigente_desde: '2030-01-01' }, subjects: [], topics: [],
  demands: [demand('c1', 'concurso', 1), demand('c2', 'concurso', 2), demand('f1', 'faculdade', 3)] })
const signal = (id, value, extra = {}) => ({ sinal_id: id, nome: 'acuracia', fonte: 'registro',
  escopo: { objetivo_id: 'concurso', materia_id: 'portugues' }, janela: { inicio: '2030-03-01', fim: '2030-03-04' },
  valor: value, volume: 1, dias_distintos: 1, sessoes_distintas: 1, retestes: 0, ...extra })
const evaluate = (input = facts(), changes = {}) => evaluateMentorV2({ policyRecord, facts: input, weekStart: '2030-03-04',
  referenceInstant: '2030-03-04T15:00:00Z', evaluationId: 'evaluation', ...changes })
const maintained = (result) => result.decisoes.map((d) => [d.demanda_id, d.tipo_decisao, d.duracao_minutos, d.parametros.estado_observado.ordem])

describe('fallback conservador do Mentor V2, Fase 3.5', () => {
  it('sem sinais, explicita insuficiência e conserva a continuidade', () => {
    const result = evaluate()
    expect(result.reason_codes).toContain('INSUFFICIENT_EVIDENCE')
    expect(result.fallback).toMatchObject({ ativo: true, dominio: 'UNKNOWN', fraqueza_forte: 'UNKNOWN',
      aumentar_carga: false, adicionar_modalidades: false, coleta_evidencia: 'EVENTOS_NORMAIS' })
    expect(result.decisoes.every((d) => d.tipo_decisao === 'MANTER_DEMANDA')).toBe(true)
    expect(result.explicacao).toContain('não autoriza mudança estratégica')
  })
  it.each([0, 1])('uma resposta com acurácia %s não comprova fraqueza forte nem domínio', (value) => {
    const input = facts(); input.signals = [signal('s1', value)]
    const result = evaluate(input)
    expect(result.fallback.fraqueza_forte).toBe('UNKNOWN')
    expect(result.dominio).toBe('UNKNOWN')
    expect(maintained(result)).toEqual(maintained(evaluate()))
    expect(result.reason_codes).not.toContain('QUESTION_PERFORMANCE')
  })
  it('volume alto e selo de suficiente no input não substituem regra aprovada', () => {
    const input = facts(); input.signals = [signal('s1', 1, { volume: 1000, dias_distintos: 100,
      sessoes_distintas: 100, retestes: 100, qualificacao: { suficiente: true } })]
    expect(evaluate(input)).toMatchObject({ dominio: 'UNKNOWN', fallback: { aumentar_carga: false,
      qualificacao_evidencia: 'SEM_REGRA_DE_SUFICIENCIA_APROVADA' } })
  })
  it('tempo e cobertura não viram domínio nem mudança de método', () => {
    const input = facts(); input.signals = [signal('tempo', 6000, { nome: 'tempo', fonte: 'tempo_estudo' }),
      signal('cobertura', 1, { nome: 'cobertura', fonte: 'material_progresso' })]
    const result = evaluate(input)
    expect(result.dominio).toBe('UNKNOWN')
    expect(result.decisoes.every((d) => d.tipo_atividade === 'ESTUDO')).toBe(true)
  })
  it('mantém concurso estrutural e Faculdade existente sem ampliar ou remover blocos', () => {
    const input = facts(), before = structuredClone(input)
    const result = evaluate(input)
    expect(result.fallback).toMatchObject({ prioridade_estrutural: 'CONCURSO', faculdade: 'PRESERVAR_SEM_EXPANDIR' })
    expect(maintained(result)).toEqual([['c1', 'MANTER_DEMANDA', 50, 1], ['c2', 'MANTER_DEMANDA', 50, 2], ['f1', 'MANTER_DEMANDA', 50, 3]])
    expect(input).toEqual(before)
    expect(result.decisoes.every((d) => d.prioridade === null)).toBe(true)
  })
  it('evidência acadêmica isolada não promove Faculdade sobre concurso', () => {
    const input = facts(); input.signals = [signal('fac', 0, { escopo: { objetivo_id: 'faculdade' } })]
    expect(maintained(evaluate(input))).toEqual(maintained(evaluate()))
  })
  it('falta e backlog não acrescentam dívida de horas', () => {
    const input = facts(); input.demands.push({ ...demand('falta', 'concurso', 4), status: 'nao_concluida' })
    input.signals = [signal('backlog', 100, { nome: 'pendencias', fonte: 'sessao' })]
    expect(evaluate(input).decisoes).toHaveLength(3)
  })
  it('continua coleta pelos eventos normais, sem criar prática para obter evidência', () => {
    const result = evaluate()
    expect(result.fallback.coleta_evidencia).toBe('EVENTOS_NORMAIS')
    expect(result.decisoes.some((d) => /^SOLICITAR_|CRIAR_DEMANDA|AUMENTAR_CARGA/.test(d.tipo_decisao))).toBe(false)
  })
  it('valores divergentes da mesma medida/escopo/janela geram conflito específico', () => {
    const input = facts(); input.signals = [signal('a', 0), signal('b', 1)]
    const result = evaluate(input)
    expect(result.reason_codes).toContain('UNRESOLVED_SIGNAL_CONFLICT')
    expect(result.fallback.conflitos[0].sinal_ids).toEqual(['a', 'b'])
    expect(maintained(result)).toEqual(maintained(evaluate()))
    for (const decision of result.decisoes) {
      expect(validateMentorV2Decision(decision)).toBe(true)
      expect(decision.fundamentacao.some((f) => f.codigo === 'UNRESOLVED_SIGNAL_CONFLICT' && f.evidencia_ids.includes('fallback'))).toBe(true)
    }
  })
  it('conflito explícito entre medidas distintas preserva plano sem decidir por uma delas', () => {
    const input = facts(); input.signals = [signal('aderencia', 1, { nome: 'aderencia', fonte: 'sessao' }),
      signal('disponibilidade', 0, { nome: 'disponibilidade', fonte: 'mentor_contexto' })]
    input.signalConflicts = [{ id: 'sustentabilidade', sinal_ids: ['disponibilidade', 'aderencia'] }]
    const result = evaluate(input)
    expect(result.reason_codes).toContain('UNRESOLVED_SIGNAL_CONFLICT')
    expect(result.fallback.aumentar_carga).toBe(false)
    expect(result.explicacao).toContain('sem desempate aleatório')
  })
  it('ordem de sinais não altera o resultado nem resolve conflito pelo primeiro', () => {
    const input = facts(); input.signals = [signal('b', 1), signal('a', 0)]
    expect(evaluate(input)).toEqual(evaluate({ ...input, signals: [...input.signals].reverse() }))
  })
  it.each([{ nome: 'outra' }, { escopo: { objetivo_id: 'faculdade' } }, { janela: { inicio: '2030-01-01', fim: '2030-02-01' } },
    { unidade: 'minutos' }, { versao_definicao: 'outra-versao' }, { corte: '2030-03-04T16:00:00Z' }])('medidas/escopos/janelas diferentes não fabricam conflito: %j', (difference) => {
    const input = facts(); input.signals = [signal('a', 0), signal('b', 1, difference)]
    expect(evaluate(input).reason_codes).not.toContain('UNRESOLVED_SIGNAL_CONFLICT')
  })
  it('valores iguais não produzem falso conflito', () => {
    const input = facts(); input.signals = [signal('a', { acertos: 1, total: 2 }), signal('b', { total: 2, acertos: 1 })]
    expect(evaluate(input).fallback.conflitos).toEqual([])
  })
  it('conflito sem referências rastreáveis é inconsistência, não desempate', () => {
    const input = facts(); input.signals = [signal('a', 0)]; input.signalConflicts = [{ id: 'conflict', sinal_ids: ['a', 'inexistente'] }]
    expect(evaluate(input)).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [], reason_codes: ['DATA_INCONSISTENCY'] })
  })
  it('sem plano válido não inventa carga inicial ou substitui dados ausentes', () => {
    const input = facts(); input.demands = []
    expect(evaluate(input)).toMatchObject({ resultado: 'SEM_ALTERACAO', decisoes: [], fallback: { aumentar_carga: false } })
    expect(evaluate(null)).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [], reason_codes: ['DATA_UNAVAILABLE'] })
  })
  it('evidência insuficiente/conflito nunca resgata policy histórica', () => {
    const input = facts(); input.signals = [signal('a', 0), signal('b', 1)]
    const legacy = { id: 'legacy', conteudo: { politica: { amostra_minima: 10, fase: 'adaptacao_teorica_1' } } }
    expect(evaluate(input, { policyRecord: legacy })).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [], reason_codes: ['DATA_UNAVAILABLE'] })
  })
})
