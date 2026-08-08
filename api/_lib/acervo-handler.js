import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'
import { generateJson, generateText, researchWithGrounding } from './gemini.js'
import { enforceRateLimit, fail, queryParam } from './http.js'
import { librarySpecs } from '../../scripts/acervo-specs.js'

const letters = ['A', 'B', 'C', 'D', 'E']
const schema = {
  type: 'object', additionalProperties: false, required: ['questoes', 'cards'], properties: {
    questoes: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['tipo', 'enunciado', 'alternativas', 'gabarito', 'explicacao', 'evidencia_id', 'dificuldade'], properties: {
      tipo: { type: 'string', enum: ['CE', 'ME'] }, enunciado: { type: 'string' },
      alternativas: { anyOf: [{ type: 'null' }, { type: 'object', required: letters, additionalProperties: false, properties: Object.fromEntries(letters.map((letter) => [letter, { type: 'string' }])) }] },
      gabarito: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] }, explicacao: { type: 'string' }, evidencia_id: { type: 'integer' }, dificuldade: { type: 'integer', minimum: 1, maximum: 5 },
    } } },
    cards: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['frente', 'verso', 'evidencia_id'], properties: { frente: { type: 'string' }, verso: { type: 'string' }, evidencia_id: { type: 'integer' } } } },
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

function subjectPrompt(spec) {
  const audience = spec.type === 'concurso' ? 'candidato ao cargo de Técnico do Banco Central, Área 1, no padrão Cebraspe' : 'estudante do segundo semestre do curso de Direito'
  const syllabus = spec.topics.map(([topic, scope]) => `# ${topic}\nEscopo: ${scope}`).join('\n\n')
  return `Produza uma apostila autossuficiente em português do Brasil, dividida exatamente pelos títulos abaixo.
Público: ${audience}. Disciplina: ${spec.subject}. Base curricular: ${spec.basis}

${syllabus}

Explique minuciosamente conceitos, fundamentos, classificações, elementos, relações, exceções, consequências e aplicações. Inclua exemplos apenas explicativos, sem perguntas, exercícios ou gabaritos. Em Direito, confirme a legislação vigente na data da pesquisa e indique alterações relevantes. No BACEN, cubra integralmente o recorte do edital e as armadilhas conceituais comuns. Em cada título, escreva entre 1.600 e 2.400 palavras e use subtítulos para visão geral, fundamentos, desenvolvimento, classificações ou etapas, exemplos, comparações, erros comuns e síntese. Pesquise prioritariamente fontes oficiais, legislação, manuais institucionais e bibliografia acadêmica confiável. Não invente decisões, artigos, números ou citações.`
}

function topicSection(content, topicName, nextTopicName) {
  const text = String(content || '')
  const escaped = topicName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const startMatch = new RegExp(`^#{1,3}\\s+(?:\\d+[.)]\\s*)?${escaped}\\s*$`, 'im').exec(text)
  if (!startMatch) return ''
  const start = startMatch.index
  if (!nextTopicName) return text.slice(start).trim()
  const nextEscaped = nextTopicName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const after = text.slice(start + startMatch[0].length)
  const endMatch = new RegExp(`^#{1,3}\\s+(?:\\d+[.)]\\s*)?${nextEscaped}\\s*$`, 'im').exec(after)
  return endMatch ? text.slice(start, start + startMatch[0].length + endMatch.index).trim() : text.slice(start).trim()
}

function trainingPrompt(spec, topicName, evidence, cardCount) {
  const blocks = evidence.map((item) => `[EVIDÊNCIA ${item.id}]\n${item.texto}`).join('\n\n')
  const style = spec.type === 'concurso'
    ? 'Crie 15 questões inéditas no padrão Cebraspe: 10 itens CE e 5 itens ME com alternativas A a E.'
    : 'Crie 15 questões acadêmicas inéditas, misturando CE e ME com cinco alternativas e casos curtos quando cabível.'
  return `${style} Misture dificuldades 2, 3, 4 e 5. Crie também ${cardCount} Question Cards atômicos de recuperação ativa.
Disciplina: ${spec.subject}. Tópico: ${topicName}.
Use somente as evidências numeradas. Cada questão e card deve apontar um único evidencia_id. Em CE, alternativas é null e gabarito C ou E. Em ME, existem A, B, C, D e E e exatamente uma correta. Toda explicação justifica a resposta. Não duplique conceitos nem copie provas anteriores.

${blocks}`
}

function validateTraining(data, evidence, cardCount) {
  const evidenceById = new Map(evidence.map((item) => [item.id, item]))
  const seen = new Set()
  const questions = []
  for (const item of data.questoes || []) {
    const type = String(item.tipo || '').toUpperCase()
    const answer = String(item.gabarito || '').toUpperCase()
    const statement = String(item.enunciado || '').trim()
    const linked = evidenceById.get(Number(item.evidencia_id))
    if (!linked || !statement || seen.has(normalized(statement)) || !['CE', 'ME'].includes(type)) continue
    if (type === 'CE' && !['C', 'E'].includes(answer)) continue
    if (type === 'ME' && (!letters.includes(answer) || letters.some((letter) => !String(item.alternativas?.[letter] || '').trim()))) continue
    seen.add(normalized(statement))
    questions.push({ tipo: type, enunciado: statement, alternativas: type === 'CE' ? null : Object.fromEntries(letters.map((letter) => [letter, String(item.alternativas[letter]).trim()])), gabarito: answer, explicacao: String(item.explicacao || '').trim(), evidencia_id: linked.id, dificuldade: Math.min(5, Math.max(1, Number(item.dificuldade) || 3)) })
  }
  const cardSeen = new Set()
  const cards = (data.cards || []).flatMap((item) => {
    const linked = evidenceById.get(Number(item.evidencia_id))
    const front = String(item.frente || '').trim(); const back = String(item.verso || '').trim(); const key = normalized(front)
    if (!linked || !front || !back || cardSeen.has(key)) return []
    cardSeen.add(key); return [{ frente: front, verso: back, evidencia_id: linked.id }]
  })
  if (questions.length < 12 || questions.filter((item) => item.tipo === 'CE').length < 7 || questions.filter((item) => item.tipo === 'ME').length < 3) throw new Error('O lote não atingiu a quantidade ou o formato mínimos.')
  if (cardCount && cards.length < 4) throw new Error('O lote não atingiu a quantidade mínima de Question Cards.')
  return { questions: questions.slice(0, 15), cards: cards.slice(0, cardCount) }
}

function sourceLabel(sources, spec) {
  const first = sources.find((item) => item.url)
  return first ? `${first.titulo}: ${first.url}` : `${spec.subject}: ${spec.basis}`
}

export default async function archiveHandler(req, res) {
  const supabase = getSupabaseAdmin()
  try {
    const requestedIndex = Number(req.body?.index ?? queryParam(req, 'index'))
    const topics = librarySpecs.flatMap((spec) => spec.topics.map(([topic, scope]) => ({ spec, topic, scope })))
    if (!Number.isInteger(requestedIndex) || requestedIndex < 0 || requestedIndex >= topics.length) return res.status(400).json({ error: `Índice inválido. Use de 0 a ${topics.length - 1}.`, total: topics.length })
    const { spec, topic: topicName } = topics[requestedIndex]
    const { data: objective, error: objectiveError } = await supabase.from('objetivo').select('id,nome').eq('nome', spec.objective).single()
    if (objectiveError) throw objectiveError
    const { data: subject, error: subjectError } = await supabase.from('materia').select('id,nome').eq('objetivo_id', objective.id).eq('nome', spec.subject).single()
    if (subjectError) throw subjectError
    let { data: topic } = await supabase.from('topico').select('id,nome').eq('materia_id', subject.id).eq('nome', topicName).maybeSingle()
    if (!topic) {
      const result = await supabase.from('topico').insert({ materia_id: subject.id, nome: topicName }).select('id,nome').single()
      if (result.error) throw result.error
      topic = result.data
    }
    const cardCount = spec.type === 'faculdade' && normalized(spec.subject).includes('analise e producao de texto') ? 0 : 6
    const [{ count: questionCount }, { count: currentCards }, { data: knowledge }] = await Promise.all([
      supabase.from('questao').select('id', { count: 'exact', head: true }).eq('topico_id', topic.id).neq('estado', 'arquivada'),
      supabase.from('question_card').select('id', { count: 'exact', head: true }).eq('topico_id', topic.id),
      supabase.from('conhecimento').select('id,trecho,material_id').eq('topico_id', topic.id).eq('origem', `acervo-completo:${slug(topicName)}`).maybeSingle(),
    ])
    if (knowledge && (questionCount || 0) >= 12 && (cardCount === 0 || (currentCards || 0) >= 4)) return res.status(200).json({ index: requestedIndex, total: topics.length, cache: true, materia: spec.subject, topico: topicName, questoes: questionCount, cards: currentCards })

    await enforceRateLimit(supabase, 'acervo_completo', 240, 1440)
    const researchName = `Pesquisa-base completa - ${spec.subject}`
    let { data: researchMaterial } = await supabase.from('material').select('id,conteudo').eq('materia_id', subject.id).eq('nome', researchName).maybeSingle()
    let researchSources = []
    if (!researchMaterial) {
      const researchModel = String(req.body?.researchModel || process.env.GEMINI_RESEARCH_MODEL || 'gemini-3-flash-preview')
      let researched
      let grounded = true
      try {
        researched = await researchWithGrounding(subjectPrompt(spec), { model: researchModel })
      } catch (error) {
        if (!/429|quota|RESOURCE_EXHAUSTED|no longer available|404/i.test(String(error?.message || error))) throw error
        grounded = false
        researched = { texto: await generateText(`${subjectPrompt(spec)}\n\nA busca integrada está indisponível na cota gratuita. Use estritamente a base curricular indicada e conhecimentos normativos consolidados. Quando houver risco de desatualização, declare a necessidade de conferir a redação vigente em fonte oficial.`, { model: process.env.GEMINI_MODEL || 'gemini-3.1-flash-lite' }), fontes: [] }
      }
      const researchText = String(researched.texto || '').trim()
      if (researchText.length < spec.topics.length * 3500) throw new Error('A pesquisa gerou uma apostila curta demais para a disciplina completa.')
      researchSources = researched.fontes || []
      const researchContent = `${researchText}\n\n## Fontes verificadas\n${researchSources.map((item) => `- ${item.titulo}: ${item.url}`).join('\n') || `- ${spec.basis}`}`
      const result = await supabase.from('material').insert({ objetivo_id: objective.id, materia_id: subject.id, tipo: 'texto', nome: researchName, conteudo: researchContent, status: 'aceito', motivo: grounded ? 'Pesquisa-base completa, criada uma única vez para economizar a cota gratuita de busca.' : 'Base curricular completa gerada sem busca integrada porque a cota gratuita de grounding estava indisponível; requer atualização futura de fontes.', forcado: false }).select('id,conteudo').single()
      if (result.error) throw result.error
      researchMaterial = result.data
    }
    const topicPosition = spec.topics.findIndex(([name]) => name === topicName)
    const chapter = topicSection(researchMaterial.conteudo, topicName, spec.topics[topicPosition + 1]?.[0])
    if (chapter.length < 3000) throw new Error('Não foi possível separar um capítulo completo da pesquisa-base.')
    const evidence = evidenceBlocks(chapter)
    if (evidence.length < 5) throw new Error('O capítulo não contém evidências suficientes para gerar o treino.')
    const generated = await generateJson({ prompt: trainingPrompt(spec, topicName, evidence, cardCount), schema })
    const training = validateTraining(generated, evidence, cardCount)
    if (!researchSources.length) {
      const url = String(researchMaterial.conteudo).match(/https?:\/\/\S+/)?.[0]?.replace(/[),.;]+$/, '')
      if (url) researchSources = [{ titulo: `Fonte verificada de ${spec.subject}`, url }]
    }
    const source = sourceLabel(researchSources, spec)
    const materialName = `Apostila completa - ${spec.subject} - ${topicName}`
    const content = `${chapter}\n\n## Fontes verificadas\n${researchSources.map((item) => `- ${item.titulo}: ${item.url}`).join('\n') || `- ${spec.basis}`}`
    const { data: existingMaterial } = await supabase.from('material').select('id').eq('materia_id', subject.id).eq('nome', materialName).maybeSingle()
    const materialPayload = { objetivo_id: objective.id, materia_id: subject.id, tipo: 'texto', nome: materialName, conteudo: content, status: 'aceito', motivo: 'Capítulo curricular pesquisado, estruturado e vinculado a fontes.', forcado: false }
    const materialResult = existingMaterial ? await supabase.from('material').update(materialPayload).eq('id', existingMaterial.id).select('id').single() : await supabase.from('material').insert(materialPayload).select('id').single()
    if (materialResult.error) throw materialResult.error
    const knowledgePayload = { materia_id: subject.id, topico_id: topic.id, trecho: chapter, origem: `acervo-completo:${slug(topicName)}`, material_id: materialResult.data.id }
    const knowledgeResult = knowledge ? await supabase.from('conhecimento').update(knowledgePayload).eq('id', knowledge.id) : await supabase.from('conhecimento').insert(knowledgePayload)
    if (knowledgeResult.error) throw knowledgeResult.error
    const existingQuestions = await supabase.from('questao').select('enunciado').eq('topico_id', topic.id)
    if (existingQuestions.error) throw existingQuestions.error
    const questionKeys = new Set((existingQuestions.data || []).map((item) => normalized(item.enunciado)))
    const questionRows = training.questions.filter((item) => !questionKeys.has(normalized(item.enunciado))).map((item) => ({ topico_id: topic.id, tipo: item.tipo, enunciado: item.enunciado, alternativas: item.alternativas, gabarito: item.gabarito, explicacao: item.explicacao, fonte: source, trecho_fonte: evidence.find((block) => block.id === item.evidencia_id).texto, origem: 'ia', dificuldade: item.dificuldade }))
    if (questionRows.length) {
      const result = await supabase.from('questao').insert(questionRows)
      if (result.error) throw result.error
    }
    const cardRows = training.cards.map((item) => ({ objetivo_id: objective.id, materia_id: subject.id, topico_id: topic.id, chave: hash(`${objective.id}|${topic.id}|${normalized(item.frente)}`), frente: item.frente, verso: item.verso, fonte: source, trecho_fonte: evidence.find((block) => block.id === item.evidencia_id).texto, proxima_revisao: new Date().toISOString() }))
    if (cardRows.length) {
      const result = await supabase.from('question_card').upsert(cardRows, { onConflict: 'chave', ignoreDuplicates: true })
      if (result.error) throw result.error
    }
    return res.status(201).json({ index: requestedIndex, total: topics.length, cache: false, materia: spec.subject, topico: topicName, questoes: questionRows.length, cards: cardRows.length, fontes: researchSources.length })
  } catch (error) {
    return fail(res, error, 'Não foi possível concluir este capítulo do acervo.')
  }
}
