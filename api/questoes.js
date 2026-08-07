import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, requireAccess } from './_lib/http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['PATCH']) || !requireAccess(req, res)) return
  try {
    const { id, marcadaErrada = true } = req.body || {}
    if (!id) return res.status(400).json({ error: 'Questao obrigatoria.' })
    const { error } = await getSupabaseAdmin().from('questao').update({ marcada_errada: Boolean(marcadaErrada) }).eq('id', id)
    if (error) throw error
    return res.status(200).json({ ok: true })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel atualizar a questao.')
  }
}

