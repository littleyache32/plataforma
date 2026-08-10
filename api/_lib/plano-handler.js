import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, requireAccess } from './http.js'
import { calculateTopicDiagnosis } from '../../shared/mentor.js'
import { buildMentorWeek, canGenerateMentorWeek, planOverdueMoves } from '../../shared/planner.js'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
export const brazilToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

function allocateQuestionReviews(groups, weekStart, weekEnd) {
  const occupied = new Set()
  const allocated = []
  const ordered = [...groups].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (b.count || 0) - (a.count || 0))
  for (const group of ordered) {
    for (let date = group.dueDate < weekStart ? weekStart : group.dueDate; date <= weekEnd; date = addDays(date, 1)) {
      if (occupied.has(date)) continue
      occupied.add(date)
      allocated.push({ ...group, dueDate: date })
      break
    }
  }
  return allocated
}

async function reallocateOverdue(supabase, sessions, today, weekEnd) {
  let moved = 0
  for (const move of planOverdueMoves(sessions, today, weekEnd)) {
    const { error } = await supabase.from('sessao').update({ data: move.data, ordem: 1000 + moved, movida_pelo_mentor_em: new Date().toISOString() }).eq('id', move.id)
    if (error) throw error
    moved += 1
  }
  return moved
}

export async function prepareMentorWeek({ inicio, today = brazilToday(), force = false }) {
  if (!DATE_PATTERN.test(String(inicio || ''))) return { status: 400, body: { error: 'Inicio da semana invalido.' } }
  if (!force && !canGenerateMentorWeek({ weekStart: inicio, today })) return { status: 200, body: { criadas: 0, total_planejado: 0, aguardando_domingo: true } }
  const supabase = getSupabaseAdmin()
  const weekEnd = addDays(inicio, 6)
  const commitmentEnd = addDays(inicio, 13)
  const results = await Promise.all([
    supabase.from('objetivo').select('id,tipo,materias:materia(id,nome,topicos:topico(id,nome))').eq('ativo', true).order('criado_em'),
    supabase.from('registro').select('resultado,classificacao,criado_em,questao!inner(topico_id)').order('criado_em', { ascending: false }),
    supabase.from('revisao_item').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
    supabase.from('compromisso').select('id,objetivo_id,materia_id,titulo,tipo,data,peso,duracao_minutos,concluido').eq('concluido', false).lte('data', commitmentEnd).gte('data', inicio),
    supabase.from('sessao').select('id,chave_mentor,titulo,tipo,data,status,movida_em,movida_pelo_mentor_em,ordenada_em,ordem,duracao_estimada,prioridade').gte('data', inicio).lte('data', weekEnd),
    supabase.from('sessao').select('id,data,status,movida_em,movida_pelo_mentor_em,ordem,duracao_estimada,prioridade').eq('status', 'planejada').lt('data', inicio).order('data').limit(100),
    supabase.from('mentor_conhecimento').select('versao,politica').eq('ativo', true).order('criado_em', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('questao').select('id,topico_id,proxima_revisao').eq('ativa', true).eq('marcada_errada', false).not('proxima_revisao', 'is', null).lte('proxima_revisao', `${weekEnd}T23:59:59-03:00`),
  ])
  const error = results.find((item) => item.error)?.error
  if (error) throw error
  const [catalogResult, recordsResult, reviewResult, commitmentsResult, existingResult, carryoverResult, knowledgeResult, spacedQuestionResult] = results
  const policy = knowledgeResult.data ? { ...knowledgeResult.data.politica, versao: knowledgeResult.data.versao } : {}
  const grouped = new Map()
  for (const record of recordsResult.data || []) {
    const id = record.questao?.topico_id
    if (!id) continue
    grouped.set(id, [...(grouped.get(id) || []), record])
  }
  const priorities = [...grouped.entries()].map(([id, items]) => ({ id, ...calculateTopicDiagnosis(items, policy) })).filter((item) => item.status === 'prioridade').sort((a, b) => b.gravidade - a.gravidade).slice(0, 3)
  const reviewGroups = new Map()
  for (const question of spacedQuestionResult.data || []) {
    const due = String(question.proxima_revisao).slice(0, 10)
    const dueDate = due < inicio ? inicio : due
    const key = `${dueDate}|${question.topico_id}`
    const current = reviewGroups.get(key) || { dueDate, topicId: question.topico_id, count: 0 }
    current.count += 1
    reviewGroups.set(key, current)
  }
  const scheduledQuestionReviews = allocateQuestionReviews(reviewGroups.values(), inicio, weekEnd)
  const demands = buildMentorWeek({ weekStart: inicio, catalog: catalogResult.data || [], priorities, pendingReviews: reviewResult.count || 0, scheduledQuestionReviews, commitments: commitmentsResult.data || [], policy })
  if (!demands.length) return { status: 200, body: { criadas: 0, motivo: 'Nenhuma disciplina disponivel.' } }
  const existingByKey = new Map((existingResult.data || []).map((item) => [item.chave_mentor, item]))
  const recalibrated = demands.map((item) => {
    const previous = existingByKey.get(item.chave_mentor)
    if (!previous) return item
    return {
      ...item,
      ...((previous.movida_pelo_mentor_em || previous.status !== 'planejada') ? { data: previous.data } : {}),
      ...(previous.ordenada_em ? { ordem: previous.ordem } : {}),
    }
  })
  const upsert = await supabase.from('sessao').upsert(recalibrated, { onConflict: 'chave_mentor' }).select('id')
  if (upsert.error) throw upsert.error
  const activeKeys = new Set(demands.map((item) => item.chave_mentor))
  const onboardingWithoutCards = inicio >= '2026-08-10' && inicio < '2026-08-24'
  const obsoleteIds = (existingResult.data || []).filter((item) => {
    if (item.status !== 'planejada') return false
    if (onboardingWithoutCards && item.chave_mentor && !activeKeys.has(item.chave_mentor)) return true
    return item.chave_mentor && !activeKeys.has(item.chave_mentor) && !item.movida_em
  }).map((item) => item.id)
  if (obsoleteIds.length) {
    const removed = await supabase.from('sessao').delete().in('id', obsoleteIds)
    if (removed.error) throw removed.error
  }
  const refreshed = await supabase.from('sessao').select('id,data,status,movida_em,movida_pelo_mentor_em,ordem,duracao_estimada,prioridade').gte('data', inicio).lte('data', weekEnd)
  if (refreshed.error) throw refreshed.error
  const sessionsForReallocation = [...(carryoverResult.data || []), ...(refreshed.data || [])]
  const moved = inicio <= today && today <= weekEnd ? await reallocateOverdue(supabase, sessionsForReallocation, today, weekEnd) : 0
  return { status: 200, body: { atualizadas: upsert.data?.length || 0, removidas: obsoleteIds.length, total_planejado: demands.length, revisoes_espacadas_planejadas: scheduledQuestionReviews.length, revisoes_adiadas: Math.max(0, reviewGroups.size - scheduledQuestionReviews.length), remanejadas: moved, politica_mentor: policy.versao } }
}

export default async function planHandler(req, res) {
  if (!allowMethods(req, res, ['POST']) || !requireAccess(req, res)) return
  try {
    const result = await prepareMentorWeek({ inicio: req.body?.inicio })
    return res.status(result.status).json(result.body)
  } catch (error) {
    return fail(res, error, 'Nao foi possivel preparar sua semana.')
  }
}
