import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, requireAccess } from './_lib/http.js'
import { calculateTopicDiagnosis } from '../shared/mentor.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin()
    const [{ data: topics, error: topicsError }, { data: records, error: recordsError }] = await Promise.all([
      supabase.from('topico').select('id,nome,materia:materia_id(nome)'),
      supabase.from('registro').select('resultado,classificacao,criado_em,questao!inner(id,topico_id,enunciado)').order('criado_em', { ascending: false }),
    ])
    if (topicsError) throw topicsError
    if (recordsError) throw recordsError

    const diagnoses = (topics || []).map((topic) => {
      const topicRecords = (records || []).filter((record) => record.questao?.topico_id === topic.id)
      return { id: topic.id, nome: topic.nome, materia: topic.materia?.nome, ...calculateTopicDiagnosis(topicRecords) }
    })
    const prioridades = diagnoses
      .filter((item) => item.status === 'prioridade')
      .sort((a, b) => b.gravidade - a.gravidade)
      .slice(0, 3)
    const revisaoImediata = (records || [])
      .filter((record) => record.resultado === 'erro' && record.classificacao === 'certeza')
      .slice(0, 10)
      .map((record) => ({ questao_id: record.questao.id, enunciado: record.questao.enunciado, criado_em: record.criado_em }))

    return res.status(200).json({ prioridades, topicos: diagnoses, revisao_imediata: revisaoImediata })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel gerar o diagnostico.')
  }
}
