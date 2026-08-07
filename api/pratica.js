import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, requireAccess } from './_lib/http.js'

const classifications = ['certeza', 'duvida', 'eliminacao', 'sem_conhecimento']

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()

  try {
    if (req.method === 'GET') {
      const topicoId = String(req.query.topicoId || '')
      if (!topicoId) return res.status(400).json({ error: 'Topico obrigatorio.' })

      const { data: questions, error } = await supabase
        .from('questao')
        .select('id,tipo,enunciado,alternativas,origem')
        .eq('topico_id', topicoId)
        .eq('usada', false)
        .eq('marcada_errada', false)
        .limit(20)
      if (error) throw error
      if (!questions?.length) return res.status(404).json({ error: 'Nao ha questoes disponiveis. Gere um novo lote no Admin.' })

      const question = questions[Math.floor(Math.random() * questions.length)]
      const { error: updateError } = await supabase.from('questao').update({ usada: true }).eq('id', question.id)
      if (updateError) throw updateError
      return res.status(200).json({ questao: question })
    }

    const { questaoId, resposta, classificacao, tempo } = req.body || {}
    if (!questaoId || !classifications.includes(classificacao) || !Number.isInteger(tempo) || tempo < 0) {
      return res.status(400).json({ error: 'Resposta, classificacao e tempo validos sao obrigatorios.' })
    }

    const { data: question, error } = await supabase
      .from('questao')
      .select('id,tipo,gabarito,explicacao,fonte,trecho_fonte')
      .eq('id', questaoId)
      .eq('marcada_errada', false)
      .single()
    if (error) throw error

    const answer = String(resposta || '').toUpperCase()
    const validAnswers = question.tipo === 'CE' ? ['C', 'E'] : ['A', 'B', 'C', 'D', 'E']
    if (!validAnswers.includes(answer)) return res.status(400).json({ error: 'Resposta invalida para o tipo da questao.' })

    const resultado = answer === question.gabarito ? 'acerto' : 'erro'
    const { error: insertError } = await supabase.from('registro').insert({
      questao_id: question.id,
      resultado,
      classificacao,
      tempo,
    })
    if (insertError) throw insertError

    return res.status(201).json({
      resultado,
      gabarito: question.gabarito,
      explicacao: question.explicacao,
      fonte: question.fonte,
      trecho_fonte: question.trecho_fonte,
      revisao_imediata: resultado === 'erro' && classificacao === 'certeza',
    })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel processar a pratica.')
  }
}

