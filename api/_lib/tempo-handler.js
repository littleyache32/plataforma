import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './http.js'

const fields = 'id,operacao_id,sessao_id,objetivo_id,materia_id,topico_id,contexto,titulo,status,segundos_acumulados,iniciado_em,retomado_em,finalizado_em,materia:materia_id(nome),objetivo:objetivo_id(nome,tipo)'
const elapsed = (item) => item.status === 'rodando' && item.retomado_em ? item.segundos_acumulados + Math.max(0, Math.floor((Date.now() - new Date(item.retomado_em).getTime()) / 1000)) : item.segundos_acumulados

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    if (req.method === 'GET') {
      const active = await supabase.from('tempo_estudo').select(fields).in('status', ['rodando','pausado']).maybeSingle()
      if (active.error) throw active.error
      const since = queryParam(req, 'desde') || new Date(Date.now() - 7 * 86400000).toISOString()
      const history = await supabase.from('tempo_estudo').select(fields).gte('iniciado_em', since).order('iniciado_em', { ascending: false }).limit(500)
      if (history.error) throw history.error
      const items = (history.data || []).map((item) => ({ ...item, segundos: elapsed(item) }))
      const planned = await supabase.from('sessao').select('duracao_estimada,data').gte('data', since.slice(0, 10)).lte('data', new Date().toISOString().slice(0, 10))
      if (planned.error) throw planned.error
      const bySubject = new Map()
      for (const item of items) if (item.status === 'concluido') bySubject.set(item.materia?.nome || item.titulo, (bySubject.get(item.materia?.nome || item.titulo) || 0) + item.segundos)
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
      return res.status(200).json({ ativo: active.data ? { ...active.data, segundos: elapsed(active.data) } : null, historico: items, resumo: { hoje: items.filter((item) => item.status === 'concluido' && item.iniciado_em.slice(0,10) === today).reduce((sum,item) => sum + item.segundos,0), semana: items.filter((item) => item.status === 'concluido').reduce((sum,item) => sum + item.segundos,0), planejado_semana: (planned.data || []).reduce((sum,item) => sum + (item.duracao_estimada || 0) * 60, 0), disciplinas: [...bySubject.entries()].map(([nome,segundos]) => ({ nome,segundos })).sort((a,b) => b.segundos-a.segundos) } })
    }
    if (req.method === 'POST') {
      const { operacaoId, sessaoId, objetivoId, materiaId, topicoId, contexto = 'livre', titulo, status, segundosAcumulados } = req.body || {}
      if (!titulo || !['demanda','disciplina','questao','card','livre'].includes(contexto)) return res.status(400).json({ error: 'Contexto e titulo validos sao obrigatorios.' })
      if (operacaoId) { const prior = await supabase.from('tempo_estudo').select(fields).eq('operacao_id', operacaoId).maybeSingle(); if (prior.data) return res.status(200).json({ timer: prior.data, repetida: true }) }
      const existing = await supabase.from('tempo_estudo').select(fields).in('status', ['rodando','pausado']).maybeSingle()
      if (existing.error) throw existing.error
      if (existing.data && status !== 'concluido') return res.status(409).json({ error: 'Pause ou conclua o timer atual antes de iniciar outro.', timer: existing.data })
      const completedOffline = status === 'concluido'
      const created = await supabase.from('tempo_estudo').insert({ operacao_id: operacaoId || null, sessao_id: sessaoId || null, objetivo_id: objetivoId || null, materia_id: materiaId || null, topico_id: topicoId || null, contexto, titulo: String(titulo).trim(), status: completedOffline ? 'concluido' : 'rodando', segundos_acumulados: completedOffline ? Math.max(0, Number(segundosAcumulados) || 0) : 0, retomado_em: completedOffline ? null : new Date().toISOString(), finalizado_em: completedOffline ? new Date().toISOString() : null }).select(fields).single()
      if (created.error) throw created.error
      return res.status(201).json({ timer: created.data })
    }
    const { id, acao, operacaoId } = req.body || {}
    if (!id || !['pausar','retomar','concluir'].includes(acao)) return res.status(400).json({ error: 'Timer e acao validos sao obrigatorios.' })
    if (operacaoId) { const prior = await supabase.from('tempo_estudo').select(fields).eq('operacao_id', operacaoId).maybeSingle(); if (prior.data?.status === 'concluido') return res.status(200).json({ timer: prior.data, repetida: true }) }
    const current = await supabase.from('tempo_estudo').select(fields).eq('id', id).single()
    if (current.error) throw current.error
    const now = new Date().toISOString(); const seconds = elapsed(current.data)
    const changes = acao === 'retomar' ? { status: 'rodando', retomado_em: now, atualizado_em: now } : { status: acao === 'concluir' ? 'concluido' : 'pausado', segundos_acumulados: seconds, retomado_em: null, finalizado_em: acao === 'concluir' ? now : null, atualizado_em: now, ...(operacaoId && acao === 'concluir' ? { operacao_id: operacaoId } : {}) }
    const updated = await supabase.from('tempo_estudo').update(changes).eq('id', id).select(fields).single()
    if (updated.error) throw updated.error
    if (acao === 'concluir' && current.data.sessao_id) await supabase.from('sessao').update({ duracao_realizada: Math.round(seconds / 60) }).eq('id', current.data.sessao_id)
    return res.status(200).json({ timer: updated.data })
  } catch (error) { return fail(res, error, 'Nao foi possivel registrar o tempo de estudo.') }
}
