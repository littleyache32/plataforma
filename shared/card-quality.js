import { normalizeContent } from './question-quality.js'

export function inferCardType(card) {
  const front = normalizeContent(card.frente)
  if (/erro|incorret|corrija|armadilha/.test(front)) return 'correcao'
  if (/diferenca|diferencie|compare|distincao/.test(front)) return 'distincao'
  if (/exceto|excecao|salvo|quando nao|hipotese especial/.test(front)) return 'excecao'
  if (/por que|como se aplica|caso|situacao|exemplo/.test(front)) return 'aplicacao'
  return 'recordacao'
}

export function auditCard(card, duplicate = false) {
  const reasons = []
  const warnings = []
  const front = String(card.frente || '').trim()
  const back = String(card.verso || '').trim()
  if (duplicate) reasons.push('duplicado_no_topico')
  if (front.length < 12 || front.length > 350) reasons.push('frente_inadequada')
  if (back.length < 2 || back.length > 1400) reasons.push('verso_inadequado')
  if (String(card.fonte || '').trim().length < 10) reasons.push('fonte_ausente')
  if (String(card.trecho_fonte || '').trim().length < 40) reasons.push('evidencia_insuficiente')
  if (!/[?]$/.test(front) && !/^(defina|diferencie|compare|complete|corrija|identifique)/i.test(front)) warnings.push('frente_pouco_interrogativa')
  if (/^(sim|não|nao)\.?$/i.test(back)) warnings.push('resposta_sem_fundamento')
  return { approved: reasons.length === 0, reasons, warnings, tipoCard: inferCardType(card) }
}
