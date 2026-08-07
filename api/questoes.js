import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, requireAccess } from './_lib/http.js'

const reportReasons = ['gabarito_incorreto', 'questao_ambigua', 'fonte_insuficiente', 'conteudo_desatualizado', 'erro_formatacao']

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST']) || !requireAccess(req, res)) return
  try {
    const { id, motivo, detalhe } = req.body || {}
    if (!id || !reportReasons.includes(motivo)) return res.status(400).json({ error: 'Questao e motivo validos sao obrigatorios.' })
    const supabase = getSupabaseAdmin()
    const { error: reportError } = await supabase.from('relato_questao').insert({ questao_id: id, motivo, detalhe: String(detalhe || '').slice(0, 1000) || null })
    if (reportError) throw reportError
    const { error } = await supabase.from('questao').update({ marcada_errada: true, estado: 'arquivada' }).eq('id', id)
    if (error) throw error
    return res.status(201).json({ ok: true, mensagem: 'Problema registrado e questao retirada do baralho.' })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel reportar a questao.')
  }
}

