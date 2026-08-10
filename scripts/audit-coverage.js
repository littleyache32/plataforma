import { createClient } from '@supabase/supabase-js'

const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!process.env.SUPABASE_URL || !key) throw new Error('Supabase não configurado.')
const supabase = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } })
const questionTarget = 30
const cardTarget = 50

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
  allRows('questao', 'id,topico_id,marcada_errada,ativa,dificuldade'),
  allRows('question_card', 'id,topico_id,ativa,ativo'),
])
if (error) throw error
const relevant = (topics || []).filter((topic) => !['análise e produção de texto', 'analise e producao de texto'].includes(String(topic.materia?.nome || '').toLocaleLowerCase('pt-BR')))
const coverage = relevant.map((topic) => {
  const activeQuestions = questions.filter((item) => item.topico_id === topic.id && item.ativa !== false && !item.marcada_errada)
  const activeCards = cards.filter((item) => item.topico_id === topic.id && item.ativa !== false && item.ativo !== false)
  const dificuldade = {
    faceis: activeQuestions.filter((item) => Number(item.dificuldade) <= 2).length,
    medias: activeQuestions.filter((item) => Number(item.dificuldade) === 3).length,
    dificeis: activeQuestions.filter((item) => Number(item.dificuldade) >= 4).length,
  }
  return { contexto: topic.materia?.objetivo?.tipo, materia: topic.materia?.nome, topico: topic.nome, questoes: activeQuestions.length, questoes_faltantes: Math.max(0, questionTarget - activeQuestions.length), dificuldade, cards: activeCards.length, cards_faltantes: Math.max(0, cardTarget - activeCards.length) }
})
const summary = coverage.reduce((result, item) => ({
  topicos: result.topicos + 1,
  questoes: result.questoes + item.questoes,
  questoes_alvo: result.questoes_alvo + questionTarget,
  questoes_faltantes: result.questoes_faltantes + item.questoes_faltantes,
  cards: result.cards + item.cards,
  cards_alvo: result.cards_alvo + cardTarget,
  cards_faltantes: result.cards_faltantes + item.cards_faltantes,
}), { topicos: 0, questoes: 0, questoes_alvo: 0, questoes_faltantes: 0, cards: 0, cards_alvo: 0, cards_faltantes: 0 })
const orderedGaps = coverage.filter((item) => item.questoes_faltantes || item.cards_faltantes).sort((a, b) => (b.questoes_faltantes + b.cards_faltantes) - (a.questoes_faltantes + a.cards_faltantes))
console.log(JSON.stringify({ resumo: summary, topicos_com_lacuna: orderedGaps.length, bacen: { expansao_liberada: true, fase: 'pre_edital', estrategia: 'Preparação ampla com o referencial disponível; o próximo edital acionará análise de diferenças e replanejamento.' }, lacunas: process.argv.includes('--all') ? orderedGaps : orderedGaps.slice(0, 20) }, null, 2))
