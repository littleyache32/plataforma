// Importação pessoal, sempre em modo de auditoria até receber --apply.
// Exemplos em docs/fase-2-notas.md. Não cria prática nem altera sessões.
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, readFile, readdir, realpath, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import pg from 'pg'
import { courseSubjectForStrategyDocument, subjectForStrategyDocument } from './strategy-source-map.js'

const run = promisify(execFile)
const arg = (name) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3)
const input = arg('input')
const apply = process.argv.includes('--apply')
if (!input) throw new Error('Informe --input=arquivo.pdf, pasta ou pacote.zip.')
const source = path.resolve(input)
const manifest = arg('manifest') ? JSON.parse(await readFile(path.resolve(arg('manifest')), 'utf8')) : {}
const maxPdfBytes = 100 * 1024 * 1024
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex')
const safeRelative = (value) => {
  const normalized = value.replaceAll('\\', '/')
  if (!normalized || normalized.startsWith('/') || /^[a-z]:/i.test(normalized) || normalized.split('/').includes('..')) throw new Error(`Caminho inválido no pacote: ${value}`)
  return normalized
}

async function* directoryPdfs(folder, base = folder) {
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const full = path.join(folder, entry.name)
    if (entry.isDirectory()) yield* directoryPdfs(full, base)
    else if (entry.isFile() && /\.pdf$/i.test(entry.name)) yield { name: safeRelative(path.relative(base, full)), bytes: await readFile(full) }
  }
}

async function* sources() {
  const info = await stat(source)
  if (info.isDirectory()) yield* directoryPdfs(source)
  else if (/\.pdf$/i.test(source)) yield { name: path.basename(source), bytes: await readFile(source) }
  else if (/\.zip$/i.test(source)) {
    const temporary = await mkdtemp(path.join(tmpdir(), 'mentor-pdfs-'))
    try {
      await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', path.join(import.meta.dirname, 'extract-study-zip.ps1'), source, temporary], { maxBuffer: 1024 * 1024 })
      yield* directoryPdfs(temporary)
    } finally {
      const resolved = await realpath(temporary)
      if (path.dirname(resolved) !== path.resolve(tmpdir()) || !path.basename(resolved).startsWith('mentor-pdfs-')) throw new Error('Diretório temporário fora do local esperado; limpeza interrompida.')
      await rm(resolved, { recursive: true, force: true })
    }
  } else throw new Error('Entrada deve ser PDF, ZIP ou pasta.')
}

const entries = []
const hashes = new Set()
for await (const item of sources()) {
  if (item.bytes.length > maxPdfBytes) throw new Error(`PDF excede 100 MB: ${item.name}`)
  const digest = hash(item.bytes)
  if (hashes.has(digest)) throw new Error(`PDF duplicado no lote: ${item.name}`)
  hashes.add(digest)
  const provided = manifest[item.name] || {}
  const disciplinaCurso = provided.disciplina_curso || arg('disciplina-curso') || courseSubjectForStrategyDocument(`${source}/${item.name}`)
  const materia = provided.materia || arg('materia') || subjectForStrategyDocument(`${source}/${item.name}`)
  const order = Number(provided.ordem || arg('ordem') || path.basename(item.name).replace(/^\d{3}-/, '').match(/^\s*(\d+)\./)?.[1])
  if (!disciplinaCurso || !materia || !Number.isInteger(order) || order < 1) throw new Error(`Informe disciplina de curso, matéria do catálogo e ordem real para ${item.name}.`)
  entries.push({ ...item, digest, disciplinaCurso, materia, order })
}
if (!entries.length) throw new Error('Nenhum PDF encontrado.')
const orders = new Set()
for (const item of entries) {
  const key = `${item.disciplinaCurso}:${item.order}`
  if (orders.has(key)) throw new Error(`Ordem duplicada no lote: ${key}`)
  orders.add(key)
}

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!connectionString) throw new Error('Conexão Postgres não configurada.')
const url = new URL(connectionString)
url.searchParams.delete('sslmode')
url.searchParams.delete('sslrootcert')
const client = new pg.Client({ connectionString: url.toString(), ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  const objectiveType = arg('objetivo') || 'concurso'
  const objective = await client.query('select id from objetivo where tipo=$1 order by criado_em limit 1', [objectiveType])
  if (objective.rowCount !== 1) throw new Error(`Objetivo não encontrado: ${objectiveType}`)
  const objectiveId = objective.rows[0].id
  const existing = await client.query('select id,sha256,disciplina_curso,ordem_curso from material where objetivo_id=$1 and status=$2', [objectiveId, 'aceito'])
  const existingHashes = new Set(existing.rows.map((row) => row.sha256).filter(Boolean))
  const duplicates = entries.filter((item) => existingHashes.has(item.digest))
  const candidates = entries.filter((item) => !existingHashes.has(item.digest))
  for (const item of candidates) {
    if (existing.rows.some((row) => row.disciplina_curso === item.disciplinaCurso && row.ordem_curso === item.order)) throw new Error(`Ordem ${item.order} já ocupada em ${item.disciplinaCurso}.`)
  }
  if (apply && candidates.length) {
    const canvas = await import('@napi-rs/canvas')
    globalThis.DOMMatrix ||= canvas.DOMMatrix
    globalThis.ImageData ||= canvas.ImageData
    globalThis.Path2D ||= canvas.Path2D
    const { PDFParse } = await import('pdf-parse')
    await client.query('begin')
    try {
      for (const item of candidates) {
        const parser = new PDFParse({ data: item.bytes })
        let parsed
        try { parsed = await parser.getText() } finally { await parser.destroy() }
        const text = String(parsed.text || '').trim()
        const extraction = text.length >= 120 ? 'texto' : 'pendente_ocr'
        const subject = await client.query('select id from materia where objetivo_id=$1 and nome=$2', [objectiveId, item.materia])
        if (subject.rowCount !== 1) throw new Error(`Matéria do catálogo não encontrada: ${item.materia}. Cadastre-a antes da importação.`)
        const name = path.basename(item.name)
        const saved = await client.query(`insert into material(objetivo_id,materia_id,tipo,nome,conteudo,status,motivo,forcado,versao,disciplina_curso,arquivo_origem,fonte,paginas,sha256,ordem_curso,ordem_estudo,estado_extracao)
          values($1,$2,'pdf',$3,$4,'aceito',$5,false,'importacao-curricular',$6,$7,$8,$9,$10,$11,$11,$12) returning id`,
        [objectiveId, subject.rows[0].id, name, text, extraction === 'texto' ? 'PDF fornecido pelo mentorado.' : 'PDF sem camada textual suficiente; OCR pendente.', item.disciplinaCurso, item.name, arg('fonte') || 'PDF fornecido pelo mentorado', parsed.total || null, item.digest, item.order, extraction])
        await client.query(`insert into material_unidade_curricular(material_id,ordem,titulo,origem) values($1,1,$2,'titulo_pdf')`, [saved.rows[0].id, name.replace(/\.pdf$/i, '').replace(/^\d{3}-/, '')])
      }
      await client.query('commit')
    } catch (error) {
      await client.query('rollback')
      throw error
    }
  }
  process.stdout.write(`${JSON.stringify({ aplicado: apply, encontrados: entries.length, duplicados: duplicates.length, novos: candidates.length, arquivos: candidates.map((item) => ({ arquivo: item.name, disciplina: item.disciplinaCurso, ordem: item.order })) }, null, 2)}\n`)
} finally {
  await client.end()
}
