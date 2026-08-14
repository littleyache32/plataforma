import { resolveMentorPolicy } from './mentor-policy.js'

export function mentorPhase(date = new Date().toISOString().slice(0, 10)) {
  if (date < '2026-08-17') {
    return { id: 'aguardando_inicio', titulo: 'Preparação para o início', descricao: 'A mentoria começa em 17 de agosto. Nenhuma carga anterior será criada.' }
  }
  if (date >= '2026-08-17' && date <= '2026-08-30') {
    return { id: 'construcao_base', titulo: 'Construção da base', descricao: 'Retorno gradual ao ritmo: duas horas na primeira semana e até três na segunda, sem questões ou Question Cards.' }
  }
  if (date < '2026-09-07') {
    return { id: 'pratica_progressiva', titulo: 'Prática progressiva', descricao: 'Estudo, questões e revisões espaçadas entram gradualmente conforme o desempenho.' }
  }
  return { id: 'adaptativa', titulo: 'Preparação adaptativa', descricao: 'O mentor combina estudo, revisão, questões e simulados conforme as evidências.' }
}

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

export function topicSignals({ diagnosis, totalQuestions = 0, unusedQuestions = 0, dueCards = 0, dueQuestions = 0, lastSeenAt = null, averageSeconds = 0, overdue = 0 }) {
  const daysSince = lastSeenAt ? Math.max(0, (Date.now() - new Date(lastSeenAt).getTime()) / 86_400_000) : 30
  const forgettingRisk = Math.min(1, 1 - (0.5 ** (daysSince / 21)))
  const coverage = totalQuestions ? 1 - (unusedQuestions / totalQuestions) : 0
  const uncertainty = (diagnosis.incerteza_estimativa ?? 50) / 100
  const mastery = (diagnosis.probabilidade_dominio ?? diagnosis.dominio ?? 0) / 100
  const priority = (1 - mastery) * 1.2 + forgettingRisk * 0.8 + ((diagnosis.falsa_certeza || 0) / 100) * 2.5 + uncertainty * 0.4 + Math.min(1, overdue / 3) * 0.5 + Math.min(1, dueQuestions / 5) * 0.7
  return { ...diagnosis, risco_esquecimento: Math.round(forgettingRisk * 100), cobertura: Math.round(coverage * 100), questoes_ineditas: unusedQuestions, questoes_para_revisar: dueQuestions, cards_vencidos: dueCards, tempo_medio: averageSeconds, atraso: overdue, prioridade_calculada: Number(priority.toFixed(4)) }
}

export function buildScenarios({ coveredTopics, totalTopics, daysRemaining = 180, weeklyMinutes = 1260 }) {
  const coverage = totalTopics ? coveredTopics / totalTopics : 0
  const remaining = Math.max(0, totalTopics - coveredTopics)
  const hoursRemaining = remaining * 3
  const weeklyHours = weeklyMinutes / 60
  const weeks = Math.max(1, daysRemaining / 7)
  const capacity = weeklyHours * weeks
  return [
    ['conservador', 0.75], ['provavel', 1], ['acelerado', 1.2],
  ].map(([cenario, factor]) => ({ cenario, cobertura_estimada: Math.min(100, Math.round((coverage + (capacity * factor / Math.max(hoursRemaining, 1)) * (1 - coverage)) * 100)), horas_restantes: hoursRemaining, risco_atraso: Number(Math.max(0, Math.min(1, 1 - capacity * factor / Math.max(hoursRemaining, 1))).toFixed(4)) }))
}

export function simulationEligibility({ date, adherence = 0, answeredQuestions = 0, overdueDemands = 0 }) {
  if (date < '2026-09-07') {
    return { eligible: false, reason: 'construcao_de_base', availableFrom: '2026-09-07' }
  }
  const signals = {
    adherenceEnough: adherence >= 0.75,
    practiceSampleEnough: answeredQuestions >= 40,
    backlogControlled: overdueDemands <= 3,
  }
  return {
    eligible: Object.values(signals).every(Boolean),
    reason: Object.values(signals).every(Boolean) ? 'mentor_pode_programar' : 'criterios_pedagogicos_insuficientes',
    availableFrom: '2026-09-07',
    signals,
  }
}

