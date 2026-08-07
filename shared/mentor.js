const MIN_SAMPLE = 20

export function calculateTopicDiagnosis(records) {
  const ordered = [...records]
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
    .slice(0, MIN_SAMPLE)

  if (ordered.length < MIN_SAMPLE) {
    return { status: 'coletando_dados', amostra: ordered.length, faltam: MIN_SAMPLE - ordered.length }
  }

  let totalWeight = 0
  let masteryWeight = 0
  let falseCertaintyWeight = 0
  let errorWeight = 0

  ordered.forEach((record, index) => {
    const weight = 1 - index * (0.5 / Math.max(ordered.length - 1, 1))
    totalWeight += weight
    if (record.resultado === 'acerto' && record.classificacao === 'certeza') masteryWeight += weight
    if (record.resultado === 'erro') errorWeight += weight
    if (record.resultado === 'erro' && record.classificacao === 'certeza') falseCertaintyWeight += weight
  })

  const mastery = masteryWeight / totalWeight
  const falseCertainty = falseCertaintyWeight / totalWeight
  const errorRate = errorWeight / totalWeight
  const masteryIn = (slice) => slice.filter((r) => r.resultado === 'acerto' && r.classificacao === 'certeza').length / slice.length
  const recent = masteryIn(ordered.slice(0, 5))
  const previous = masteryIn(ordered.slice(5, 10))
  const improving = recent - previous >= 0.2 && !ordered.slice(0, 5).some((r) => r.resultado === 'erro' && r.classificacao === 'certeza')
  const needsPriority = (mastery < 0.6 || falseCertainty >= 0.15) && !improving
  const gravity = falseCertainty * 2.5 + (1 - mastery) * 1.2 + errorRate * 0.3

  return {
    status: needsPriority ? 'prioridade' : improving ? 'melhorando' : 'estavel',
    amostra: ordered.length,
    dominio: Math.round(mastery * 100),
    falsa_certeza: Math.round(falseCertainty * 100),
    erro: Math.round(errorRate * 100),
    gravidade: Number(gravity.toFixed(4)),
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

