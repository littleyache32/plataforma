import { resolveMentorPolicy } from './mentor-policy.js'

export function calculateTopicDiagnosis(records, customPolicy = {}) {
  const policy = resolveMentorPolicy(customPolicy)
  const ordered = [...records]
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
    .slice(0, policy.janela_maxima)

  if (ordered.length < policy.amostra_minima) {
    return { status: 'coletando_dados', amostra: ordered.length, faltam: policy.amostra_minima - ordered.length, versao_politica: policy.versao }
  }

  const newestTime = new Date(ordered[0].criado_em).getTime()
  let totalWeight = 0
  let alpha = policy.prior_beta.acertos
  let beta = policy.prior_beta.erros
  let falseCertaintyWeight = 0
  let errorWeight = 0

  ordered.forEach((record) => {
    const ageDays = Math.max(0, newestTime - new Date(record.criado_em).getTime()) / 86_400_000
    const recency = 0.5 ** (ageDays / policy.meia_vida_recencia_dias)
    const outcome = record.resultado === 'acerto' ? 'acerto' : 'erro'
    const confidence = policy.pesos_confianca[record.classificacao] || { acerto: 1, erro: 1 }
    const weight = recency * confidence[outcome]
    totalWeight += weight
    if (record.resultado === 'acerto') alpha += weight
    else beta += weight
    if (record.resultado === 'erro') errorWeight += weight
    if (record.resultado === 'erro' && record.classificacao === 'certeza') falseCertaintyWeight += weight
  })

  const mastery = alpha / (alpha + beta)
  const falseCertainty = falseCertaintyWeight / totalWeight
  const errorRate = errorWeight / totalWeight
  const masteryIn = (slice) => slice.filter((r) => r.resultado === 'acerto' && r.classificacao === 'certeza').length / slice.length
  const recent = masteryIn(ordered.slice(0, 5))
  const previous = masteryIn(ordered.slice(5, 10))
  const improving = recent - previous >= policy.limiares.melhora_recente && !ordered.slice(0, 5).some((r) => r.resultado === 'erro' && r.classificacao === 'certeza')
  const needsPriority = (mastery < policy.limiares.dominio || falseCertainty >= policy.limiares.falsa_certeza) && !improving
  const uncertainty = 1.96 * Math.sqrt((mastery * (1 - mastery)) / (alpha + beta + 1))
  const gravity = falseCertainty * 2.5 + (1 - mastery) * 1.2 + errorRate * 0.3 + uncertainty * 0.4

  return {
    status: needsPriority ? 'prioridade' : improving ? 'melhorando' : 'estavel',
    amostra: ordered.length,
    dominio: Math.round(mastery * 100),
    falsa_certeza: Math.round(falseCertainty * 100),
    erro: Math.round(errorRate * 100),
    probabilidade_dominio: Math.round(mastery * 100),
    incerteza_estimativa: Math.round(uncertainty * 100),
    gravidade: Number(gravity.toFixed(4)),
    versao_politica: policy.versao,
  }
}

export function scoreboard(records) {
  const total = records.length
  const acertos = records.filter((r) => r.resultado === 'acerto').length
  const dominio = records.filter((r) => r.resultado === 'acerto' && r.classificacao === 'certeza').length
  const falsaCerteza = records.filter((r) => r.resultado === 'erro' && r.classificacao === 'certeza').length
  const percent = (value) => total ? Math.round((value / total) * 100) : 0
  return {
    total,
    acerto_bruto: percent(acertos),
    acerto_com_certeza: percent(dominio),
    falsa_certeza: percent(falsaCerteza),
  }
}

