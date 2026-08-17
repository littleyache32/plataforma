export function cardTransition({ resultado, repeticoes = 0, intervaloDias = 0, fatorFacilidade = 2.5, lapsos = 0, now = Date.now() }) {
  const day = 24 * 60 * 60 * 1000
  const rating = resultado === 'revisar' ? 'novamente' : resultado === 'lembrei' ? 'bom' : resultado
  let nextRepetitions = repeticoes
  let nextInterval = Number(intervaloDias) || 0
  let nextEase = Number(fatorFacilidade) || 2.5
  let nextLapses = lapsos

  if (rating === 'novamente') {
    nextRepetitions = 0
    nextInterval = 10 / (24 * 60)
    nextEase = Math.max(1.3, nextEase - 0.2)
    nextLapses += 1
  } else if (rating === 'dificil') {
    nextRepetitions += 1
    nextInterval = Math.max(1, Math.round((nextInterval || 1) * 1.2))
    nextEase = Math.max(1.3, nextEase - 0.15)
  } else if (rating === 'facil') {
    nextRepetitions += 1
    nextInterval = nextInterval < 1 ? 4 : Math.max(4, Math.round(nextInterval * nextEase * 1.3))
    nextEase = Math.min(4, nextEase + 0.15)
  } else {
    nextRepetitions += 1
    nextInterval = nextInterval < 1 ? 1 : nextRepetitions === 2 ? 3 : Math.max(3, Math.round(nextInterval * nextEase))
  }

  return {
    repeticoes: nextRepetitions,
    intervaloDias: nextInterval,
    fatorFacilidade: Number(nextEase.toFixed(2)),
    lapsos: nextLapses,
    proximaRevisao: new Date(now + nextInterval * day).toISOString(),
  }
}

export function cardKey({ topicoId, explicacao }) {
  const normalized = String(explicacao || '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
  return `${topicoId}:${normalized}`
}

function normalizeText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function limitText(value, maximum) {
  const normalized = normalizeText(value)
  if (normalized.length <= maximum) return normalized
  return `${normalized.slice(0, maximum - 1).trimEnd()}…`
}

function explanationParts(value) {
  const normalized = normalizeText(value)
  const sentences = normalized.match(/[^.!?]+[.!?]?/g)?.map((item) => item.trim()).filter(Boolean) || []
  return {
    direct: limitText(sentences[0] || normalized, 280),
    short: limitText(sentences.slice(1, 3).join(' ') || sentences[0] || normalized, 480),
  }
}

export function shouldCreateQuestionCard({ resultado, classificacao }) {
  return resultado === 'erro' || classificacao === 'duvida' || classificacao === 'sem_conhecimento'
}

export function buildQuestionCard({ question, topicName }) {
  const explanation = explanationParts(question?.explicacao)
  const statement = limitText(question?.enunciado, 720)
  const context = normalizeText(topicName) || 'Conteúdo estudado'
  const answerLabel = question?.tipo === 'CE'
    ? question?.gabarito === 'C' ? 'Certo.' : 'Errado.'
    : `Alternativa ${normalizeText(question?.gabarito)}.`
  const directAnswer = limitText(`${answerLabel} ${explanation.direct}`, 320)

  return {
    frente: `[${context}] Qual regra ou conclusão resolve este item?\n${statement}`,
    verso: `${directAnswer}\n${explanation.short}`,
    respostaDireta: directAnswer,
    explicacaoCurta: explanation.short,
    dicaEscopo: 'Responda com a regra central em uma frase.',
    modeloCard: 'pergunta_resposta',
    tipoCard: 'correcao',
  }
}
