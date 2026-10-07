import { describe, expect, it, vi } from 'vitest'
import { evaluateMentorV2 } from '../shared/mentor-v2-policy.js'
import { materializeMentorWeek } from '../api/_lib/mentor-v2-plan.js'
import { readMentorDemandTrace } from '../api/_lib/mentor-v2-trace.js'
import { shortMentorDemandReason } from '../shared/mentor-v2-explanation.js'
import mentorHandler from '../api/mentor.js'

const state = vi.hoisted(() => ({ db: null, authenticated: true }))
vi.mock('../api/_lib/supabase.js', () => ({ getSupabaseAdmin: () => state.db }))
vi.mock('../api/_lib/http.js', () => ({ allowMethods: () => true,
  requireAccess: (_req, res) => { if (!state.authenticated) { res.status(401).json({ error: 'Acesso negado.' }); return false }; return true },
  queryParam: (req, key) => new URL(req.url, 'https://test.local').searchParams.get(key) || '',
  fail: (res) => res.status(500).json({ error: 'Falha de consulta.' }) }))

function database() {
  const evaluation = evaluateMentorV2({ policyRecord: { id: 'p', modulo: 'mentor', ativo: true, versao: 'original-v1', conteudo: { politica: {
    modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO'],
    regras: ['CONTINUIDADE_PLANO_EXISTENTE', 'PRIORIZACAO_CURRICULAR_SEMANAL', 'GERACAO_PLANO_SEMANAL'].map((id) => ({ id, habilitada: true })),
  } } }, facts: { context: { id: 1, rotina_pratica: {}, capacidade_inicial: { versao: 'capacidade-inicial-v2/1', revisao: 'trace', slots: [{ dia: 0, objetivo_id: 'g', atividade: 'ESTUDO', duracao_minutos: 50 }] }, disponibilidade: { versao: 'disponibilidade-v2/1',
    dias: [{ data: '2030-03-04', minutos: 50 }] } }, demands: [], subjects: [{ id: 'm', objetivo_id: 'g' }], topics: [],
    loadSources: { history: [], times: [], objectives: [{ id: 'g', tipo: 'concurso' }], commitments: [] },
    prioritySources: { materials: [{ id: 'pdf', materia_id: 'm', objetivo_id: 'g', status: 'aceito', ordem_curso: 1, nome: 'Aula real' }],
      progress: [], commitmentTopics: [], reviews: [], questions: [], attempts: [] } },
    weekStart: '2030-03-04', referenceInstant: '2030-03-04T15:00:00Z', evaluationId: 'original-evaluation' })
  const tables = { sessao: materializeMentorWeek(evaluation), mentor_decisao: [{ chave_operacao: evaluation.avaliacao_ref,
    tipo: 'avaliacao_mentor_v2', criado_em: '2030-03-04T15:01:00Z', dados: { modelo: 'MENTOR_V2', avaliacao: evaluation } }] }
  const db = { tables, calls: [], fail: null, writes: vi.fn(), from(table) {
    db.calls.push(table)
    const filters = [], q = { select: () => q, eq: (key, value) => { filters.push((row) => row[key] === value); return q },
      maybeSingle: async () => db.fail === table ? { data: null, error: new Error('synthetic DB failure') }
        : { data: (tables[table] || []).find((row) => filters.every((filter) => filter(row))) || null, error: null } }
    for (const method of ['insert', 'update', 'delete', 'upsert']) q[method] = db.writes
    return q
  } }
  return db
}
const read = (db, audit = false) => readMentorDemandTrace({ supabase: db, id: db.tables.sessao[0].id, audit })
const response = () => ({ statusCode: null, body: null, status(code) { this.statusCode = code; return this }, json(body) { this.body = body; return this } })

describe('rastreio da origem factual', () => {
  it('resolve criação original e disponibiliza decisão, inputs, policy, motivos, demanda e datas', async () => {
    const db = database(), result = await read(db, true)
    expect(result).toMatchObject({ estado: 'RASTREAVEL', policy_ref: { id: 'p', versao: 'original-v1' },
      avaliacao_ref: 'original-evaluation', data_decisao: '2030-03-04T15:00:00Z', data_original: '2030-03-04',
      data_atual: '2030-03-04', registro_criado_em: '2030-03-04T15:01:00Z' })
    expect(result.decisao.tipo_decisao).toBe('CRIAR_DEMANDA')
    expect(result.inputs_relevantes.length).toBeGreaterThan(0)
    expect(result.reason_codes).toContain('CURRICULUM_CONTINUITY')
    expect(result.demanda.id).toBe(result.demanda_original.id)
    expect(db.calls).toEqual(['sessao', 'mentor_decisao'])
    expect(db.writes).not.toHaveBeenCalled()
  })
  it('resumo da UI não inclui dados técnicos, inputs, IDs ou policy', async () => {
    const result = await read(database())
    expect(result).toEqual({ estado: 'RASTREAVEL', explicacao: 'Continuidade curricular da disciplina.' })
  })
  it('movimentação, ordem, conclusão e cancelamento não reescrevem o motivo histórico', async () => {
    const db = database(), original = structuredClone(db.tables.mentor_decisao)
    Object.assign(db.tables.sessao[0], { data: '2030-03-11', ordem: 9, status: 'cancelada', movida_em: '2030-03-05T15:00:00Z' })
    const result = await read(db, true)
    expect(result).toMatchObject({ estado: 'RASTREAVEL', data_original: '2030-03-04', data_atual: '2030-03-11' })
    expect(db.tables.mentor_decisao).toEqual(original)
  })
  it('nova avaliação e policy vigente não substituem a criação original', async () => {
    const db = database(); db.tables.mentor_decisao.unshift({ chave_operacao: 'new-evaluation', tipo: 'avaliacao_mentor_v2',
      dados: { modelo: 'MENTOR_V2', avaliacao: { policy_ref: { versao: 'new' } } } })
    expect((await read(db, true)).policy_ref.versao).toBe('original-v1')
  })
  it('cache de motivos divergente não inventa revisão ou queda de retenção', async () => {
    const db = database(); db.tables.sessao[0].reason_codes = ['REVIEW_NEED', 'QUESTION_PERFORMANCE']
    const result = await read(db, true)
    expect(result.explicacao).toBe('Continuidade curricular da disciplina.')
    expect(result.divergencias).toEqual(['CACHE_REASON_CODES_DIVERGENTE'])
    expect(db.writes).not.toHaveBeenCalled()
  })
  it('origem manual é explícita e não consulta decisão do Mentor', async () => {
    const db = database(); db.tables.sessao[0].origem = 'manual'
    expect(await read(db)).toEqual({ estado: 'MANUAL', explicacao: 'Demanda adicionada manualmente.' })
    expect(db.calls).toEqual(['sessao'])
  })
  it('legado sem vínculo não recebe justificativa retrospectiva', async () => {
    const db = database(); db.tables.sessao[0].chave_mentor = 'v1:old'
    expect(await read(db)).toMatchObject({ estado: 'LEGADO_SEM_VINCULO', explicacao: 'Motivo original indisponível.' })
  })
  it('decisão ausente é distinta de fonte com falha', async () => {
    const db = database(); db.tables.mentor_decisao = []
    expect((await read(db)).estado).toBe('DECISAO_AUSENTE')
    db.fail = 'mentor_decisao'; await expect(read(db)).rejects.toThrow('synthetic DB failure')
  })
  it.each(['materia_id', 'material_id', 'objetivo_id', 'data_planejada_original', 'duracao_estimada'])('divergência de %s não é apresentada como origem válida', async (field) => {
    const db = database(); db.tables.sessao[0][field] = field === 'duracao_estimada' ? 30 : 'other'
    expect((await read(db)).estado).toBe('VINCULO_INCONSISTENTE')
  })
  it('decisão duplicada ou envelope inválido é recusado sem recalcular', async () => {
    const db = database(), evaluation = db.tables.mentor_decisao[0].dados.avaliacao
    evaluation.decisoes.push(evaluation.decisoes[0])
    expect((await read(db)).estado).toBe('VINCULO_INCONSISTENTE')
    evaluation.decisoes = {}
    expect((await read(db)).estado).toBe('VINCULO_INCONSISTENTE')
  })
  it('ID inexistente não busca/gera decisão', async () => {
    const db = database()
    expect((await readMentorDemandTrace({ supabase: db, id: 'absent' })).estado).toBe('NAO_ENCONTRADA')
    expect(db.calls).toEqual(['sessao'])
  })
})

describe('endpoint protegido de rastreio', () => {
  it('padrão entrega somente resumo e auditoria explícita entrega snapshots', async () => {
    const db = database(); state.db = db; state.authenticated = true
    const url = `/api/mentor?recurso=demanda&id=${db.tables.sessao[0].id}`
    const normal = response(); await mentorHandler({ method: 'GET', url }, normal)
    expect(normal.statusCode).toBe(200); expect(Object.keys(normal.body)).toEqual(['estado', 'explicacao'])
    const audit = response(); await mentorHandler({ method: 'GET', url: `${url}&auditoria=1` }, audit)
    expect(audit.body.inputs_relevantes.length).toBeGreaterThan(0)
    expect(db.writes).not.toHaveBeenCalled()
  })
  it('nega acesso antes de consultar fatos', async () => {
    const db = database(); state.db = db; state.authenticated = false
    const res = response(); await mentorHandler({ method: 'GET', url: '/api/mentor?recurso=demanda&id=invalid' }, res)
    expect(res.statusCode).toBe(401); expect(db.calls).toEqual([])
    state.authenticated = true
  })
  it('ID inválido retorna 400 sem consultar banco', async () => {
    const db = database(); state.db = db; state.authenticated = true
    const res = response(); await mentorHandler({ method: 'GET', url: '/api/mentor?recurso=demanda&id=invalid' }, res)
    expect(res.statusCode).toBe(400); expect(db.calls).toEqual([])
  })
})

describe('explicações curtas e determinísticas', () => {
  it.each([
    [['CONFIRMED_DEADLINE'], 'ESTUDO', 'Preparação para um compromisso previsto.'],
    [['MATERIAL_IN_PROGRESS'], 'ESTUDO', 'Continuidade do material em andamento.'],
    [['CURRICULUM_CONTINUITY'], 'ESTUDO', 'Continuidade curricular da disciplina.'],
    [['REVIEW_NEED'], 'REVISAO', 'Revisão programada para este conteúdo.'],
    [[], 'QUESTOES', 'Prática de questões prevista para a semana.'],
    [[], 'QUESTION_CARDS', 'Recuperação ativa prevista para a semana.'],
  ])('motivos %j são projetados sem linguagem técnica ou inferência de retenção', (reason_codes, tipo_atividade, expected) => {
    const text = shortMentorDemandReason({ reason_codes, tipo_atividade })
    expect(text).toBe(expected); expect(text.length).toBeLessThan(90)
    expect(text).not.toMatch(/policy|threshold|UNKNOWN|retenção/i)
  })
})
