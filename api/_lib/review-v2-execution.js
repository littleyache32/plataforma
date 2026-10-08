import { readMentorDemandTrace } from './mentor-v2-trace.js'
import { questionEquivalence, questionReviewObservations } from '../../shared/review-v2-operational.js'
import { readReviewRows } from './review-v2-facts.js'

export async function plannedQuestionReview(supabase, sessaoId) {
  if (!sessaoId) return null
  const trace = await readMentorDemandTrace({ supabase, id: sessaoId, audit: true })
  const selection = trace.decisao?.parametros?.revisao
  if (trace.estado !== 'RASTREAVEL' || !selection || !['planejada', 'parcial', 'feita'].includes(trace.demanda.status)
    || selection.fontes[0]?.entidade !== 'revisao_item'
    || !['QUESTAO_INDIVIDUAL', 'BATERIA_QUESTOES'].includes(selection.metodo.metodo)) throw new Error('Demanda sem reteste de questões rastreável.')
  return { revisaoId: selection.fontes[0].id, questaoOriginalId: selection.fontes[0].alvo.id,
    questaoIds: selection.metodo.componentes[0].referencias.filter((r) => r.entidade === 'questao').map((r) => r.id), sessaoId }
}

export async function validateReviewExecution(supabase, { question, revisaoId, sessaoId, corte, repetida = false }) {
  const planned = await plannedQuestionReview(supabase, sessaoId)
  if (planned && (!planned.questaoIds.includes(question.id) || (revisaoId && planned.revisaoId !== revisaoId))) throw new Error('Execução diverge da origem planejada.')
  const id = planned?.revisaoId || revisaoId
  if (!id) return { need: null, original: question, sessao_id: null }
  const result = await supabase.from('revisao_item').select('id,questao_id,motivo,status,agendada_para').eq('id', id).maybeSingle()
  if (result.error) throw result.error
  const need = result.data
  if (!need || (need.status !== 'pendente' && !(repetida && need.status === 'concluida'))) throw new Error('Necessidade de revisão não está pendente.')
  const originalResult = need.questao_id === question.id ? { data: question } : await supabase.from('questao')
    .select('id,topico_id,metadados_revisao').eq('id', need.questao_id).single()
  if (originalResult.error) throw originalResult.error
  const original = originalResult.data
  if (!original || !questionEquivalence(original, question, corte)) throw new Error('Questão sem equivalência curricular comprovada.')
  return { need, original, sessao_id: planned?.sessaoId || null }
}

// Facts first, never "demand marked done => need done". Partial remains pending.
export async function reconcileQuestionReview(supabase, { need, original, corte }) {
  if (!need) return null
  const [questions, records] = await Promise.all([
    readReviewRows(supabase, 'questao', 'id,topico_id,ativa,marcada_errada,estado,metadados_revisao', (q) => q.eq('topico_id', original.topico_id)),
    readReviewRows(supabase, 'registro', 'id,questao_id,resultado,classificacao,criado_em,revisao_item_id,sessao_id,erro_alvo_id', (q) => q.lte('criado_em', corte)),
  ])
  const facts = questionReviewObservations({ questao: original, revisao: need, questoes: questions, registros: records, corte })
  if (facts.atendimento === 'ATENDIDA') {
    const updated = await supabase.from('revisao_item').update({ status: 'concluida', concluida_em: corte }).eq('id', need.id).eq('status', 'pendente')
    if (updated.error) throw updated.error
  }
  return facts
}
