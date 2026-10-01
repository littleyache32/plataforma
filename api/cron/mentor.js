import { getSupabaseAdmin } from '../_lib/supabase.js'
import { brazilToday, prepareMentorWeek } from '../_lib/plano-handler.js'

function mondayFor(date, next = false) {
  const value = new Date(`${date}T12:00:00Z`)
  const day = value.getUTCDay() || 7
  value.setUTCDate(value.getUTCDate() - day + 1 + (next ? 7 : 0))
  return value.toISOString().slice(0, 10)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Metodo nao permitido.' })
  if (!process.env.CRON_SECRET || req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) return res.status(401).json({ error: 'Nao autorizado.' })
  const supabase = getSupabaseAdmin()
  const today = brazilToday()
  const isSunday = new Date(`${today}T12:00:00Z`).getUTCDay() === 0
  const weekStart = mondayFor(today, isSunday)
  const type = isSunday ? 'semanal' : 'diaria'
  const existing = await supabase.from('mentor_execucao').select('id,resultado').eq('tipo', type).eq('semana_inicio', weekStart).eq('data_execucao', today).eq('status', 'concluida').maybeSingle()
  if (existing.error) return res.status(500).json({ error: 'Falha ao verificar execucao.' })
  if (existing.data) return res.status(200).json({ ok: true, ja_executado: true, semana: weekStart, ...existing.data.resultado })
  const run = await supabase.from('mentor_execucao').upsert({ tipo: type, semana_inicio: weekStart, data_execucao: today, status: 'iniciada', entrada: { today }, resultado: {}, erro: null, iniciado_em: new Date().toISOString(), concluido_em: null }, { onConflict: 'tipo,semana_inicio,data_execucao' }).select('id').single()
  if (run.error) return res.status(500).json({ error: 'Falha ao registrar execucao.' })
  try {
    const backup = await supabase.rpc('criar_backup_snapshot', { p_tipo: 'automatico' })
    if (backup.error) throw backup.error
    const expansionCycle = null
    const result = await prepareMentorWeek({ inicio: weekStart, today, force: true, source: isSunday ? 'cron_domingo' : 'cron_diario' })
    const executionResult = { ...result.body, ciclo_expansao_questoes: expansionCycle }
    await supabase.from('mentor_execucao').update({ status: 'concluida', politica_versao: result.body.politica_mentor, resultado: executionResult, concluido_em: new Date().toISOString() }).eq('id', run.data.id)
    return res.status(200).json({ ok: true, semana: weekStart, backup_id: backup.data, ...executionResult })
  } catch (error) {
    await supabase.from('mentor_execucao').update({ status: 'falhou', erro: String(error.message || error), concluido_em: new Date().toISOString() }).eq('id', run.data.id)
    await supabase.from('sistema_falha').insert({ origem: 'cron_mentor', mensagem: String(error.message || error).slice(0, 500) })
    return res.status(500).json({ error: 'Execucao do mentor falhou.' })
  }
}
