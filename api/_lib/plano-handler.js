import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, requireAccess } from './http.js'
import { calculateTopicDiagnosis } from '../../shared/mentor.js'
import { buildMentorWeek, canGenerateMentorWeek, planOverdueMoves } from '../../shared/planner.js'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() + days)
  return value.toISOString().slice(0, 10)
}

async function reallocateOverdue(supabase, sessions, today, weekEnd) {
  let moved = 0
  for (const move of planOverdueMoves(sessions, today, weekEnd)) {
    const { error } = await supabase.from('sessao').update({ data: move.data, movida_pelo_mentor_em: new Date().toISOString() }).eq('id', move.id)
    if (error) throw error
    moved += 1
  }
  return moved
}

export default async function planHandler(req, res) {
  if (!allowMethods(req, res, ['POST']) || !requireAccess(req, res)) return
  try {
    const { inicio } = req.body || {}
    if (!DATE_PATTERN.test(String(inicio || ''))) return res.status(400).json({ error: 'Inicio da semana invalido.' })
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    if (!canGenerateMentorWeek({ weekStart: inicio, today })) return res.status(200).json({ criadas: 0, total_planejado: 0, aguardando_domingo: true })
    const supabase = getSupabaseAdmin()
    const weekEnd = addDays(inicio, 6)
    const commitmentEnd = addDays(inicio, 13)
    const [{ data: catalog, error: catalogError }, { data: records, error: recordsError }, { count: pendingReviews, error: reviewError }, { data: commitments, error: commitmentsError }, { data: existing, error: existingError }] = await Promise.all([
      supabase.from('objetivo').select('id,tipo,materias:materia(id,nome,topicos:topico(id,nome))').eq('ativo', true).order('criado_em'),
      supabase.from('registro').select('resultado,classificacao,criado_em,questao!inner(topico_id)').order('criado_em', { ascending: false }),
      supabase.from('revisao_item').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
      supabase.from('compromisso').select('id,objetivo_id,materia_id,titulo,tipo,data,peso,duracao_minutos,concluido').eq('concluido', false).lte('data', commitmentEnd).gte('data', inicio),
      supabase.from('sessao').select('id,chave_mentor,data,status,movida_em,movida_pelo_mentor_em,duracao_estimada,prioridade').gte('data', inicio).lte('data', weekEnd),
    ])
    if (catalogError) throw catalogError
    if (recordsError) throw recordsError
    if (reviewError) throw reviewError
    if (commitmentsError) throw commitmentsError
    if (existingError) throw existingError

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
    const demands = buildMentorWeek({ weekStart: inicio, catalog: catalog || [], priorities, pendingReviews: pendingReviews || 0, commitments: commitments || [] })
    if (!demands.length) return res.status(200).json({ criadas: 0, motivo: 'Nenhuma disciplina disponivel.' })
    const existingByKey = new Map((existing || []).map((item) => [item.chave_mentor, item]))
    const recalibrated = demands.map((item) => {
      const previous = existingByKey.get(item.chave_mentor)
      if (previous && (previous.movida_em || previous.movida_pelo_mentor_em || previous.status !== 'planejada')) return { ...item, data: previous.data }
      return item
    })
    const { data, error } = await supabase.from('sessao').upsert(recalibrated, { onConflict: 'chave_mentor' }).select('id')
    if (error) throw error
    const { data: refreshed, error: refreshedError } = await supabase.from('sessao').select('id,data,status,movida_em,duracao_estimada,prioridade').gte('data', inicio).lte('data', weekEnd)
    if (refreshedError) throw refreshedError
    const moved = inicio <= today && today <= weekEnd ? await reallocateOverdue(supabase, refreshed || [], today, weekEnd) : 0
    return res.status(200).json({ atualizadas: data?.length || 0, total_planejado: demands.length, remanejadas: moved })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel preparar sua semana.')
  }
}
