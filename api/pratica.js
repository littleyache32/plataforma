import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, requireAccess } from './_lib/http.js'
import { practiceTransition, selectPracticeQuestion } from '../shared/practice.js'

const classifications = ['certeza', 'duvida', 'eliminacao', 'sem_conhecimento']

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    if (req.method === 'GET') {
      const topicoId = String(req.query.topicoId || '')
      const questaoId = String(req.query.questaoId || '')
      if (!topicoId && !questaoId) return res.status(400).json({ error: 'Topico ou questao obrigatorio.' })

      let query = supabase.from('questao')
        .select('id,tipo,enunciado,alternativas,origem,estado,quantidade_tentativas,ultima_resolucao,proxima_revisao')
        .eq('marcada_errada', false)
        .neq('estado', 'arquivada')
      query = questaoId ? query.eq('id', questaoId).limit(1) : query.eq('topico_id', topicoId).limit(100)
      const { data: questions, error } = await query
      if (error) throw error
      const question = questaoId ? questions?.[0] : selectPracticeQuestion(questions || [])
      if (!question) return res.status(404).json({ error: 'Nao ha questoes disponiveis. Gere um lote em Administracao.' })
      return res.status(200).json({ questao: question })
    }

    const { questaoId, resposta, classificacao, tempo } = req.body || {}
    if (!questaoId || !classifications.includes(classificacao) || !Number.isInteger(tempo) || tempo < 0) {
      return res.status(400).json({ error: 'Resposta, classificacao e tempo validos sao obrigatorios.' })
    }
    const { data: question, error } = await supabase.from('questao')
      .select('id,tipo,gabarito,explicacao,fonte,trecho_fonte,quantidade_tentativas')
      .eq('id', questaoId).eq('marcada_errada', false).single()
    if (error) throw error

    const answer = String(resposta || '').toUpperCase()
    const validAnswers = question.tipo === 'CE' ? ['C', 'E'] : ['A', 'B', 'C', 'D', 'E']
    if (!validAnswers.includes(answer)) return res.status(400).json({ error: 'Resposta invalida para o tipo da questao.' })
    const resultado = answer === question.gabarito ? 'acerto' : 'erro'
    const transition = practiceTransition({ resultado, classificacao, tentativas: question.quantidade_tentativas })
    const now = new Date().toISOString()

    const { error: insertError } = await supabase.from('registro').insert({ questao_id: question.id, resultado, classificacao, tempo })
    if (insertError) throw insertError
    const { error: updateError } = await supabase.from('questao').update({
      usada: true,
      ultima_resolucao: now,
      quantidade_tentativas: question.quantidade_tentativas + 1,
      proxima_revisao: transition.proximaRevisao,
      estado: transition.estado,
    }).eq('id', question.id)
    if (updateError) throw updateError

    const { data: pending } = await supabase.from('revisao_item').select('id').eq('questao_id', question.id).eq('status', 'pendente').maybeSingle()
    if (resultado === 'acerto' && classificacao === 'certeza' && pending) {
      await supabase.from('revisao_item').update({ status: 'concluida', concluida_em: now }).eq('id', pending.id)
    } else if (transition.motivo) {
      if (pending) {
        await supabase.from('revisao_item').update({ motivo: transition.motivo, prioridade: transition.prioridade, agendada_para: transition.proximaRevisao }).eq('id', pending.id)
      } else {
        await supabase.from('revisao_item').insert({ questao_id: question.id, motivo: transition.motivo, prioridade: transition.prioridade, agendada_para: transition.proximaRevisao })
      }
    }

    return res.status(201).json({
      resultado,
      gabarito: question.gabarito,
      explicacao: question.explicacao,
      fonte: question.fonte,
      trecho_fonte: question.trecho_fonte,
      revisao_imediata: transition.motivo === 'falsa_certeza',
      proxima_revisao: transition.proximaRevisao,
    })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel processar a pratica.')
  }
}

