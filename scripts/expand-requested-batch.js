import { librarySpecs } from './acervo-specs.js'

const baseUrl = process.env.PLATFORM_URL || 'https://plataforma-three-virid.vercel.app'
const accessKey = process.env.APP_ACCESS_KEY
const questionGoal = Math.max(0, Number(process.argv.find((item) => item.startsWith('--questions='))?.split('=')[1] || 300))
const cardGoal = Math.max(0, Number(process.argv.find((item) => item.startsWith('--cards='))?.split('=')[1] || 600))
const model = process.argv.find((item) => item.startsWith('--model='))?.split('=')[1] || 'gemini-3.1-flash-lite'
const start = Math.max(0, Number(process.argv.find((item) => item.startsWith('--start='))?.split('=')[1] || 0))
const facultySubjects = new Set(['Direito das Pessoas e dos Negócios Jurídicos', 'Teoria da Constituição e Direitos Fundamentais', 'Teoria do Crime', 'Teorias da Justiça'])

if (!accessKey) throw new Error('APP_ACCESS_KEY não configurada no .env.local.')
const tasks = librarySpecs.filter((spec) => spec.type === 'concurso' || facultySubjects.has(spec.subject)).flatMap((spec) => spec.topics.map(([topic]) => ({ materia: spec.subject, topico: topic })))

const login = await fetch(`${baseUrl}/api/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: accessKey }) })
if (!login.ok) throw new Error(`Não foi possível entrar na plataforma: ${login.status}`)
const cookie = login.headers.get('set-cookie')?.split(';')[0]
if (!cookie) throw new Error('A plataforma não devolveu a sessão segura.')

let questionsAdded = 0
let cardsAdded = 0
let processed = 0
for (let index = start; index < tasks.length && (questionsAdded < questionGoal || cardsAdded < cardGoal); index += 1) {
  const questionCap = Math.min(10, questionGoal - questionsAdded)
  const cardCap = Math.min(20, cardGoal - cardsAdded)
  const response = await fetch(`${baseUrl}/api/admin/reconstruir`, {
    method: 'POST',
    headers: { cookie, 'content-type': 'application/json' },
    body: JSON.stringify({ index, questionCap, cardCap, researchModel: model, generationModel: model }),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    process.stdout.write(`${JSON.stringify({ concluido: false, bloqueado_no_indice: index, ...tasks[index], questoes_adicionadas: questionsAdded, cards_adicionados: cardsAdded, erro: data.error || `HTTP ${response.status}` })}\n`)
    process.exit(1)
  }
  questionsAdded += Number(data.questoes_adicionadas || 0)
  cardsAdded += Number(data.cards_adicionados || 0)
  processed += 1
  process.stdout.write(`${JSON.stringify({ indice: index, ...tasks[index], questoes_adicionadas: questionsAdded, cards_adicionados: cardsAdded })}\n`)
}

const completed = questionsAdded === questionGoal && cardsAdded === cardGoal
process.stdout.write(`${JSON.stringify({ concluido: completed, topicos_processados: processed, questoes_adicionadas: questionsAdded, meta_questoes: questionGoal, cards_adicionados: cardsAdded, meta_cards: cardGoal }, null, 2)}\n`)
if (!completed) process.exitCode = 1
