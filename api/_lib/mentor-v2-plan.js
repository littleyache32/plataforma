import { createHash } from 'node:crypto'
import { validateMentorV2Decision, MENTOR_V2_CONTRACT } from '../../shared/mentor-v2-policy.js'

const TYPE = { ESTUDO: 'estudo', QUESTOES: 'exercicio', QUESTION_CARDS: 'especial', REVISAO: 'revisao' }
// A stable identity is independent of evaluation time, material and manual moves.
export function mentorDemandId(key) {
  const hex = createHash('sha256').update(`mentor-v2-demand:${key}`).digest('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`
}

export function materializeMentorWeek(evaluation) {
  if (evaluation?.versao_contrato !== MENTOR_V2_CONTRACT || !['DECISOES_EMITIDAS', 'SEM_ALTERACAO'].includes(evaluation.resultado)
    || !Array.isArray(evaluation.decisoes)) throw new Error('Avaliação não aplicável ao plano.')
  evaluation.decisoes.forEach(validateMentorV2Decision)
  const decisions = evaluation.decisoes.filter((row) => row.tipo_decisao === 'CRIAR_DEMANDA')
  const keys = new Set()
  return decisions.map((decision) => {
    const key = decision.parametros.chave_mentor
    if (keys.has(key) || decision.avaliacao_ref !== evaluation.avaliacao_ref
      || decision.policy_ref.id !== evaluation.policy_ref?.id || decision.policy_ref.versao !== evaluation.policy_ref?.versao
      || decision.alvo_temporal.semana_inicio !== evaluation.alvo_temporal?.semana_inicio) throw new Error('Origem de demanda inválida ou duplicada.')
    keys.add(key)
    // The stable PK protects a slot across evaluations. The original decision is
    // retained in the immutable creation key, without changing the reasons array.
    return { id: mentorDemandId(key), chave_mentor: `${key}:decision:${decision.decisao_id}`, origem: 'mentor', status: 'planejada',
      objetivo_id: decision.objetivo_id, materia_id: decision.materia_id, topico_id: decision.topico_id,
      material_id: decision.alvos_relacionados.find((row) => row.entidade === 'material')?.id || null,
      titulo: decision.parametros.titulo, tipo: TYPE[decision.tipo_atividade], data: decision.alvo_temporal.data,
      data_planejada_original: decision.alvo_temporal.data, duracao_estimada: decision.duracao_minutos,
      prioridade: decision.prioridade.ordem_relativa, ordem: decision.parametros.ordem,
      reason_codes: decision.reason_codes }
  })
}

// Insert-only application. Existing rows, including tombstones and user edits,
// never become upsert UPDATEs. Database unique keys also serialize duplicate inserts.
export async function applyMentorWeekV2({ supabase, evaluation }) {
  const rows = materializeMentorWeek(evaluation)
  if (!rows.length) return { criadas: 0, atualizadas: 0, removidas: 0, demandas: [] }
  const result = await supabase.from('sessao').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }).select('id,chave_mentor')
  if (result.error) throw result.error
  if (!Array.isArray(result.data)) throw new Error('Banco não confirmou as demandas criadas.')
  return { criadas: result.data.length, atualizadas: 0, removidas: 0, demandas: result.data.map((row) => ({
    id: row.id, chave_mentor: row.chave_mentor,
    decisao_id: evaluation.decisoes.find((decision) => decision.tipo_decisao === 'CRIAR_DEMANDA' && mentorDemandId(decision.parametros.chave_mentor) === row.id)?.decisao_id,
    avaliacao_ref: evaluation.avaliacao_ref,
  })) }
}
