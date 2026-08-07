import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    if (req.method === 'GET') {
      const inicio = queryParam(req, 'inicio')
      const fim = queryParam(req, 'fim')
      const objetivoId = queryParam(req, 'objetivoId')
      let query = supabase.from('sessao').select('id,titulo,tipo,data,duracao_estimada,duracao_realizada,status,prioridade,movida_em,objetivo:objetivo_id(id,nome,tipo),materia:materia_id(id,nome),topico:topico_id(id,nome)').order('data').order('prioridade')
      if (inicio) query = query.gte('data', inicio)
      if (fim) query = query.lte('data', fim)
      if (objetivoId) query = query.eq('objetivo_id', objetivoId)
      const { data, error } = await query
      if (error) throw error
      return res.status(200).json({ sessoes: data })
    }
    if (req.method === 'PATCH') {
      const { id, status, data, duracaoRealizada } = req.body || {}
      if (!id) return res.status(400).json({ error: 'Demanda obrigatoria.' })
      const update = {}
      if (status) {
        if (!['feita', 'parcial'].includes(status)) return res.status(400).json({ error: 'Status de conclusao invalido.' })
        update.status = status
        update.duracao_realizada = Number.isInteger(duracaoRealizada) ? duracaoRealizada : null
      }
      if (data) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data))) return res.status(400).json({ error: 'Data da demanda invalida.' })
        update.data = data
        update.movida_em = new Date().toISOString()
      }
      if (!Object.keys(update).length) return res.status(400).json({ error: 'Informe uma alteracao para a demanda.' })
      const { error } = await supabase.from('sessao').update(update).eq('id', id)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }
    const { objetivoId, materiaId, topicoId, titulo, tipo = 'estudo', data, duracaoEstimada = 50, prioridade = 2 } = req.body || {}
    if (!objetivoId || !titulo || !data) return res.status(400).json({ error: 'Objetivo, titulo e data sao obrigatorios.' })
    const { data: session, error } = await supabase.from('sessao').insert({
      objetivo_id: objetivoId,
      materia_id: materiaId || null,
      topico_id: topicoId || null,
      titulo: String(titulo).trim(),
      tipo,
      data,
      duracao_estimada: Number(duracaoEstimada) || 50,
      prioridade: Math.min(4, Math.max(1, Number(prioridade) || 2)),
    }).select('id').single()
    if (error) throw error
    return res.status(201).json({ sessao: session })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel processar a semana.')
  }
}
