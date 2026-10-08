import { readdir, readFile } from 'node:fs/promises'
import pg from 'pg'

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error('POSTGRES_URL_NON_POOLING ou POSTGRES_URL nao configurada.')
}

const migrationsDirectory = new URL('../supabase/migrations/', import.meta.url)
const databaseUrl = new URL(connectionString)
databaseUrl.searchParams.delete('sslmode')
databaseUrl.searchParams.delete('sslrootcert')
const client = new pg.Client({
  connectionString: databaseUrl.toString(),
  // A integracao Vercel/Supabase entrega uma cadeia propria no pool.
  // A conexao continua TLS, mas a migracao local nao valida a CA do pool.
  ssl: { rejectUnauthorized: false },
})

try {
  await client.connect()
  await client.query(`
    create table if not exists schema_migration (
      nome text primary key,
      aplicado_em timestamptz not null default now()
    )
  `)
  const { rows } = await client.query('select nome from schema_migration')
  const applied = new Set(rows.map((row) => row.nome))
  const files = (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort()

  for (const file of files) {
    if (applied.has(file)) continue
    const sql = await readFile(new URL(file, migrationsDirectory), 'utf8')
    await client.query('begin')
    try {
      // Serialize executors and recheck the ledger after acquiring the lock.
      // The startup snapshot alone cannot detect another executor's commit.
      await client.query("select pg_advisory_xact_lock(hashtext('plataforma.schema_migration'))")
      const current = await client.query('select nome from schema_migration where nome = $1', [file])
      if (current.rows.length) {
        await client.query('commit')
        continue
      }
      await client.query(sql)
      await client.query('insert into schema_migration (nome) values ($1)', [file])
      await client.query('commit')
      console.log(`Migracao ${file} aplicada com sucesso.`)
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }
} finally {
  await client.end()
}
