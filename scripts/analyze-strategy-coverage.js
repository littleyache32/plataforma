import { readFile } from 'node:fs/promises'
import pg from 'pg'
import { matchesStrategyTopic, sourcePatternsForTopic, subjectForStrategyDocument } from './strategy-source-map.js'

const reportPath = process.argv[2] || 'tmp/estrategia-2026-08-11/parsed/auditoria.json'
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!connectionString) throw new Error('POSTGRES_URL_NON_POOLING ou POSTGRES_URL não configurada.')

const databaseUrl = new URL(connectionString)
databaseUrl.searchParams.delete('sslmode')
databaseUrl.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: databaseUrl.toString(), ssl: { rejectUnauthorized: false } })
const report = JSON.parse(await readFile(reportPath, 'utf8'))
const documents = report.documentos.filter((item) => !item.erro)

await client.connect()
try {
  const topics = await client.query(`
    select m.nome materia, t.nome topico
    from topico t
    join materia m on m.id=t.materia_id
    join objetivo o on o.id=m.objetivo_id
    where o.tipo='concurso' and o.ativo=true
    order by m.nome,t.nome
  `)
  const coverage = topics.rows.map((topic) => {
    const sources = documents.filter((document) => matchesStrategyTopic(document.arquivo, topic.materia, topic.topico))
    return {
      ...topic,
      padroes: sourcePatternsForTopic(topic.materia, topic.topico),
      fontes: sources.map((item) => item.arquivo),
      paginas: sources.reduce((sum, item) => sum + item.paginas, 0),
      caracteres: sources.reduce((sum, item) => sum + item.caracteres, 0),
    }
  })
  const materialBySubject = Object.groupBy(documents, (item) => subjectForStrategyDocument(item.arquivo) || 'Não mapeado')
  const summary = {
    pdfs: documents.length,
    topicos: coverage.length,
    cobertos: coverage.filter((item) => item.fontes.length).length,
    sem_fonte: coverage.filter((item) => !item.fontes.length).map((item) => `${item.materia} > ${item.topico}`),
    documentos_por_disciplina: Object.fromEntries(Object.entries(materialBySubject).map(([subject, items]) => [subject, items.length])),
    cobertura: coverage,
  }
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`)
} finally {
  await client.end()
}
