import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, requireAccess, queryParam } from './_lib/http.js'
import { readMentorWeekV2 } from './_lib/mentor-v2.js'
import { readMentorDemandTrace } from './_lib/mentor-v2-trace.js'
import { reconcileMeetingFacts, hydrateMeetingFacts } from './_lib/mentor-v2-meeting.js'

function mondayForDate(date, next = false) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() - (value.getUTCDay() || 7) + 1 + (next ? 7 : 0))
  return value.toISOString().slice(0, 10)
}

const brazilDate = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin()
    if (req.method === 'GET' && queryParam(req, 'recurso') === 'demanda') {
      const id = queryParam(req, 'id')
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return res.status(400).json({ error: 'Demanda inválida.' })
      const trace = await readMentorDemandTrace({ supabase, id, audit: queryParam(req, 'auditoria') === '1' })
      return res.status(trace.estado === 'NAO_ENCONTRADA' ? 404 : 200).json(trace)
    }
    if (req.method === 'POST') {
      const semanaInicio = String(req.body?.semanaInicio || '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(semanaInicio) || new Date(`${semanaInicio}T12:00:00Z`).getUTCDay() !== 1) return res.status(400).json({ error: 'Informe a segunda-feira da semana do encontro.' })
      const today = brazilDate(new Date())
      if (semanaInicio !== mondayForDate(today)) return res.status(400).json({ error: 'O encontro deve corresponder à semana atual.' })
      const allowedClassifications = ['dificuldade_conteudo', 'dificuldade_volume', 'dificuldade_questoes', 'dificuldade_revisao', 'problema_material', 'estrategia_funcionou', 'faculdade_atrasada', 'faculdade_em_dia']
      const classifications = [...new Set((Array.isArray(req.body?.classificacoes) ? req.body.classificacoes : []).filter((item) => allowedClassifications.includes(item)))]
      const nextWeek = mondayForDate(today, true)
      const facts = await reconcileMeetingFacts({ supabase, body: req.body || {}, week: semanaInicio, nextWeek, today, now: new Date().toISOString() })
      const payload = {
        semana_inicio: semanaInicio,
        observacoes: String(req.body?.observacoes || '').trim().slice(0, 1200) || null,
        classificacoes: classifications,
        fatos: facts,
        realizado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('mentor_encontro_semanal').upsert(payload, { onConflict: 'semana_inicio' }).select('*').single()
      if (error) throw error
      const hydrated = await hydrateMeetingFacts(supabase, data)
      if (new Date(`${today}T12:00:00Z`).getUTCDay() !== 0) return res.status(200).json({ encontro_semanal: hydrated, planejamento_pendente: true })
      try {
        const { prepareMentorWeek } = await import('./_lib/plano-handler.js')
        const planned = await prepareMentorWeek({ inicio: nextWeek, today, force: true, source: 'encontro' })
        return res.status(200).json({ encontro_semanal: hydrated, planejamento: planned.body, planejamento_pendente: planned.status !== 200 })
      } catch {
        return res.status(200).json({ encontro_semanal: hydrated, planejamento_pendente: true })
      }
    }
    const today = brazilDate(new Date())
    const currentWeek = mondayForDate(today)
    const evaluation = await readMentorWeekV2({ supabase, inicio: currentWeek, instanteReferencia: new Date().toISOString() })
    const meeting = await supabase.from('mentor_encontro_semanal').select('semana_inicio,carga_percebida,observacoes,classificacoes,fatos,realizado_em').eq('semana_inicio', currentWeek).maybeSingle()
    if (meeting.error) throw meeting.error
    return res.status(200).json({
      avaliacao_mentor_v2: evaluation,
      politica: evaluation.policy_ref,
      fase: { id: 'mentor_v2', titulo: 'Mentor V2', descricao: evaluation.explicacao },
      prioridades: [], revisao_imediata: [], cenarios: [], resumo: { dominio: 'UNKNOWN', revisoes_imediatas: 0 },
      decisao_mentor: null, fechamento_semanal: null, trajetoria: null,
      alertas: evaluation.resultado === 'NAO_AVALIAVEL'
        ? [{ tipo: 'configuracao', gravidade: 'alta', titulo: 'Mentor V2 aguardando configuração', mensagem: evaluation.explicacao }]
        : [],
      semana_atual: currentWeek, encontro_semanal: await hydrateMeetingFacts(supabase, meeting.data), cards_liberados: false,
    })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel consultar o Mentor V2.')
  }
}
