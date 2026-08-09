import { librarySpecs } from './acervo-specs.js'

const baseUrl = process.env.PLATFORM_URL || 'https://plataforma-three-virid.vercel.app'
const accessKey = process.env.APP_ACCESS_KEY
const start = Math.max(0, Number(process.argv.find((item) => item.startsWith('--start='))?.split('=')[1] || 0))
const requestedLimit = Number(process.argv.find((item) => item.startsWith('--limit='))?.split('=')[1] || Infinity)
const concurrency = Math.min(3, Math.max(1, Number(process.argv.find((item) => item.startsWith('--concurrency='))?.split('=')[1] || 2)))
const force = process.argv.includes('--force')
const facultySubjects = new Set(['Direito das Pessoas e dos Negócios Jurídicos', 'Teoria da Constituição e Direitos Fundamentais', 'Teoria do Crime', 'Teorias da Justiça'])

if (!accessKey) throw new Error('APP_ACCESS_KEY não configurada no .env.local.')

const tasks = librarySpecs.filter((spec) => spec.type === 'concurso' || facultySubjects.has(spec.subject)).flatMap((spec) => spec.topics.map(([topic]) => ({ materia: spec.subject, topico: topic, contexto: spec.type })))
const end = Math.min(tasks.length, start + requestedLimit)

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

const login = await fetch(`${baseUrl}/api/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: accessKey }) })
if (!login.ok) throw new Error(`Não foi possível entrar na plataforma: ${login.status}`)
const cookie = login.headers.get('set-cookie')?.split(';')[0]
if (!cookie) throw new Error('A plataforma não devolveu a sessão segura.')

async function rebuild(index) {
  let lastError
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/admin/reconstruir`, {
        method: 'POST',
        headers: { cookie, 'content-type': 'application/json' },
        body: JSON.stringify({ index, force, researchModel: 'gemini-3.1-flash-lite', generationModel: 'gemini-3.1-flash-lite' }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(`${response.status}: ${data.error || 'falha sem mensagem'}`)
      return data
    } catch (error) {
      lastError = error
      const delay = Math.min(180_000, 20_000 * attempt)
      process.stdout.write(`${JSON.stringify({ index, tentativa: attempt, erro: String(error.message || error), nova_tentativa_em_segundos: delay / 1000 })}\n`)
      await sleep(delay)
    }
  }
  throw lastError
}

let nextIndex = start
let completed = 0
const failures = []

async function worker() {
  while (nextIndex < end) {
    const index = nextIndex
    nextIndex += 1
    try {
      const data = await rebuild(index)
      completed += 1
      process.stdout.write(`${JSON.stringify({ progresso: `${completed}/${end - start}`, indice: index, ...data })}\n`)
    } catch (error) {
      failures.push({ index, ...tasks[index], erro: String(error.message || error) })
      process.stdout.write(`${JSON.stringify({ falha_final: failures.at(-1) })}\n`)
    }
    if (nextIndex < end) await sleep(8_000)
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, end - start) }, () => worker()))
process.stdout.write(`${JSON.stringify({ concluido: failures.length === 0, processados: completed, falhas: failures, intervalo: [start, end], total: tasks.length })}\n`)
if (failures.length) process.exitCode = 1
