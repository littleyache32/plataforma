import { createHash } from 'node:crypto'
import { auditCard } from './card-quality.js'
import { auditQuestion, normalizeContent } from './question-quality.js'

const verbPattern = /\b(?:e|sao|representa|representam|consiste|consistem|corresponde|correspondem|abrange|abrangem|inclui|incluem|deve|devem|permite|permitem|exige|exigem|possui|possuem|pode|podem|pressupoe|pressupoem|decorre|decorrem)\b/i
const excludedPattern = /^(?:referencias|bibliografia|fontes|fonte|leitura complementar|conclusao|resumo do capitulo)\b/i
const questionLeads = ['Com base no material de estudo', 'À luz do conteúdo apresentado', 'Segundo a referência vinculada', 'No contexto conceitual do tópico', 'Considerando a formulação didática', 'A partir da evidência apresentada', 'Conforme a sistematização do conteúdo', 'No âmbito da disciplina', 'Tendo em vista o fundamento indicado', 'Com apoio no trecho de referência']
const questionFocus = ['quanto ao conceito central', 'quanto ao alcance da afirmação', 'em relação ao fundamento estudado', 'sobre a definição apresentada', 'a respeito da regra examinada', 'quanto à compreensão do conteúdo']
const cardLeads = ['O que o material estabelece sobre', 'Como deve ser compreendido', 'Qual é a ideia essencial associada a', 'Que regra se relaciona a', 'Qual fundamento explica', 'Como o conteúdo define', 'O que precisa ser lembrado sobre', 'Qual afirmação resume', 'Como se identifica', 'Que conclusão decorre de']
const cardFocus = ['no tópico', 'no contexto de', 'na revisão de', 'segundo a seção', 'conforme o estudo de']

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
  if (clean.length <= 420 && !/[.!?;:].+[.!?;:]/.test(clean)) return [clean]
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
    if (!line) { flush(); continue }
    const heading = line.match(/^#{1,6}\s+(.+)/)
    if (heading) {
      flush()
      const next = cleanMarkdown(heading[1])
      if (next && !excludedPattern.test(next)) section = next
      continue
    }
    if (/^\s*(?:[-+*]|\d+[.)])\s+/.test(rawLine)) { flush(); add(line, line); continue }
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
  const lead = cardLeads[variant % cardLeads.length]
  const focus = cardFocus[Math.floor(variant / cardLeads.length) % cardFocus.length]
  return `${lead} ${anchor} ${focus} ${section || topicName}?`
}

function cardAnswer(claim) {
  const clean = cleanMarkdown(claim)
  if (clean.length <= 240) return clean

  const clauses = clean
    .split(/(?<=[.;:])\s+|,\s+(?=(?:que|quando|porque|pois|mas|porém|contudo|logo|portanto)\b)/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 24)
  const complete = clauses.find((item) => item.length <= 240)
  if (complete) return /[.!?;:]$/.test(complete) ? complete : `${complete}.`

  const boundary = clean.slice(0, 236).lastIndexOf(' ')
  return `${clean.slice(0, boundary > 80 ? boundary : 236).replace(/[,;:]$/, '')}.`
}

function difficultyGroup(value) {
  const level = Number(value)
  return level <= 2 ? 'easy' : level === 3 ? 'medium' : 'hard'
}

function buildQuestion(unit, secondUnit, topic, source, knowledgeVersion, difficulty, cycle) {
  const lead = questionLeads[cycle % questionLeads.length]
  const focus = questionFocus[Math.floor(cycle / questionLeads.length) % questionFocus.length]
  const firstFalse = cycle % 2 === 1 ? negateClaim(unit.claim) : null
  const firstClaim = firstFalse || unit.claim
  let claim = firstClaim
  let evidence = unit.evidence
  let explanation = `O material de estudo registra: "${unit.claim}"`
  let falseItem = Boolean(firstFalse)
  if (difficulty === 'hard' && secondUnit) {
    const secondFalse = cycle % 3 === 2 ? negateClaim(secondUnit.claim) : null
    claim = `${firstClaim} Além disso, ${secondFalse || secondUnit.claim}`
    evidence = `${unit.evidence}\n\n${secondUnit.evidence}`.slice(0, 2600)
    explanation = `A análise conjunta depende destes fundamentos do material: "${unit.claim}" e "${secondUnit.claim}"`
    falseItem = falseItem || Boolean(secondFalse)
  }
  const depth = difficulty === 'easy' ? 'em formulação direta' : difficulty === 'medium' ? 'em análise intermediária' : 'em análise integrada'
  return {
    topico_id: topic.id,
    tipo: 'CE',
    enunciado: `${lead}, ${focus} e ${depth}, julgue a proposição relativa a ${topic.name}: ${claim}`,
    alternativas: null,
    gabarito: falseItem ? 'E' : 'C',
    explicacao: explanation,
    fonte: source,
    trecho_fonte: evidence,
    origem: 'material',
    dificuldade: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 3 : 5,
    versao_conhecimento: knowledgeVersion || null,
  }
}

export function buildTopicItems({ topic, knowledge, existingQuestions = [], existingCards = [], questionTarget = 30, cardTarget = 50, difficultyTargets = null }) {
  const units = extractLearningUnits(knowledge.text)
  if (!units.length) throw new Error(`Nenhuma unidade aproveitável em ${topic.subject} > ${topic.name}.`)
  const source = String(knowledge.source || `${topic.subject} - material de estudo`).trim()
  const questionKeys = new Set(existingQuestions.map((item) => normalizeContent(item.enunciado)))
  const cardKeys = new Set(existingCards.map((item) => normalizeContent(item.frente)))
  const questions = []
  const cards = []
  const targetByDifficulty = difficultyTargets || { easy: questionTarget, medium: 0, hard: 0 }
  const existingByDifficulty = Object.fromEntries(['easy', 'medium', 'hard'].map((group) => [group, existingQuestions.filter((item) => difficultyGroup(item.dificuldade) === group).length]))
  const missingByDifficulty = difficultyTargets
    ? Object.fromEntries(['easy', 'medium', 'hard'].map((group) => [group, Math.max(0, Number(targetByDifficulty[group] || 0) - existingByDifficulty[group])]))
    : { easy: Math.max(0, questionTarget - existingQuestions.length), medium: 0, hard: 0 }
  const missingQuestions = Object.values(missingByDifficulty).reduce((sum, value) => sum + value, 0)
  const missingCards = Math.max(0, cardTarget - existingCards.length)

  for (const difficulty of ['easy', 'medium', 'hard']) {
    const target = missingByDifficulty[difficulty]
    let generated = 0
    for (let cycle = 0; generated < target && cycle < Math.max(1200, units.length * 240); cycle += 1) {
      const unit = units[cycle % units.length]
      const secondUnit = units[(cycle * 7 + 3) % units.length]
      const question = buildQuestion(unit, secondUnit, topic, source, knowledge.version, difficulty, cycle)
      const key = normalizeContent(question.enunciado)
      if (questionKeys.has(key)) continue
      const audit = auditQuestion(question, false)
      if (!audit.approved) continue
      questionKeys.add(key)
      questions.push({ ...question, audit })
      generated += 1
    }
  }

  for (let cycle = 0; cards.length < missingCards && cycle < Math.max(1000, units.length * 180); cycle += 1) {
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
      verso: cardAnswer(unit.claim),
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
