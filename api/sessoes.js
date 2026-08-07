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
      let query = supabase.from('sessao').select('id,titulo,tipo,data,duracao_estimada,duracao_realizada,status,objetivo:objetivo_id(id,nome),materia:materia_id(nome),topico:topico_id(nome)').order('data')
      if (inicio) query = query.gte('data', inicio)
      if (fim) query = query.lte('data', fim)
      if (objetivoId) query = query.eq('objetivo_id', objetivoId)
      const { data, error } = await query
      if (error) throw error
      return res.status(200).json({ sessoes: data })
    }
    if (req.method === 'PATCH') {
      const { id, status, duracaoRealizada } = req.body || {}
      if (!id || !['feita', 'parcial', 'remanejada'].includes(status)) return res.status(400).json({ error: 'Sessao e status validos sao obrigatorios.' })
      const { error } = await supabase.from('sessao').update({ status, duracao_realizada: Number.isInteger(duracaoRealizada) ? duracaoRealizada : null }).eq('id', id)
      if (error) throw error
      return res.status(200).json({ ok: true })
    }
    const { objetivoId, materiaId, topicoId, titulo, tipo = 'estudo', data, duracaoEstimada = 50 } = req.body || {}
    if (!objetivoId || !titulo || !data) return res.status(400).json({ error: 'Objetivo, titulo e data sao obrigatorios.' })
    const { data: session, error } = await supabase.from('sessao').insert({
      objetivo_id: objetivoId,
      materia_id: materiaId || null,
      topico_id: topicoId || null,
      titulo: String(titulo).trim(),
      tipo,
      data,
      duracao_estimada: Number(duracaoEstimada) || 50,
    }).select('id').single()
    if (error) throw error
    return res.status(201).json({ sessao: session })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel processar a semana.')
  }
}
