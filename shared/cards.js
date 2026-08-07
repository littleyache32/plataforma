const reviewDays = [3, 7, 14, 30]

export function cardTransition({ resultado, repeticoes = 0, now = Date.now() }) {
  const day = 24 * 60 * 60 * 1000
  if (resultado === 'revisar') return { repeticoes: 0, proximaRevisao: new Date(now + day).toISOString() }
  const nextRepetitions = repeticoes + 1
  const days = reviewDays[Math.min(nextRepetitions - 1, reviewDays.length - 1)]
  return { repeticoes: nextRepetitions, proximaRevisao: new Date(now + days * day).toISOString() }
}

export function cardKey({ topicoId, explicacao }) {
  const normalized = String(explicacao || '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
  return `${topicoId}:${normalized}`
}
