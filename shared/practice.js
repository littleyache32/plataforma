export function practiceTransition({ resultado, classificacao, tentativas = 0, intervaloDias = 0, fatorFacilidade = 2.5, lapsos = 0, acertosSeguidos, now = Date.now() }) {
  const attempts = tentativas + 1
  const day = 24 * 60 * 60 * 1000
  const falseCertainty = resultado === 'erro' && classificacao === 'certeza'
  let interval = Number(intervaloDias) || 0
  let ease = Number(fatorFacilidade) || 2.5
  let nextLapses = Number(lapsos) || 0
  let streak = acertosSeguidos == null ? Number(tentativas) || 0 : Number(acertosSeguidos) || 0

  if (resultado === 'erro') {
    nextLapses += 1
    streak = 0
    ease = Math.max(1.3, ease - (falseCertainty ? 0.25 : 0.18))
    interval = falseCertainty ? 0 : classificacao === 'sem_conhecimento' ? 1 : 2
  } else {
    streak += 1
    const confidenceFactor = classificacao === 'certeza' ? 1 : classificacao === 'eliminacao' ? 0.72 : 0.45
    if (interval < 1) interval = classificacao === 'certeza' ? 3 : 1
    else interval = Math.max(1, Math.round(interval * ease * confidenceFactor))
    if (classificacao === 'certeza') ease = Math.min(4, ease + 0.05)
    else ease = Math.max(1.3, ease - 0.05)
  }
  const mastered = resultado === 'acerto' && classificacao === 'certeza' && streak >= 3 && interval >= 14
  const schedule = {
    intervaloDias: interval,
    fatorFacilidade: Number(ease.toFixed(2)),
    lapsos: nextLapses,
    acertosSeguidos: streak,
  }

  if (falseCertainty) return { ...schedule, estado: 'revisao', proximaRevisao: new Date(now).toISOString(), motivo: 'falsa_certeza', prioridade: 1 }
  if (resultado === 'erro') return { ...schedule, estado: 'revisao', proximaRevisao: new Date(now + interval * day).toISOString(), motivo: classificacao === 'sem_conhecimento' ? 'baixa_confianca' : 'erro', prioridade: 2 }
  if (classificacao !== 'certeza') return { ...schedule, estado: 'revisao', proximaRevisao: new Date(now + interval * day).toISOString(), motivo: 'checagem', prioridade: 3 }
  return {
    ...schedule,
    estado: mastered ? 'dominada' : 'aprendendo',
    proximaRevisao: new Date(now + interval * day).toISOString(),
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

export function shouldShowExplanation({ resultado, classificacao }) {
  return resultado === 'erro' || classificacao === 'duvida' || classificacao === 'sem_conhecimento'
}

