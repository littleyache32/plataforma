import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './http.js'
import planHandler from './plano-handler.js'

export default async function handler(req, res) {
  if (queryParam(req, 'recurso') === 'plano') return planHandler(req, res)
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH', 'DELETE']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    if (req.method === 'GET') {
      if (queryParam(req, 'recurso') === 'proxima') {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
        const next = await supabase.from('sessao').select('id,titulo,tipo,data,duracao_estimada,prioridade,objetivo:objetivo_id(id,nome,tipo),materia:materia_id(id,nome),topico:topico_id(id,nome)').neq('status','feita').neq('status','cancelada').lte('data', today).order('data').order('prioridade').order('ordem').limit(1).maybeSingle()
        if (next.error) throw next.error
        if (next.data) return res.status(200).json({ demanda: next.data })
        const future = await supabase.from('sessao').select('id,titulo,tipo,data,duracao_estimada,prioridade,objetivo:objetivo_id(id,nome,tipo),materia:materia_id(id,nome),topico:topico_id(id,nome)').neq('status','feita').neq('status','cancelada').gt('data', today).order('data').order('prioridade').order('ordem').limit(1).maybeSingle()
        if (future.error) throw future.error
        return res.status(200).json({ demanda: future.data || null })
      }
      const inicio = queryParam(req, 'inicio')
      const fim = queryParam(req, 'fim')
      const objetivoId = queryParam(req, 'objetivoId')
      let query = supabase.from('sessao').select('id,titulo,tipo,data,data_planejada_original,duracao_estimada,duracao_realizada,status,concluida_em,prioridade,ordem,ordenada_em,movida_em,movida_pelo_mentor_em,origem,objetivo:objetivo_id(id,nome,tipo),materia:materia_id(id,nome),topico:topico_id(id,nome)').neq('status', 'cancelada').order('data').order('ordem').order('prioridade')
      if (inicio) query = query.gte('data', inicio)
      if (fim) query = query.lte('data', fim)
      if (objetivoId) query = query.eq('objetivo_id', objetivoId)
      const { data, error } = await query
      if (error) throw error
      return res.status(200).json({ sessoes: data })
    }
    if (req.method === 'DELETE') {
      const id = queryParam(req, 'id') || req.body?.id
      if (!id) return res.status(400).json({ error: 'Demanda obrigatoria.' })
      const { data, error } = await supabase.from('sessao').update({ status: 'cancelada', concluida_em: null, duracao_realizada: null }).eq('id', id).select('id').maybeSingle()
      if (error) throw error
      if (!data) return res.status(404).json({ error: 'Demanda nao encontrada.' })
      return res.status(200).json({ ok: true })
    }
    if (req.method === 'PATCH') {
      const { id, status, data, duracaoRealizada, orderedIds } = req.body || {}
      if (Array.isArray(orderedIds)) {
        const ids = [...new Set(orderedIds.filter(Boolean))]
        if (!ids.length || ids.length !== orderedIds.length) return res.status(400).json({ error: 'Ordem das demandas invalida.' })
        const { data: demands, error: readError } = await supabase.from('sessao').select('id,data').in('id', ids)
        if (readError) throw readError
        if (demands.length !== ids.length) return res.status(400).json({ error: 'Alguma demanda nao foi encontrada.' })
        if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: 'Dia de destino invalido.' })
        if (!data && new Set(demands.map((item) => item.data)).size !== 1) return res.status(400).json({ error: 'Informe o dia de destino.' })
        const orderedAt = new Date().toISOString()
        const originalById = new Map(demands.map((item) => [item.id, item.data]))
        const updates = await Promise.all(ids.map((demandId, ordem) => supabase.from('sessao').update({ ordem, ordenada_em: orderedAt, ...(data ? { data, ...(originalById.get(demandId) !== data ? { movida_em: orderedAt } : {}) } : {}) }).eq('id', demandId)))
        const updateError = updates.find((result) => result.error)?.error
        if (updateError) throw updateError
        return res.status(200).json({ ok: true })
      }
      if (data && !/^\d{4}-\d{2}-\d{2}$/.test(data)) return res.status(400).json({ error: 'Dia de destino invalido.' })
      if (!id) return res.status(400).json({ error: 'Demanda obrigatoria.' })
      const update = {}
      if (status) {
        if (!['planejada', 'feita', 'parcial'].includes(status)) return res.status(400).json({ error: 'Status de conclusao invalido.' })
        update.status = status
        update.duracao_realizada = status === 'planejada' ? null : Number.isInteger(duracaoRealizada) ? duracaoRealizada : null
        update.concluida_em = status === 'feita' ? new Date().toISOString() : null
      }
      if (data) Object.assign(update, { data, movida_em: new Date().toISOString() })
      if (!Object.keys(update).length) return res.status(400).json({ error: 'Informe uma alteracao para a demanda.' })
      const { error } = await supabase.from('sessao').update(update).eq('id', id)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }
    const { objetivoId, materiaId, topicoId, titulo, tipo = 'estudo', data, duracaoEstimada = 30, prioridade = 2 } = req.body || {}
    if (!objetivoId || !titulo || !data) return res.status(400).json({ error: 'Objetivo, titulo e data sao obrigatorios.' })
    const duration = Number(duracaoEstimada) || 30
    if (!['simulado', 'prova'].includes(tipo) && duration > 90) return res.status(400).json({ error: 'Atividades de estudo podem durar no maximo 1h30.' })
    const { data: session, error } = await supabase.from('sessao').insert({
      objetivo_id: objetivoId,
      materia_id: materiaId || null,
      topico_id: topicoId || null,
      titulo: String(titulo).trim(),
      tipo,
      data,
      duracao_estimada: duration,
      prioridade: Math.min(4, Math.max(1, Number(prioridade) || 2)),
    }).select('id').single()
    if (error) throw error
    return res.status(201).json({ sessao: session })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel processar a semana.')
  }
}
