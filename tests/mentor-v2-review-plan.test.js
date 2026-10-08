import { describe, expect, it } from 'vitest'
import { evaluateMentorV2, validateMentorV2Decision } from '../shared/mentor-v2-policy.js'
import { materializeMentorWeek } from '../api/_lib/mentor-v2-plan.js'
import { projectPlannedReviewCoverage } from '../shared/mentor-v2-review-plan.js'
import { readMentorReviewCoverage, separateCoveredCentralItems } from '../api/_lib/mentor-v2-review-coverage.js'
import { questionReviewEvidence } from '../shared/review-v2-evidence.js'
import { assessQuestionCorrectionSignal } from '../shared/mentor-v2-question-signals.js'
import { selectMentorReviewMethod } from '../shared/mentor-v2-review-method.js'
import { orderReviewQueue } from '../shared/review-v2-queue.js'

const start = '2030-03-04', corte = `${start}T15:00:00Z`, ref = { id: 'p', versao: 'test-v2' }
function item(id, confidence = 'certeza') {
  const evidencia = questionReviewEvidence({ registro: { id: `r-${id}`, questao_id: id, resultado: 'erro', classificacao: confidence, criado_em: corte }, questao: { id, topico_id: 't' }, corte })
  const elegibilidade = assessQuestionCorrectionSignal({ evidencia, policy_ref: ref }).elegibilidade
  const metodo = selectMentorReviewMethod({ elegibilidade, policy_ref: ref, fontes: evidencia.fontes,
    topico_id: 't', recursos: { questoes: [{ id, topico_id: 't', ativo: true, elegivel: true }] },
    slots: [{ id: 'method-slot', atividade: 'QUESTOES', duracao_minutos: 30 }], modalidades: ['QUESTOES'] })
  return { fonte: { tipo: 'RETESTE_QUESTAO', entidade: 'revisao_item', id: `need-${id}`, alvo: { entidade: 'questao', id } },
    objetivo_id: 'contest', materia_id: 'm', topico_id: 't', evidencia, elegibilidade, metodo, agendada_para: corte }
}
function fixture() {
  const facts = { context: { id: 1, objetivo_principal_id: 'contest', rotina_pratica: { questoes: true, revisao_pratica: true },
    capacidade_inicial: { versao: 'capacidade-inicial-v2/1', revisao: 'test', slots: [
      { dia: 0, objetivo_id: 'contest', atividade: 'ESTUDO', duracao_minutos: 50 },
      { dia: 0, objetivo_id: 'faculty', atividade: 'ESTUDO', duracao_minutos: 50 },
      ...[0, 1].map((dia) => ({ dia, objetivo_id: 'contest', atividade: 'REVISAO', duracao_minutos: 30, justificativa_30: 'Revisão curta reservada' })),
    ] }, disponibilidade: { versao: 'disponibilidade-v2/1', dias: [0, 1].map((offset) => ({ data: `2030-03-0${4 + offset}`, minutos: 130 })) } },
    demands: [], planIdentities: [], subjects: [{ id: 'm', objetivo_id: 'contest' }, { id: 'f', objetivo_id: 'faculty' }],
    topics: [{ id: 't', materia_id: 'm', nome: 'Conceito alvo' }],
    loadSources: { objectives: [{ id: 'contest', tipo: 'concurso' }, { id: 'faculty', tipo: 'faculdade' }], history: [], times: [], commitments: [] },
    prioritySources: { materials: [{ id: 'mat', objetivo_id: 'contest', materia_id: 'm', ordem_curso: 1, nome: 'Aula atual', status: 'aceito', estado_extracao: 'texto' },
      { id: 'faculty-mat', objetivo_id: 'faculty', materia_id: 'f', ordem_curso: 1, nome: 'Aula faculdade', status: 'aceito', estado_extracao: 'texto' }],
      progress: [], commitmentTopics: [], reviews: ['a', 'z'].map((id) => ({ id: `need-${id}`, questao_id: id, motivo: 'erro', status: 'pendente', agendada_para: corte })),
      questions: ['a', 'z'].map((id) => ({ id, topico_id: 't' })), attempts: [], cards: [] },
    reviewPlanning: { itens: [item('a', 'sem_conhecimento'), item('z')] } }
  return { facts, weekStart: start, referenceInstant: corte, evaluationId: 'evaluation', policyRecord: { id: ref.id, modulo: 'mentor', ativo: true, versao: ref.versao,
    conteudo: { politica: { modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO', 'REVISAO', 'QUESTOES'],
      regras: ['CONTINUIDADE_PLANO_EXISTENTE', 'PRIORIZACAO_CURRICULAR_SEMANAL', 'GERACAO_PLANO_SEMANAL'].map((id) => ({ id, habilitada: true })) } } } }
}
const run = (input = fixture()) => evaluateMentorV2(input)
const reviews = (evaluation) => evaluation.decisoes.filter((row) => row.tipo_decisao === 'CRIAR_DEMANDA' && row.tipo_atividade === 'REVISAO')
function coverage(evaluation, rows = materializeMentorWeek(evaluation)) {
  return reviews(evaluation).map((decision) => projectPlannedReviewCoverage({ decisao: decision,
    demanda: rows.find((row) => row.chave_mentor.endsWith(`:decision:${decision.decisao_id}`)) })).filter(Boolean)
}
function database(evaluation, demands) {
  const tables = { sessao: demands, mentor_decisao: [{ chave_operacao: 'evaluation', tipo: 'avaliacao_mentor_v2', dados: { modelo: 'MENTOR_V2', avaliacao: evaluation } }] }
  return { from(table) {
    const filters = [], query = {
      select() { return this }, eq(key, value) { filters.push((row) => row[key] === value); return this },
      in(key, values) { filters.push((row) => values.includes(row[key])); return this },
      gte(key, value) { filters.push((row) => row[key] >= value); return this },
      async maybeSingle() { return { data: tables[table].find((row) => filters.every((filter) => filter(row))) ?? null, error: null } },
      then(resolve) { resolve({ data: tables[table].filter((row) => filters.every((filter) => filter(row))), error: null }) },
    }; return query
  } }
}

describe('Fase 4.8, revisão integrada ao Mentor e Meu Plano', () => {
  it('materializa prioridade, matéria, tópico, método, duração, motivos e origem auditável', () => {
    const evaluation = run(), rows = materializeMentorWeek(evaluation), decisions = reviews(evaluation)
    expect(rows).toHaveLength(4); expect(decisions).toHaveLength(2)
    expect(rows.find((row) => row.tipo === 'revisao').titulo).toBe('Revisão (questão): Conceito alvo')
    expect(decisions[0].parametros.revisao.fontes[0].id).toBe('need-z')
    for (const decision of decisions) {
      expect(validateMentorV2Decision(decision)).toBe(true)
      expect(decision).toMatchObject({ materia_id: 'm', topico_id: 't', duracao_minutos: 30, reason_codes: expect.arrayContaining(['REVIEW_NEED', 'NO_HOUR_DEBT']) })
      expect(decision.parametros.revisao.metodo.metodo).toBe('QUESTAO_INDIVIDUAL')
      expect(decision.evidencias_utilizadas.some((row) => row.evidencia_id === 'revisao_planejada')).toBe(true)
    }
  })
  it('muitas revisões não substituem estudo de concurso/Faculdade nem aumentam carga', () => {
    const args = fixture(); args.facts.reviewPlanning.itens.push(...Array.from({ length: 15 }, (_, i) => item(`extra-${i}`)))
    for (let i = 0; i < 15; i++) {
      args.facts.prioritySources.questions.push({ id: `extra-${i}`, topico_id: 't' })
      args.facts.prioritySources.reviews.push({ id: `need-extra-${i}`, questao_id: `extra-${i}`, motivo: 'erro', status: 'pendente', agendada_para: corte })
    }
    const rows = materializeMentorWeek(run(args))
    expect(rows.filter((row) => row.tipo === 'revisao')).toHaveLength(2)
    expect(rows.filter((row) => row.tipo === 'estudo').map((row) => row.objetivo_id).sort()).toEqual(['contest', 'faculty'])
    expect(rows.reduce((sum, row) => sum + row.duracao_estimada, 0)).toBe(160)
  })
  it('sem slot reservado não acrescenta revisão nem troca teoria', () => {
    const args = fixture(); args.facts.context.capacidade_inicial.slots = args.facts.context.capacidade_inicial.slots.filter((row) => row.atividade === 'ESTUDO')
    expect(reviews(run(args))).toEqual([])
    expect(materializeMentorWeek(run(args))).toHaveLength(2)
  })
  it('não gera revisão por configuração/data legada sem projeção V2', () => {
    const args = fixture(); delete args.facts.reviewPlanning
    const evaluation = run(args)
    expect(reviews(evaluation)).toEqual([])
    expect(evaluation.limitacoes).toContain('REVISAO_V2_SEM_ITEM_METODO_OU_CAPACIDADE_COMPATIVEL')
  })
  it('falta de disponibilidade reduz materialização sem sobrecarga ou dívida', () => {
    const args = fixture(); args.facts.context.disponibilidade.dias = [{ data: start, minutos: 100 }]
    expect(reviews(run(args))).toEqual([])
    expect(materializeMentorWeek(run(args)).reduce((sum, row) => sum + row.duracao_estimada, 0)).toBe(100)
  })
  it.each(['REVISAO', 'QUESTOES'])('respeita gate/policy de %s', (activity) => {
    const args = fixture(); args.policyRecord.conteudo.politica.modalidades_permitidas = args.policyRecord.conteudo.politica.modalidades_permitidas.filter((value) => value !== activity)
    expect(reviews(run(args))).toEqual([])
  })
  it('método pendente ou duração incompatível não fabrica demanda', () => {
    const args = fixture(); args.facts.reviewPlanning.itens.forEach((entry) => { entry.metodo.resultado = 'METODO_PENDENTE' })
    expect(reviews(run(args))).toEqual([])
    expect(materializeMentorWeek(run(args)).filter((row) => row.tipo === 'estudo')).toHaveLength(2)
    const other = fixture(); other.facts.reviewPlanning.itens.forEach((entry) => { entry.metodo.componentes[0].duracao_minutos = 50 })
    expect(reviews(run(other))).toEqual([])
  })
  it('mesma necessidade ocupa no máximo um slot', () => {
    const args = fixture(); args.facts.reviewPlanning.itens = [item('z')]
    expect(reviews(run(args))).toHaveLength(1)
  })
  it('escopo configurado limita revisão e não redireciona capacidade de outro objetivo', () => {
    const args = fixture(); args.facts.context.capacidade_inicial.slots.filter((slot) => slot.atividade === 'REVISAO')
      .forEach((slot) => { slot.materia_id = 'f'; slot.topico_id = 'faculty-topic' })
    expect(reviews(run(args))).toEqual([])
  })
  it('combinação não é fundida nem considerada totalmente coberta com apenas um componente', () => {
    const args = fixture(); args.facts.reviewPlanning.itens.forEach((entry) => {
      entry.metodo.metodo = 'COMBINACAO'; entry.metodo.componentes.push(structuredClone(entry.metodo.componentes[0]))
    })
    expect(reviews(run(args))).toEqual([])
    expect(materializeMentorWeek(run(args)).filter((row) => row.tipo === 'estudo')).toHaveLength(2)
  })
  it('recalcular preserva demandas existentes, exclusões e identidade', () => {
    const args = fixture(), first = run(args), rows = materializeMentorWeek(first)
    args.facts.demands = rows
    args.facts.planIdentities = rows
    expect(materializeMentorWeek(run(args))).toEqual([])
    args.facts.demands = rows.filter((row) => row.tipo !== 'revisao')
    args.facts.planIdentities = rows.map((row) => row.tipo === 'revisao' ? { ...row, status: 'cancelada', cancelamento_origem: 'exclusao_manual' } : row)
    expect(reviews(run(args))).toEqual([])
  })
  it('demanda prioritária hoje suprime item equivalente da Central sem concluir/apagar necessidade', () => {
    const args = fixture(), evaluation = run(args), planned = coverage(evaluation)
    const queue = orderReviewQueue({ itens: args.facts.reviewPlanning.itens, demandas: planned, corte })
    expect(queue.cobertos_no_plano).toHaveLength(1)
    // The second review is tomorrow: a due item still remains actionable today.
    expect(queue.itens).toHaveLength(1)
    expect(args.facts.reviewPlanning.itens.every((entry) => entry.elegibilidade.elegivel)).toBe(true)
  })
  it('handler projeta cobertura da decisão original persistida sem criar nova flag no banco', async () => {
    const evaluation = run(), rows = materializeMentorWeek(evaluation)
    const planned = await readMentorReviewCoverage({ supabase: database(evaluation, rows), corte })
    expect(planned).toHaveLength(2)
    const central = separateCoveredCentralItems({ corte, demandas: planned,
      itens: ['a', 'z'].map((id) => ({ tipo: 'questao', id: `need-${id}`, item_id: id, agendada_para: corte })) })
    expect(central.cobertos_no_plano.map((row) => row.item_id)).toEqual(['z'])
    expect(central.itens.map((row) => row.item_id)).toEqual(['a'])
  })
  it('movimento manual fora do prazo devolve ação à Central sem reescrever método/origem', () => {
    const args = fixture(), evaluation = run(args), rows = materializeMentorWeek(evaluation)
    const copy = structuredClone(evaluation)
    rows.filter((row) => row.tipo === 'revisao').forEach((row) => { row.data = '2030-03-06' })
    const queue = orderReviewQueue({ itens: args.facts.reviewPlanning.itens, demandas: coverage(evaluation, rows), corte })
    expect(queue.cobertos_no_plano).toEqual([]); expect(evaluation).toEqual(copy)
  })
  it.each(['cancelada', 'feita'])('demanda %s não oculta item ainda elegível', (status) => {
    const args = fixture(), evaluation = run(args), rows = materializeMentorWeek(evaluation)
    rows.filter((row) => row.tipo === 'revisao').forEach((row) => { row.status = status })
    expect(coverage(evaluation, rows)).toEqual([])
  })
  it('não confunde outra ocorrência da mesma questão com cobertura exata', () => {
    const evaluation = run(), planned = coverage(evaluation)
    const queue = separateCoveredCentralItems({ corte, demandas: planned, itens: [{ tipo: 'questao', id: 'different-need', item_id: 'z', agendada_para: corte }] })
    expect(queue.itens).toHaveLength(1)
  })
  it('origem/metadados alterados são recusados, sem materializar demanda incompleta', () => {
    const evaluation = run(); reviews(evaluation)[0].parametros.revisao.metodo.componentes[0].duracao_minutos = 50
    expect(() => materializeMentorWeek(evaluation)).toThrow()
  })
  it('não cria demanda por projeção de ocorrência ausente/incompatível na fonte canônica', () => {
    const args = fixture(); args.facts.prioritySources.reviews = []
    const result = run(args)
    expect(result.resultado).toBe('NAO_AVALIAVEL')
    expect(result.decisoes).toEqual([])
    expect(result.limitacoes).toContain('ORIGEM_CANONICA_REVISAO_INVALIDA')
  })
  it('determinismo e história factual preservados', () => {
    const args = fixture(), before = structuredClone(args)
    expect(run(args)).toEqual(run(before)); expect(args).toEqual(before)
    expect(args.facts.prioritySources.progress).toEqual([])
  })
})
