// UI projection only: no scores, policy choices or invented retention claims.
export function shortMentorDemandReason(decision) {
  const codes = new Set(decision.reason_codes || [])
  if (codes.has('CONFIRMED_DEADLINE')) return 'Preparação para um compromisso previsto.'
  if (codes.has('MATERIAL_IN_PROGRESS')) return 'Continuidade do material em andamento.'
  if (codes.has('CURRICULUM_CONTINUITY')) return 'Continuidade curricular da disciplina.'
  if (codes.has('REVIEW_NEED')) return 'Revisão programada para este conteúdo.'
  if (decision.tipo_atividade === 'QUESTOES') return 'Prática de questões prevista para a semana.'
  if (decision.tipo_atividade === 'QUESTION_CARDS') return 'Recuperação ativa prevista para a semana.'
  return 'Estudo previsto no plano semanal.'
}
