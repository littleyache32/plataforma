import { materializeMentorWeek } from './mentor-v2-plan.js'
import { MENTOR_V2_CONTRACT, stableMentorJSON, validateMentorV2Decision } from '../../shared/mentor-v2-policy.js'
import { shortMentorDemandReason } from '../../shared/mentor-v2-explanation.js'

const missing = (estado) => ({ estado, explicacao: 'Motivo original indisponível.' })

// Resolve the ORIGINAL creation record, never today's policy/latest evaluation.
// This is a protected read, not a decision or another persistence mechanism.
export async function readMentorDemandTrace({ supabase, id, audit = false }) {
  const demandQuery = await supabase.from('sessao').select('id,chave_mentor,origem,objetivo_id,materia_id,topico_id,material_id,tipo,data,data_planejada_original,duracao_estimada,status,reason_codes').eq('id', id).maybeSingle()
  if (demandQuery.error) throw demandQuery.error
  const demand = demandQuery.data
  if (!demand) return { estado: 'NAO_ENCONTRADA', explicacao: null }
  if (demand.origem === 'manual') return { estado: 'MANUAL', explicacao: 'Demanda adicionada manualmente.',
    ...(audit ? { demanda: demand, decisao: null, inputs_relevantes: [], policy_ref: null } : {}) }
  if (demand.origem !== 'mentor' || !demand.chave_mentor?.includes(':decision:')) return missing('LEGADO_SEM_VINCULO')
  const [key, decisionId, extra] = demand.chave_mentor.split(':decision:')
  if (extra !== undefined || !/^v2:\d{4}-\d{2}-\d{2}:\d+$/.test(key) || !decisionId) return missing('VINCULO_INCONSISTENTE')
  const evaluationId = decisionId.split(':')[0]
  const saved = await supabase.from('mentor_decisao').select('chave_operacao,dados,criado_em')
    .eq('chave_operacao', evaluationId).eq('tipo', 'avaliacao_mentor_v2').maybeSingle()
  if (saved.error) throw saved.error
  if (!saved.data) return missing('DECISAO_AUSENTE')
  const evaluation = saved.data.dados?.avaliacao
  const matches = Array.isArray(evaluation?.decisoes) ? evaluation.decisoes.filter((row) => row?.decisao_id === decisionId) : []
  if (saved.data.dados?.modelo !== 'MENTOR_V2' || evaluation?.versao_contrato !== MENTOR_V2_CONTRACT
    || evaluation.avaliacao_ref !== evaluationId || matches.length !== 1) return missing('VINCULO_INCONSISTENTE')
  const decision = matches[0]
  let original
  try {
    validateMentorV2Decision(decision)
    if (decision.tipo_decisao !== 'CRIAR_DEMANDA' || decision.parametros.chave_mentor !== key) return missing('VINCULO_INCONSISTENTE')
    original = materializeMentorWeek({ ...evaluation, decisoes: [decision] })[0]
  } catch { return missing('VINCULO_INCONSISTENTE') }
  // Moving, ordering and status changes do not change creation facts. A reason
  // cache mismatch is reported to audit, not used to fabricate a new explanation.
  if (['id', 'chave_mentor', 'objetivo_id', 'materia_id', 'topico_id', 'material_id', 'tipo', 'data_planejada_original', 'duracao_estimada']
    .some((field) => (demand[field] ?? null) !== (original[field] ?? null))) return missing('VINCULO_INCONSISTENTE')
  const summary = { estado: 'RASTREAVEL', explicacao: shortMentorDemandReason(decision) }
  if (!audit) return summary
  return { ...summary, versao_rastreio: 'mentor-v2-trace/1', demanda: demand,
    demanda_original: original, decisao: decision, inputs_relevantes: decision.evidencias_utilizadas,
    reason_codes: decision.reason_codes, policy_ref: decision.policy_ref, contexto_ref: decision.contexto_ref,
    avaliacao_ref: evaluation.avaliacao_ref, data_decisao: decision.registrada_em,
    instante_referencia: decision.instante_referencia, data_original: decision.alvo_temporal.data,
    data_atual: demand.data, registro_criado_em: saved.data.criado_em || null,
    divergencias: stableMentorJSON(demand.reason_codes) === stableMentorJSON(decision.reason_codes) ? [] : ['CACHE_REASON_CODES_DIVERGENTE'] }
}
