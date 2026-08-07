import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'
import { calculateTopicDiagnosis } from '../shared/mentor.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin()
    const objetivoId = queryParam(req, 'objetivoId')
    const [{ data: topics, error: topicsError }, { data: records, error: recordsError }, { data: reviewItems, error: reviewError }] = await Promise.all([
      supabase.from('topico').select('id,nome,materia:materia_id(nome,objetivo:objetivo_id(id,nome))'),
      supabase.from('registro').select('resultado,classificacao,criado_em,questao!inner(id,topico_id,enunciado,topico:topico_id(materia:materia_id(objetivo_id)))').order('criado_em', { ascending: false }),
      supabase.from('revisao_item').select('id,motivo,prioridade,agendada_para,questao:questao_id(id,enunciado,topico_id,topico:topico_id(materia:materia_id(objetivo_id)))').eq('status', 'pendente').order('prioridade').order('agendada_para').limit(20),
    ])
    if (topicsError) throw topicsError
    if (recordsError) throw recordsError
    if (reviewError) throw reviewError

    const filteredTopics = objetivoId ? (topics || []).filter((topic) => topic.materia?.objetivo?.id === objetivoId) : (topics || [])
    const filteredRecords = objetivoId ? (records || []).filter((record) => record.questao?.topico?.materia?.objetivo_id === objetivoId) : (records || [])
    const filteredReviews = objetivoId ? (reviewItems || []).filter((item) => item.questao?.topico?.materia?.objetivo_id === objetivoId) : (reviewItems || [])
    const diagnoses = filteredTopics.map((topic) => {
      const topicRecords = filteredRecords.filter((record) => record.questao?.topico_id === topic.id)
      return { id: topic.id, nome: topic.nome, materia: topic.materia?.nome, objetivo: topic.materia?.objetivo?.nome, ...calculateTopicDiagnosis(topicRecords) }
    })
    const prioridades = diagnoses
      .filter((item) => item.status === 'prioridade')
      .sort((a, b) => b.gravidade - a.gravidade)
      .slice(0, 3)
    const revisaoImediata = filteredReviews.map((item) => ({
      id: item.id,
      questao_id: item.questao.id,
      topico_id: item.questao.topico_id,
      enunciado: item.questao.enunciado,
      motivo: item.motivo,
      prioridade: item.prioridade,
      agendada_para: item.agendada_para,
    }))

    return res.status(200).json({ prioridades, topicos: diagnoses, revisao_imediata: revisaoImediata })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel gerar o diagnostico.')
  }
}
