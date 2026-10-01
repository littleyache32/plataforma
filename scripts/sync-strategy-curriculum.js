import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import pg from 'pg'
import { courseSubjectForStrategyDocument } from './strategy-source-map.js'

const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3)
const root = path.resolve(arg('root') || path.join(process.env.USERPROFILE || '', 'Downloads', 'ESTUDO'))
const reportPath = path.resolve(arg('report') || 'tmp/estrategia-2026-08-11/parsed/auditoria.json')
const apply = process.argv.includes('--apply')
const sha = (data) => createHash('sha256').update(data).digest('hex')
const lessonOrder = (file) => Number(path.basename(file).replace(/^\d{3}-/, '').match(/^\s*(\d+)\./)?.[1])
const cleanName = (file) => path.basename(file).replace(/^\d{3}-/, '')

async function* pdfFiles(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) yield* pdfFiles(full)
    else if (entry.isFile() && /\.pdf$/i.test(entry.name)) yield full
  }
}

const report = JSON.parse(await readFile(reportPath, 'utf8'))
const expected = new Map(report.documentos.filter((item) => !item.duplicado_de).map((item) => [item.sha256, item]))
const seen = new Map()
for await (const file of pdfFiles(root)) {
  const digest = sha(await readFile(file))
  if (!expected.has(digest)) throw new Error(`PDF fora do inventário auditado: ${path.relative(root, file)}`)
  if (seen.has(digest)) throw new Error(`PDF duplicado no diretório: ${path.relative(root, file)}`)
  const relative = path.relative(root, file).replaceAll('\\', '/')
  const subject = courseSubjectForStrategyDocument(relative)
  const order = lessonOrder(file)
  if (!subject || !Number.isInteger(order) || order < 1) throw new Error(`Disciplina ou ordem não identificada: ${relative}`)
  seen.set(digest, { relative, subject, order, document: expected.get(digest) })
}
if (seen.size !== expected.size) throw new Error(`Inventário incompleto: ${seen.size} PDFs locais para ${expected.size} PDFs auditados.`)
const courseOrders = new Set()
for (const item of seen.values()) {
  const key = `${item.subject}:${item.order}`
  if (courseOrders.has(key)) throw new Error(`Ordem duplicada no curso: ${key}`)
  courseOrders.add(key)
}

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!connectionString) throw new Error('Conexão Postgres não configurada.')
const url = new URL(connectionString)
url.searchParams.delete('sslmode')
url.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  const { rows } = await client.query("select id,nome,motivo from material where versao='estrategia-2026.08.11' and status='aceito'")
  if (rows.length !== expected.size) throw new Error(`Banco tem ${rows.length} PDFs do Estratégia; inventário local tem ${expected.size}. Nada foi alterado.`)
  const matched = new Set()
  const updates = rows.map((row) => {
    const digest = row.motivo.match(/SHA-256\s+([a-f0-9]{64})/i)?.[1]?.toLowerCase()
    const item = seen.get(digest)
    if (!item || matched.has(digest)) throw new Error(`Hash ausente ou duplicado no banco para material ${row.id}. Nada foi alterado.`)
    matched.add(digest)
    return { id: row.id, digest, ...item }
  })
  const counts = Object.fromEntries([...new Set(updates.map((item) => item.subject))].sort().map((subject) => [subject, updates.filter((item) => item.subject === subject).length]))
  if (apply) {
    await client.query('begin')
    try {
      for (const item of updates) {
        await client.query(`update material set nome=$1,disciplina_curso=$2,arquivo_origem=$3,fonte='Estratégia Concursos',paginas=$4,sha256=$5,ordem_curso=$6,ordem_estudo=$6,estado_extracao='texto' where id=$7`, [cleanName(item.relative), item.subject, item.relative, item.document.paginas, item.digest, item.order, item.id])
        await client.query(`insert into material_unidade_curricular(material_id,ordem,titulo,origem) values ($1,1,$2,'titulo_pdf') on conflict (material_id,ordem) do update set titulo=excluded.titulo where material_unidade_curricular.origem='titulo_pdf'`, [item.id, cleanName(item.relative).replace(/\.pdf$/i, '')])
      }
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }
  process.stdout.write(`${JSON.stringify({ aplicado: apply, pdfs: updates.length, paginas: updates.reduce((total, item) => total + item.document.paginas, 0), disciplinas: counts }, null, 2)}\n`)
} finally {
  await client.end()
}
