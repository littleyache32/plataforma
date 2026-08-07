import { readFile } from 'node:fs/promises'
import pg from 'pg'

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL

if (!connectionString) {
  throw new Error('POSTGRES_URL_NON_POOLING ou POSTGRES_URL nao configurada.')
}

const sql = await readFile(new URL('../supabase/migrations/0001_init.sql', import.meta.url), 'utf8')
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
  await client.query(sql)
  console.log('Migracao 0001 aplicada com sucesso.')
} finally {
  await client.end()
}
