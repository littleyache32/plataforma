import { createHash } from 'node:crypto'
import { auditCard } from './card-quality.js'
import { auditQuestion, normalizeContent } from './question-quality.js'

const verbPattern = /\b(?:e|sao|representa|representam|consiste|consistem|corresponde|correspondem|abrange|abrangem|inclui|incluem|deve|devem|permite|permitem|exige|exigem|possui|possuem|pode|podem|pressupoe|pressupoem|decorre|decorrem)\b/i
const excludedPattern = /^(?:referencias|bibliografia|fontes|fonte|leitura complementar|conclusao|resumo do capitulo)\b/i

function cleanMarkdown(value) {
  return String(value || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[*_`~]/g, '')
    .replace(/^\s*(?:[-+]|\d+[.)])\s+/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sentenceParts(value) {
  const clean = cleanMarkdown(value)
  if (clean.length <= 420) return [clean]
  return clean.split(/(?<=[.!?;:])\s+(?=[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9])/u).map((item) => item.trim())
}

function usableClaim(value) {
  if (value.length < 45 || value.length > 520) return false
  if (excludedPattern.test(value)) return false
  if (/^(?:https?:\/\/|doi\b|isbn\b)/i.test(value)) return false
  if ((value.match(/[A-Za-zÀ-ÿ]/g) || []).length < 30) return false
  return /[.!?;:]$/.test(value) || verbPattern.test(normalizeContent(value))
}

function anchorFor(claim) {
  const normalized = cleanMarkdown(claim).replace(/^["“”']+|["“”']+$/g, '')
  const verb = normalizeContent(normalized).match(verbPattern)
  if (verb?.index > 8) {
    const sourceWords = normalized.split(/\s+/)
    const normalizedPrefix = normalizeContent(normalized).slice(0, verb.index)
    const count = Math.min(14, Math.max(2, normalizedPrefix.split(' ').length))
    return sourceWords.slice(0, count).join(' ').replace(/[,;:]$/, '')
  }
  return normalized.split(/\s+/).slice(0, 9).join(' ').replace(/[,;:]$/, '')
}

export function extractLearningUnits(markdown) {
  const units = []
  const seen = new Set()
  let section = 'Conceitos essenciais'
  let paragraph = []

  const add = (raw, original = raw) => {
    for (const claim of sentenceParts(raw)) {
      if (!usableClaim(claim)) continue
      const key = normalizeContent(claim)
      if (seen.has(key)) continue
      seen.add(key)
      units.push({ section, claim, evidence: cleanMarkdown(original).slice(0, 1400) })
    }
  }
  const flush = () => {
    if (paragraph.length) add(paragraph.join(' '), paragraph.join(' '))
    paragraph = []
  }

  for (const rawLine of String(markdown || '').split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) {
      flush()
      continue
    }
    const heading = line.match(/^#{1,6}\s+(.+)/)
    if (heading) {
      flush()
      const next = cleanMarkdown(heading[1])
      if (next && !excludedPattern.test(next)) section = next
      continue
    }
    if (/^\s*(?:[-+*]|\d+[.)])\s+/.test(rawLine)) {
      flush()
      add(line, line)
      continue
    }
    if (/^(?:---+|___+|\*\*\*+)$/.test(line)) continue
    paragraph.push(line)
  }
  flush()
  return units.filter((unit) => unit.evidence.length >= 40)
}

function negateClaim(claim) {
  const direct = claim.match(/\b(não|nao)\s+(é|e|são|sao|representa|representam|consiste|consistem|corresponde|correspondem|abrange|abrangem|inclui|incluem|deve|devem|permite|permitem|exige|exigem|possui|possuem|pode|podem)\b/i)
  if (direct) return `${claim.slice(0, direct.index)}${direct[2]}${claim.slice(direct.index + direct[0].length)}`
  const positive = claim.match(/\b(é|e|são|sao|representa|representam|consiste|consistem|corresponde|correspondem|abrange|abrangem|inclui|incluem|deve|devem|permite|permitem|exige|exigem|possui|possuem|pode|podem)\b/i)
  if (!positive) return null
  return `${claim.slice(0, positive.index)}não ${positive[0]}${claim.slice(positive.index + positive[0].length)}`
}

function cardFront(unit, topicName, variant = 0) {
  const anchor = anchorFor(unit.claim)
  const section = unit.section && unit.section !== 'Conceitos essenciais' ? unit.section : topicName
  if (variant === 0) return `O que o material estabelece sobre ${anchor} em ${section}?`
  if (variant === 1) return `Como deve ser compreendido ${anchor} no tópico ${topicName}?`
  return `Qual é a ideia essencial associada a ${anchor} em ${section}?`
}

export function buildTopicItems({ topic, knowledge, existingQuestions = [], existingCards = [], questionTarget = 30, cardTarget = 50 }) {
  const units = extractLearningUnits(knowledge.text)
  if (!units.length) throw new Error(`Nenhuma unidade aproveitável em ${topic.subject} > ${topic.name}.`)
  const source = String(knowledge.source || `${topic.subject} - material de estudo`).trim()
  const questionKeys = new Set(existingQuestions.map((item) => normalizeContent(item.enunciado)))
  const cardKeys = new Set(existingCards.map((item) => normalizeContent(item.frente)))
  const questions = []
  const cards = []
  const missingQuestions = Math.max(0, questionTarget - existingQuestions.length)
  const missingCards = Math.max(0, cardTarget - existingCards.length)

  for (let cycle = 0; questions.length < missingQuestions && cycle < units.length * 3; cycle += 1) {
    const unit = units[cycle % units.length]
    const falseItem = cycle % 2 === 1 ? negateClaim(unit.claim) : null
    const claim = falseItem || unit.claim
    const statement = `Julgue o item a seguir, relativo a ${topic.name}: ${claim}`
    const key = normalizeContent(statement)
    if (questionKeys.has(key)) continue
    const question = {
      topico_id: topic.id,
      tipo: 'CE',
      enunciado: statement,
      alternativas: null,
      gabarito: falseItem ? 'E' : 'C',
      explicacao: `O material de estudo registra: "${unit.claim}"`,
      fonte: source,
      trecho_fonte: unit.evidence,
      origem: 'material',
      dificuldade: cycle % 5 === 4 ? 2 : 1,
      versao_conhecimento: knowledge.version || null,
    }
    const audit = auditQuestion(question, false)
    if (!audit.approved) continue
    questionKeys.add(key)
    questions.push({ ...question, audit })
  }

  for (let cycle = 0; cards.length < missingCards && cycle < units.length * 4; cycle += 1) {
    const unit = units[cycle % units.length]
    const variant = Math.floor(cycle / units.length)
    const front = cardFront(unit, topic.name, variant)
    const key = normalizeContent(front)
    if (cardKeys.has(key)) continue
    const card = {
      objetivo_id: topic.objectiveId,
      materia_id: topic.subjectId,
      topico_id: topic.id,
      chave: createHash('sha256').update(`${topic.id}|${key}`).digest('hex'),
      frente: front,
      verso: unit.claim,
      fonte: source,
      trecho_fonte: unit.evidence,
      dificuldade: cycle % 10 === 9 ? 4 : cycle % 3 === 2 ? 3 : 2,
      versao_conhecimento: knowledge.version || null,
    }
    const audit = auditCard(card, false)
    if (!audit.approved) continue
    cardKeys.add(key)
    cards.push({ ...card, tipo_card: audit.tipoCard, audit })
  }

  if (questions.length !== missingQuestions || cards.length !== missingCards) {
    throw new Error(`${topic.subject} > ${topic.name}: gerados ${questions.length}/${missingQuestions} questões e ${cards.length}/${missingCards} cards; material insuficiente para completar com unicidade.`)
  }
  return { questions, cards, units: units.length }
}
