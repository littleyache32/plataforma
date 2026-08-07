export function practiceTransition({ resultado, classificacao, tentativas = 0, now = Date.now() }) {
  const attempts = tentativas + 1
  const day = 24 * 60 * 60 * 1000
  const falseCertainty = resultado === 'erro' && classificacao === 'certeza'
  const mastered = resultado === 'acerto' && classificacao === 'certeza' && attempts >= 3

  if (falseCertainty) return { estado: 'revisao', proximaRevisao: new Date(now).toISOString(), motivo: 'falsa_certeza', prioridade: 1 }
  if (resultado === 'erro') return { estado: 'revisao', proximaRevisao: new Date(now + day).toISOString(), motivo: classificacao === 'sem_conhecimento' ? 'baixa_confianca' : 'erro', prioridade: 2 }
  if (classificacao !== 'certeza') return { estado: 'revisao', proximaRevisao: new Date(now + 2 * day).toISOString(), motivo: 'checagem', prioridade: 3 }
  return {
    estado: mastered ? 'dominada' : 'aprendendo',
    proximaRevisao: new Date(now + (mastered ? 14 : 7) * day).toISOString(),
    motivo: null,
    prioridade: null,
  }
}

export function selectPracticeQuestion(questions, now = Date.now()) {
  return [...questions].sort((a, b) => {
    const dueA = a.proxima_revisao && new Date(a.proxima_revisao).getTime() <= now ? 0 : 1
    const dueB = b.proxima_revisao && new Date(b.proxima_revisao).getTime() <= now ? 0 : 1
    if (dueA !== dueB) return dueA - dueB
    if (a.quantidade_tentativas !== b.quantidade_tentativas) return a.quantidade_tentativas - b.quantidade_tentativas
    return new Date(a.ultima_resolucao || 0) - new Date(b.ultima_resolucao || 0)
  })[0] || null
}

