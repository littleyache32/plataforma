import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'
import { scoreboard } from '../shared/mentor.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET']) || !requireAccess(req, res)) return
  try {
    let query = getSupabaseAdmin().from('registro').select('resultado,classificacao,questao!inner(topico:topico_id(materia:materia_id(objetivo_id)))')
    const topicoId = queryParam(req, 'topicoId')
    const objetivoId = queryParam(req, 'objetivoId')
    if (topicoId) query = query.eq('questao.topico_id', topicoId)
    const { data, error } = await query
    if (error) throw error
    const records = objetivoId ? (data || []).filter((item) => item.questao?.topico?.materia?.objetivo_id === objetivoId) : (data || [])
    return res.status(200).json(scoreboard(records))
  } catch (error) {
    return fail(res, error, 'Nao foi possivel calcular o placar.')
  }
}
