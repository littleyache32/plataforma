import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { evaluateMentorWeekV2, readMentorWeekV2 } from '../api/_lib/mentor-v2.js'
import { prepareMentorWeek } from '../api/_lib/plano-handler.js'
import mentorHandler from '../api/mentor.js'
import cronHandler from '../api/cron/mentor.js'
import painelHandler from '../api/_lib/painel-handler.js'

const state = vi.hoisted(() => ({ db: null }))
vi.mock('../api/_lib/supabase.js', () => ({ getSupabaseAdmin: () => state.db }))
vi.mock('../api/_lib/http.js', () => ({ allowMethods: () => true, requireAccess: () => true,
  queryParam: (req, key) => req.query?.[key], fail: (res, error) => res.status(500).json({ error: error.message }) }))

function database(overrides = {}) {
  const values = {
    conhecimento_modulo: [{ id: 'policy', modulo: 'mentor', ativo: true, versao: 'v2-test', conteudo: { politica: {
      modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO'],
      regras: [{ id: 'CONTINUIDADE_PLANO_EXISTENTE', habilitada: true }],
    } } }],
    mentor_contexto: { id: 1, vigente_desde: '2030-01-01', dados: { fase: 'legado', carga_atual: { concurso: 9 }, rotina_pratica: {} } },
    sessao: [{ id: 'demand', objetivo_id: 'goal', materia_id: 'subject', topico_id: 'topic', tipo: 'estudo',
      status: 'planejada', data: '2030-03-04', duracao_estimada: 50 }],
    materia: [{ id: 'subject', objetivo_id: 'goal' }], topico: [{ id: 'topic', materia_id: 'subject' }],
    mentor_decisao: null, mentor_encontro_semanal: null, ...overrides,
  }
  const calls = [], writes = []
  const db = { calls, writes, values, rpc: vi.fn(async () => ({ data: 'backup', error: null })), from(table) {
    calls.push(table)
    let write = false, page = null
    const filters = []
    const q = {}
    for (const method of ['select', 'eq', 'gte', 'lte', 'lt', 'order', 'range', 'limit', 'in', 'maybeSingle', 'single']) q[method] = () => q
    q.range = (start, end) => { page = [start, end]; return q }
    q.gte = (key, value) => { filters.push((row) => row[key] >= value); return q }
    q.lte = (key, value) => { filters.push((row) => row[key] <= value); return q }
    q.lt = (key, value) => { filters.push((row) => row[key] < value); return q }
    for (const method of ['upsert', 'insert', 'update', 'delete']) q[method] = (payload, options) => {
      write = true; writes.push({ table, method, payload, options }); return q
    }
    q.then = (resolve, reject) => {
      let data = values[table] ?? []
      if (Array.isArray(data)) {
        data = data.filter((row) => filters.every((filter) => filter(row)))
        if (page) data = data.slice(page[0], page[1] + 1)
      }
      return Promise.resolve(write ? { data: { id: 'run' }, error: null }
        : values[table]?.error ? values[table] : { data, error: null }).then(resolve, reject)
    }
    return q
  } }
  return db
}
const evaluate = (db, persist = false) => evaluateMentorWeekV2({ supabase: db, inicio: '2030-03-04', instanteReferencia: '2030-03-04T15:00:00Z', persist })
function response() { return { statusCode: null, body: null, status(code) { this.statusCode = code; return this }, json(value) { this.body = value; return this } } }
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs() })

function priorityDatabase() {
  const db = database({ objetivo: [{ id: 'goal', tipo: 'concurso' }], material: [
    { id: 'pdf-1', objetivo_id: 'goal', materia_id: 'subject', status: 'aceito', ordem_curso: 1, estado_extracao: 'texto' },
    { id: 'pdf-2', objetivo_id: 'goal', materia_id: 'subject', status: 'aceito', ordem_curso: 2, estado_extracao: 'texto' },
  ], material_progresso: [{ material_id: 'pdf-1', estado: 'concluido', concluido_em: '2030-03-01T15:00:00Z' }],
    compromisso_topico: [], revisao_item: [], questao: [], registro: [] })
  db.values.conhecimento_modulo[0].conteudo.politica.regras.push({ id: 'PRIORIZACAO_CURRICULAR_SEMANAL', habilitada: true })
  return db
}

describe('integração da priorização semanal V2', () => {
  it('lê progresso canônico e registra seleção tipada sem escrever material, progresso ou demanda', async () => {
    const db = priorityDatabase(), result = await evaluate(db, true)
    const decision = result.decisoes.find((row) => row.tipo_decisao === 'PRIORIZAR_MATERIA')
    expect(decision.parametros.selecao.material_id).toBe('pdf-2')
    expect(db.calls).toEqual(expect.arrayContaining(['material', 'material_progresso', 'compromisso_topico', 'revisao_item', 'questao', 'registro']))
    expect(db.writes.map((row) => row.table)).toEqual(['mentor_decisao'])
    db.values.mentor_decisao = db.writes[0].payload
    expect((await readMentorWeekV2({ supabase: db, inicio: '2030-03-04', instanteReferencia: '2030-03-04T15:00:00Z' })).decisoes).toEqual(result.decisoes)
  })
  it.each(['material', 'material_progresso', 'compromisso_topico', 'revisao_item', 'questao', 'registro'])('falha em %s impede persistência e decisões parciais', async (table) => {
    const db = priorityDatabase(); db.values[table] = { data: null, error: new Error('test source unavailable') }
    const result = await evaluate(db, true)
    expect(result).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [], reason_codes: ['DATA_UNAVAILABLE'] })
    expect(db.writes).toEqual([])
  })
  it('currículo acima de uma página é lido integralmente e não volta à primeira aula', async () => {
    const db = priorityDatabase()
    db.values.material = Array.from({ length: 501 }, (_, i) => ({ id: `pdf-${i}`, objetivo_id: 'goal', materia_id: 'subject',
      status: 'aceito', ordem_curso: i + 1, estado_extracao: 'texto' }))
    db.values.material_progresso = db.values.material.slice(0, 500).map((row) => ({ material_id: row.id, estado: 'concluido', concluido_em: '2030-03-01T15:00:00Z' }))
    const result = await evaluate(db)
    expect(result.decisoes.find((row) => row.tipo_decisao === 'PRIORIZAR_MATERIA').parametros.selecao.material_id).toBe('pdf-500')
    expect(db.calls.filter((table) => table === 'material')).toHaveLength(2)
    expect(db.calls.filter((table) => table === 'material_progresso')).toHaveLength(2)
  })
  it('contexto vigente fornece objetivo principal sem ler estratégia de objetivo.config', async () => {
    const db = priorityDatabase(); db.values.mentor_contexto.dados.objetivo_principal_id = 'goal'
    const result = await evaluate(db)
    expect(result.contexto_ref.snapshot.objetivo_principal_id).toBe('goal')
    expect(result.decisoes.some((row) => row.tipo_decisao === 'PRIORIZAR_MATERIA')).toBe(true)
  })
})

describe('integração operacional única V2', () => {
  it('lê apenas fonte canônica e fatos necessários, sem especialistas/defaults', async () => {
    const db = database(), result = await evaluate(db)
    expect(db.calls).toEqual(['conhecimento_modulo', 'mentor_contexto', 'sessao', 'materia', 'topico', 'sessao', 'tempo_estudo', 'objetivo', 'compromisso'])
    expect(result.decisoes).toHaveLength(1)
    expect(result.contexto_ref.snapshot).not.toHaveProperty('fase')
    expect(result.contexto_ref.snapshot).not.toHaveProperty('carga_atual')
    expect(db.writes).toEqual([])
  })
  it('persistência guarda decisão tipada, sem alterar plano nem fatos', async () => {
    const db = database(), result = await evaluate(db, true)
    expect(db.writes).toHaveLength(1)
    expect(db.writes[0]).toMatchObject({ table: 'mentor_decisao', method: 'upsert', payload: {
      tipo: 'avaliacao_mentor_v2', dados: { modelo: 'MENTOR_V2', avaliacao: result },
    }, options: { onConflict: 'chave_operacao', ignoreDuplicates: true } })
  })
  it('carrega história paginada completa, sem truncar o volume da avaliação', async () => {
    const db = database()
    db.values.sessao.push(...Array.from({ length: 501 }, (_, i) => ({ id: `historical-${i}`, objetivo_id: 'goal',
      tipo: 'estudo', data: '2030-02-25', status: 'feita', duracao_estimada: 30, concluida_em: '2030-02-25T15:00:00Z' })))
    const result = await evaluate(db)
    expect(result.carga_semanal.sinais.historico[0].demandas_elegiveis).toBe(501)
    expect(result.carga_semanal.carga_proposta).toMatchObject({ demandas: 1, minutos: 50 })
    expect(db.calls.filter((table) => table === 'sessao')).toHaveLength(3)
    expect(db.writes).toEqual([])
  })
  it('persiste sinais reais de carga e mantém Faculdade sem feedback subjetivo', async () => {
    const db = database({ objetivo: [{ id: 'goal', tipo: 'concurso' }, { id: 'faculty', tipo: 'faculdade' }],
      tempo_estudo: [{ id: 't1', sessao_id: 'demand', status: 'concluido', segundos_acumulados: 4020, finalizado_em: '2030-03-04T14:00:00Z' }],
      compromisso: [{ id: 'exam', objetivo_id: 'faculty', tipo: 'prova', data: '2030-03-06', concluido: false }] })
    db.values.sessao.push({ id: 'f1', objetivo_id: 'faculty', materia_id: null, topico_id: null,
      tipo: 'estudo', data: '2030-03-04', status: 'planejada', duracao_estimada: 30 })
    const result = await evaluate(db, true)
    expect(result.carga_semanal).toMatchObject({ acao: 'MANTER', carga_proposta: { demandas: 2, minutos: 80 } })
    expect(result.carga_semanal.sinais.execucao.segundos_reais).toBe(4020)
    expect(result.reason_codes).toContain('CONFIRMED_DEADLINE')
    expect(db.writes).toHaveLength(1)
    expect(db.writes[0].payload.dados.avaliacao.carga_semanal).toEqual(result.carga_semanal)
  })
  it('fallback operacional sem prática é registrado com insuficiência, sem novas demandas', async () => {
    const db = database(), result = await evaluate(db, true)
    expect(result.reason_codes).toContain('INSUFFICIENT_EVIDENCE')
    expect(result.fallback).toMatchObject({ aumentar_carga: false, adicionar_modalidades: false,
      prioridade_estrutural: 'CONCURSO', faculdade: 'PRESERVAR_SEM_EXPANDIR', coleta_evidencia: 'EVENTOS_NORMAIS' })
    expect(db.writes[0].payload.dados.avaliacao.fallback).toEqual(result.fallback)
    expect(db.writes.every((w) => w.table === 'mentor_decisao')).toBe(true)
    expect(result.versao_motor).toBe('mentor-v2-engine/3.8')
    expect(result.catalogo_reason_codes).toBe('mentor-v2-reasons/5')
  })
  it('mesmo corte produz mesma chave para retry, sem incremento ou duplicação de demanda', async () => {
    const db = database(); await evaluate(db, true); await evaluate(db, true)
    expect(db.writes[0].payload.chave_operacao).toBe(db.writes[1].payload.chave_operacao)
    expect(db.writes.every((w) => w.table === 'mentor_decisao')).toBe(true)
  })
  it('policy antiga não consulta contexto/fatos nem grava avaliação de sucesso', async () => {
    const db = database({ conhecimento_modulo: [{ conteudo: { politica: { fase: 'adaptacao_teorica_1' } } }] })
    expect(await evaluate(db, true)).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [] })
    expect(db.calls).toEqual(['conhecimento_modulo']); expect(db.writes).toEqual([])
  })
  it('múltiplas versões ativas não selecionam arbitrariamente uma', async () => {
    const db = database(); db.values.conhecimento_modulo.push(structuredClone(db.values.conhecimento_modulo[0]))
    expect(await evaluate(db, true)).toMatchObject({ resultado: 'NAO_AVALIAVEL', reason_codes: ['DATA_INCONSISTENCY'],
      limitacoes: ['MULTIPLAS_POLICIES_ATIVAS'], evidencias_utilizadas: [{ valor: 'MULTIPLAS_POLICIES_ATIVAS' }] })
    expect(db.writes).toEqual([])
  })
  it.each(['conhecimento_modulo', 'mentor_contexto', 'sessao', 'materia', 'topico', 'tempo_estudo', 'objetivo', 'compromisso'])('erro de leitura em %s é indisponibilidade, não semana vazia', async (table) => {
    const db = database({ [table]: { error: new Error('read failed'), data: null } })
    expect(await evaluate(db, true)).toMatchObject({ resultado: 'NAO_AVALIAVEL', decisoes: [], reason_codes: ['DATA_UNAVAILABLE'], limitacoes: ['FALHA_LEITURA_FONTE'] })
    expect(db.writes).toEqual([])
  })
  it('GET da avaliação registrada não recalcula uma segunda estratégia', async () => {
    const db = database(), evaluation = await evaluate(db)
    db.calls.length = 0; db.values.mentor_decisao = { dados: { modelo: 'MENTOR_V2', avaliacao: evaluation } }
    const result = await readMentorWeekV2({ supabase: db, inicio: '2030-03-04', instanteReferencia: '2030-03-05T15:00:00Z' })
    expect(result).toEqual({ ...evaluation, origem: 'decisao_registrada' })
    expect(db.calls).toEqual(['mentor_decisao']); expect(db.writes).toEqual([])
  })
  it('avaliação registrada malformada não vira instrução operacional', async () => {
    const db = database({ mentor_decisao: { dados: { modelo: 'MENTOR_V2', avaliacao: { resultado: 'DECISOES_EMITIDAS', decisoes: [] } } } })
    await expect(readMentorWeekV2({ supabase: db, inicio: '2030-03-04', instanteReferencia: '2030-03-04T15:00:00Z' })).rejects.toThrow('inválida')
  })
  it('preparação usa o mesmo avaliador e preserva exclusões, conclusões, data/ordem manuais', async () => {
    const db = database(); db.values.sessao.push({ ...db.values.sessao[0], id: 'excluded', status: 'cancelada', cancelamento_origem: 'usuario' },
      { ...db.values.sessao[0], id: 'done', status: 'feita' })
    db.values.sessao[0].movida_em = '2030-03-04T10:00:00Z'; db.values.sessao[0].ordem = 7
    const before = structuredClone(db.values.sessao)
    const result = await prepareMentorWeek({ supabase: db, inicio: '2030-03-04', today: '2030-03-04', instanteReferencia: '2030-03-04T15:00:00Z' })
    expect(result.status).toBe(200)
    expect(result.body.avaliacao_mentor_v2.decisoes.map((d) => d.demanda_id)).toEqual(['demand'])
    expect(result.body).toMatchObject({ criadas: 0, atualizadas: 0, removidas: 0, planejamento_estado: 'preservado' })
    expect(db.values.sessao).toEqual(before)
  })
  it('preparação indisponível não apresenta geração V1 como sucesso', async () => {
    const db = database({ conhecimento_modulo: [] })
    expect(await prepareMentorWeek({ supabase: db, inicio: '2030-03-04', today: '2030-03-04' })).toMatchObject({ status: 503, body: { planejamento_pendente: true, planejamento_estado: 'policy_v2_pendente' } })
    expect(db.writes).toEqual([])
  })
  it('API do Mentor retorna avaliação registrada sem decisões paralelas', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2030-03-04T15:00:00Z'))
    const db = database(), evaluation = await evaluate(db); db.calls.length = 0
    db.values.mentor_decisao = { dados: { modelo: 'MENTOR_V2', avaliacao: evaluation } }; state.db = db
    const res = response(); await mentorHandler({ method: 'GET' }, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.avaliacao_mentor_v2).toEqual({ ...evaluation, origem: 'decisao_registrada' })
    expect(res.body.decisao_mentor).toBeNull()
    // Existing Statistics consumes this list. Empty is not activation of the
    // historical review algorithm or a fabricated retention signal.
    expect(res.body.revisao_imediata).toEqual([])
    expect(res.body.resumo.dominio).toBe('UNKNOWN')
    expect(db.calls).toEqual(['mentor_decisao', 'mentor_encontro_semanal'])
    expect(db.writes).toEqual([])
  })
  it('cron recusa policy indisponível antes de backup e não marca execução como concluída', async () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date('2030-03-04T15:00:00Z')); vi.stubEnv('CRON_SECRET', 'ci-test-only')
    const db = database({ conhecimento_modulo: [], mentor_execucao: null }); state.db = db
    // maybeSingle must return null when no execution exists.
    const originalFrom = db.from
    db.from = (table) => { const q = originalFrom(table); if (table === 'mentor_execucao') q.maybeSingle = () => Promise.resolve({ data: null, error: null }); return q }
    const res = response(); await cronHandler({ method: 'GET', headers: { authorization: 'Bearer ci-test-only' } }, res)
    expect(res.statusCode).toBe(500); expect(db.rpc).not.toHaveBeenCalled()
    expect(db.writes.some((w) => w.payload?.status === 'concluida')).toBe(false)
    expect(db.writes.some((w) => w.payload?.status === 'falhou')).toBe(true)
  })
  it('painel não anuncia versão de execução histórica como policy vigente', async () => {
    const db = database({ conhecimento_modulo: [], mentor_execucao: [{ politica_versao: 'v1-antiga' }] }); state.db = db
    const res = response(); await painelHandler({ method: 'GET', query: {} }, res)
    expect(res.statusCode).toBe(200); expect(res.body.saude.politica).toBeNull()
    expect(res.body.protecoes.carga_minima_segunda_sexta).toBeNull()
    expect(db.calls).not.toContain('mentor_conhecimento')
  })
  it('cron não reapresenta resultado V1 já concluído como execução V2, nem o sobrescreve', async () => {
    vi.stubEnv('CRON_SECRET', 'ci-test-only')
    const db = database({ mentor_execucao: { id: 'old-run', resultado: { politica_mentor: 'v1' } } }); state.db = db
    const res = response(); await cronHandler({ method: 'GET', headers: { authorization: 'Bearer ci-test-only' } }, res)
    expect(res.statusCode).toBe(503)
    expect(db.writes).toEqual([])
    expect(db.rpc).not.toHaveBeenCalled()
  })
  it('entrypoints operacionais não importam motores estratégicos V1', () => {
    for (const path of ['api/mentor.js', 'api/_lib/plano-handler.js', 'api/_lib/mentor-v2.js', 'api/cron/mentor.js']) {
      const text = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
      expect(text).not.toMatch(/from ['"].*(?:shared\/mentor\.js|shared\/planner\.js|mentor-decision|mentor-specialists|module-knowledge)/)
    }
  })
})
