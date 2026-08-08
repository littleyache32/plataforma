import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { generateJson, researchWithGrounding } from '../api/_lib/gemini.js'
import { librarySpecs } from './acervo-specs.js'

const args = new Set(process.argv.slice(2))
const generate = args.has('--generate')
const apply = args.has('--apply')
const force = args.has('--force')
const limitArg = [...args].find((item) => item.startsWith('--limit='))
const limit = limitArg ? Math.max(1, Number(limitArg.split('=')[1])) : Infinity
const cacheDir = path.resolve('tmp', 'acervo-cache')
const questionAmount = 15
const cardAmount = 6
const waitMs = 4300

const letters = ['A', 'B', 'C', 'D', 'E']
const questionSchema = {
  type: 'object', additionalProperties: false, required: ['questoes', 'cards'], properties: {
    questoes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tipo', 'enunciado', 'alternativas', 'gabarito', 'explicacao', 'evidencia_id', 'dificuldade'], properties: {
      tipo: { type: 'string', enum: ['CE', 'ME'] }, enunciado: { type: 'string' },
      alternativas: { anyOf: [{ type: 'null' }, { type: 'object', required: letters, additionalProperties: false, properties: Object.fromEntries(letters.map((letter) => [letter, { type: 'string' }])) }] },
      gabarito: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] }, explicacao: { type: 'string' }, evidencia_id: { type: 'integer' }, dificuldade: { type: 'integer', minimum: 1, maximum: 5 },
    } } },
    cards: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['frente', 'verso', 'evidencia_id'], properties: { frente: { type: 'string' }, verso: { type: 'string' }, evidencia_id: { type: 'integer' } } } },
  },
}

function slug(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function loadCache(file) {
  try { return JSON.parse(await readFile(file, 'utf8')) } catch { return null }
}

async function saveCache(file, data) {
  await writeFile(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
}

async function withRetry(label, operation) {
  let lastError
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const result = await operation()
      await sleep(waitMs)
      return result
    } catch (error) {
      lastError = error
      const message = String(error?.message || error)
      if (attempt === 5 || !/429|quota|rate|temporar|503|json/i.test(message)) throw error
      const delay = Math.min(60_000, 8_000 * attempt)
      console.log(JSON.stringify({ etapa: label, tentativa: attempt, aguardando_ms: delay, erro: message.slice(0, 180) }))
      await sleep(delay)
    }
  }
  throw lastError
}

function evidenceBlocks(chapter) {
  const paragraphs = String(chapter || '').split(/\n\s*\n/).map((item) => item.replace(/^#{1,4}\s+/gm, '').replace(/^[-*]\s+/gm, '').trim()).filter((item) => item.length >= 80)
  const blocks = []
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 1600) blocks.push(paragraph)
    else {
      const sentences = paragraph.split(/(?<=[.!?])\s+/)
      let current = ''
      for (const sentence of sentences) {
        if (`${current} ${sentence}`.length > 1500 && current) { blocks.push(current); current = sentence } else current = `${current} ${sentence}`.trim()
      }
      if (current) blocks.push(current)
    }
  }
  return blocks.slice(0, 35).map((texto, index) => ({ id: index + 1, texto }))
}

function cleanChapter(text, subject, topic) {
  const body = String(text || '').trim().replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '')
  if (body.length < 5000) throw new Error(`Capitulo curto demais: ${subject} / ${topic}`)
  return body
}

function validateTraining(data, evidence, subject, topic) {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]))
  const seenQuestions = new Set()
  const questions = []
  for (const raw of data.questoes || []) {
    const type = String(raw.tipo || '').toUpperCase()
    const answer = String(raw.gabarito || '').toUpperCase()
    const linked = evidenceById.get(Number(raw.evidencia_id))
    const statement = String(raw.enunciado || '').trim()
    const key = normalize(statement)
    if (!linked || !statement || seenQuestions.has(key) || !['CE', 'ME'].includes(type)) continue
    if (type === 'CE' && !['C', 'E'].includes(answer)) continue
    if (type === 'ME' && (!letters.includes(answer) || letters.some((letter) => !String(raw.alternativas?.[letter] || '').trim()))) continue
    seenQuestions.add(key)
    questions.push({ tipo: type, enunciado: statement, alternativas: type === 'CE' ? null : Object.fromEntries(letters.map((letter) => [letter, String(raw.alternativas[letter]).trim()])), gabarito: answer, explicacao: String(raw.explicacao || '').trim(), evidencia_id: linked.id, dificuldade: Math.min(5, Math.max(1, Number(raw.dificuldade) || 3)) })
  }
  const seenCards = new Set()
  const cards = []
  for (const raw of data.cards || []) {
    const linked = evidenceById.get(Number(raw.evidencia_id))
    const front = String(raw.frente || '').trim()
    const back = String(raw.verso || '').trim()
    const key = normalize(front)
    if (!linked || !front || !back || seenCards.has(key)) continue
    seenCards.add(key)
    cards.push({ frente: front, verso: back, evidencia_id: linked.id })
  }
  if (questions.length < 12 || questions.filter((item) => item.tipo === 'CE').length < 8 || questions.filter((item) => item.tipo === 'ME').length < 3) throw new Error(`Lote insuficiente ou fora do formato: ${subject} / ${topic}`)
  if (cards.length < 4) throw new Error(`Cards insuficientes: ${subject} / ${topic}`)
  return { questions: questions.slice(0, questionAmount), cards: cards.slice(0, cardAmount) }
}

function chapterPrompt(spec, topicName, scope) {
  const audience = spec.type === 'concurso' ? 'candidato ao cargo de Técnico do Banco Central, Área 1, em padrão Cebraspe' : 'estudante do segundo semestre do curso de Direito'
  return `Produza um capítulo de apostila autossuficiente em português do Brasil.
Público: ${audience}.
Disciplina: ${spec.subject}.
Capítulo: ${topicName}.
Escopo obrigatório: ${scope}
Base curricular: ${spec.basis}

Requisitos:
1. O texto deve permitir estudo sem depender de links externos, aulas ou outro livro.
2. Explique conceitos, fundamentos, classificações, elementos, relações, exceções, consequências e aplicações.
3. Inclua exemplos apenas explicativos. Não inclua perguntas, exercícios, questões, testes ou gabaritos.
4. Em Direito, use legislação vigente em 7 de agosto de 2026, indique mudanças relevantes e não ensine norma revogada como vigente.
5. No BACEN, cubra integralmente o recorte do edital e destaque armadilhas conceituais comuns da banca sem criar questões.
6. Use linguagem didática, precisa e progressiva. Defina termos antes de aprofundar.
7. Estruture em Markdown com: visão geral, fundamentos, desenvolvimento minucioso, classificações ou etapas, exemplos explicativos, comparações importantes, erros comuns, síntese final e referências normativas ou bibliográficas.
8. Escreva entre 1.600 e 2.400 palavras. Evite introduções genéricas e repetição.
9. Pesquise prioritariamente fontes oficiais, legislação, manuais institucionais e bibliografia acadêmica confiável. Não invente decisões, artigos, números ou citações.`
}

function trainingPrompt(spec, topicName, evidence) {
  const blocks = evidence.map((item) => `[EVIDÊNCIA ${item.id}]\n${item.texto}`).join('\n\n')
  const style = spec.type === 'concurso'
    ? `Crie ${questionAmount} questões inéditas em estilo Cebraspe: 10 ou 11 itens CE e 4 ou 5 itens ME com alternativas A a E. Misture dificuldades 2, 3, 4 e 5, com predominância 3 e 4.`
    : `Crie ${questionAmount} questões acadêmicas inéditas: use CE e ME com cinco alternativas, casos curtos e dificuldade compatível com graduação em Direito.`
  return `${style}
Crie também ${cardAmount} Question Cards iniciais de recuperação ativa, atômicos e sem duplicidade.
Disciplina: ${spec.subject}. Tópico: ${topicName}.

Use somente as evidências numeradas. Cada questão e cada card deve apontar um único evidencia_id que sustente diretamente a resposta. Em CE, alternativas é null e o gabarito é C ou E. Em ME, há exatamente uma alternativa correta. Distribua os gabaritos ME entre A, B, C, D e E. Toda explicação deve justificar a correta e, quando útil, o erro central das demais. Os cards não devem copiar o enunciado das questões e devem cobrar um conceito essencial por vez.

${blocks}`
}

async function generateLibrary() {
  await mkdir(cacheDir, { recursive: true })
  let processed = 0
  for (const spec of librarySpecs) {
    for (const [topicName, scope] of spec.topics) {
      if (processed >= limit) return
      processed += 1
      const file = path.join(cacheDir, `${slug(spec.objective)}__${slug(spec.subject)}__${slug(topicName)}.json`)
      let cached = force ? null : await loadCache(file)
      if (!cached?.chapter) {
        console.log(JSON.stringify({ progresso: `${processed}/${Math.min(limit, librarySpecs.reduce((sum, item) => sum + item.topics.length, 0))}`, etapa: 'apostila', materia: spec.subject, topico: topicName }))
        const result = await withRetry('apostila', () => researchWithGrounding(chapterPrompt(spec, topicName, scope)))
        cached = { objective: spec.objective, type: spec.type, subject: spec.subject, basis: spec.basis, topic: topicName, scope, chapter: cleanChapter(result.texto, spec.subject, topicName), sources: result.fontes || [], generatedAt: new Date().toISOString() }
        await saveCache(file, cached)
      }
      if (!cached.questions?.length || !cached.cards?.length) {
        const evidence = evidenceBlocks(cached.chapter)
        if (evidence.length < 5) throw new Error(`Poucas evidencias no capitulo ${spec.subject} / ${topicName}`)
        console.log(JSON.stringify({ progresso: `${processed}/${Math.min(limit, librarySpecs.reduce((sum, item) => sum + item.topics.length, 0))}`, etapa: 'questoes_cards', materia: spec.subject, topico: topicName }))
        const result = await withRetry('questoes_cards', () => generateJson({ prompt: trainingPrompt(spec, topicName, evidence), schema: questionSchema }))
        const training = validateTraining(result, evidence, spec.subject, topicName)
        cached = { ...cached, evidence, questions: training.questions, cards: training.cards, completedAt: new Date().toISOString() }
        await saveCache(file, cached)
      }
    }
  }
}

async function readDataset() {
  const chapters = []
  for (const spec of librarySpecs) {
    for (const [topicName] of spec.topics) {
      const file = path.join(cacheDir, `${slug(spec.objective)}__${slug(spec.subject)}__${slug(topicName)}.json`)
      const cached = await loadCache(file)
      if (cached?.chapter && cached?.questions?.length && cached?.cards?.length) chapters.push(cached)
    }
  }
  return chapters
}

function sourceLabel(chapter) {
  const first = chapter.sources?.find((item) => item.url)
  return first ? `${first.titulo}: ${first.url}` : `${chapter.subject} - apostila completa, ${chapter.basis}`
}

async function applyDataset(chapters) {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('Supabase nao configurado.')
  const supabase = createClient(url, key, { auth: { persistSession: false } })
  const { data: objectives, error: catalogError } = await supabase.from('objetivo').select('id,nome,materias:materia(id,nome,topicos:topico(id,nome))').eq('ativo', true)
  if (catalogError) throw catalogError

  for (const spec of librarySpecs) {
    const objective = objectives.find((item) => item.nome === spec.objective)
    const subject = objective?.materias?.find((item) => item.nome === spec.subject)
    if (!objective || !subject) throw new Error(`Catalogo ausente: ${spec.objective} / ${spec.subject}`)
    const subjectChapters = chapters.filter((item) => item.objective === spec.objective && item.subject === spec.subject)
    if (!subjectChapters.length) continue

    const topicIds = new Map((subject.topicos || []).map((item) => [item.nome, item.id]))
    for (const chapter of subjectChapters) {
      if (topicIds.has(chapter.topic)) continue
      const { data, error } = await supabase.from('topico').insert({ materia_id: subject.id, nome: chapter.topic }).select('id').single()
      if (error) throw error
      topicIds.set(chapter.topic, data.id)
    }

    const materialName = `Apostila completa - ${spec.subject}`
    const content = subjectChapters.map((chapter, index) => `# ${index + 1}. ${chapter.topic}\n\n${chapter.chapter}\n\n## Fontes verificadas deste capítulo\n${(chapter.sources || []).map((source) => `- ${source.titulo}: ${source.url}`).join('\n') || `- ${chapter.basis}`}`).join('\n\n---\n\n')
    const { data: existingMaterial, error: materialFindError } = await supabase.from('material').select('id').eq('materia_id', subject.id).eq('nome', materialName).maybeSingle()
    if (materialFindError) throw materialFindError
    const materialPayload = { objetivo_id: objective.id, materia_id: subject.id, tipo: 'texto', nome: materialName, conteudo: content, status: 'aceito', motivo: 'Apostila produzida por programa curricular, com fontes verificadas e revisão estrutural.', forcado: false }
    const materialResult = existingMaterial ? await supabase.from('material').update(materialPayload).eq('id', existingMaterial.id).select('id').single() : await supabase.from('material').insert(materialPayload).select('id').single()
    if (materialResult.error) throw materialResult.error
    const materialId = materialResult.data.id

    for (const chapter of subjectChapters) {
      const topicId = topicIds.get(chapter.topic)
      const origin = `acervo-completo:${slug(chapter.topic)}`
      const knowledgePayload = { materia_id: subject.id, topico_id: topicId, trecho: chapter.chapter, origem: origin, material_id: materialId }
      const { data: existingKnowledge, error: knowledgeFindError } = await supabase.from('conhecimento').select('id').eq('material_id', materialId).eq('origem', origin).maybeSingle()
      if (knowledgeFindError) throw knowledgeFindError
      const knowledgeResult = existingKnowledge ? await supabase.from('conhecimento').update(knowledgePayload).eq('id', existingKnowledge.id) : await supabase.from('conhecimento').insert(knowledgePayload)
      if (knowledgeResult.error) throw knowledgeResult.error

      const evidenceById = new Map(chapter.evidence.map((item) => [item.id, item.texto]))
      const { data: existingQuestions, error: questionFindError } = await supabase.from('questao').select('id,enunciado').eq('topico_id', topicId)
      if (questionFindError) throw questionFindError
      const existingQuestionKeys = new Set((existingQuestions || []).map((item) => normalize(item.enunciado)))
      const questionRows = chapter.questions.filter((item) => !existingQuestionKeys.has(normalize(item.enunciado))).map((item) => ({ topico_id: topicId, tipo: item.tipo, enunciado: item.enunciado, alternativas: item.alternativas, gabarito: item.gabarito, explicacao: item.explicacao, fonte: sourceLabel(chapter), trecho_fonte: evidenceById.get(item.evidencia_id), origem: 'ia', dificuldade: item.dificuldade }))
      if (questionRows.length) {
        const { error } = await supabase.from('questao').insert(questionRows)
        if (error) throw error
      }

      const cardRows = chapter.cards.map((item) => ({ objetivo_id: objective.id, materia_id: subject.id, topico_id: topicId, chave: hash(`${objective.id}|${topicId}|${normalize(item.frente)}`), frente: item.frente, verso: item.verso, fonte: sourceLabel(chapter), trecho_fonte: evidenceById.get(item.evidencia_id), proxima_revisao: new Date().toISOString() }))
      if (cardRows.length) {
        const { error } = await supabase.from('question_card').upsert(cardRows, { onConflict: 'chave', ignoreDuplicates: true })
        if (error) throw error
      }
    }
    console.log(JSON.stringify({ importado: spec.subject, capitulos: subjectChapters.length }))
  }
}

if (generate) await generateLibrary()
const dataset = await readDataset()
const summary = {
  materias_planejadas: librarySpecs.length,
  capitulos_planejados: librarySpecs.reduce((sum, item) => sum + item.topics.length, 0),
  capitulos_prontos: dataset.length,
  questoes_prontas: dataset.reduce((sum, item) => sum + item.questions.length, 0),
  cards_prontos: dataset.reduce((sum, item) => sum + item.cards.length, 0),
}
console.log(JSON.stringify(summary, null, 2))
if (apply) await applyDataset(dataset)

