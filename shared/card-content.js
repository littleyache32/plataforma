const compact = (value) => String(value || '').replace(/\s+/g, ' ').trim()

const withoutFinalPeriod = (value) => compact(value).replace(/[.]$/, '')

function shortClause(value, limit = 220) {
  const text = withoutFinalPeriod(value)
  if (text.length <= limit) return text
  const clause = text.split(/;|,\s+(?:sendo|pois|porque|embora|quando|enquanto)\b/i)[0]
  return clause.length >= 24 && clause.length <= limit ? clause : text.slice(0, limit).replace(/\s+\S*$/, '')
}

function promptExcerpt(value, limit = 180) {
  const text = withoutFinalPeriod(value)
  if (text.length <= limit) return text
  return `${text.slice(0, limit).replace(/\s+\S*$/, '')}…`
}

function clozeExcerpt(value, limit = 180) {
  const text = withoutFinalPeriod(value)
  const marker = text.indexOf('[...]')
  if (text.length <= limit || marker < 0) return promptExcerpt(text, limit)
  const roughStart = Math.max(0, marker - 70)
  const roughEnd = Math.min(text.length, marker + 105)
  const start = roughStart ? text.indexOf(' ', roughStart) + 1 : 0
  const lastSpace = text.lastIndexOf(' ', roughEnd)
  const end = roughEnd < text.length && lastSpace > marker ? lastSpace : roughEnd
  return `${start ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`
}

export function buildEfficientCardContent(claimValue, topicValue) {
  const claim = compact(claimValue)
  const topic = compact(topicValue)
  const sentence = withoutFinalPeriod(claim)
  if (/^\d|^[A-E]\s*[).]|^(iremos|veremos|estudaremos|analisaremos|abordaremos|vamos|com base nisso|nesse contexto|neste contexto|nesse sentido|dessa forma|assim,|ao seu turno|agora,|ou seja|para tanto|em regra|em outras palavras|no entanto|portanto|este\b|esta\b|estes\b|estas\b|esse\b|essa\b|esses\b|essas\b|isso\b|é\b|embora\b|já\b|veja\b|na internet,)/i.test(sentence)) return null
  if (/\[\d{1,3}\]/.test(sentence) || /\b(nesta aula|neste curso|adiante veremos|como vimos|já vimos|tenta clicar|clique|perceba|observe|banca|candidato|professor)\b/i.test(sentence)) return null
  if (/\b(?:art|arts|p|pp)\.$/i.test(sentence) || /[(,:;]$/.test(sentence)) return null
  if ((sentence.match(/[“”]/g) || []).length % 2) return null

  const cause = sentence.match(/^(.{12,160}?)\s+(provoca|causa|reduz|aumenta|resulta em|implica|acarreta)\s+(.{12,240})$/i)
  if (cause) return {
    frente: `[${topic}] Qual é o principal efeito de ${withoutFinalPeriod(cause[1])}? (efeito principal)`,
    respostaDireta: shortClause(cause[3], 180), explicacaoCurta: claim,
    modeloCard: 'causa_efeito', dicaEscopo: 'efeito principal',
  }

  const definition = sentence.match(/^(.{5,120}?)\s+(é|são|consiste em|corresponde a|refere-se a|representa)\s+(.{12,300})$/i)
  if (definition) {
    const subject = withoutFinalPeriod(definition[1]).replace(/^(o|a|os|as|um|uma)\s+/i, '')
    const subjectIsAtomic = subject.split(/\s+/).length <= 12 && !/[,;:]/.test(subject)
    if (subjectIsAtomic) return {
      frente: `[${topic}] Como se define ${subject}? (definição objetiva)`,
      respostaDireta: shortClause(definition[3]), explicacaoCurta: claim,
      modeloCard: 'pergunta_resposta', dicaEscopo: 'definição objetiva',
      alternativa: {
        frente: `[${topic}] Qual conceito corresponde a “${promptExcerpt(definition[3], 155)}”? (conceito ou instituto)`,
        respostaDireta: subject, explicacaoCurta: claim,
        modeloCard: 'pergunta_resposta', dicaEscopo: 'conceito ou instituto',
      },
    }
  }

  const numericContext = /\b(percentual|por cento|prazo|dias?|meses?|anos?|horas?|artigo|arts?\.|lei|constitui[cç][aã]o|data|idade|mandato)\b|%/i.test(sentence)
  const number = numericContext ? sentence.match(/\b\d+(?:[.,]\d+)?%?\b/) : null
  if (number) return {
    frente: `[${topic}] Complete: ${clozeExcerpt(sentence.replace(number[0], '[...]'))}. (número, percentual ou data)`,
    respostaDireta: number[0], explicacaoCurta: claim,
    modeloCard: 'cloze', dicaEscopo: 'número, percentual ou data',
  }

  const subject = sentence.match(/^(.{8,130}?)\s+(deve|devem|pode|podem|possui|possuem|tem|têm|inclui|incluem|exige|exigem|permite|permitem|compreende|compreendem|apresenta|apresentam|utiliza|utilizam|era|eram|foi|foram|será|serão|geralmente começa|começa|ocorre|ocorrem|funciona|funcionam|caracteriza-se por|baseia-se em|divide-se em|compõe-se de)\s+(.{15,320})$/i)
  if (subject && subject[1].split(/\s+/).length <= 12 && !/[,;:]/.test(subject[1])) return {
    frente: `[${topic}] Complete: [...] ${subject[2]} ${promptExcerpt(subject[3])}. (conceito ou instituto)`,
    respostaDireta: withoutFinalPeriod(subject[1]), explicacaoCurta: claim,
    modeloCard: 'cloze', dicaEscopo: 'conceito ou instituto',
  }

  return null
}
