const letters = ['A', 'B', 'C', 'D', 'E']
const stopWords = new Set(['a','ao','aos','as','com','como','da','das','de','do','dos','e','em','entre','essa','esse','esta','este','foi','na','nas','no','nos','o','os','ou','para','por','qual','que','se','sem','ser','sua','um','uma'])

export function normalizeContent(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR').replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ').trim()
}

function meaningfulTokens(value) {
  return new Set(normalizeContent(value).split(' ').filter((item) => item.length >= 4 && !stopWords.has(item)))
}

function hasEvidenceOverlap(question) {
  const claim = meaningfulTokens(`${question.enunciado} ${question.explicacao} ${question.tipo === 'ME' ? Object.values(question.alternativas || {}).join(' ') : ''}`)
  const evidence = meaningfulTokens(question.trecho_fonte)
  let overlap = 0
  for (const token of claim) if (evidence.has(token)) overlap += 1
  return overlap >= 2
}

export function auditQuestion(question, duplicate = false) {
  const reasons = []
  const warnings = []
  const statement = String(question.enunciado || '').trim()
  const explanation = String(question.explicacao || '').trim()
  const source = String(question.fonte || '').trim()
  const evidence = String(question.trecho_fonte || '').trim()
  if (duplicate) reasons.push('duplicada_no_topico')
  if (statement.length < 25 || statement.length > 1400) reasons.push('enunciado_inadequado')
  if (/\b(professor|gabarito|questão anterior|alternativa [a-e]|letra [a-e])\b/i.test(statement)) reasons.push('ruido_editorial_no_enunciado')
  if (explanation.length < 25 || explanation.length > 5000) reasons.push('explicacao_inadequada')
  if (source.length < 10) reasons.push('fonte_ausente')
  if (evidence.length < 40) reasons.push('evidencia_insuficiente')
  if (!Number.isInteger(Number(question.dificuldade)) || Number(question.dificuldade) < 1 || Number(question.dificuldade) > 5) reasons.push('dificuldade_invalida')
  if (question.tipo === 'CE') {
    if (question.alternativas !== null || !['C', 'E'].includes(question.gabarito)) reasons.push('formato_ce_invalido')
  } else if (question.tipo === 'ME') {
    const alternatives = question.alternativas || {}
    if (letters.some((letter) => !String(alternatives[letter] || '').trim()) || !letters.includes(question.gabarito)) reasons.push('formato_me_invalido')
    const unique = new Set(letters.map((letter) => normalizeContent(alternatives[letter])))
    if (unique.size !== 5) reasons.push('alternativas_duplicadas')
  } else reasons.push('tipo_invalido')
  if (evidence.length >= 40 && !hasEvidenceOverlap(question)) warnings.push('vinculo_textual_fraco_com_evidencia')
  if (/evid[eê]ncia\s+\d+/i.test(explanation)) warnings.push('explicacao_menciona_id_interno')
  if (/\b(conjunto|formulação)\s+\d+\b/i.test(statement)) warnings.push('numeracao_artificial_no_enunciado')
  if (/^\s*(esse|essa|estes|estas|isso|isto|ele|ela|eles|elas)\b/i.test(statement.replace(/^A respeito de[^:]*:\s*/i, ''))) warnings.push('referencia_possivelmente_descontextualizada')
  if (question.tipo === 'ME' && !question.comentarios_alternativas) warnings.push('comentarios_individuais_pendentes')
  return { approved: reasons.length === 0, reasons, warnings, checks: { formato: !reasons.some((item) => item.includes('formato') || item === 'tipo_invalido'), fonte: !reasons.includes('fonte_ausente'), evidencia: !reasons.includes('evidencia_insuficiente'), vinculo_textual: !warnings.includes('vinculo_textual_fraco_com_evidencia'), unicidade: !duplicate } }
}
