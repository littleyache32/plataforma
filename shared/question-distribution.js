const normalizedNumber = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback

export function allocateDisciplineQuestions({ topics = [], total = 0, currentCounts = {}, subjectWeight = 1 }) {
  const quantity = Math.max(0, Math.floor(normalizedNumber(total)))
  const ordered = [...topics]
    .filter((topic) => topic?.id)
    .sort((left, right) => String(left.nome || '').localeCompare(String(right.nome || ''), 'pt-BR') || String(left.id).localeCompare(String(right.id)))
  const allocations = Object.fromEntries(ordered.map((topic) => [topic.id, 0]))

  for (let index = 0; index < quantity && ordered.length; index += 1) {
    const selected = ordered.reduce((best, topic) => {
      const incidence = Math.max(0, normalizedNumber(topic.incidencia))
      const stock = Math.max(0, normalizedNumber(currentCounts[topic.id])) + allocations[topic.id]
      const score = (0.15 + Math.max(0, normalizedNumber(subjectWeight, 1)) * incidence) / (stock + 1)
      if (!best || score > best.score) return { topic, score }
      return best
    }, null)?.topic
    if (selected) allocations[selected.id] += 1
  }

  return ordered.map((topic) => ({ ...topic, quantidade: allocations[topic.id] })).filter((topic) => topic.quantidade > 0)
}
