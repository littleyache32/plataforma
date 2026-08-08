import { createClient } from '@supabase/supabase-js'

const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!process.env.SUPABASE_URL || !key) throw new Error('Supabase não configurado.')
const supabase = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } })
const questionTarget = 20
const cardTarget = 20

async function allRows(table, columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

const [{ data: topics, error }, questions, cards] = await Promise.all([
  supabase.from('topico').select('id,nome,materia:materia_id(nome,objetivo:objetivo_id(id,nome,tipo))'),
  allRows('questao', 'id,topico_id,marcada_errada'),
  allRows('question_card', 'id,topico_id'),
])
if (error) throw error
const relevant = (topics || []).filter((topic) => !['análise e produção de texto', 'analise e producao de texto'].includes(String(topic.materia?.nome || '').toLocaleLowerCase('pt-BR')))
const coverage = relevant.map((topic) => {
  const questionCount = questions.filter((item) => item.topico_id === topic.id && !item.marcada_errada).length
  const cardCount = cards.filter((item) => item.topico_id === topic.id).length
  return { contexto: topic.materia?.objetivo?.tipo, materia: topic.materia?.nome, topico: topic.nome, questoes: questionCount, questoes_faltantes: Math.max(0, questionTarget - questionCount), cards: cardCount, cards_faltantes: Math.max(0, cardTarget - cardCount) }
})
const summary = coverage.reduce((result, item) => ({
  topicos: result.topicos + 1,
  questoes: result.questoes + item.questoes,
  questoes_alvo: result.questoes_alvo + questionTarget,
  cards: result.cards + item.cards,
  cards_alvo: result.cards_alvo + cardTarget,
}), { topicos: 0, questoes: 0, questoes_alvo: 0, cards: 0, cards_alvo: 0 })
console.log(JSON.stringify({ resumo: summary, bacen: { expansao_liberada: true, fase: 'pre_edital', estrategia: 'Preparação ampla com o referencial disponível; o próximo edital acionará análise de diferenças e replanejamento.' }, maiores_lacunas: coverage.sort((a, b) => (b.questoes_faltantes + b.cards_faltantes) - (a.questoes_faltantes + a.cards_faltantes)).slice(0, 20) }, null, 2))
