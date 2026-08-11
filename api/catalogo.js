import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'
import studyHandler from './_lib/estudo-handler.js'

const countPageSize = 1000

async function fetchAllTopicReferences(buildQuery) {
  const items = []
  for (let from = 0; ; from += countPageSize) {
    const { data, error } = await buildQuery().range(from, from + countPageSize - 1)
    if (error) throw error
    items.push(...(data || []))
    if (!data || data.length < countPageSize) return items
  }
}

function groupCounts(items) {
  return items.reduce((counts, item) => {
    counts[item.topico_id] = (counts[item.topico_id] || 0) + 1
    return counts
  }, {})
}

export default async function handler(req, res) {
  if (queryParam(req, 'recurso') === 'health') {
    if (!allowMethods(req, res, ['GET'])) return
    try {
      const { error } = await getSupabaseAdmin().from('materia').select('id', { head: true, count: 'exact' })
      if (error && error.code !== '42P01' && !error.message?.includes('schema cache')) throw error
      return res.status(200).json({ ok: true, service: 'mentor-de-estudos-api', database: error ? 'connected-schema-pending' : 'connected', timestamp: new Date().toISOString() })
    } catch (error) {
      console.error(error)
      return res.status(503).json({ ok: false, database: 'unavailable' })
    }
  }
  if (queryParam(req, 'recurso') === 'estudo') return studyHandler(req, res)
  if (!allowMethods(req, res, ['GET']) || !requireAccess(req, res)) return
  try {
    if (queryParam(req, 'recurso') === 'contagens') {
      const objetivoId = queryParam(req, 'objetivoId')
      const somenteCaderno = queryParam(req, 'caderno') === '1'
      if (!objetivoId) return res.status(400).json({ error: 'Objetivo obrigatorio.' })
      const supabase = getSupabaseAdmin()
      const { data: subjects, error: subjectsError } = await supabase.from('materia').select('topicos:topico(id)').eq('objetivo_id', objetivoId)
      if (subjectsError) throw subjectsError
      const topicIds = (subjects || []).flatMap((subject) => (subject.topicos || []).map((topic) => topic.id))
      if (!topicIds.length) return res.status(200).json({ topicos: {}, totais: { questoes: 0, cards: 0 } })
      let notebookQuestionIds = null
      if (somenteCaderno) {
        const pending = await fetchAllTopicReferences(() => supabase.from('revisao_item').select('questao_id').eq('status', 'pendente'))
        notebookQuestionIds = pending.map((item) => item.questao_id)
      }
      const questionPromise = somenteCaderno && !notebookQuestionIds.length
        ? Promise.resolve([])
        : fetchAllTopicReferences(() => {
          let query = supabase.from('questao').select('topico_id').in('topico_id', topicIds).eq('ativa', true).eq('marcada_errada', false).neq('estado', 'arquivada')
          if (somenteCaderno) query = query.in('id', notebookQuestionIds)
          return query
        })
      const cardPromise = somenteCaderno ? Promise.resolve([]) : fetchAllTopicReferences(() => supabase.from('question_card').select('topico_id').in('topico_id', topicIds).eq('ativa', true))
      const [questions, cards] = await Promise.all([questionPromise, cardPromise])
      const questionCounts = groupCounts(questions)
      const cardCounts = groupCounts(cards)
      const topics = Object.fromEntries(topicIds.map((id) => [id, { questoes: questionCounts[id] || 0, cards: cardCounts[id] || 0 }]))
      return res.status(200).json({ topicos: topics, totais: { questoes: questions.length, cards: cards.length } })
    }
    const { data, error } = await getSupabaseAdmin().from('objetivo')
      .select('id,tipo,nome,banca,situacao,data_alvo,materias:materia(id,nome,topicos:topico(id,nome))')
      .eq('ativo', true).order('criado_em')
    if (error) throw error
    data.forEach((objective) => {
      objective.materias?.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      objective.materias?.forEach((subject) => subject.topicos?.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
    })
    return res.status(200).json({ objetivos: data })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel carregar os objetivos.')
  }
}
