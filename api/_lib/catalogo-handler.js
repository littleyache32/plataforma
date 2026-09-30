import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './http.js'
import studyHandler from './estudo-handler.js'
import { isBacenPracticeOpen, currentPracticeFlags } from '../../shared/study-access.js'

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
      const practiceFlags = await currentPracticeFlags(supabase)
      const [{ data: subjects, error: subjectsError }, { data: objective, error: objectiveError }] = await Promise.all([
        supabase.from('materia').select('topicos:topico(id)').eq('objetivo_id', objetivoId),
        supabase.from('objetivo').select('tipo').eq('id', objetivoId).maybeSingle(),
      ])
      if (subjectsError || objectiveError) throw subjectsError || objectiveError
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
      const completed = objective?.tipo === 'concurso' ? await supabase.from('sessao').select('topico_id').eq('tipo', 'estudo').eq('status', 'feita').in('topico_id', topicIds) : { data: [], error: null }
      if (completed.error) throw completed.error
      const studied = new Set((completed.data || []).map((item) => item.topico_id))
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const questionCounts = groupCounts(questions)
      const cardCounts = groupCounts(cards)
      const topics = Object.fromEntries(topicIds.map((id) => {
        const materialLocked = objective?.tipo === 'concurso' && (!isBacenPracticeOpen(today) || !studied.has(id))
        return [id, { questoes: questionCounts[id] || 0, cards: cardCounts[id] || 0, bloqueado: !practiceFlags.questoes || materialLocked, cards_bloqueados: !practiceFlags.question_cards || materialLocked }]
      }))
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
