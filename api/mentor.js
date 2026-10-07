import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, requireAccess, queryParam } from './_lib/http.js'
import { readMentorWeekV2 } from './_lib/mentor-v2.js'
import { readMentorDemandTrace } from './_lib/mentor-v2-trace.js'

function mondayForDate(date, next = false) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() - (value.getUTCDay() || 7) + 1 + (next ? 7 : 0))
  return value.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10)
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
      const cargaPercebida = String(req.body?.cargaPercebida || '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(semanaInicio) || new Date(`${semanaInicio}T12:00:00Z`).getUTCDay() !== 1) return res.status(400).json({ error: 'Informe a segunda-feira da semana do encontro.' })
      const today = brazilDate(new Date())
      if (semanaInicio !== mondayForDate(today)) return res.status(400).json({ error: 'O encontro deve corresponder à semana atual.' })
      if (cargaPercebida && !['leve', 'adequada', 'pesada'].includes(cargaPercebida)) return res.status(400).json({ error: 'Classifique a carga como leve, adequada ou pesada.' })
      const allowedClassifications = ['dificuldade_conteudo', 'dificuldade_volume', 'dificuldade_questoes', 'dificuldade_revisao', 'problema_material', 'estrategia_funcionou', 'faculdade_atrasada', 'faculdade_em_dia']
      const classifications = [...new Set((Array.isArray(req.body?.classificacoes) ? req.body.classificacoes : []).filter((item) => allowedClassifications.includes(item)))]
      const nextWeek = mondayForDate(today, true)
      const unavailable = [...new Set((Array.isArray(req.body?.fatos?.indisponivel_em) ? req.body.fatos.indisponivel_em : []).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item) && item >= nextWeek && item <= addDays(nextWeek, 6)))]
      const difficultyLevel = String(req.body?.fatos?.dificuldade_nivel || '')
      if (difficultyLevel && !['baixa', 'media', 'alta'].includes(difficultyLevel)) return res.status(400).json({ error: 'Classifique a dificuldade como baixa, média ou alta.' })
      const facts = { acontecimentos: String(req.body?.fatos?.acontecimentos || '').trim().slice(0, 600), dificuldade_nivel: difficultyLevel || null, dificuldade: String(req.body?.fatos?.dificuldade || '').trim().slice(0, 600), impedimentos: String(req.body?.fatos?.impedimentos || '').trim().slice(0, 600), excecoes: String(req.body?.fatos?.excecoes || '').trim().slice(0, 600), indisponivel_em: unavailable }
      facts.avaliacoes = []
      const assessments = Array.isArray(req.body?.fatos?.avaliacoes) ? req.body.fatos.avaliacoes.slice(0, 10) : []
      for (const assessment of assessments) {
        if (!['prova', 'entrega'].includes(assessment?.tipo) || !/^\d{4}-\d{2}-\d{2}$/.test(assessment.data || '') || assessment.data < today || !assessment.materia_id || !String(assessment.titulo || '').trim()) return res.status(400).json({ error: 'Informe tipo, data, disciplina e título de cada prova ou entrega.' })
        const subject = await supabase.from('materia').select('id,objetivo_id,objetivo:objetivo_id(tipo)').eq('id', assessment.materia_id).maybeSingle()
        if (subject.error) throw subject.error
        if (subject.data?.objetivo?.tipo !== 'faculdade') return res.status(400).json({ error: 'Selecione uma disciplina da Faculdade.' })
        facts.avaliacoes.push({ tipo: assessment.tipo, data: assessment.data, objetivo_id: subject.data.objetivo_id, materia_id: subject.data.id, titulo: String(assessment.titulo).trim().slice(0, 160) })
      }
      const payload = {
        semana_inicio: semanaInicio,
        carga_percebida: cargaPercebida || null,
        observacoes: String(req.body?.observacoes || '').trim().slice(0, 1200) || null,
        classificacoes: classifications,
        fatos: facts,
        realizado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('mentor_encontro_semanal').upsert(payload, { onConflict: 'semana_inicio' }).select('*').single()
      if (error) throw error
      if (new Date(`${today}T12:00:00Z`).getUTCDay() !== 0) return res.status(200).json({ encontro_semanal: data, planejamento_pendente: true })
      try {
        const { prepareMentorWeek } = await import('./_lib/plano-handler.js')
        const planned = await prepareMentorWeek({ inicio: nextWeek, today, force: true, source: 'encontro' })
        return res.status(200).json({ encontro_semanal: data, planejamento: planned.body, planejamento_pendente: planned.status !== 200 })
      } catch {
        return res.status(200).json({ encontro_semanal: data, planejamento_pendente: true })
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
      semana_atual: currentWeek, encontro_semanal: meeting.data || null, cards_liberados: false,
    })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel consultar o Mentor V2.')
  }
}
