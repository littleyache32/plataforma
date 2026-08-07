const letters = ['A', 'B', 'C', 'D', 'E']

export function normalizeQuestion(raw, { topicoId, origem, evidencias }) {
  const tipo = String(raw.tipo || '').toUpperCase()
  if (!['CE', 'ME'].includes(tipo)) throw new Error('Tipo de questao invalido.')

  const gabarito = String(raw.gabarito || '').toUpperCase()
  let alternativas = null
  if (tipo === 'CE') {
    if (!['C', 'E'].includes(gabarito)) throw new Error('Gabarito CE invalido.')
  } else {
    if (!letters.includes(gabarito)) throw new Error('Gabarito ME invalido.')
    const incoming = raw.alternativas || {}
    alternativas = Object.fromEntries(letters.map((letter) => [letter, String(incoming[letter] || '').trim()]))
    if (letters.some((letter) => !alternativas[letter])) throw new Error('Questao ME sem cinco alternativas.')
  }

  const evidenceId = Number(raw.evidencia_id)
  const evidence = evidencias.find((item) => item.id === evidenceId)
  if (!evidence) throw new Error('Questao sem evidencia individual valida.')

  const question = {
    topico_id: topicoId,
    tipo,
    enunciado: String(raw.enunciado || '').trim(),
    alternativas,
    gabarito,
    explicacao: String(raw.explicacao || '').trim(),
    fonte: evidence.url ? `${evidence.titulo}: ${evidence.url}` : evidence.titulo,
    trecho_fonte: evidence.texto,
    origem,
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
        required: ['tipo', 'enunciado', 'alternativas', 'gabarito', 'explicacao', 'evidencia_id'],
        properties: {
          tipo: { type: 'string', enum: ['CE', 'ME'] },
          enunciado: { type: 'string' },
          alternativas: {
            anyOf: [
              { type: 'null' },
              { type: 'object', required: letters, additionalProperties: false, properties: Object.fromEntries(letters.map((letter) => [letter, { type: 'string' }])) },
            ],
          },
          gabarito: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] },
          explicacao: { type: 'string' },
          evidencia_id: { type: 'integer' },
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

Priorize fontes oficiais, legislacao vigente, manuais, documentos institucionais e referencias primarias. Produza um dossie factual com afirmacoes curtas e autocontidas. Nao crie questoes ainda. Nao inclua informacao que nao esteja sustentada pelas fontes pesquisadas.`
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

Use somente os blocos abaixo. Cada questao deve informar evidencia_id de um unico bloco que sustente diretamente enunciado, gabarito e explicacao. Nao misture fontes na mesma questao. Em CE, alternativas deve ser null e gabarito C ou E. Em ME, produza A, B, C, D e E com uma unica correta. Se houver pelo menos duas questoes para uma banca Cebraspe, inclua CE e ME.

${blocks}`
}
