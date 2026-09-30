export const BACEN_PRACTICE_START = '2026-08-31'

export async function currentPracticeFlags(supabase) {
  const { data, error } = await supabase.from('mentor_contexto').select('fase,dados').eq('id', 1).single()
  if (error) throw error
  const flags = data?.dados?.rotina_pratica || {}
  if (data?.fase === 'adaptacao_teorica_1') {
    return { questoes: flags.questoes === true, question_cards: flags.question_cards === true, revisao_pratica: flags.revisao_pratica === true, simulados: flags.simulados === true }
  }
  return { questoes: true, question_cards: true, revisao_pratica: true, simulados: true }
}

export function isBacenPracticeOpen(today) {
  return String(today || '') >= BACEN_PRACTICE_START
}

export function allowedStudiedTopics(topicIds, completedTopicIds) {
  const completed = new Set((completedTopicIds || []).filter(Boolean))
  return [...new Set((topicIds || []).filter((id) => completed.has(id)))]
}

export function canAccessBacenItem({ today, topicId, completedTopicIds = [], previouslyAttempted = false }) {
  if (!isBacenPracticeOpen(today)) return false
  return previouslyAttempted || completedTopicIds.includes(topicId)
}
