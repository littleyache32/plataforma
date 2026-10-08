// Read-only production preflight. Never calls the migration runner or a write API.
import pg from 'pg'

const raw = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!raw || !process.env.SUPABASE_URL) throw new Error('Conexão canônica não configurada.')
const url = new URL(raw), project = new URL(process.env.SUPABASE_URL).hostname.split('.')[0]
if (!decodeURIComponent(url.username).endsWith(project) && url.hostname !== `db.${project}.supabase.co`) {
  throw new Error('PostgreSQL não corresponde ao projeto Supabase configurado.')
}
url.searchParams.delete('sslmode'); url.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false },
  options: '-c default_transaction_read_only=on -c statement_timeout=15000', connectionTimeoutMillis: 15000 })
try {
  await client.connect()
  await client.query('begin isolation level repeatable read read only')
  const server = await client.query("select current_setting('server_version') as version, current_setting('transaction_read_only') as read_only")
  const ledger = await client.query('select nome from public.schema_migration order by nome')
  const columns = await client.query(`select table_name,column_name,data_type,is_nullable,column_default
    from information_schema.columns where table_schema='public'
    and table_name = any($1::text[]) order by table_name,ordinal_position`,
  [['registro', 'revisao_item', 'questao', 'material_unidade_curricular', 'sessao']])
  const constraints = await client.query(`select conrelid::regclass::text as tabela, conname, pg_get_constraintdef(oid) as definicao
    from pg_constraint where connamespace='public'::regnamespace
    and conrelid::regclass::text = any($1::text[]) order by conname`,
  [['registro', 'revisao_item', 'questao', 'material_unidade_curricular', 'sessao']])
  const indexes = await client.query(`select tablename,indexname,indexdef from pg_indexes
    where schemaname='public' and tablename in ('registro','revisao_item') order by indexname`)
  const counts = await client.query(`select (select count(*) from registro)::int as tentativas,
    (select count(*) from revisao_item)::int as necessidades,
    (select count(*) from sessao where status='feita')::int as sessoes_concluidas,
    (select count(*) from material_unidade_curricular)::int as unidades`)
  console.log(JSON.stringify({ projeto: project, servidor: server.rows[0], migrations: ledger.rows.map((r) => r.nome),
    colunas: columns.rows, constraints: constraints.rows, indices: indexes.rows, contagens: counts.rows[0] }))
  await client.query('rollback')
} catch (error) {
  // Do not print connection URLs, keys, usernames, rows with personal data or raw errors.
  console.error(JSON.stringify({ erro: error.code || 'READ_ONLY_PREFLIGHT_FAILED' }))
  process.exitCode = 1
} finally { await client.end() }
