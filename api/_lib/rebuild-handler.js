import { createHash } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'
import { generateJson, researchWithGrounding } from './gemini.js'
import { enforceRateLimit, fail, queryParam } from './http.js'
import { librarySpecs } from '../../scripts/acervo-specs.js'

const REVISION = '2026.08-acervo-30-50-v3'
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
        type: 'object', additionalProperties: false, required: ['frente', 'verso', 'evidencia_id', 'tipo_card', 'dificuldade'],
        properties: { frente: { type: 'string' }, verso: { type: 'string' }, evidencia_id: { type: 'integer' }, tipo_card: { type: 'string', enum: ['recordacao', 'distincao', 'aplicacao', 'excecao', 'correcao'] }, dificuldade: { type: 'integer', minimum: 1, maximum: 5 } },
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

function trainingPrompt({ spec, topicName, evidence, questionCount, cardCount, difficultyPlan, existingQuestions, existingCards }) {
  const blocks = evidence.map((item) => `[EVIDÊNCIA ${item.id}]\n${item.texto}`).join('\n\n')
  const style = spec.type === 'concurso'
    ? `Crie exatamente ${questionCount} questões inéditas, misturando Certo ou Errado e múltipla escolha A a E em estilo Cebraspe, com predominância de CE.`
    : `Crie exatamente ${questionCount} questões inéditas, misturando Certo ou Errado e múltipla escolha A a E, com predominância de ME e casos acadêmicos curtos.`
  return `${style}
Distribuição de dificuldade das novas questões: ${difficultyPlan.faceis} fáceis (níveis 1 ou 2), ${difficultyPlan.medias} médias (nível 3) e ${difficultyPlan.dificeis} difíceis (níveis 4 ou 5).
Crie também exatamente ${cardCount} Question Cards de recuperação ativa, atômicos, claros e sem duplicidade.
Disciplina: ${spec.subject}. Tópico: ${topicName}.

Use somente as evidências numeradas. Cada questão e card deve indicar um único evidencia_id que sustente diretamente a resposta. Em CE, alternativas e comentarios_alternativas são null e o gabarito é C ou E. Em ME, forneça exatamente A, B, C, D e E, uma única correta e um comentário individual para cada alternativa explicando por que está correta ou incorreta. A explicação geral deve ensinar o fundamento, não apenas repetir o gabarito. Distribua os gabaritos ME entre as cinco letras. Não copie provas anteriores e não crie informação além do capítulo.

Regras dos Question Cards: uma única unidade de conhecimento por card; pergunta específica que obrigue recuperação ativa; resposta curta e suficiente; contexto mínimo para evitar ambiguidade; nada de perguntas genéricas como "fale sobre"; não agrupe listas longas. Misture os tipos recordacao, distincao, aplicacao, excecao e correcao. A frente deve ter no máximo 220 caracteres e o verso no máximo 700 caracteres.

Não repita estes enunciados já existentes:
${existingQuestions.slice(0, 45).map((item) => `- ${item}`).join('\n')}

Não repita estas frentes de cards já existentes:
${existingCards.slice(0, 60).map((item) => `- ${item}`).join('\n')}

${blocks}`
}

function validateTraining(data, evidence, { questionCount, cardCount, difficultyPlan }) {
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
    if (frente.length > 220 || verso.length > 700 || !['recordacao', 'distincao', 'aplicacao', 'excecao', 'correcao'].includes(raw.tipo_card)) continue
    cards.push({ frente, verso, evidencia: evidenceText, tipoCard: raw.tipo_card, dificuldade: Math.min(5, Math.max(1, Number(raw.dificuldade) || 3)) })
  }
  if (questions.length < questionCount) throw new Error(`O lote não atingiu as ${questionCount} questões necessárias.`)
  if (cards.length < cardCount) throw new Error(`O lote não atingiu os ${cardCount} Question Cards necessários.`)
  const selectedQuestions = []
  const bands = [
    [difficultyPlan.faceis, (item) => item.dificuldade <= 2],
    [difficultyPlan.medias, (item) => item.dificuldade === 3],
    [difficultyPlan.dificeis, (item) => item.dificuldade >= 4],
  ]
  for (const [amount, matcher] of bands) selectedQuestions.push(...questions.filter(matcher).filter((item) => !selectedQuestions.includes(item)).slice(0, amount))
  if (selectedQuestions.length < questionCount) selectedQuestions.push(...questions.filter((item) => !selectedQuestions.includes(item)).slice(0, questionCount - selectedQuestions.length))
  return { questions: selectedQuestions, cards: cards.slice(0, cardCount) }
}

function difficultyPlan(existing, missing) {
  const counts = {
    faceis: existing.filter((item) => item.dificuldade <= 2).length,
    medias: existing.filter((item) => item.dificuldade === 3).length,
    dificeis: existing.filter((item) => item.dificuldade >= 4).length,
  }
  const targets = { faceis: 18, medias: 9, dificeis: 3 }
  const plan = { faceis: 0, medias: 0, dificeis: 0 }
  for (let index = 0; index < missing; index += 1) {
    const band = Object.keys(plan).sort((a, b) => (targets[b] - counts[b] - plan[b]) - (targets[a] - counts[a] - plan[a]))[0]
    plan[band] += 1
  }
  return plan
}

function sourceLabel(sources, spec) {
  const source = sources.find((item) => item.url)
  return source ? `${source.titulo}: ${source.url}` : `${spec.subject}: ${spec.basis}`
}

export default async function rebuildHandler(req, res) {
  const supabase = getSupabaseAdmin()
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
    const topic = foundTopic

    const [{ data: knowledge }, { data: existingQuestions, error: existingQuestionsError }, { data: existingCards, error: existingCardsError }] = await Promise.all([
      supabase.from('conhecimento').select('id,trecho,material_id,versao').eq('topico_id', topic.id).eq('origem', `acervo-completo:${slug(topicName)}`).maybeSingle(),
      supabase.from('questao').select('id,enunciado,dificuldade').eq('topico_id', topic.id).eq('ativa', true).eq('marcada_errada', false),
      supabase.from('question_card').select('id,frente,tipo_card').eq('topico_id', topic.id).eq('ativa', true),
    ])
    if (existingQuestionsError || existingCardsError) throw existingQuestionsError || existingCardsError
    const questionCap = Math.min(30, Math.max(0, Number(req.body?.questionCap ?? 30) || 0))
    const cardCap = Math.min(50, Math.max(0, Number(req.body?.cardCap ?? 50) || 0))
    const questionCount = Math.min(questionCap, Math.max(0, 30 - (existingQuestions || []).length))
    const cardCount = Math.min(cardCap, Math.max(0, 50 - (existingCards || []).length))
    if (!force && knowledge?.versao === REVISION && questionCount === 0 && cardCount === 0) return res.status(200).json({ cache: true, index: requestedIndex, total: tasks.length, materia: spec.subject, topico: topicName, questoes: existingQuestions.length, cards: existingCards.length, versao: REVISION })

    await enforceRateLimit(supabase, 'reconstrucao_acervo', 450, 1440)
    const researched = await researchWithGrounding(chapterPrompt({ spec, topicName, scope, previous: knowledge?.trecho }), { model: String(req.body?.researchModel || 'gemini-3.1-flash-lite') })
    const chapter = String(researched.texto || '').trim().replace(/^```(?:markdown)?\s*/i, '').replace(/\s*```$/, '')
    if (wordCount(chapter) < 2500) throw new Error(`Capítulo insuficiente: ${wordCount(chapter)} palavras; mínimo de 2500.`)
    const sources = researched.fontes || []
    if (sources.length < 1) throw new Error('A pesquisa não retornou fonte rastreável.')
    const evidence = evidenceBlocks(chapter)
    if (evidence.length < 12) throw new Error('O capítulo não possui blocos de evidência suficientes.')

    const plannedDifficulty = difficultyPlan(existingQuestions || [], questionCount)
    const generated = questionCount || cardCount ? await generateJson({ prompt: trainingPrompt({ spec, topicName, evidence, questionCount, cardCount, difficultyPlan: plannedDifficulty, existingQuestions: (existingQuestions || []).map((item) => item.enunciado), existingCards: (existingCards || []).map((item) => item.frente) }), schema: trainingSchema, model: String(req.body?.generationModel || 'gemini-3.1-flash-lite') }) : { questoes: [], cards: [] }
    const training = validateTraining(generated, evidence, { questionCount, cardCount, difficultyPlan: plannedDifficulty })
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

    const questionRows = training.questions.map((item) => ({ topico_id: topic.id, tipo: item.tipo, enunciado: item.enunciado, alternativas: item.alternativas, gabarito: item.gabarito, explicacao: item.explicacao, comentarios_alternativas: item.comentarios_alternativas, fonte: source, trecho_fonte: item.evidencia, origem: 'ia', dificuldade: item.dificuldade, ativa: true, versao_conhecimento: REVISION, criado_em: now }))
    const cardRows = training.cards.map((item) => ({ objetivo_id: objective.id, materia_id: subject.id, topico_id: topic.id, chave: hash(`${REVISION}|${objective.id}|${topic.id}|${normalized(item.frente)}`), frente: item.frente, verso: item.verso, fonte: source, trecho_fonte: item.evidencia, proxima_revisao: now, ativa: true, ativo: true, tipo_card: item.tipoCard, dificuldade: item.dificuldade, versao_conhecimento: REVISION }))

    const [questionInsert, cardInsert] = await Promise.all([
      questionRows.length ? supabase.from('questao').insert(questionRows).select('id') : Promise.resolve({ data: [], error: null }),
      cardRows.length ? supabase.from('question_card').insert(cardRows).select('id') : Promise.resolve({ data: [], error: null }),
    ])
    if (questionInsert.error || cardInsert.error) throw questionInsert.error || cardInsert.error
    if (questionInsert.data.length !== questionCount || cardInsert.data.length !== cardCount) throw new Error('A expansão do tópico ficou incompleta.')

    return res.status(201).json({ cache: false, index: requestedIndex, total: tasks.length, materia: spec.subject, topico: topicName, palavras: wordCount(chapter), fontes: sources.length, questoes_adicionadas: questionCount, cards_adicionados: cardCount, questoes_total: existingQuestions.length + questionCount, cards_total: existingCards.length + cardCount, versao: REVISION })
  } catch (error) {
    return fail(res, error, 'Não foi possível reconstruir este capítulo com segurança.')
  }
}

export { REVISION }
