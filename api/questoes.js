import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'
import { cardTransition } from '../shared/cards.js'

const reportReasons = ['gabarito_incorreto', 'questao_ambigua', 'fonte_insuficiente', 'conteudo_desatualizado', 'erro_formatacao']

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin()
    if (queryParam(req, 'recurso') === 'cards') {
      if (req.method === 'GET') {
        const objetivoId = queryParam(req, 'objetivoId')
        let query = supabase.from('question_card').select('id,frente,verso,fonte,trecho_fonte,ocorrencias,repeticoes,proxima_revisao,ultima_revisao,criado_em,materia:materia_id(nome),topico:topico_id(nome),objetivo:objetivo_id(nome,tipo)').order('proxima_revisao').order('criado_em')
        if (objetivoId) query = query.eq('objetivo_id', objetivoId)
        const { data, error } = await query.limit(100)
        if (error) throw error
        const now = Date.now()
        const cards = (data || []).map((item) => ({ ...item, vencido: new Date(item.proxima_revisao).getTime() <= now }))
        return res.status(200).json({ cards, vencidos: cards.filter((item) => item.vencido).length })
      }
      const { id, resultado } = req.body || {}
      if (!id || !['lembrei', 'revisar'].includes(resultado)) return res.status(400).json({ error: 'Card e resultado validos sao obrigatorios.' })
      const { data: card, error: cardError } = await supabase.from('question_card').select('id,repeticoes').eq('id', id).single()
      if (cardError) throw cardError
      const transition = cardTransition({ resultado, repeticoes: card.repeticoes })
      const now = new Date().toISOString()
      const [{ error: updateError }, { error: recordError }] = await Promise.all([supabase.from('question_card').update({ repeticoes: transition.repeticoes, proxima_revisao: transition.proximaRevisao, ultima_revisao: now }).eq('id', id), supabase.from('question_card_registro').insert({ question_card_id: id, resultado })])
      if (updateError || recordError) throw updateError || recordError
      return res.status(200).json({ ok: true, proxima_revisao: transition.proximaRevisao })
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido para questoes.' })
    const { id, motivo, detalhe } = req.body || {}
    if (!id || !reportReasons.includes(motivo)) return res.status(400).json({ error: 'Questao e motivo validos sao obrigatorios.' })
    const { error: reportError } = await supabase.from('relato_questao').insert({ questao_id: id, motivo, detalhe: String(detalhe || '').slice(0, 1000) || null })
    if (reportError) throw reportError
    const { error } = await supabase.from('questao').update({ marcada_errada: true, estado: 'arquivada' }).eq('id', id)
    if (error) throw error
    return res.status(201).json({ ok: true, mensagem: 'Problema registrado e questao retirada do baralho.' })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel reportar a questao.')
  }
}

