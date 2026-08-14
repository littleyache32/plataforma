const letters = ['A', 'B', 'C', 'D', 'E']

export function normalizeQuestion(raw, { topicoId, origem, evidencias }) {
  const tipo = String(raw.tipo || '').toUpperCase()
  if (!['CE', 'ME'].includes(tipo)) throw new Error('Tipo de questao invalido.')

  const gabarito = String(raw.gabarito || '').toUpperCase()
  let alternativas = null
  let comentariosAlternativas = null
  if (tipo === 'CE') {
    if (!['C', 'E'].includes(gabarito)) throw new Error('Gabarito CE invalido.')
  } else {
    if (!letters.includes(gabarito)) throw new Error('Gabarito ME invalido.')
    const incoming = raw.alternativas || {}
    alternativas = Object.fromEntries(letters.map((letter) => [letter, String(incoming[letter] || '').trim()]))
    if (letters.some((letter) => !alternativas[letter])) throw new Error('Questao ME sem cinco alternativas.')
    const incomingComments = raw.comentarios_alternativas || {}
    comentariosAlternativas = Object.fromEntries(letters.map((letter) => [letter, String(incomingComments[letter] || '').trim()]))
    if (letters.some((letter) => !comentariosAlternativas[letter])) throw new Error('Questao ME sem comentario para cada alternativa.')
  }

  const evidenceId = Number(raw.evidencia_id)
  const evidence = evidencias.find((item) => item.id === evidenceId)
  if (!evidence) throw new Error('Questao sem evidencia individual valida.')
  const dificuldade = Number(raw.dificuldade)
  if (!Number.isInteger(dificuldade) || dificuldade < 1 || dificuldade > 5) throw new Error('Dificuldade invalida.')

  const question = {
    topico_id: topicoId,
    tipo,
    enunciado: String(raw.enunciado || '').trim(),
    alternativas,
    comentarios_alternativas: comentariosAlternativas,
    gabarito,
    explicacao: String(raw.explicacao || '').trim(),
    fonte: evidence.url ? `${evidence.titulo}: ${evidence.url}` : evidence.titulo,
    trecho_fonte: evidence.texto,
    origem,
    dificuldade,
  }
  if (!question.enunciado || !question.explicacao || !question.fonte || !question.trecho_fonte) {
    throw new Error('Questao sem conteudo ou proveniencia completa.')
  }
  return question
}

export const questionBatchSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['questoes'],
  properties: {
    questoes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['tipo', 'enunciado', 'alternativas', 'comentarios_alternativas', 'gabarito', 'explicacao', 'evidencia_id', 'dificuldade'],
        properties: {
          tipo: { type: 'string', enum: ['CE', 'ME'] },
          enunciado: { type: 'string' },
          alternativas: {
            anyOf: [
              { type: 'null' },
              { type: 'object', required: letters, additionalProperties: false, properties: Object.fromEntries(letters.map((letter) => [letter, { type: 'string' }])) },
            ],
          },
          comentarios_alternativas: {
            anyOf: [
              { type: 'null' },
              { type: 'object', required: letters, additionalProperties: false, properties: Object.fromEntries(letters.map((letter) => [letter, { type: 'string' }])) },
            ],
          },
          gabarito: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] },
          explicacao: { type: 'string' },
          evidencia_id: { type: 'integer' },
          dificuldade: { type: 'integer', minimum: 1, maximum: 5 },
        },
      },
    },
  },
}

export function researchPrompt({ objetivo, tipoObjetivo, banca, materia, topico }) {
  return `Pesquise informacoes atuais, verificaveis e suficientes para criar questoes de estudo.
Objetivo: ${objetivo} (${tipoObjetivo})
Banca ou contexto: ${banca || 'nao definido'}
Materia: ${materia}
Topico: ${topico}

Priorize fontes oficiais, legislacao vigente, manuais, documentos institucionais e referencias primarias. Quando consultar provas anteriores publicamente disponiveis, use-as apenas para reconhecer assuntos e estilo da banca: nao reproduza enunciados, alternativas ou explicacoes literalmente. Produza um dossie factual com afirmacoes curtas e autocontidas. Nao crie questoes ainda. Nao inclua informacao que nao esteja sustentada pelas fontes pesquisadas.`
}

export function disciplineQuestionBatchSchema(topicIds) {
  return {
    ...questionBatchSchema,
    properties: {
      questoes: {
        ...questionBatchSchema.properties.questoes,
        items: {
          ...questionBatchSchema.properties.questoes.items,
          required: [...questionBatchSchema.properties.questoes.items.required, 'topico_id'],
          properties: {
            ...questionBatchSchema.properties.questoes.items.properties,
            topico_id: { type: 'string', enum: topicIds },
          },
        },
      },
    },
  }
}

export function generationPrompt({ objetivo, tipoObjetivo, banca, materia, topico, quantidade, evidencias }) {
  const blocks = evidencias.map((item) => `[EVIDENCIA ${item.id}]\n${item.texto}\nFONTE: ${item.titulo}${item.url ? ` | ${item.url}` : ''}`).join('\n\n')
  const format = tipoObjetivo === 'concurso'
    ? `Siga o estilo ${banca || 'da banca informada'}. Para Cebraspe, misture CE e ME e use CE como formato dominante.`
    : 'Crie questoes academicas objetivas adequadas ao nivel da disciplina.'
  return `Crie exatamente ${quantidade} questoes ineditas para o objetivo ${objetivo}.
Materia: ${materia}
Topico: ${topico}
${format}

Use somente os blocos abaixo. Cada questao deve informar evidencia_id de um unico bloco que sustente diretamente enunciado, gabarito e explicacao. Nao misture fontes na mesma questao. Em CE, alternativas e comentarios_alternativas devem ser null e gabarito C ou E. Em ME, produza A, B, C, D e E com uma unica correta e um comentario individual que explique por que cada alternativa esta correta ou errada. Se houver pelo menos duas questoes para uma banca Cebraspe, inclua CE e ME.

${blocks}`
}

export function disciplineGenerationPrompt({ objetivo, tipoObjetivo, banca, materia, quantidade, distribuicao, dificuldades, evidencias }) {
  const blocks = evidencias.map((item) => `[EVIDENCIA ${item.id}] [TOPICO ${item.topicoId || 'GERAL'}]\n${item.texto}\nFONTE: ${item.titulo}${item.url ? ` | ${item.url}` : ''}`).join('\n\n')
  const allocation = distribuicao.map((item) => `- ${item.topicoId} | ${item.topico}: ${item.quantidade} questoes`).join('\n')
  const format = tipoObjetivo === 'concurso'
    ? `Siga o estilo ${banca || 'da banca informada'}. Para Cebraspe, misture CE e ME e use CE como formato dominante.`
    : 'Crie questoes academicas objetivas adequadas ao nivel da disciplina.'
  return `Crie exatamente ${quantidade} questoes ineditas para a disciplina ${materia}, no objetivo ${objetivo}.
${format}

O lote foi solicitado por disciplina. Respeite exatamente a distribuicao decidida pelo mentor:
${allocation}

Distribuicao exata de dificuldade do lote: ${dificuldades.faceis} faceis (nivel 1 ou 2), ${dificuldades.medias} medias (nivel 3) e ${dificuldades.dificeis} dificeis (nivel 4 ou 5).
Cada questao deve informar topico_id, dificuldade e evidencia_id. A evidencia deve ser geral ou pertencer ao mesmo topico_id da questao e sustentar diretamente enunciado, gabarito e explicacao. Nao misture fontes na mesma questao. Em CE, alternativas e comentarios_alternativas devem ser null e gabarito C ou E. Em ME, produza A, B, C, D e E com uma unica correta e comentario individual para cada alternativa. Se houver pelo menos duas questoes para uma banca Cebraspe, inclua CE e ME.

${blocks}`
}
