import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { createHmac, randomUUID } from 'node:crypto'
import { createServer } from 'node:http'
import pg from 'pg'

// Fail closed: never load .env or fall back to a production connection.
assert.equal(process.env.CI, 'true')
assert.equal(process.env.GITHUB_REF, 'refs/heads/ci-homologacao-fase4')
const url = new URL(process.env.REVIEW_TEST_DATABASE_URL)
assert.equal(url.hostname, '127.0.0.1')
assert.equal(url.pathname, '/plataforma_review_test')
assert.equal(url.username, 'ci_review')
const rest = new URL(process.env.REVIEW_TEST_POSTGREST_URL)
assert.equal(rest.origin, 'http://127.0.0.1:3000')
for (const key of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'POSTGRES_URL', 'POSTGRES_URL_NON_POOLING', 'APP_ACCESS_KEY']) assert.equal(process.env[key], undefined)

const directory = new URL('../supabase/migrations/', import.meta.url)
const migration = '0069_revisao_v2_fatos_sem_intervalo.sql'
const sql = await readFile(new URL(migration, directory), 'utf8')
const runner = await readFile(new URL('../scripts/migrate.js', import.meta.url), 'utf8')
// Execute the EXACT transaction body from the canonical runner, with real pg clients.
const block = runner.slice(runner.indexOf("    await client.query('begin')"), runner.indexOf('\n  }\n} finally'))
assert(block.includes('pg_advisory_xact_lock') && block.includes('insert into schema_migration'))
const apply = new (Object.getPrototypeOf(async function () {}).constructor)('client', 'file', 'sql', `for (const unused of [0]) { ${block} }`)
const connect = async () => { const c = new pg.Client({ connectionString: url.toString() }); await c.connect(); return c }
let db, second, server, base, q1, q2, topic, goal, subject, historic, session, need, cookie
const scalar = async (query, args = []) => (await db.query(query, args)).rows[0]
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

before(async () => {
  db = await connect(); second = await connect()
  assert.equal((await scalar("select current_setting('server_version_num')::int as v")).v >= 170000, true)
  await db.query(`create schema storage; create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create role anon nologin; create role service_role nologin bypassrls;
    create table schema_migration (nome text primary key, aplicado_em timestamptz not null default now());`)
  const files = (await readdir(directory)).filter((f) => /^\d{4}.*\.sql$/.test(f) && f < '0069').sort()
  // Replay the actual full application migrations through 0068 in this EMPTY CI database.
  // storage.buckets is a minimal Supabase platform dependency, not a mock of review tables.
  for (const file of files) {
    if (file.startsWith('0045_')) {
      // Historical 0045 requires at least one eligible curriculum topic.
      // Supply only a synthetic prerequisite; do not change the real migration.
      const objective = (await scalar("select id from objetivo where tipo='concurso' and ativo=true limit 1")).id
      const matter = (await scalar("insert into materia(objetivo_id,nome) values($1,'CI historical prerequisite') returning id", [objective])).id
      await db.query("insert into topico(materia_id,nome) values($1,'CI historical topic')", [matter])
    }
    try { await db.query(await readFile(new URL(file, directory), 'utf8')); await db.query('insert into schema_migration(nome) values($1)', [file]) }
    catch (error) { throw new Error(`Schema baseline failed at ${file}: ${error.code}`) }
  }
  assert.equal((await scalar('select count(*)::int as n from schema_migration')).n, files.length)
  // Remove migration seed records only in the guarded disposable DB; fixtures are synthetic.
  const tables = (await db.query("select tablename from pg_tables where schemaname='public' and tablename <> 'schema_migration'")).rows
  await db.query(`truncate ${tables.map((t) => `public."${t.tablename}"`).join(',')} cascade`)
  goal = (await scalar("insert into objetivo(tipo,nome) values('concurso','CI concurso') returning id")).id
  subject = (await scalar("insert into materia(objetivo_id,nome) values($1,'CI materia') returning id", [goal])).id
  topic = (await scalar("insert into topico(materia_id,nome) values($1,'CI conceito') returning id", [subject])).id
  const insertQuestion = async (title) => (await scalar(`insert into questao(topico_id,tipo,enunciado,gabarito,explicacao,fonte,trecho_fonte,origem)
    values($1,'CE',$2,'C','CI explicacao','CI fonte','CI trecho','material') returning id`, [topic, title])).id
  q1 = await insertQuestion('CI questão original'); q2 = await insertQuestion('CI questão equivalente')
  for (let i = 0; i < 10; i++) await db.query(`insert into sessao(objetivo_id,materia_id,titulo,tipo,data,status,duracao_estimada,duracao_realizada)
    values($1,$2,$3,'estudo','2030-03-01','feita',50,67)`, [goal, subject, `CI histórico ${i}`])
  session = (await scalar('select id from sessao order by titulo limit 1')).id
  historic = (await db.query("select * from sessao order by id")).rows
  await db.query("insert into revisao_item(questao_id,motivo,prioridade,agendada_para) values($1,'erro',2,'2020-01-01T15:00:00Z')", [q1])
})
after(async () => { if (server) await new Promise((resolve) => server.close(resolve)); await second?.end(); await db?.end() })

test('01: falha entre DDL e ledger faz rollback real do schema', async () => {
  await db.query(`create function fail_ledger() returns trigger language plpgsql as $$ begin raise exception 'CI failure'; end $$;
    create trigger fail_ledger before insert on schema_migration for each row execute function fail_ledger();`)
  await assert.rejects(apply(db, migration, sql), (e) => e.code === 'P0001')
  assert.equal((await scalar("select count(*)::int n from information_schema.columns where table_name='registro' and column_name='revisao_item_id'")).n, 0)
  assert.equal((await scalar('select count(*)::int n from schema_migration where nome=$1', [migration])).n, 0)
  assert.equal((await scalar("select is_nullable from information_schema.columns where table_name='revisao_item' and column_name='agendada_para'")).is_nullable, 'NO')
  await db.query('drop trigger fail_ledger on schema_migration; drop function fail_ledger()')
})
test('02: dois executores/conexões reais aplicam 0069 uma vez, DDL + ledger', async () => {
  await Promise.all([apply(db, migration, sql), apply(second, migration, sql)])
  assert.equal((await scalar('select count(*)::int n from schema_migration where nome=$1', [migration])).n, 1)
  assert.equal((await scalar("select count(*)::int n from information_schema.columns where table_name='registro' and column_name='revisao_item_id'")).n, 1)
})
test('03: reaplicação pelo executor é idempotente', async () => {
  await apply(db, migration, sql)
  assert.equal((await scalar('select count(*)::int n from schema_migration where nome=$1', [migration])).n, 1)
})
test('04: dez sessões e calendário legado preservados integralmente', async () => {
  assert.deepEqual((await db.query('select * from sessao order by id')).rows, historic)
  assert.equal((await scalar('select agendada_para from revisao_item')).agendada_para.toISOString(), '2020-01-01T15:00:00.000Z')
  await db.query("update revisao_item set status='concluida' where questao_id=$1", [q1])
})
test('05: necessidade nova não recebe intervalo/data fixa', async () => {
  need = (await scalar("insert into revisao_item(questao_id,motivo,prioridade) values($1,'erro',2) returning id,agendada_para", [q1])).id
  assert.equal((await scalar('select agendada_para from revisao_item where id=$1', [need])).agendada_para, null)
})
test('06: duas conexões concorrentes não duplicam operation ID', async () => {
  const query = `insert into registro(questao_id,resultado,classificacao,tempo,operacao_id,revisao_item_id,sessao_id,topico_id)
    values($1,'erro','certeza',30,'CI_concurrent',$2,$3,$4)`
  const results = await Promise.allSettled([db.query(query, [q1, need, session, topic]), second.query(query, [q1, need, session, topic])])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, '23505')
  assert.equal((await scalar("select count(*)::int n from registro where operacao_id='CI_concurrent'")).n, 1)
})
test('07: necessidade concorrente respeita unicidade pendente', async () => {
  const query = "insert into revisao_item(questao_id,motivo,prioridade) values($1,'erro',2)"
  const results = await Promise.allSettled([db.query(query, [q2]), second.query(query, [q2])])
  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
  assert.equal(results.find((r) => r.status === 'rejected').reason.code, '23505')
})
test('08: vínculo inválido faz rollback de tentativa sem estado parcial SQL', async () => {
  await db.query('begin')
  await assert.rejects(db.query(`insert into registro(questao_id,resultado,classificacao,tempo,revisao_item_id)
    values($1,'erro','certeza',30,$2)`, [q1, randomUUID()]), (e) => e.code === '23503')
  await db.query('rollback')
  assert.equal((await scalar('select count(*)::int n from registro')).n, 1)
})

async function http(path, method = 'GET', body, token = cookie) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(token ? { cookie: token } : {}), 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] }
}
test('09: HTTP real + PostgREST + login scrypt/cookie real, sem mocks', async () => {
  const secret = 'disposable_ci_jwt_secret_not_used_outside_this_job_0123456789'
  const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url')
  const payload = `${part({ alg: 'HS256', typ: 'JWT' })}.${part({ role: 'service_role', exp: Math.floor(Date.now() / 1000) + 3600 })}`
  const serviceKey = `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
  await db.query('grant usage on schema public to service_role; grant all on all tables in schema public to service_role; grant all on all sequences in schema public to service_role; notify pgrst, \'reload schema\'')
  let ready = false
  for (let i = 0; i < 30; i++) { try { const r = await fetch(`${rest.origin}/app_usuario`, { headers: { authorization: `Bearer ${serviceKey}` } }); if (r.ok) { ready = true; break } } catch {} await sleep(1000) }
  assert(ready, 'PostgREST did not become healthy')
  process.env.APP_ACCESS_KEY = randomUUID()
  process.env.SUPABASE_SERVICE_ROLE_KEY = serviceKey
  const routes = {}
  server = createServer(async (req, res) => {
    if (req.url.startsWith('/rest/v1/')) {
      const chunks = []; for await (const chunk of req) chunks.push(chunk)
      const upstream = await fetch(`${rest.origin}/${req.url.slice('/rest/v1/'.length)}`, { method: req.method,
        headers: Object.fromEntries(Object.entries(req.headers).filter(([key]) => !['host', 'connection', 'content-length'].includes(key))),
        ...(chunks.length ? { body: Buffer.concat(chunks) } : {}) })
      res.writeHead(upstream.status, Object.fromEntries(upstream.headers)); res.end(Buffer.from(await upstream.arrayBuffer())); return
    }
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    req.body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}
    res.status = (code) => { res.statusCode = code; return res }
    res.json = (body) => { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(body)); return res }
    try { await routes[req.url.split('?')[0]](req, res) } catch { res.status(500).json({ error: 'CI HTTP failure' }) }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve)); base = `http://127.0.0.1:${server.address().port}`
  process.env.SUPABASE_URL = base
  routes['/auth'] = (await import('../api/auth.js')).default
  routes['/pratica'] = (await import('../api/_lib/pratica-handler.js')).default
  routes['/revisoes'] = (await import('../api/_lib/revisoes-handler.js')).default
  const account = await http('/auth', 'POST', { acao: 'criar_conta', handle: '@ci_owner', password: 'CI_only_password_123' }, null)
  assert.equal(account.status, 201); cookie = account.cookie
  const login = await http('/auth', 'POST', { handle: '@ci_owner', password: 'CI_only_password_123' }, null)
  assert.equal(login.status, 200); cookie = login.cookie
  assert.equal((await http('/auth')).body.authenticated, true)
})
test('10: acesso inválido e segunda conta recusados, modelo pessoal', async () => {
  assert.equal((await http('/auth', 'POST', { handle: '@ci_other', password: 'CI_only_password_123' }, null)).status, 401)
  assert.equal((await http('/auth', 'POST', { acao: 'criar_conta', handle: '@ci_other', password: 'CI_only_password_123' }, null)).status, 409)
  assert.equal((await http('/pratica', 'POST', {}, null)).status, 401)
  assert.equal((await http('/revisoes', 'GET', null, 'mentor_session=invalid')).status, 401)
  assert.equal((await scalar('select count(*)::int n from app_usuario')).n, 1)
})
test('11: tentativa real cria necessidade, retry HTTP não duplica nem fixa intervalo', async () => {
  await db.query('delete from registro; delete from revisao_item')
  await db.query(`insert into mentor_contexto(id,fase,vigente_desde,semana_inicio,dados) values(1,'CI','2030-03-04','2030-03-04', $1)`, [JSON.stringify({ rotina_pratica: { questoes: true, revisao_pratica: true, question_cards: false } })])
  const policy = { politica: { modelo: 'MENTOR_V2', versao_contrato: 'mentor-v2/1', modalidades_permitidas: ['ESTUDO', 'QUESTOES', 'REVISAO'],
    regras: ['CONTINUIDADE_PLANO_EXISTENTE', 'PRIORIZACAO_CURRICULAR_SEMANAL', 'GERACAO_PLANO_SEMANAL'].map((id) => ({ id, habilitada: true })) } }
  await db.query("insert into conhecimento_modulo(modulo,versao,titulo,conteudo,ativo) values('mentor','CI','CI policy',$1,true)", [JSON.stringify(policy)])
  const answer = { questaoId: q1, resposta: 'E', classificacao: 'certeza', tempo: 30, operacaoId: 'CI_http_attempt' }
  const result = await http('/pratica', 'POST', answer)
  assert.equal(result.status, 201, JSON.stringify(result.body)); assert.equal(result.body.proxima_revisao, null)
  assert.equal((await http('/pratica', 'POST', answer)).status, 200)
  assert.equal((await scalar('select count(*)::int n from registro')).n, 1)
  need = (await scalar('select id,agendada_para from revisao_item')).id
  assert.equal((await scalar('select agendada_para from revisao_item')).agendada_para, null)
  const center = await http('/revisoes'); assert.equal(center.status, 200, JSON.stringify(center.body))
  assert(center.body.itens.some((item) => item.id === need))
})
test('12: execução factual atende necessidade sem marcar sessão/material', async () => {
  const metadata = { conceito_id: 'CI_concept', fonte: 'CI curriculum', evidencia: 'CI equivalence', atualizado_em: '2020-01-01T00:00:00Z' }
  await db.query('update questao set metadados_revisao=$1 where id in ($2,$3)', [JSON.stringify(metadata), q1, q2])
  // Synthetic past observation; no mocked wall clock or real user data.
  await db.query("update registro set criado_em=now()-interval '3 days' where operacao_id='CI_http_attempt'")
  await db.query(`insert into registro(questao_id,resultado,classificacao,tempo,revisao_item_id,sessao_id,topico_id,criado_em,operacao_id)
    values($1,'acerto','certeza',30,$2,$3,$4,now()-interval '1 day','CI_prior_retest')`, [q1, need, session, topic])
  const result = await http('/pratica', 'POST', { questaoId: q2, resposta: 'C', classificacao: 'certeza', tempo: 30, revisaoId: need, operacaoId: 'CI_attend' })
  assert.equal(result.status, 201, JSON.stringify(result.body)); assert.equal(result.body.atendimento, 'ATENDIDA')
  assert.equal((await scalar('select status from revisao_item where id=$1', [need])).status, 'concluida')
  assert.equal((await http('/pratica', 'POST', { questaoId: q2, resposta: 'C', classificacao: 'certeza', tempo: 30, revisaoId: need, operacaoId: 'CI_attend' })).status, 200)
  assert.deepEqual((await db.query('select * from sessao order by id')).rows, historic)
})
