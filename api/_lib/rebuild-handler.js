import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'
import { generateJson, researchWithGrounding } from './gemini.js'
import { enforceRateLimit, fail, queryParam } from './http.js'
import { librarySpecs } from '../../scripts/acervo-specs.js'

const REVISION = '2026.08-autossuficiente-v2'
const letters = ['A', 'B', 'C', 'D', 'E']
const facultySubjects = new Set([
  'Direito das Pessoas e dos Negócios Jurídicos',
  'Teoria da Constituição e Direitos Fundamentais',
  'Teoria do Crime',
  'Teorias da Justiça',
])

const trainingSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questoes', 'cards'],
  properties: {
    questoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'enunciado', 'alternativas', 'gabarito', 'explicacao', 'comentarios_alternativas', 'evidencia_id', 'dificuldade'],
        properties: {
          tipo: { type: 'string', enum: ['CE', 'ME'] },
          enunciado: { type: 'string' },
          alternativas: { anyOf: [{ type: 'null' }, { type: 'object', required: letters, additionalProperties: false, properties: Object.fromEntries(letters.map((letter) => [letter, { type: 'string' }])) }] },
          gabarito: { type: 'string', enum: letters },
          explicacao: { type: 'string' },
          comentarios_alternativas: { anyOf: [{ type: 'null' }, { type: 'object', required: letters, additionalProperties: false, properties: Object.fromEntries(letters.map((letter) => [letter, { type: 'string' }])) }] },
          evidencia_id: { type: 'integer' },
          dificuldade: { type: 'integer', minimum: 1, maximum: 5 },
        },
      },
    },
    cards: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false, required: ['frente', 'verso', 'evidencia_id'],
        properties: { frente: { type: 'string' }, verso: { type: 'string' }, evidencia_id: { type: 'integer' } },
      },
    },
  },
}

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
}

function slug(value) {
  return normalized(value).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function hash(value) {
  return createHash('sha256').update(value).digest('hex')
}

function wordCount(value) {
  return String(value || '').trim().split(/\s+/).filter(Boolean).length
}

function evidenceBlocks(chapter) {
  const paragraphs = String(chapter || '').split(/\n\s*\n/).map((item) => item.replace(/^#{1,4}\s+/gm, '').replace(/^[-*]\s+/gm, '').trim()).filter((item) => item.length >= 90)
  const blocks = []
  for (const paragraph of paragraphs) {
    if (paragraph.length <= 1800) blocks.push(paragraph)
    else {
      const sentences = paragraph.split(/(?<=[.!?])\s+/)
      let current = ''
      for (const sentence of sentences) {
        if (`${current} ${sentence}`.length > 1700 && current) { blocks.push(current); current = sentence }
        else current = `${current} ${sentence}`.trim()
      }
      if (current) blocks.push(current)
    }
  }
  return blocks.slice(0, 55).map((texto, index) => ({ id: index + 1, texto }))
}

function depthInstructions(subject) {
  if (subject === 'Contabilidade') return 'Inclua lançamentos completos com débito e crédito, razonetes quando úteis, cálculos passo a passo, efeitos nas demonstrações, diferenças entre tratamento societário e fiscal e referência precisa aos CPCs aplicáveis.'
  if (subject === 'Raciocínio Lógico e Quantitativo') return 'Demonstre fórmulas, condições de uso e resolução passo a passo de exemplos progressivos. Explique erros de raciocínio e como conferir o resultado.'
  if (subject === 'Português e Redação Oficial') return 'Inclua exemplos originais analisados, contraexemplos, efeitos de sentido, exceções gramaticais e aplicação das regras em reescritas e comunicações oficiais.'
  if (subject === 'Informática') return 'Inclua procedimentos concretos, comandos, atalhos, funções de planilha, protocolos, comparações e cenários de segurança. Diferencie conceitos que a banca costuma confundir.'
  if (/Direito|Lei 8\.112|Constitui/.test(subject)) return 'Explique a disciplina com base legal precisa, artigos relevantes, exceções, prazos, efeitos, controvérsias consolidadas e jurisprudência apenas quando verificável. Não invente precedentes.'
  return 'Inclua modelos, autores, classificações, quadros comparativos em texto, indicadores, fórmulas quando existirem e situações administrativas completas que demonstrem aplicação e limites.'
}

function chapterPrompt({ spec, topicName, scope, previous }) {
  const audience = spec.type === 'concurso' ? 'candidato iniciante ao cargo de Técnico do Banco Central, Área 1, em preparação para Cebraspe' : 'estudante do segundo semestre de Direito do CEUB'
  return `Reescreva e amplie o capítulo abaixo como material didático autossuficiente em português do Brasil.
Público: ${audience}.
Disciplina: ${spec.subject}.
Capítulo: ${topicName}.
Escopo obrigatório: ${scope}
Base curricular: ${spec.basis}

O estudante precisa aprender do zero e usar este capítulo como fonte principal. Cubra conceitos, fundamentos, requisitos, classificações, procedimentos, relações, exceções, consequências e aplicações. ${depthInstructions(spec.subject)}

Requisitos obrigatórios:
1. Produza entre 3.000 e 4.500 palavras de conteúdo útil, sem preenchimento genérico ou repetição.
2. Use títulos e subtítulos em Markdown, progressão didática e linguagem precisa.
3. Inclua pelo menos quatro exemplos explicativos ou aplicações completas, sem transformar o capítulo em lista de questões.
4. Inclua comparações, exceções, erros comuns e armadilhas de prova.
5. Termine com uma síntese estruturada e uma seção chamada Referências normativas e bibliográficas.
6. Pesquise fontes oficiais, legislação vigente, manuais institucionais e bibliografia reconhecida. Identifique norma, artigo, manual ou obra de forma humana e verificável.
7. Não reproduza questões de prova, não inclua exercícios e não inclua gabarito.
8. Não trate norma revogada como vigente. Quando mencionar mudança histórica, deixe a situação atual explícita.
9. Preserve apenas o que estiver correto no texto anterior e corrija qualquer simplificação, ambiguidade ou informação desatualizada.

Texto anterior usado apenas como ponto de partida:
${String(previous || '').slice(0, 24000)}`
}

function trainingPrompt({ spec, topicName, evidence }) {
  const blocks = evidence.map((item) => `[EVIDÊNCIA ${item.id}]\n${item.texto}`).join('\n\n')
  const style = spec.type === 'concurso'
    ? 'Crie exatamente 20 questões inéditas: 14 itens de Certo ou Errado e 6 questões de múltipla escolha A a E, em estilo Cebraspe, com dificuldades 2 a 5 e predominância 3 e 4.'
    : 'Crie exatamente 20 questões inéditas: 8 itens de Certo ou Errado e 12 questões de múltipla escolha A a E, com casos acadêmicos curtos e dificuldades 2 a 5.'
  return `${style}
Crie também exatamente 20 Question Cards de recuperação ativa, atômicos, claros e sem duplicidade.
Disciplina: ${spec.subject}. Tópico: ${topicName}.

Use somente as evidências numeradas. Cada questão e card deve indicar um único evidencia_id que sustente diretamente a resposta. Em CE, alternativas e comentarios_alternativas são null e o gabarito é C ou E. Em ME, forneça exatamente A, B, C, D e E, uma única correta e um comentário individual para cada alternativa explicando por que está correta ou incorreta. A explicação geral deve ensinar o fundamento, não apenas repetir o gabarito. Distribua os gabaritos ME entre as cinco letras. Não copie provas anteriores e não crie informação além do capítulo.

${blocks}`
}

function validateTraining(data, evidence, type) {
  const evidenceById = new Map(evidence.map((item) => [item.id, item.texto]))
  const seenQuestions = new Set()
  const questions = []
  for (const raw of data.questoes || []) {
    const tipo = String(raw.tipo || '').toUpperCase()
    const gabarito = String(raw.gabarito || '').toUpperCase()
    const enunciado = String(raw.enunciado || '').trim()
    const evidenceText = evidenceById.get(Number(raw.evidencia_id))
    if (!evidenceText || !enunciado || seenQuestions.has(normalized(enunciado)) || !['CE', 'ME'].includes(tipo)) continue
    if (tipo === 'CE' && !['C', 'E'].includes(gabarito)) continue
    if (tipo === 'ME' && (!letters.includes(gabarito) || letters.some((letter) => !String(raw.alternativas?.[letter] || '').trim()) || letters.some((letter) => !String(raw.comentarios_alternativas?.[letter] || '').trim()))) continue
    seenQuestions.add(normalized(enunciado))
    questions.push({
      tipo,
      enunciado,
      alternativas: tipo === 'CE' ? null : Object.fromEntries(letters.map((letter) => [letter, String(raw.alternativas[letter]).trim()])),
      gabarito,
      explicacao: String(raw.explicacao || '').trim(),
      comentarios_alternativas: tipo === 'CE' ? null : Object.fromEntries(letters.map((letter) => [letter, String(raw.comentarios_alternativas[letter]).trim()])),
      evidencia_id: Number(raw.evidencia_id),
      evidencia: evidenceText,
      dificuldade: Math.min(5, Math.max(1, Number(raw.dificuldade) || 3)),
    })
  }
  const seenCards = new Set()
  const cards = []
  for (const raw of data.cards || []) {
    const frente = String(raw.frente || '').trim()
    const verso = String(raw.verso || '').trim()
    const evidenceText = evidenceById.get(Number(raw.evidencia_id))
    if (!evidenceText || !frente || !verso || seenCards.has(normalized(frente))) continue
    seenCards.add(normalized(frente))
    cards.push({ frente, verso, evidencia: evidenceText })
  }
  const expectedCE = type === 'concurso' ? 14 : 8
  const expectedME = type === 'concurso' ? 6 : 12
  const ceQuestions = questions.filter((item) => item.tipo === 'CE')
  const meQuestions = questions.filter((item) => item.tipo === 'ME')
  if (questions.length < 20 || ceQuestions.length < expectedCE || meQuestions.length < expectedME) throw new Error('O lote não atingiu a distribuição obrigatória de 20 questões.')
  if (cards.length < 20) throw new Error('O lote não atingiu os 20 Question Cards obrigatórios.')
  return { questions: [...ceQuestions.slice(0, expectedCE), ...meQuestions.slice(0, expectedME)], cards: cards.slice(0, 20) }
}

function sourceLabel(sources, spec) {
  const source = sources.find((item) => item.url)
  return source ? `${source.titulo}: ${source.url}` : `${spec.subject}: ${spec.basis}`
}

export default async function rebuildHandler(req, res) {
  const supabase = getSupabaseAdmin()
  let oldQuestionsDeactivated = false
  let oldCardsDeactivated = false
  let previousQuestionIds = []
  let previousCardIds = []
  let topic
  try {
    const tasks = librarySpecs
      .filter((spec) => spec.type === 'concurso' || facultySubjects.has(spec.subject))
      .flatMap((spec) => spec.topics.map(([topicName, scope]) => ({ spec, topicName, scope })))
    const requestedIndex = Number(req.body?.index ?? queryParam(req, 'index'))
    const force = req.body?.force === true
    if (!Number.isInteger(requestedIndex) || requestedIndex < 0 || requestedIndex >= tasks.length) return res.status(400).json({ error: `Índice inválido. Use de 0 a ${tasks.length - 1}.`, total: tasks.length })
    const { spec, topicName, scope } = tasks[requestedIndex]

    const { data: objective, error: objectiveError } = await supabase.from('objetivo').select('id,nome').eq('nome', spec.objective).single()
    if (objectiveError) throw objectiveError
    const { data: subject, error: subjectError } = await supabase.from('materia').select('id,nome').eq('objetivo_id', objective.id).eq('nome', spec.subject).single()
    if (subjectError) throw subjectError
    const { data: foundTopic, error: topicError } = await supabase.from('topico').select('id,nome').eq('materia_id', subject.id).eq('nome', topicName).single()
    if (topicError) throw topicError
    topic = foundTopic

    const [{ data: knowledge }, { count: readyQuestions }, { count: readyCards }] = await Promise.all([
      supabase.from('conhecimento').select('id,trecho,material_id,versao').eq('topico_id', topic.id).eq('origem', `acervo-completo:${slug(topicName)}`).maybeSingle(),
      supabase.from('questao').select('id', { count: 'exact', head: true }).eq('topico_id', topic.id).eq('ativa', true).eq('versao_conhecimento', REVISION),
      supabase.from('question_card').select('id', { count: 'exact', head: true }).eq('topico_id', topic.id).eq('ativa', true).eq('versao_conhecimento', REVISION),
    ])
    if (!force && knowledge?.versao === REVISION && (readyQuestions || 0) >= 20 && (readyCards || 0) >= 20) return res.status(200).json({ cache: true, index: requestedIndex, total: tasks.length, materia: spec.subject, topico: topicName, versao: REVISION })

    await enforceRateLimit(supabase, 'reconstrucao_acervo', 450, 1440)
    const researched = await researchWithGrounding(chapterPrompt({ spec, topicName, scope, previous: knowledge?.trecho }), { model: String(req.body?.researchModel || 'gemini-3.1-flash-lite') })
    const chapter = String(researched.texto || '').trim().replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '')
    if (wordCount(chapter) < 2500) throw new Error(`Capítulo insuficiente: ${wordCount(chapter)} palavras; mínimo de 2500.`)
    const sources = researched.fontes || []
    if (sources.length < 1) throw new Error('A pesquisa não retornou fonte rastreável.')
    const evidence = evidenceBlocks(chapter)
    if (evidence.length < 12) throw new Error('O capítulo não possui blocos de evidência suficientes.')

    const generated = await generateJson({ prompt: trainingPrompt({ spec, topicName, evidence }), schema: trainingSchema, model: String(req.body?.generationModel || 'gemini-3.1-flash-lite') })
    const training = validateTraining(generated, evidence, spec.type)
    const source = sourceLabel(sources, spec)
    const now = new Date().toISOString()

    const materialName = `Apostila completa - ${spec.subject} - ${topicName}`
    const content = `${chapter}\n\n## Fontes verificadas pelo grounding\n${sources.map((item) => `- ${item.titulo}: ${item.url}`).join('\n')}`
    const { data: existingMaterial } = await supabase.from('material').select('id').eq('materia_id', subject.id).eq('nome', materialName).maybeSingle()
    const materialPayload = { objetivo_id: objective.id, materia_id: subject.id, tipo: 'texto', nome: materialName, conteudo: content, status: 'aceito', motivo: 'Capítulo aprofundado, versionado e pesquisado com fontes rastreáveis.', forcado: false, versao: REVISION }
    const materialResult = existingMaterial
      ? await supabase.from('material').update(materialPayload).eq('id', existingMaterial.id).select('id').single()
      : await supabase.from('material').insert(materialPayload).select('id').single()
    if (materialResult.error) throw materialResult.error

    const knowledgePayload = { materia_id: subject.id, topico_id: topic.id, trecho: chapter, origem: `acervo-completo:${slug(topicName)}`, material_id: materialResult.data.id, versao: REVISION }
    const knowledgeResult = knowledge
      ? await supabase.from('conhecimento').update(knowledgePayload).eq('id', knowledge.id)
      : await supabase.from('conhecimento').insert(knowledgePayload)
    if (knowledgeResult.error) throw knowledgeResult.error

    const questionRows = training.questions.map((item) => ({ topico_id: topic.id, tipo: item.tipo, enunciado: item.enunciado, alternativas: item.alternativas, gabarito: item.gabarito, explicacao: item.explicacao, comentarios_alternativas: item.comentarios_alternativas, fonte: source, trecho_fonte: item.evidencia, origem: 'ia', dificuldade: item.dificuldade, ativa: false, versao_conhecimento: REVISION, criado_em: now }))
    const cardRows = training.cards.map((item) => ({ objetivo_id: objective.id, materia_id: subject.id, topico_id: topic.id, chave: hash(`${REVISION}|${objective.id}|${topic.id}|${normalized(item.frente)}`), frente: item.frente, verso: item.verso, fonte: source, trecho_fonte: item.evidencia, proxima_revisao: now, ativa: false, versao_conhecimento: REVISION }))

    await supabase.from('questao').delete().eq('topico_id', topic.id).eq('ativa', false).eq('versao_conhecimento', REVISION)
    await supabase.from('question_card').delete().eq('topico_id', topic.id).eq('ativa', false).eq('versao_conhecimento', REVISION)
    const [questionInsert, cardInsert] = await Promise.all([
      supabase.from('questao').insert(questionRows).select('id'),
      supabase.from('question_card').insert(cardRows).select('id'),
    ])
    if (questionInsert.error || cardInsert.error) throw questionInsert.error || cardInsert.error
    if (questionInsert.data.length !== 20 || cardInsert.data.length !== 20) throw new Error('O conjunto de substituição ficou incompleto.')

    const previousQuestions = await supabase.from('questao').select('id').eq('topico_id', topic.id).eq('ativa', true)
    if (previousQuestions.error) throw previousQuestions.error
    previousQuestionIds = (previousQuestions.data || []).map((item) => item.id)
    const oldQuestionResult = await supabase.from('questao').update({ ativa: false }).in('id', previousQuestionIds.length ? previousQuestionIds : ['00000000-0000-0000-0000-000000000000'])
    if (oldQuestionResult.error) throw oldQuestionResult.error
    oldQuestionsDeactivated = true
    const activateQuestions = await supabase.from('questao').update({ ativa: true }).in('id', questionInsert.data.map((item) => item.id))
    if (activateQuestions.error) throw activateQuestions.error

    const previousCards = await supabase.from('question_card').select('id').eq('topico_id', topic.id).eq('ativa', true)
    if (previousCards.error) throw previousCards.error
    previousCardIds = (previousCards.data || []).map((item) => item.id)
    const oldCardResult = await supabase.from('question_card').update({ ativa: false }).in('id', previousCardIds.length ? previousCardIds : ['00000000-0000-0000-0000-000000000000'])
    if (oldCardResult.error) throw oldCardResult.error
    oldCardsDeactivated = true
    const activateCards = await supabase.from('question_card').update({ ativa: true }).in('id', cardInsert.data.map((item) => item.id))
    if (activateCards.error) throw activateCards.error

    return res.status(201).json({ cache: false, index: requestedIndex, total: tasks.length, materia: spec.subject, topico: topicName, palavras: wordCount(chapter), fontes: sources.length, questoes: 20, cards: 20, versao: REVISION })
  } catch (error) {
    if (topic?.id && oldQuestionsDeactivated && previousQuestionIds.length) await supabase.from('questao').update({ ativa: true }).in('id', previousQuestionIds)
    if (topic?.id && oldCardsDeactivated && previousCardIds.length) await supabase.from('question_card').update({ ativa: true }).in('id', previousCardIds)
    return fail(res, error, 'Não foi possível reconstruir este capítulo com segurança.')
  }
}

export { REVISION }
