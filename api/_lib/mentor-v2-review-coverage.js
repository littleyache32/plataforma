import { readMentorDemandTrace } from './mentor-v2-trace.js'
import { projectPlannedReviewCoverage } from '../../shared/mentor-v2-review-plan.js'

// Read only. Coverage comes from the original typed decision, never a topic
// match, today's policy or a new flag persisted on the review itself.
export async function readMentorReviewCoverage({ supabase, corte }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(corte))
  const query = await supabase.from('sessao').select('id').eq('tipo', 'revisao').eq('origem', 'mentor')
    .in('status', ['planejada', 'parcial']).gte('data', today)
  if (query.error) throw query.error
  const result = []
  for (const row of query.data || []) {
    const trace = await readMentorDemandTrace({ supabase, id: row.id, audit: true })
    if (trace.estado !== 'RASTREAVEL') continue
    const coverage = projectPlannedReviewCoverage({ demanda: trace.demanda, decisao: trace.decisao })
    if (coverage) result.push(coverage)
  }
  return result
}

export function separateCoveredCentralItems({ itens, demandas, corte }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(corte))
  const covered = [], actionable = []
  for (const item of itens) {
    const type = item.tipo === 'card' ? 'SRS_QUESTION_CARD' : 'RETESTE_QUESTAO'
    const target = item.tipo === 'card' ? 'question_card' : 'questao'
    const dueDay = item.agendada_para ? new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.agendada_para)) : today
    const coverage = demandas.find((row) => ['planejada', 'parcial'].includes(row.status)
      && row.data >= today && row.data <= (dueDay < today ? today : dueDay)
      && row.revisao_ref.fontes.some((source) => source.tipo === type && source.id === item.id
        && source.alvo.entidade === target && source.alvo.id === item.item_id))
    if (coverage) covered.push({ ...item, sessao_id: coverage.id, decisao_id: coverage.revisao_ref.decisao_id,
      reason_codes: ['REVIEW_COVERED_BY_PRIORITY_PLAN'] })
    else actionable.push(item)
  }
  return { itens: actionable, cobertos_no_plano: covered }
}
