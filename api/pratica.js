import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'
import { practiceTransition, selectPracticeQuestion, shouldShowExplanation } from '../shared/practice.js'
import { cardKey, cardTransition } from '../shared/cards.js'

const classifications = ['certeza', 'duvida', 'eliminacao', 'sem_conhecimento']

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    if (req.method === 'GET') {
      const topicoId = queryParam(req, 'topicoId')
      const materiaId = queryParam(req, 'materiaId')
      const questaoId = queryParam(req, 'questaoId')
      if (!topicoId && !materiaId && !questaoId) return res.status(400).json({ error: 'Materia, topico ou questao obrigatorio.' })

      let query = supabase.from('questao')
        .select('id,tipo,enunciado,alternativas,origem,estado,quantidade_tentativas,ultima_resolucao,proxima_revisao,topico:topico_id(id,nome,materia_id)', { count: 'exact' })
        .eq('marcada_errada', false)
        .eq('ativa', true)
        .neq('estado', 'arquivada')
      if (questaoId) query = query.eq('id', questaoId).limit(1)
      else if (topicoId) query = query.eq('topico_id', topicoId).limit(1000)
      else {
        const { data: subjectTopics, error: topicsError } = await supabase.from('topico').select('id').eq('materia_id', materiaId)
        if (topicsError) throw topicsError
        const topicIds = (subjectTopics || []).map((item) => item.id)
        if (!topicIds.length) return res.status(404).json({ error: 'Esta disciplina ainda nao possui topicos.' })
        query = query.in('topico_id', topicIds).limit(1000)
      }
      const { data: questions, count, error } = await query
      if (error) throw error
      const question = questaoId ? questions?.[0] : selectPracticeQuestion(questions || [])
      if (!question) return res.status(404).json({ error: 'Nao ha questoes disponiveis. Gere um lote em Administracao.' })
      return res.status(200).json({ questao: question, disponiveis: count || questions?.length || 0 })
    }

    const { questaoId, resposta, classificacao, tempo } = req.body || {}
    if (!questaoId || !classifications.includes(classificacao) || !Number.isInteger(tempo) || tempo < 0) {
      return res.status(400).json({ error: 'Resposta, classificacao e tempo validos sao obrigatorios.' })
    }
    const { data: question, error } = await supabase.from('questao')
      .select('id,tipo,gabarito,enunciado,explicacao,comentarios_alternativas,fonte,trecho_fonte,quantidade_tentativas,topico:topico_id(id,materia:materia_id(id,objetivo_id))')
      .eq('id', questaoId).eq('marcada_errada', false).eq('ativa', true).single()
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

    const topico = question.topico
    const materia = topico?.materia
    if (topico?.id && materia?.id && materia?.objetivo_id) {
      const chave = cardKey({ topicoId: topico.id, explicacao: question.explicacao })
      const cardResult = resultado === 'acerto' && classificacao === 'certeza' ? 'lembrei' : 'revisar'
      const cardSchedule = cardTransition({ resultado: cardResult })
      const due = transition.motivo === 'falsa_certeza' ? now : cardSchedule.proximaRevisao
      const { data: existingCard, error: existingCardError } = await supabase.from('question_card').select('id,ocorrencias').eq('chave', chave).maybeSingle()
      if (existingCardError) throw existingCardError
      if (existingCard) {
        const { error: cardError } = await supabase.from('question_card').update({ ocorrencias: existingCard.ocorrencias + 1, questao_id: question.id, proxima_revisao: due }).eq('id', existingCard.id)
        if (cardError) throw cardError
      } else {
        const { error: cardError } = await supabase.from('question_card').insert({
          objetivo_id: materia.objetivo_id,
          materia_id: materia.id,
          topico_id: topico.id,
          questao_id: question.id,
          chave,
          frente: question.enunciado,
          verso: `Gabarito: ${question.gabarito}\n\n${question.explicacao}`,
          fonte: question.fonte,
          trecho_fonte: question.trecho_fonte,
          proxima_revisao: due,
        })
        if (cardError) throw cardError
      }
    }

    const mostrarExplicacao = shouldShowExplanation({ resultado, classificacao })
    return res.status(201).json({
      resultado,
      gabarito: question.gabarito,
      mostrar_explicacao: mostrarExplicacao,
      explicacao: mostrarExplicacao ? question.explicacao : null,
      comentarios_alternativas: mostrarExplicacao ? question.comentarios_alternativas : null,
      fonte: mostrarExplicacao ? question.fonte : null,
      trecho_fonte: mostrarExplicacao ? question.trecho_fonte : null,
      revisao_imediata: transition.motivo === 'falsa_certeza',
      proxima_revisao: transition.proximaRevisao,
    })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel processar a pratica.')
  }
}
