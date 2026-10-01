// Atualiza somente rótulos de demandas futuras do Mentor já vinculadas a PDF.
// Não replaneja dias, duração, ordem ou progresso.
import pg from 'pg'

const apply = process.argv.includes('--apply')
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!connectionString) throw new Error('Conexão Postgres não configurada.')
const url = new URL(connectionString)
url.searchParams.delete('sslmode')
url.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  const { rows } = await client.query(`select s.id,s.titulo,m.nome,m.disciplina_curso,m.ordem_curso
    from sessao s join material m on m.id=s.material_id join objetivo o on o.id=s.objetivo_id
    where s.data >= date '2026-10-02' and s.status='planejada' and s.origem='mentor'
      and s.tipo='estudo' and o.tipo='concurso' and m.disciplina_curso is not null
      and m.ordem_curso is not null and s.titulo like 'BACEN · %'`)
  const updates = rows.map((item) => ({
    id: item.id,
    before: item.titulo,
    after: `BACEN · ${item.disciplina_curso} · Aula ${item.ordem_curso}: ${item.nome.replace(/\.pdf$/i, '').replace(/^(\s*\d+\.\s*)+/, '').trim()}`,
  })).filter((item) => item.before !== item.after)
  if (apply && updates.length) {
    await client.query('begin')
    try {
      for (const item of updates) await client.query('update sessao set titulo=$1 where id=$2 and titulo=$3', [item.after, item.id, item.before])
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }
  process.stdout.write(`${JSON.stringify({ aplicado: apply, demandas_relabel: updates.length, alteracoes: updates.map(({ before, after }) => ({ before, after })) }, null, 2)}\n`)
} finally {
  await client.end()
}
