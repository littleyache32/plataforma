import { afterEach, describe, expect, it, vi } from 'vitest'
import practiceHandler from '../api/_lib/pratica-handler.js'
import { evaluateMentorWeekV2 } from '../api/_lib/mentor-v2.js'
import { evaluateMentorV2 } from '../shared/mentor-v2-policy.js'
import { materializeMentorWeek } from '../api/_lib/mentor-v2-plan.js'
import { projectMentorQuestionReviews } from '../shared/review-v2-pipeline.js'
import { projectReviewCenter } from '../shared/review-v2-center.js'
import { projectPlannedReviewCoverage } from '../shared/mentor-v2-review-plan.js'
import { separateCoveredCentralItems } from '../api/_lib/mentor-v2-review-coverage.js'
import { selectMentorReviewMethod } from '../shared/mentor-v2-review-method.js'
import { contentReviewEvidence, cardReviewEvidence } from '../shared/review-v2-evidence.js'
import { evaluateReviewEligibility } from '../shared/review-v2-eligibility.js'

const transport = vi.hoisted(() => ({ db: null }))
vi.mock('../api/_lib/supabase.js', () => ({ getSupabaseAdmin: () => transport.db }))
vi.mock('../api/_lib/http.js', () => ({ allowMethods: () => true, requireAccess: () => true,
  queryParam: (req, key) => req.query?.[key], fail: (res, error) => res.status(500).json({ error: error.message }) }))
afterEach(() => vi.useRealTimers())

const start = '2030-03-04', corte = `${start}T15:00:00Z`, ref = { id: 'p', versao: 'integration' }
function fixture(outcome = 'erro', confidence = 'certeza') {
  const policyRecord = { id: 'p', modulo: 'mentor', versao: ref.versao, ativo: true, conteudo: { politica: {
    modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO', 'QUESTOES', 'REVISAO'],
    regras: ['CONTINUIDADE_PLANO_EXISTENTE', 'PRIORIZACAO_CURRICULAR_SEMANAL', 'GERACAO_PLANO_SEMANAL'].map((id) => ({ id, habilitada: true })),
  } } }
  const facts = { context: { id: 1, objetivo_principal_id: 'g', rotina_pratica: { questoes: true, revisao_pratica: true },
    disponibilidade: { versao: 'disponibilidade-v2/1', dias: [{ data: start, minutos: 150 }] },
    capacidade_inicial: { versao: 'capacidade-inicial-v2/1', revisao: 'initial', slots: [
      { dia: 0, objetivo_id: 'g', atividade: 'ESTUDO', duracao_minutos: 50 },
      { dia: 0, objetivo_id: 'g', atividade: 'REVISAO', duracao_minutos: 50 },
    ] } }, demands: [], planIdentities: [], subjects: [{ id: 'm', objetivo_id: 'g', nome: 'Direito' }],
    topics: [{ id: 't', materia_id: 'm', nome: 'Conceito' }],
    loadSources: { history: [], times: [], objectives: [{ id: 'g', tipo: 'concurso' }], commitments: [] },
    prioritySources: { materials: [{ id: 'mat', objetivo_id: 'g', materia_id: 'm', status: 'aceito', ordem_curso: 1, estado_extracao: 'texto' }],
      progress: [], commitmentTopics: [], cards: [], questions: [{ id: 'q', topico_id: 't', ativa: true, marcada_errada: false, estado: 'revisao' }],
      reviews: [{ id: 'need', questao_id: 'q', status: 'pendente', motivo: 'erro', agendada_para: corte }],
      attempts: [{ id: 'r', questao_id: 'q', resultado: outcome, classificacao: confidence, criado_em: corte }] } }
  return { facts, policyRecord, weekStart: start, referenceInstant: corte, evaluationId: 'eval' }
}
function project(args) { return projectMentorQuestionReviews({ facts: args.facts, corte, policy_ref: ref, modalidades: args.policyRecord.conteudo.politica.modalidades_permitidas }) }
function evaluate(args) { args.facts.reviewPlanning = project(args); return evaluateMentorV2(args) }
const reviewDecisions = (evaluation) => evaluation.decisoes.filter((row) => row.tipo_decisao === 'CRIAR_DEMANDA' && row.tipo_atividade === 'REVISAO')
function center(args) {
  const source = args.facts.prioritySources
  return projectReviewCenter({ corte, policy_ref: ref, flags: args.facts.context.rotina_pratica, registros: source.attempts, cards: [],
    questoes: source.reviews.map((row) => ({ ...row, questao: { ...source.questions.find((q) => q.id === row.questao_id),
      topico: { nome: 'Conceito', materia: { id: 'm', nome: 'Direito', objetivo_id: 'g' } } } })) })
}
function database(args) {
  const { facts, policyRecord } = args, p = facts.prioritySources
  const tables = { conhecimento_modulo: [policyRecord], mentor_contexto: { id: 1, dados: facts.context }, sessao: facts.demands,
    materia: facts.subjects, topico: facts.topics, objetivo: facts.loadSources.objectives, compromisso: [], tempo_estudo: [],
    material: p.materials, material_progresso: p.progress, compromisso_topico: [], revisao_item: p.reviews,
    questao: p.questions, registro: p.attempts, question_card: [], mentor_decisao: [] }
  const writes = []
  return { tables, writes, from(table) {
    const filters = []; let page = null, one = false, mutation = null
    return { select() { return this }, order() { return this },
      eq(key, value) { filters.push((row) => row[key] === value); return this },
      gte(key, value) { filters.push((row) => row[key] >= value); return this },
      lte(key, value) { filters.push((row) => row[key] <= value); return this },
      lt(key, value) { filters.push((row) => row[key] < value); return this },
      in(key, values) { filters.push((row) => values.includes(row[key])); return this },
      like(key, value) { filters.push((row) => row[key]?.startsWith(value.replace('%', ''))); return this },
      range(a, b) { page = [a, b]; return this }, maybeSingle() { one = true; return this }, single() { one = true; return this },
      insert(payload) { mutation = { method: 'insert', payload }; return this },
      update(payload) { mutation = { method: 'update', payload }; return this },
      upsert(payload) { writes.push({ table, payload }); return this },
      then(resolve) {
        if (mutation) {
          writes.push({ table, ...mutation })
          if (mutation.method === 'insert') tables[table].push({ id: `new-${table}`, criado_em: corte, status: 'pendente', ...mutation.payload })
          else for (const row of tables[table]) if (filters.every((filter) => filter(row))) Object.assign(row, mutation.payload)
          return resolve({ data: null, error: null })
        }
        if (tables[table]?.error) return resolve(tables[table])
        const raw = tables[table], rows = Array.isArray(raw) ? raw.filter((row) => filters.every((filter) => filter(row))) : raw
        resolve({ data: Array.isArray(rows) ? one ? rows[0] || null : page ? rows.slice(page[0], page[1] + 1) : rows : rows, error: null })
      },
    }
  } }
}

describe('Fase 4.10, registro factual até Central e demanda do Mentor', () => {
  it.each(['certeza', 'sem_conhecimento'])('POST real de prática registra erro com %s e alimenta evidência local', async (confidence) => {
    vi.useFakeTimers(); vi.setSystemTime(corte)
    const args = fixture(), db = database(args)
    db.tables.registro = []; db.tables.revisao_item = []
    Object.assign(db.tables.questao[0], { tipo: 'CE', gabarito: 'C', quantidade_tentativas: 0, topico: { id: 't' } })
    transport.db = db
    const res = { status(code) { this.code = code; return this }, json(body) { this.body = body; return this } }
    await practiceHandler({ method: 'POST', body: { questaoId: 'q', resposta: 'E', classificacao: confidence, tempo: 60 } }, res)
    expect(res.code).toBe(201)
    expect(db.tables.registro[0]).toMatchObject({ questao_id: 'q', resultado: 'erro', classificacao: confidence })
    args.facts.prioritySources.attempts = db.tables.registro
    args.facts.prioritySources.reviews = db.tables.revisao_item
    // Legacy future calendars remain a constraint, not a new interval calculated by V2.
    expect(project(args).observacoes[0].sinal.necessidade_local).toBe('REVISAO_OU_RETESTE')
    expect(center(args).itens[0].ultima_interacao).toBe(corte)
    const result = await evaluateMentorWeekV2({ supabase: db, inicio: start, instanteReferencia: corte })
    expect(reviewDecisions(result)).toHaveLength(confidence === 'certeza' ? 1 : 0)
  })
  it.each([
    ['erro', 'certeza', 'FALSA_CERTEZA', 1],
    ['erro', 'sem_conhecimento', 'PROVAVEL_LACUNA_BASE', 1],
    ['acerto', 'duvida', 'CONHECIMENTO_INSTAVEL', 0],
    ['acerto', 'certeza', 'EVIDENCIA_POSITIVA_FORTE', 0],
    ['erro', 'duvida', 'ERRO_COM_INCERTEZA', 0],
  ])('%s + %s permanece local (%s)', async (outcome, confidence, signal, count) => {
    const args = fixture(outcome, confidence), before = structuredClone(args), projection = project(args)
    expect(projection.observacoes[0].sinal.sinal).toBe(signal)
    expect(projection.observacoes[0].sinal.infere_dominio).toBe(false)
    const db = database(args)
    const result = await evaluateMentorWeekV2({ supabase: db, inicio: start, instanteReferencia: corte, persist: true })
    expect(reviewDecisions(result)).toHaveLength(count)
    expect(db.writes.map((row) => row.table)).toEqual(['mentor_decisao'])
    expect(center(args).itens).toHaveLength(1) // calendar fact is not strategic authorization
    expect(args).toEqual(before)
  })
  it('questão antiga pode retornar sem prazo máximo ou reinício do curso', () => {
    const args = fixture(); args.facts.prioritySources.attempts[0].criado_em = '2024-01-01T12:00:00Z'
    expect(reviewDecisions(evaluate(args))).toHaveLength(1)
    expect(center(args).itens[0].ultima_interacao).toBe('2024-01-01T12:00:00Z')
  })
  it('item já coberto hoje pelo Plano sai da ação complementar, sem apagar registro', () => {
    const args = fixture(), evaluation = evaluate(args), rows = materializeMentorWeek(evaluation)
    const decision = reviewDecisions(evaluation)[0]
    const coverage = projectPlannedReviewCoverage({ decisao: decision, demanda: rows.find((row) => row.tipo === 'revisao') })
    const result = separateCoveredCentralItems({ itens: center(args).itens, demandas: [coverage], corte })
    expect(result.itens).toEqual([]); expect(result.cobertos_no_plano).toHaveLength(1)
    expect(args.facts.prioritySources.attempts).toHaveLength(1)
  })
  it('múltiplos erros do tópico competem dentro da carga sem ampliar estratégia da matéria', () => {
    const args = fixture(), p = args.facts.prioritySources
    p.questions.push({ ...p.questions[0], id: 'q2' })
    p.reviews.push({ ...p.reviews[0], id: 'need2', questao_id: 'q2' })
    p.attempts.push({ ...p.attempts[0], id: 'r2', questao_id: 'q2' })
    const evaluation = evaluate(args), reviews = reviewDecisions(evaluation)
    expect(reviews).toHaveLength(1)
    expect(materializeMentorWeek(evaluation).reduce((sum, row) => sum + row.duracao_estimada, 0)).toBe(100)
    expect(reviews[0].parametros.revisao.metodo.metodo).toBe('QUESTAO_INDIVIDUAL')
    expect(evaluation.decisoes.some((row) => row.tipo_decisao === 'AUMENTAR_CARGA')).toBe(false)
  })
  it('revisão não exige teoria nem conclui material', () => {
    const args = fixture(), result = evaluate(args), method = reviewDecisions(result)[0].parametros.revisao.metodo
    expect(method.reason_codes).toContain('REVIEW_TARGETED_SINGLE_QUESTION')
    expect(method.reinicia_curso).toBe(false); expect(method.altera_progresso).toBe(false)
    expect(args.facts.prioritySources.progress).toEqual([])
  })
  it('estudo concluído fornece exposição factual, não domínio ou revisão automática', () => {
    const args = fixture(); args.facts.prioritySources.attempts = []; args.facts.prioritySources.reviews = []
    const material = args.facts.prioritySources.materials[0]
    const evidence = contentReviewEvidence({ material, corte, estudos: [{ material_id: material.id,
      referencia: { entidade: 'sessao', id: 'study' }, observado_em: corte }] })
    expect(evidence.observacoes.ultimo_estudo_em).toBe(corte)
    expect(evidence.observacoes.progresso).toBeNull(); expect(evidence.autoriza_decisao).toBe(false)
    expect(reviewDecisions(evaluate(args))).toEqual([])
    expect(args.facts.prioritySources.progress).toEqual([])
  })
  it('ponto de integração FSRS continua explícito e não converte data legada em elegibilidade', () => {
    const evidence = cardReviewEvidence({ card: { id: 'card', proxima_revisao: corte }, corte })
    expect(evaluateReviewEligibility({ evidencia: evidence })).toMatchObject({ elegivel: false, pendencias: ['FSRS_NAO_DISPONIVEL'] })
  })
  it('retorno teórico qualificado atravessa método, decisão e demanda de unidade delimitada', () => {
    const args = fixture(), planning = project(args), item = planning.itens[0]
    const sources = [...item.evidencia.fontes, { entidade: 'material_unidade_curricular', id: 'unit' }, { entidade: 'material_progresso', id: 'mat' }]
    item.metodo = selectMentorReviewMethod({ elegibilidade: item.elegibilidade, topico_id: 't', fontes: sources, policy_ref: ref,
      modalidades: ['ESTUDO'], recursos: {}, slots: [{ id: 'bounded', atividade: 'ESTUDO', duracao_minutos: 50 }],
      lacuna: { confirmada: true, regra_ref: { id: 'authorized-test-gap', versao: 'test' }, fontes: sources, topico_id: 't',
        conteudo_previamente_estudado: true, unidade: { id: 'unit', material_id: 'mat' } } })
    delete item.metodos_por_duracao
    args.facts.reviewPlanning = planning
    const result = evaluateMentorV2(args), rows = materializeMentorWeek(result)
    expect(reviewDecisions(result)[0].parametros.revisao.metodo.metodo).toBe('RETORNO_PONTUAL_TEORIA')
    expect(rows.find((row) => row.tipo === 'revisao').titulo).toContain('teoria pontual')
    expect(args.facts.prioritySources.progress).toEqual([])
  })
  it('adapta métodos de 30 e 50 aos slots sem criar minutos extras', () => {
    const args = fixture(); args.facts.context.capacidade_inicial.slots[1] = { dia: 0, objetivo_id: 'g', atividade: 'REVISAO', duracao_minutos: 30, justificativa_30: 'Revisão pontual' }
    expect(reviewDecisions(evaluate(args))[0].duracao_minutos).toBe(30)
  })
  it.each(['ativa', 'marcada_errada', 'estado'])('não planeja recurso indisponível por %s', (field) => {
    const args = fixture(); args.facts.prioritySources.questions[0][field] = { ativa: false, marcada_errada: true, estado: 'arquivada' }[field]
    expect(reviewDecisions(evaluate(args))).toEqual([])
  })
  it('tentativa mais recente positiva não deixa erro antigo comandar revisão estratégica', () => {
    const args = fixture(); args.facts.prioritySources.attempts.unshift({ id: 'old', questao_id: 'q', resultado: 'erro', classificacao: 'certeza', criado_em: '2029-01-01T12:00:00Z' })
    args.facts.prioritySources.attempts[1].resultado = 'acerto'
    expect(reviewDecisions(evaluate(args))).toEqual([])
  })
  it('datas futuras e prática bloqueada não geram demandas', () => {
    const args = fixture(); args.facts.prioritySources.reviews[0].agendada_para = '2099-01-01T12:00:00Z'
    expect(reviewDecisions(evaluate(args))).toEqual([])
    const blocked = fixture(); blocked.facts.context.rotina_pratica.questoes = false
    expect(reviewDecisions(evaluate(blocked))).toEqual([])
  })
  it('erro de fonte não produz avaliação parcial persistida', async () => {
    const db = database(fixture()); db.tables.registro = { error: new Error('synthetic failure') }
    const result = await evaluateMentorWeekV2({ supabase: db, inicio: start, instanteReferencia: corte, persist: true })
    expect(result.resultado).toBe('NAO_AVALIAVEL'); expect(db.writes).toEqual([])
  })
})
