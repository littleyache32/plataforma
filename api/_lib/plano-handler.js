import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, requireAccess } from './http.js'
import { calculateTopicDiagnosis } from '../../shared/mentor.js'
import { buildMentorWeek } from '../../shared/planner.js'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export default async function planHandler(req, res) {
  if (!allowMethods(req, res, ['POST']) || !requireAccess(req, res)) return
  try {
    const { inicio } = req.body || {}
    if (!DATE_PATTERN.test(String(inicio || ''))) return res.status(400).json({ error: 'Inicio da semana invalido.' })
    const supabase = getSupabaseAdmin()
    const [{ data: catalog, error: catalogError }, { data: records, error: recordsError }, { count: pendingReviews, error: reviewError }] = await Promise.all([
      supabase.from('objetivo').select('id,tipo,materias:materia(id,nome,topicos:topico(id,nome))').eq('ativo', true).order('criado_em'),
      supabase.from('registro').select('resultado,classificacao,criado_em,questao!inner(topico_id)').order('criado_em', { ascending: false }),
      supabase.from('revisao_item').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
    ])
    if (catalogError) throw catalogError
    if (recordsError) throw recordsError
    if (reviewError) throw reviewError

    const grouped = new Map()
    for (const record of records || []) {
      const topicId = record.questao?.topico_id
      if (!topicId) continue
      const items = grouped.get(topicId) || []
      items.push(record)
      grouped.set(topicId, items)
    }
    const priorities = [...grouped.entries()].map(([id, items]) => ({ id, ...calculateTopicDiagnosis(items) }))
      .filter((item) => item.status === 'prioridade')
      .sort((a, b) => b.gravidade - a.gravidade)
      .slice(0, 3)
    const demands = buildMentorWeek({ weekStart: inicio, catalog: catalog || [], priorities, pendingReviews: pendingReviews || 0 })
    if (!demands.length) return res.status(200).json({ criadas: 0, motivo: 'Nenhuma disciplina disponivel.' })
    const { data, error } = await supabase.from('sessao').upsert(demands, { onConflict: 'chave_mentor', ignoreDuplicates: true }).select('id')
    if (error) throw error
    return res.status(200).json({ criadas: data?.length || 0, total_planejado: demands.length })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel preparar sua semana.')
  }
}

