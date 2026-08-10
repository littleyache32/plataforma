import { mkdir, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!process.env.SUPABASE_URL || !key) throw new Error('Supabase não configurado.')
const supabase = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } })

async function allRows(table, columns, configure = (query) => query) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await configure(supabase.from(table).select(columns)).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

const { data: objective, error: objectiveError } = await supabase.from('objetivo').select('*').eq('tipo', 'concurso').eq('ativo', true).order('criado_em').limit(1).single()
if (objectiveError) throw objectiveError
const subjects = await allRows('materia', '*', (query) => query.eq('objetivo_id', objective.id))
const subjectIds = subjects.map((item) => item.id)
const topics = await allRows('topico', '*', (query) => query.in('materia_id', subjectIds))
const topicIds = topics.map((item) => item.id)
const [questions, cards, knowledge, materials, sessions] = await Promise.all([
  allRows('questao', '*', (query) => query.in('topico_id', topicIds)),
  allRows('question_card', '*', (query) => query.eq('objetivo_id', objective.id)),
  allRows('conhecimento', '*', (query) => query.in('materia_id', subjectIds)),
  allRows('material', '*', (query) => query.eq('objetivo_id', objective.id)),
  allRows('sessao', '*', (query) => query.eq('objetivo_id', objective.id)),
])

const backup = { criado_em: new Date().toISOString(), objective, subjects, topics, questions, cards, knowledge, materials, sessions }
await mkdir(new URL('../tmp/', import.meta.url), { recursive: true })
const output = new URL(`../tmp/backup-bacen-antes-catalogo-${Date.now()}.json`, import.meta.url)
await writeFile(output, JSON.stringify(backup))
console.log(JSON.stringify({ arquivo: output.pathname, disciplinas: subjects.length, topicos: topics.length, questoes: questions.length, cards: cards.length, conhecimentos: knowledge.length, materiais: materials.length, sessoes: sessions.length }, null, 2))
