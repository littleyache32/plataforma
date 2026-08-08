const baseUrl = process.env.PLATFORM_URL || 'https://plataforma-three-virid.vercel.app'
const accessKey = process.env.APP_ACCESS_KEY
const start = Math.max(0, Number(process.argv.find((item) => item.startsWith('--start='))?.split('=')[1] || 0))
const requestedLimit = Number(process.argv.find((item) => item.startsWith('--limit='))?.split('=')[1] || Infinity)

if (!accessKey) throw new Error('APP_ACCESS_KEY não configurada no .env.local.')

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)) }

const login = await fetch(`${baseUrl}/api/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: accessKey }) })
if (!login.ok) throw new Error(`Não foi possível entrar na plataforma: ${login.status}`)
const cookie = login.headers.get('set-cookie')?.split(';')[0]
if (!cookie) throw new Error('A plataforma não devolveu a sessão segura.')

async function generate(index) {
  let lastError
  for (let attempt = 1; attempt <= 8; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/admin/acervo`, { method: 'POST', headers: { cookie, 'content-type': 'application/json' }, body: JSON.stringify({ index }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(`${response.status}: ${data.error || 'falha sem mensagem'}`)
      return data
    } catch (error) {
      lastError = error
      const delay = Math.min(120_000, 15_000 * attempt)
      process.stdout.write(`${JSON.stringify({ index, tentativa: attempt, erro: String(error.message || error), nova_tentativa_em_segundos: delay / 1000 })}\n`)
      await sleep(delay)
    }
  }
  throw lastError
}

let index = start
let completed = 0
let total = Infinity
while (index < total && completed < requestedLimit) {
  const data = await generate(index)
  total = data.total
  completed += 1
  process.stdout.write(`${JSON.stringify({ progresso: `${index + 1}/${total}`, cache: data.cache, materia: data.materia, topico: data.topico, questoes: data.questoes, cards: data.cards, fontes: data.fontes })}\n`)
  index += 1
  if (index < total && completed < requestedLimit) await sleep(15_000)
}

process.stdout.write(`${JSON.stringify({ concluido: true, processados: completed, proximo_indice: index, total })}\n`)
