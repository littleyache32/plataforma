import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import canvas from '@napi-rs/canvas'

globalThis.DOMMatrix ||= canvas.DOMMatrix
globalThis.ImageData ||= canvas.ImageData
globalThis.Path2D ||= canvas.Path2D
const { PDFParse } = await import('pdf-parse')

const baseUrl = process.env.PLATFORM_URL || 'https://plataforma-three-virid.vercel.app'
const username = process.env.PLATFORM_USERNAME
const password = process.env.PLATFORM_PASSWORD
if (!username || !password) throw new Error('Defina PLATFORM_USERNAME e PLATFORM_PASSWORD no ambiente local.')

const downloads = path.join(process.env.USERPROFILE || '', 'Downloads')
const sources = [
  ['Plano de ensino e plano de aula Pessoas e NJ 2 2026 Matutino e Vespertino.pdf', 'Direito das Pessoas e dos Negócios Jurídicos'],
  ['teoria_do_crime_material_completo_22-09.pdf', 'Teoria do Crime'],
  ['bd97dd3b-12cd-436b-a871-71043d01fc3e.pdf', 'Teorias da Justiça'],
  ['a57974e1-837d-4102-b2a9-c7ad359b1e8f.pdf', 'Teorias da Justiça'],
  ['index (2).pdf', 'Teoria da Constituição e Direitos Fundamentais'],
  ['index (1).pdf', 'Teoria do Crime'],
  ['index.pdf', 'Direito das Pessoas e dos Negócios Jurídicos'],
]

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

async function pdfSource(fileName) {
  const filePath = path.join(downloads, fileName)
  const data = await readFile(filePath)
  const parser = new PDFParse({ data })
  try {
    const result = await parser.getText()
    const text = String(result.text || '').trim()
    const sha256 = createHash('sha256').update(data).digest('hex')
    if (text.length >= 120) return { name: fileName, content: text, note: `PDF fornecido pelo mentorado, ${result.total || 'várias'} páginas, SHA-256 ${sha256}.` }
    return {
      name: fileName,
      content: `Fonte oficial fornecida pelo mentorado em formato digitalizado, sem camada textual pesquisável. Disciplina identificada pela capa do documento. Arquivo: ${fileName}. Total de páginas: ${result.total || 'não identificado'}. SHA-256: ${sha256}. O conteúdo integral permanece como fonte primária e exige OCR antes de gerar questões ou Question Cards.`,
      note: 'PDF digitalizado registrado no catálogo. Nenhuma questão pode ser gerada somente a partir deste registro até a extração OCR.',
    }
  } finally {
    await parser.destroy()
  }
}

async function request(url, options = {}) {
  const response = await fetch(`${baseUrl}${url}`, options)
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`)
  return { body, response }
}

const login = await request('/api/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ acao: 'entrar', handle: username, password }) })
const cookie = login.response.headers.getSetCookie?.()[0]?.split(';')[0] || login.response.headers.get('set-cookie')?.split(';')[0]
if (!cookie) throw new Error('A sessão autenticada não retornou cookie.')
const catalog = (await request('/api/catalogo', { headers: { cookie } })).body.objetivos
const faculty = catalog.find((item) => item.tipo === 'faculdade')
if (!faculty) throw new Error('Objetivo Faculdade não encontrado.')

const imported = []
for (const [fileName, subjectName] of sources) {
  const subject = faculty.materias.find((item) => normalize(item.nome).includes(normalize(subjectName)) || normalize(subjectName).includes(normalize(item.nome)))
  if (!subject) throw new Error(`Disciplina não encontrada para ${subjectName}.`)
  const source = await pdfSource(fileName)
  const result = await request('/api/admin?modulo=materiais', {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ acao: 'registrar_fonte', objetivoId: faculty.id, materiaId: subject.id, nome: source.name, conteudo: source.content, observacao: source.note }),
  })
  imported.push({ arquivo: fileName, disciplina: subject.nome, trechos: result.body.trechos })
}

if (process.env.CONSTITUTION_PLAN_PATH) {
  const raw = await readFile(process.env.CONSTITUTION_PLAN_PATH, 'utf8')
  const start = raw.indexOf('Teoria da Constituição e Direitos Fundamentais')
  const end = raw.indexOf('Última atualização:')
  const content = raw.slice(Math.max(0, start), end > start ? end : undefined).trim()
  const subject = faculty.materias.find((item) => normalize(item.nome).includes('teoria da constituicao'))
  const result = await request('/api/admin?modulo=materiais', {
    method: 'POST', headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ acao: 'registrar_fonte', objetivoId: faculty.id, materiaId: subject.id, nome: 'Plano de Aula 2026 - Teoria da Constituição e Direitos Fundamentais', conteudo: content, observacao: 'Plano de aula oficial copiado do ambiente acadêmico pelo mentorado.' }),
  })
  imported.push({ arquivo: 'Plano de Aula 2026 - Teoria da Constituição', disciplina: subject.nome, trechos: result.body.trechos })
}

console.log(JSON.stringify({ importados: imported.length, fontes: imported }, null, 2))
