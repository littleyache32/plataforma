import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { PDFParse } from 'pdf-parse'

const source = path.resolve(process.argv[2] || 'tmp/estrategia-2026-08-11/pdf')
const output = path.resolve(process.argv[3] || 'tmp/estrategia-2026-08-11/parsed')

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const fullPath = path.join(directory, entry.name)
    return entry.isDirectory() ? listFiles(fullPath) : [/^\d{3}-.*\.pdf$/i.test(entry.name) ? fullPath : null]
  }))
  return nested.flat().filter(Boolean)
}

async function parsePdf(file) {
  const data = await readFile(file)
  const parser = new PDFParse({ data })
  try {
    const result = await parser.getText({ pageJoiner: '\n\n--- PAGINA page_number DE total_number ---\n\n' })
    const relative = path.relative(source, file)
    const textFile = path.join(output, relative.replace(/\.pdf$/i, '.txt'))
    await mkdir(path.dirname(textFile), { recursive: true })
    await writeFile(textFile, result.text, 'utf8')
    return {
      arquivo: relative,
      sha256: createHash('sha256').update(data).digest('hex'),
      bytes_pdf: data.length,
      paginas: result.total,
      paginas_sem_texto: result.pages.filter((page) => String(page.text || '').trim().length < 30).length,
      caracteres: result.text.length,
      texto: textFile,
    }
  } finally {
    await parser.destroy()
  }
}

async function mapConcurrent(items, concurrency, worker) {
  const results = new Array(items.length)
  let nextIndex = 0
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex
      nextIndex += 1
      try {
        results[index] = await worker(items[index])
      } catch (error) {
        results[index] = { arquivo: path.relative(source, items[index]), erro: String(error.message || error) }
      }
    }
  }
  await Promise.all(Array.from({ length: concurrency }, run))
  return results
}

await mkdir(output, { recursive: true })
const files = (await listFiles(source)).sort((a, b) => a.localeCompare(b, 'pt-BR'))
const documents = await mapConcurrent(files, 4, parsePdf)
const hashes = new Map()
for (const document of documents) {
  if (!document.sha256) continue
  document.duplicado_de = hashes.get(document.sha256) || null
  if (!document.duplicado_de) hashes.set(document.sha256, document.arquivo)
}
const failures = documents.filter((item) => item.erro)
const valid = documents.filter((item) => !item.erro)
const report = {
  origem: source,
  pdfs: documents.length,
  pdfs_validos: valid.length,
  pdfs_unicos: valid.filter((item) => !item.duplicado_de).length,
  paginas: valid.reduce((sum, item) => sum + item.paginas, 0),
  paginas_sem_texto: valid.reduce((sum, item) => sum + item.paginas_sem_texto, 0),
  caracteres: valid.reduce((sum, item) => sum + item.caracteres, 0),
  falhas: failures,
  documentos: documents,
}
await writeFile(path.join(output, 'auditoria.json'), JSON.stringify(report, null, 2), 'utf8')
process.stdout.write(`${JSON.stringify({ ...report, documentos: undefined }, null, 2)}\n`)
