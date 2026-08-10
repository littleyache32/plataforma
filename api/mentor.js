import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'
import { buildScenarios, calculateTopicDiagnosis, topicSignals } from '../shared/mentor.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin()
    const objetivoId = queryParam(req, 'objetivoId')
    const now = new Date().toISOString()
    const [{ data: topics, error: topicsError }, { data: records, error: recordsError }, { data: reviewItems, error: reviewError }, { data: questions, error: questionsError }, { data: cards, error: cardsError }, { data: policy }, { data: objective }] = await Promise.all([
      supabase.from('topico').select('id,nome,materia:materia_id(nome,objetivo:objetivo_id(id,nome))'),
      supabase.from('registro').select('resultado,classificacao,tempo,criado_em,questao!inner(id,topico_id,enunciado,topico:topico_id(materia:materia_id(objetivo_id)))').order('criado_em', { ascending: false }),
      supabase.from('revisao_item').select('id,motivo,prioridade,agendada_para,questao:questao_id(id,enunciado,topico_id,topico:topico_id(materia:materia_id(objetivo_id)))').eq('status', 'pendente').order('prioridade').order('agendada_para').limit(20),
      supabase.from('questao').select('topico_id,usada,ultima_resolucao,proxima_revisao,marcada_errada,ativa').eq('ativa', true),
      supabase.from('question_card').select('topico_id,proxima_revisao,ativa').eq('ativa', true),
      supabase.from('mentor_conhecimento').select('versao,politica').eq('ativo', true).order('criado_em', { ascending: false }).limit(1).maybeSingle(),
      objetivoId ? supabase.from('objetivo').select('id,data_alvo').eq('id', objetivoId).maybeSingle() : Promise.resolve({ data: null }),
    ])
    if (topicsError) throw topicsError
    if (recordsError) throw recordsError
    if (reviewError) throw reviewError
    if (questionsError) throw questionsError
    if (cardsError) throw cardsError

    const filteredTopics = objetivoId ? (topics || []).filter((topic) => topic.materia?.objetivo?.id === objetivoId) : (topics || [])
    const filteredRecords = objetivoId ? (records || []).filter((record) => record.questao?.topico?.materia?.objetivo_id === objetivoId) : (records || [])
    const filteredReviews = objetivoId ? (reviewItems || []).filter((item) => item.questao?.topico?.materia?.objetivo_id === objetivoId) : (reviewItems || [])
    const filteredQuestions = (questions || []).filter((question) => filteredTopics.some((topic) => topic.id === question.topico_id) && !question.marcada_errada)
    const filteredCards = (cards || []).filter((card) => filteredTopics.some((topic) => topic.id === card.topico_id))
    const diagnoses = filteredTopics.map((topic) => {
      const topicRecords = filteredRecords.filter((record) => record.questao?.topico_id === topic.id)
      const topicQuestions = filteredQuestions.filter((question) => question.topico_id === topic.id)
      const topicCards = filteredCards.filter((card) => card.topico_id === topic.id)
      const diagnosis = calculateTopicDiagnosis(topicRecords, policy?.politica || {})
      const times = topicRecords.map((record) => Number(record.tempo) || 0).filter(Boolean)
      return { id: topic.id, nome: topic.nome, materia: topic.materia?.nome, objetivo: topic.materia?.objetivo?.nome, ...topicSignals({
        diagnosis,
        totalQuestions: topicQuestions.length,
        unusedQuestions: topicQuestions.filter((question) => !question.usada).length,
        dueQuestions: topicQuestions.filter((question) => question.proxima_revisao && question.proxima_revisao <= now).length,
        dueCards: topicCards.filter((card) => card.proxima_revisao <= now).length,
        lastSeenAt: topicRecords[0]?.criado_em,
        averageSeconds: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0,
        overdue: filteredReviews.filter((item) => item.questao?.topico_id === topic.id).length,
      }) }
    })
    const prioridades = diagnoses
      .filter((item) => item.status === 'prioridade' || item.cards_vencidos || item.questoes_para_revisar || item.risco_esquecimento >= 60)
      .sort((a, b) => b.prioridade_calculada - a.prioridade_calculada)
      .slice(0, 3)
      .map((item) => ({ ...item, motivo: item.falsa_certeza >= 10 ? 'Falsa certeza exige correção imediata.' : item.questoes_para_revisar ? 'Há questões programadas para revisão espaçada.' : item.cards_vencidos ? 'Há Question Cards vencidos.' : 'Risco de esquecimento ou domínio insuficiente.' }))
    const revisaoImediata = filteredReviews.map((item) => ({
      id: item.id,
      questao_id: item.questao.id,
      topico_id: item.questao.topico_id,
      enunciado: item.questao.enunciado,
      motivo: item.motivo,
      prioridade: item.prioridade,
      agendada_para: item.agendada_para,
    }))

    const coveredTopics = diagnoses.filter((item) => item.amostra >= 20 && (item.dominio || 0) >= 68).length
    const daysRemaining = objective?.data_alvo ? Math.max(1, Math.ceil((new Date(objective.data_alvo) - Date.now()) / 86_400_000)) : 180
    const cenarios = buildScenarios({ coveredTopics, totalTopics: diagnoses.length, daysRemaining })
    return res.status(200).json({ prioridades, topicos: diagnoses, revisao_imediata: revisaoImediata, cenarios, politica: { versao: policy?.versao || '2026.08.2' }, resumo: { topicos_cobertos: coveredTopics, topicos_totais: diagnoses.length, dias_restantes: daysRemaining } })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel gerar o diagnostico.')
  }
}
