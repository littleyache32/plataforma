import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './http.js'
import { practiceTransition, selectPracticeQuestion, shouldShowExplanation } from '../../shared/practice.js'
import { buildQuestionCard, cardKey, cardTransition, shouldCreateQuestionCard } from '../../shared/cards.js'
import { BACEN_PRACTICE_START, canAccessBacenItem } from '../../shared/study-access.js'

const classifications = ['certeza', 'duvida', 'eliminacao', 'sem_conhecimento']

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    if (req.method === 'GET') {
      const topicoId = queryParam(req, 'topicoId')
      const materiaId = queryParam(req, 'materiaId')
      const questaoId = queryParam(req, 'questaoId')
      const somenteRevisao = queryParam(req, 'revisao') === '1'
      const somenteCaderno = queryParam(req, 'caderno') === '1'
      if (!topicoId && !materiaId && !questaoId) return res.status(400).json({ error: 'Materia, topico ou questao obrigatorio.' })

      let query = supabase.from('questao')
        .select('id,tipo,enunciado,alternativas,origem,estado,quantidade_tentativas,ultima_resolucao,proxima_revisao,topico:topico_id(id,nome,materia_id,materia:materia_id(id,objetivo:objetivo_id(tipo)))', { count: 'exact' })
        .eq('marcada_errada', false)
        .eq('ativa', true)
        .neq('estado', 'arquivada')
      if (somenteCaderno && !questaoId) {
        const { data: notebookItems, error: notebookError } = await supabase.from('revisao_item').select('questao_id').eq('status', 'pendente')
        if (notebookError) throw notebookError
        const notebookQuestionIds = (notebookItems || []).map((item) => item.questao_id)
        if (!notebookQuestionIds.length) return res.status(404).json({ error: 'Seu Caderno de Questões está vazio.' })
        query = query.in('id', notebookQuestionIds)
      }
      if (somenteRevisao && !questaoId) query = query.not('proxima_revisao', 'is', null).lte('proxima_revisao', new Date().toISOString())
      if (questaoId) query = query.eq('id', questaoId).limit(1)
      else if (topicoId) query = query.eq('topico_id', topicoId).limit(1000)
      else {
        const { data: subjectTopics, error: topicsError } = await supabase.from('topico').select('id').eq('materia_id', materiaId)
        if (topicsError) throw topicsError
        const topicIds = (subjectTopics || []).map((item) => item.id)
        if (!topicIds.length) return res.status(404).json({ error: 'Esta disciplina ainda nao possui topicos.' })
        query = query.in('topico_id', topicIds).limit(1000)
      }
      const { data: questions, error } = await query
      if (error) throw error
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const completed = await supabase.from('sessao').select('topico_id').eq('tipo', 'estudo').eq('status', 'feita').not('topico_id', 'is', null)
      if (completed.error) throw completed.error
      const completedTopicIds = (completed.data || []).map((item) => item.topico_id)
      const eligibleQuestions = (questions || []).filter((item) => {
        if (item.topico?.materia?.objetivo?.tipo !== 'concurso') return true
        return canAccessBacenItem({ today, topicId: item.topico?.id, completedTopicIds, previouslyAttempted: item.quantidade_tentativas > 0 })
      })
      const question = questaoId ? eligibleQuestions[0] : selectPracticeQuestion(eligibleQuestions)
      const containsBacen = (questions || []).some((item) => item.topico?.materia?.objetivo?.tipo === 'concurso')
      if (!question && containsBacen && today < BACEN_PRACTICE_START) {
        return res.status(423).json({ error: 'As questões do BACEN serão liberadas em 31 de agosto, depois das duas semanas de construção de base.', bloqueado_ate: BACEN_PRACTICE_START })
      }
      if (!question && containsBacen) {
        return res.status(423).json({ error: 'Conclua primeiro uma demanda de estudo deste tópico. A prática será liberada automaticamente depois disso.' })
      }
      if (!question) return res.status(404).json({ error: somenteRevisao ? 'As revisões programadas deste foco foram concluídas.' : 'Nao ha questoes disponiveis. Gere um lote em Administracao.' })
      return res.status(200).json({ questao: question, disponiveis: eligibleQuestions.length })
    }

    const { questaoId, resposta, classificacao, tempo, operacaoId } = req.body || {}
    if (!questaoId || !classifications.includes(classificacao) || !Number.isInteger(tempo) || tempo < 0) {
      return res.status(400).json({ error: 'Resposta, classificacao e tempo validos sao obrigatorios.' })
    }
    if (operacaoId) {
      const prior = await supabase.from('registro').select('id,resultado,classificacao').eq('operacao_id', operacaoId).maybeSingle()
      if (prior.error) throw prior.error
      if (prior.data) return res.status(200).json({ ...prior.data, repetida: true })
    }
    const { data: question, error } = await supabase.from('questao')
      .select('id,tipo,gabarito,enunciado,explicacao,comentarios_alternativas,fonte,trecho_fonte,quantidade_tentativas,intervalo_dias,fator_facilidade,lapsos,acertos_seguidos,topico:topico_id(id,nome,materia:materia_id(id,objetivo_id,objetivo:objetivo_id(tipo)))')
      .eq('id', questaoId).eq('marcada_errada', false).eq('ativa', true).single()
    if (error) throw error

    if (question.topico?.materia?.objetivo?.tipo === 'concurso') {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
      const completed = await supabase.from('sessao').select('topico_id').eq('tipo', 'estudo').eq('status', 'feita').eq('topico_id', question.topico.id)
      if (completed.error) throw completed.error
      if (!canAccessBacenItem({ today, topicId: question.topico.id, completedTopicIds: (completed.data || []).map((item) => item.topico_id), previouslyAttempted: question.quantidade_tentativas > 0 })) {
        return res.status(423).json({ error: today < BACEN_PRACTICE_START ? 'As questões do BACEN ainda estão na fase de construção de base.' : 'Conclua primeiro uma demanda de estudo deste tópico.' })
      }
    }

    const answer = String(resposta || '').toUpperCase()
    const validAnswers = question.tipo === 'CE' ? ['C', 'E'] : ['A', 'B', 'C', 'D', 'E']
    if (!validAnswers.includes(answer)) return res.status(400).json({ error: 'Resposta invalida para o tipo da questao.' })
    const resultado = answer === question.gabarito ? 'acerto' : 'erro'
    const transition = practiceTransition({ resultado, classificacao, tentativas: question.quantidade_tentativas, intervaloDias: question.intervalo_dias, fatorFacilidade: question.fator_facilidade, lapsos: question.lapsos, acertosSeguidos: question.acertos_seguidos })
    const now = new Date().toISOString()

    const { error: insertError } = await supabase.from('registro').insert({ questao_id: question.id, resultado, classificacao, tempo, operacao_id: operacaoId || null })
    if (insertError) throw insertError
    const { error: updateError } = await supabase.from('questao').update({
      usada: true,
      ultima_resolucao: now,
      quantidade_tentativas: question.quantidade_tentativas + 1,
      proxima_revisao: transition.proximaRevisao,
      estado: transition.estado,
      intervalo_dias: transition.intervaloDias,
      fator_facilidade: transition.fatorFacilidade,
      lapsos: transition.lapsos,
      acertos_seguidos: transition.acertosSeguidos,
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
    if (topico?.id && materia?.id && materia?.objetivo_id && shouldCreateQuestionCard({ resultado, classificacao })) {
      const chave = cardKey({ topicoId: topico.id, explicacao: question.explicacao })
      const cardSchedule = cardTransition({ resultado: 'revisar' })
      const due = transition.motivo === 'falsa_certeza' ? now : cardSchedule.proximaRevisao
      const { data: existingCard, error: existingCardError } = await supabase.from('question_card').select('id,ocorrencias').eq('chave', chave).maybeSingle()
      if (existingCardError) throw existingCardError
      if (existingCard) {
        const { error: cardError } = await supabase.from('question_card').update({ ocorrencias: existingCard.ocorrencias + 1, questao_id: question.id, proxima_revisao: due }).eq('id', existingCard.id)
        if (cardError) throw cardError
      } else {
        const { count: cardCount, error: cardCountError } = await supabase.from('question_card').select('id', { count: 'exact', head: true }).eq('topico_id', topico.id).eq('ativa', true)
        if (cardCountError) throw cardCountError
        if ((cardCount || 0) < 20) {
          const card = buildQuestionCard({ question, topicName: topico.nome })
          const { error: cardError } = await supabase.from('question_card').insert({
            objetivo_id: materia.objetivo_id,
            materia_id: materia.id,
            topico_id: topico.id,
            questao_id: question.id,
            chave,
            frente: card.frente,
            verso: card.verso,
            resposta_direta: card.respostaDireta,
            explicacao_curta: card.explicacaoCurta,
            dica_escopo: card.dicaEscopo,
            modelo_card: card.modeloCard,
            tipo_card: card.tipoCard,
            fonte: question.fonte,
            trecho_fonte: question.trecho_fonte,
            proxima_revisao: due,
            ativa: true,
            ativo: true,
          })
          if (cardError && cardError.code !== '23505') throw cardError
        }
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
