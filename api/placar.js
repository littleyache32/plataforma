import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'
import { scoreboard } from '../shared/mentor.js'

function percent(value, total) { return total ? Math.round((value / total) * 100) : 0 }

function confidenceBreakdown(records) {
  return ['certeza', 'duvida', 'eliminacao', 'sem_conhecimento'].map((id) => {
    const group = records.filter((record) => record.classificacao === id)
    const correct = group.filter((record) => record.resultado === 'acerto').length
    return { id, total: group.length, acertos: correct, taxa: percent(correct, group.length) }
  })
}

function timeline(records, dateField = 'criado_em') {
  const groups = new Map()
  records.forEach((record) => {
    const day = String(record[dateField] || '').slice(0, 10)
    if (!day) return
    const current = groups.get(day) || { data: day, total: 0, acertos: 0 }
    current.total += 1
    current.acertos += record.resultado === 'acerto' ? 1 : 0
    groups.set(day, current)
  })
  return [...groups.values()].sort((a, b) => a.data.localeCompare(b.data)).slice(-8).map((item) => ({ ...item, taxa: percent(item.acertos, item.total) }))
}

function bySubject(records) {
  const groups = new Map()
  records.forEach((record) => {
    const name = record.materia || 'Sem disciplina'
    const current = groups.get(name) || { materia: name, total: 0, acertos: 0, certeza: 0, falsa_certeza: 0 }
    current.total += 1
    current.acertos += record.resultado === 'acerto' ? 1 : 0
    current.certeza += record.classificacao === 'certeza' ? 1 : 0
    current.falsa_certeza += record.resultado === 'erro' && record.classificacao === 'certeza' ? 1 : 0
    groups.set(name, current)
  })
  return [...groups.values()].map((item) => ({ ...item, taxa: percent(item.acertos, item.total) })).sort((a, b) => a.taxa - b.taxa || b.total - a.total)
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin()
    let query = supabase.from('registro').select('resultado,classificacao,tempo,criado_em,questao!inner(topico:topico_id(materia:materia_id(nome,objetivo_id)))')
    const topicoId = queryParam(req, 'topicoId')
    const objetivoId = queryParam(req, 'objetivoId')
    if (topicoId) query = query.eq('questao.topico_id', topicoId)
    const { data, error } = await query
    if (error) throw error
    const records = (objetivoId ? (data || []).filter((item) => item.questao?.topico?.materia?.objetivo_id === objetivoId) : (data || [])).map((item) => ({ ...item, materia: item.questao?.topico?.materia?.nome }))
    const questionScore = scoreboard(records)
    const questionTime = records.filter((item) => Number(item.tempo) > 0)

    let simulationsQuery = supabase.from('simulado').select('id,finalizado_em,materia:materia_id(nome),itens:simulado_item(resposta,classificacao,tempo,pulada,questao:questao_id(gabarito,topico:topico_id(materia:materia_id(nome))))').eq('status', 'finalizado')
    if (objetivoId) simulationsQuery = simulationsQuery.eq('objetivo_id', objetivoId)
    const { data: simulations, error: simulationsError } = await simulationsQuery.order('finalizado_em', { ascending: true })
    if (simulationsError) throw simulationsError
    const simulationRecords = (simulations || []).flatMap((simulation) => (simulation.itens || []).filter((item) => item.resposta).map((item) => ({
      resultado: item.resposta === item.questao?.gabarito ? 'acerto' : 'erro', classificacao: item.classificacao, tempo: item.tempo, criado_em: simulation.finalizado_em, materia: item.questao?.topico?.materia?.nome || simulation.materia?.nome,
    })))
    const skipped = (simulations || []).reduce((total, simulation) => total + (simulation.itens || []).filter((item) => item.pulada || !item.resposta).length, 0)
    const simulationTime = simulationRecords.filter((item) => Number(item.tempo) > 0)
    return res.status(200).json({
      questoes: { ...questionScore, acertos: records.filter((item) => item.resultado === 'acerto').length, confianca: confidenceBreakdown(records), tempo_medio: questionTime.length ? Math.round(questionTime.reduce((sum, item) => sum + Number(item.tempo), 0) / questionTime.length) : 0, evolucao: timeline(records), materias: bySubject(records) },
      simulados: { ...scoreboard(simulationRecords), total: simulationRecords.length, acertos: simulationRecords.filter((item) => item.resultado === 'acerto').length, feitos: (simulations || []).length, puladas: skipped, confianca: confidenceBreakdown(simulationRecords), tempo_medio: simulationTime.length ? Math.round(simulationTime.reduce((sum, item) => sum + Number(item.tempo), 0) / simulationTime.length) : 0, evolucao: timeline(simulationRecords), materias: bySubject(simulationRecords) },
    })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel calcular o placar.')
  }
}
