import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, requireAccess } from './http.js'
import { evaluateMentorWeekV2 } from './mentor-v2.js'
import { applyMentorWeekV2 } from './mentor-v2-plan.js'
import { cancelPreviousCyclePlans } from './mentor-v2-cycle.js'
import { isCalendarDate, mentorWeekTarget } from '../../shared/mentor-v2-policy.js'

const addDays = (date, days) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
const brazilDate = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
export const brazilToday = () => brazilDate(new Date())
export const mondayForDate = (date, next = false) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() - (value.getUTCDay() || 7) + 1 + (next ? 7 : 0)); return value.toISOString().slice(0, 10) }

// Compatibility helper for factual week closure, not invoked by policy evaluation.
export async function closeMentorWeek({ inicio, today = brazilToday(), supabase = getSupabaseAdmin() }) {
  const end = mentorWeekTarget(inicio).semana_fim
  if (end >= today) return { closed: 0 }
  const { data, error } = await supabase.from('sessao').select('id').eq('origem', 'mentor').eq('status', 'planejada').gte('data_planejada_original', inicio).lte('data_planejada_original', end).lte('data', end)
  if (error) throw error
  if (!data?.length) return { closed: 0 }
  const updated = await supabase.from('sessao').update({ status: 'nao_concluida' }).in('id', data.map((item) => item.id)).eq('status', 'planejada')
  if (updated.error) throw updated.error
  return { closed: data.length }
}

export async function prepareMentorWeek({ inicio, today = brazilToday(), force = false, supabase = null, instanteReferencia = new Date().toISOString() }) {
  if (!isCalendarDate(inicio) || new Date(`${inicio}T12:00:00Z`).getUTCDay() !== 1) return { status: 400, body: { error: 'Inicio da semana invalido.' } }
  const end = addDays(inicio, 6)
  const currentWeek = today >= inicio && today <= end
  const nextWeekOnSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0 && addDays(today, 1) === inicio
  if (!force && !currentWeek && !nextWeekOnSunday) return { status: 200, body: { criadas: 0, aguardando_domingo: true } }
  const preview = await evaluateMentorWeekV2({ supabase: supabase || getSupabaseAdmin(), inicio, instanteReferencia, persist: false })
  const cancellation = preview.resultado === 'NAO_AVALIAVEL' ? { canceladas: 0 }
    : await cancelPreviousCyclePlans({ supabase: supabase || getSupabaseAdmin(), inicio, today })
  const evaluation = await evaluateMentorWeekV2({ supabase: supabase || getSupabaseAdmin(), inicio, instanteReferencia, persist: true })
  const unavailable = evaluation.resultado === 'NAO_AVALIAVEL'
  const applied = unavailable ? { criadas: 0, atualizadas: 0, removidas: 0 } : await applyMentorWeekV2({ supabase: supabase || getSupabaseAdmin(), evaluation })
  const closure = !unavailable && evaluation.plano_semanal && !evaluation.plano_semanal.pendente
    ? await closeMentorWeek({ inicio: addDays(inicio, -7), today, supabase: supabase || getSupabaseAdmin() }) : { closed: 0 }
  const pending = unavailable || evaluation.plano_semanal?.pendente === true
  return { status: pending ? 503 : 200, body: { ...applied, canceladas_ciclo_anterior: cancellation.canceladas, encerradas: closure.closed,
    planejamento_pendente: pending, planejamento_estado: unavailable ? 'policy_v2_pendente' : pending ? 'planejamento_parcial' : applied.criadas ? 'gerado' : 'preservado',
    avaliacao_mentor_v2: evaluation, politica_mentor: evaluation.policy_ref?.versao || null,
    motivo: evaluation.explicacao } }
}

export default async function planHandler(req, res) {
  if (!allowMethods(req, res, ['POST']) || !requireAccess(req, res)) return
  try {
    const result = await prepareMentorWeek({ inicio: req.body?.inicio, force: req.body?.force === true })
    return res.status(result.status).json(result.body)
  } catch (error) {
    return fail(res, error, 'Nao foi possivel preparar sua semana.')
  }
}
