import { getSupabaseAdmin } from './supabase.js'
import { reconcileSessionDuration } from '../../shared/session-duration.js'
import { allowMethods, fail, queryParam, readSession, requireAccess } from './http.js'

const fields = 'id,operacao_id,sessao_id,objetivo_id,materia_id,topico_id,contexto,titulo,status,segundos_acumulados,duracao_alvo_segundos,iniciado_em,retomado_em,finalizado_em,materia:materia_id(nome),objetivo:objetivo_id(nome,tipo)'
const elapsed = (item) => item.status === 'rodando' && item.retomado_em ? item.segundos_acumulados + Math.max(0, Math.floor((Date.now() - new Date(item.retomado_em).getTime()) / 1000)) : item.segundos_acumulados

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH', 'DELETE']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    if (req.method === 'GET') {
      const session = readSession(req)
      const rest = session?.sub ? await supabase.from('app_usuario').select('descanso_ate').eq('id', session.sub).maybeSingle() : { data: null }
      if (rest.error) throw rest.error
      const active = await supabase.from('tempo_estudo').select(fields).in('status', ['rodando','pausado']).maybeSingle()
      if (active.error) throw active.error
      const lastSevenDays = new Date(Date.now() - 7 * 86400000).toISOString()
      const since = queryParam(req, 'desde') || '2026-08-17T00:00:00-03:00'
      const history = await supabase.from('tempo_estudo').select(fields).gte('iniciado_em', since).order('iniciado_em', { ascending: false }).limit(500)
      if (history.error) throw history.error
      const items = (history.data || []).map((item) => ({ ...item, segundos: elapsed(item) }))
      const planned = await supabase.from('sessao').select('duracao_estimada,data').gte('data', lastSevenDays.slice(0, 10)).lte('data', new Date().toISOString().slice(0, 10))
      if (planned.error) throw planned.error
      const bySubject = new Map()
      const byActivity = new Map([['estudo', 0], ['questoes', 0], ['question_cards', 0], ['simulados', 0]])
      for (const item of items) if (item.status === 'concluido') bySubject.set(item.materia?.nome || item.titulo, (bySubject.get(item.materia?.nome || item.titulo) || 0) + item.segundos)
      for (const item of items.filter((entry) => entry.status === 'concluido')) {
        const activity = item.contexto === 'questao' ? 'questoes' : item.contexto === 'card' ? 'question_cards' : item.contexto === 'simulado' ? 'simulados' : 'estudo'
        byActivity.set(activity, (byActivity.get(activity) || 0) + item.segundos)
      }
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
      return res.status(200).json({ ativo: active.data ? { ...active.data, segundos: elapsed(active.data) } : null, descanso_ate: rest.data?.descanso_ate || null, historico: items, resumo: { hoje: items.filter((item) => item.status === 'concluido' && item.iniciado_em.slice(0,10) === today).reduce((sum,item) => sum + item.segundos,0), semana: items.filter((item) => item.status === 'concluido' && item.iniciado_em >= lastSevenDays).reduce((sum,item) => sum + item.segundos,0), planejado_semana: (planned.data || []).reduce((sum,item) => sum + (item.duracao_estimada || 0) * 60, 0), disciplinas: [...bySubject.entries()].map(([nome,segundos]) => ({ nome,segundos })).sort((a,b) => b.segundos-a.segundos), atividades: [...byActivity.entries()].map(([tipo, segundos]) => ({ tipo, segundos })) } })
    }
    if (req.method === 'DELETE') {
      const id = queryParam(req, 'id')
      if (!id) return res.status(400).json({ error: 'Informe o timer que deseja apagar.' })
      const removed = await supabase.from('tempo_estudo').delete().eq('id', id).select('id').maybeSingle()
      if (removed.error) throw removed.error
      return res.status(200).json({ ok: true, removido: Boolean(removed.data) })
    }
    if (req.method === 'POST') {
      if (req.body?.acaoDescanso) {
        const session = readSession(req)
        if (!session?.sub) return res.status(401).json({ error: 'Sessao ausente ou expirada.' })
        const restUntil = req.body.acaoDescanso === 'iniciar' ? new Date(req.body.descansoAte) : null
        if (restUntil && Number.isNaN(restUntil.getTime())) return res.status(400).json({ error: 'Horario de descanso invalido.' })
        const saved = await supabase.from('app_usuario').update({ descanso_ate: restUntil?.toISOString() || null }).eq('id', session.sub)
        if (saved.error) throw saved.error
        return res.status(200).json({ descanso_ate: restUntil?.toISOString() || null })
      }
      const { operacaoId, sessaoId, objetivoId, materiaId, topicoId, contexto = 'livre', titulo, status, segundosAcumulados, duracaoAlvoSegundos, iniciadoEm } = req.body || {}
      if (!titulo || !['demanda','disciplina','questao','card','simulado','livre'].includes(contexto)) return res.status(400).json({ error: 'Contexto e titulo validos sao obrigatorios.' })
      if (operacaoId) { const prior = await supabase.from('tempo_estudo').select(fields).eq('operacao_id', operacaoId).maybeSingle(); if (prior.data) return res.status(200).json({ timer: prior.data, repetida: true }) }
      const existing = await supabase.from('tempo_estudo').select(fields).in('status', ['rodando','pausado']).maybeSingle()
      if (existing.error) throw existing.error
      if (existing.data && status !== 'concluido') return res.status(409).json({ error: 'Pause ou conclua o timer atual antes de iniciar outro.', timer: existing.data })
      const completedOffline = status === 'concluido'
      const manualSeconds = Math.max(0, Number(segundosAcumulados) || 0)
      let manualStart = null
      let manualEnd = null
      if (completedOffline && iniciadoEm) {
        manualStart = new Date(iniciadoEm)
        if (Number.isNaN(manualStart.getTime()) || manualStart.getTime() > Date.now()) return res.status(400).json({ error: 'A data do estudo nao pode estar no futuro.' })
        if (!Number.isInteger(manualSeconds) || manualSeconds < 60 || manualSeconds > 43200) return res.status(400).json({ error: 'O tempo adicionado deve ficar entre 1 minuto e 12 horas.' })
        manualEnd = new Date(manualStart.getTime() + manualSeconds * 1000)
      }
      const targetSeconds = Number(duracaoAlvoSegundos) || null
      if (targetSeconds !== null && (!Number.isInteger(targetSeconds) || targetSeconds < 60 || targetSeconds > 43200)) return res.status(400).json({ error: 'O tempo de foco deve ficar entre 1 minuto e 12 horas.' })
      const created = await supabase.from('tempo_estudo').insert({ operacao_id: operacaoId || null, sessao_id: sessaoId || null, objetivo_id: objetivoId || null, materia_id: materiaId || null, topico_id: topicoId || null, contexto, titulo: String(titulo).trim(), status: completedOffline ? 'concluido' : 'rodando', segundos_acumulados: completedOffline ? manualSeconds : 0, duracao_alvo_segundos: targetSeconds, iniciado_em: manualStart?.toISOString() || new Date().toISOString(), retomado_em: completedOffline ? null : new Date().toISOString(), finalizado_em: completedOffline ? (manualEnd || new Date()).toISOString() : null }).select(fields).single()
      if (created.error) throw created.error
      if (completedOffline) await reconcileSessionDuration(supabase, sessaoId)
      return res.status(201).json({ timer: created.data })
    }
    const { id, acao, operacaoId } = req.body || {}
    if (!id || !['pausar','retomar','concluir'].includes(acao)) return res.status(400).json({ error: 'Timer e acao validos sao obrigatorios.' })
    if (operacaoId) { const prior = await supabase.from('tempo_estudo').select(fields).eq('operacao_id', operacaoId).maybeSingle(); if (prior.data?.status === 'concluido') return res.status(200).json({ timer: prior.data, repetida: true }) }
    const current = await supabase.from('tempo_estudo').select(fields).eq('id', id).single()
    if (current.error) throw current.error
    const permitted = { pausar: ['rodando'], retomar: ['pausado'], concluir: ['rodando', 'pausado'] }
    if (!permitted[acao].includes(current.data.status)) return res.status(409).json({ error: 'Transição inválida para o estado atual do timer.' })
    const now = new Date().toISOString(); const seconds = elapsed(current.data)
    const changes = acao === 'retomar' ? { status: 'rodando', retomado_em: now, atualizado_em: now } : { status: acao === 'concluir' ? 'concluido' : 'pausado', segundos_acumulados: seconds, retomado_em: null, finalizado_em: acao === 'concluir' ? now : null, atualizado_em: now, ...(operacaoId && acao === 'concluir' ? { operacao_id: operacaoId } : {}) }
    const updated = await supabase.from('tempo_estudo').update(changes).eq('id', id).eq('status', current.data.status).select(fields).single()
    if (updated.error) throw updated.error
    if (acao === 'concluir') await reconcileSessionDuration(supabase, current.data.sessao_id)
    return res.status(200).json({ timer: updated.data })
  } catch (error) { return fail(res, error, 'Nao foi possivel registrar o tempo de estudo.') }
}
