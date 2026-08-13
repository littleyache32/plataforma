export const BACEN_PRACTICE_START = '2026-08-31'

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
