const letters = ['A', 'B', 'C', 'D', 'E']

export function normalizeQuestion(raw, { topicoId, origem, sources }) {
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

  const fonte = sources.length
    ? sources.map((source) => `${source.titulo}: ${source.url}`).join('\n')
    : String(raw.fonte || '').trim()

  const question = {
    topico_id: topicoId,
    tipo,
    enunciado: String(raw.enunciado || '').trim(),
    alternativas,
    gabarito,
    explicacao: String(raw.explicacao || '').trim(),
    fonte,
    trecho_fonte: String(raw.trecho_fonte || '').trim(),
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
        required: ['tipo', 'enunciado', 'alternativas', 'gabarito', 'explicacao', 'trecho_fonte'],
        properties: {
          tipo: { type: 'string', enum: ['CE', 'ME'] },
          enunciado: { type: 'string' },
          alternativas: {
            anyOf: [
              { type: 'null' },
              {
                type: 'object',
                required: letters,
                additionalProperties: false,
                properties: Object.fromEntries(letters.map((letter) => [letter, { type: 'string' }])),
              },
            ],
          },
          gabarito: { type: 'string', enum: ['A', 'B', 'C', 'D', 'E'] },
          explicacao: { type: 'string' },
          trecho_fonte: { type: 'string' },
        },
      },
    },
  },
}

export function generationPrompt({ materia, topico, quantidade, conhecimento }) {
  return `Voce e elaborador e revisor de itens para o concurso de Tecnico do Banco Central do Brasil, banca Cebraspe.

Pesquise fontes oficiais, atuais e confiaveis usando Google Search. Priorize legislacao vigente, manuais e paginas governamentais. Use o concurso BACEN 2013 e o edital BACEN 2024 apenas como referencia de escopo e estilo, pois ainda nao existe edital 2026 confirmado.

Materia: ${materia}
Topico: ${topico}
Quantidade: ${quantidade}

Conhecimento anexado pelo admin, quando houver:
${conhecimento || 'Nenhum material anexado para este topico.'}

Crie exatamente ${quantidade} questoes ineditas, dificeis mas inequivocas. Misture itens CE (Certo ou Errado, formato dominante) e ME (multipla escolha A a E). Se houver pelo menos duas questoes, inclua os dois tipos. Em CE, alternativas deve ser null e gabarito deve ser C ou E. Em ME, sempre produza A, B, C, D e E, com apenas uma correta.

Cada explicacao deve justificar o gabarito. Cada trecho_fonte deve ser uma citacao curta ou parafrase fiel do conteudo efetivamente pesquisado que sustenta o item. Nao invente artigos, sumulas, numeros, datas ou fontes. Se uma informacao nao puder ser confirmada, nao crie a questao.`
}

