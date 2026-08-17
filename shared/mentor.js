import { resolveMentorPolicy } from './mentor-policy.js'

export function mentorPhase(date = new Date().toISOString().slice(0, 10)) {
  if (date < '2026-08-17') {
    return { id: 'aguardando_inicio', titulo: 'Preparação para o início', descricao: 'A mentoria começa em 17 de agosto. Nenhuma carga anterior será criada.' }
  }
  if (date >= '2026-08-17' && date <= '2026-08-30') {
    return { id: 'construcao_base', titulo: 'Construção da base', descricao: 'Dois blocos de Faculdade e dois de BACEN nos dias úteis enquanto a Faculdade estiver atrasada. No fim de semana, dois blocos BACEN, sem questões nem Question Cards nas duas primeiras semanas.' }
  }
  if (date < '2026-09-07') {
    return { id: 'pratica_progressiva', titulo: 'Prática progressiva', descricao: 'Estudo, questões e revisões espaçadas entram gradualmente conforme o desempenho.' }
  }
  return { id: 'adaptativa', titulo: 'Preparação adaptativa', descricao: 'O mentor combina estudo, revisão, questões e simulados conforme as evidências.' }
}

export function classifyQuestionAttempts(records = [], minimumDelayDays = 2) {
  const byQuestion = new Map()
  for (const record of records) {
    const questionId = record.questao?.id || record.questao_id
    if (!questionId) continue
    byQuestion.set(questionId, [...(byQuestion.get(questionId) || []), record])
  }
  const classified = []
  for (const attempts of byQuestion.values()) {
    const ordered = [...attempts].sort((a, b) => new Date(a.criado_em) - new Date(b.criado_em))
    ordered.forEach((record, index) => {
      const previous = ordered[index - 1]
      const delayDays = previous ? Math.max(0, new Date(record.criado_em) - new Date(previous.criado_em)) / 86_400_000 : null
      classified.push({
        ...record,
        inedita: index === 0,
        reteste_espacado: index > 0 && delayDays >= minimumDelayDays,
        intervalo_desde_tentativa_anterior_dias: delayDays === null ? null : Number(delayDays.toFixed(2)),
      })
    })
  }
  return classified.sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
}

export function calculateTopicDiagnosis(records, customPolicy = {}) {
  const policy = resolveMentorPolicy(customPolicy)
  const raw = [...records]
    .sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em))
    .slice(0, policy.janela_maxima)
  const evidenceAnnotated = raw.some((record) => Object.hasOwn(record, 'inedita') || Object.hasOwn(record, 'reteste_espacado'))
  const ordered = evidenceAnnotated ? raw.filter((record) => record.inedita || record.reteste_espacado) : raw
  const unseenCount = evidenceAnnotated ? ordered.filter((record) => record.inedita).length : ordered.length
  const delayedCount = ordered.filter((record) => record.reteste_espacado).length
  const retentionMinimum = policy.evidencia_individual?.retestes_espacados_minimos || 2
  const retentionConfirmed = !evidenceAnnotated || delayedCount >= retentionMinimum

  if (ordered.length < policy.amostra_minima) {
    return { status: 'coletando_dados', amostra: ordered.length, faltam: policy.amostra_minima - ordered.length, questoes_ineditas_avaliadas: unseenCount, retestes_espacados: delayedCount, retencao_confirmada: retentionConfirmed, versao_politica: policy.versao }
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
    status: needsPriority ? 'prioridade' : !retentionConfirmed ? 'coletando_retencao' : improving ? 'melhorando' : 'estavel',
    amostra: ordered.length,
    dominio: Math.round(mastery * 100),
    falsa_certeza: Math.round(falseCertainty * 100),
    erro: Math.round(errorRate * 100),
    probabilidade_dominio: Math.round(mastery * 100),
    incerteza_estimativa: Math.round(uncertainty * 100),
    gravidade: Number(gravity.toFixed(4)),
    questoes_ineditas_avaliadas: unseenCount,
    retestes_espacados: delayedCount,
    retencao_confirmada: retentionConfirmed,
    limiares: 'parametros_operacionais_calibraveis',
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

export function calculateCardRetention(records = [], cards = [], customPolicy = {}, now = new Date()) {
  const policy = resolveMentorPolicy(customPolicy)
  const config = policy.retencao_cards
  const ordered = [...records].sort((a, b) => new Date(b.criado_em) - new Date(a.criado_em)).slice(0, config.janela_maxima)
  const counts = {
    novamente: ordered.filter((item) => ['novamente', 'revisar'].includes(item.resultado)).length,
    dificil: ordered.filter((item) => item.resultado === 'dificil').length,
    bom: ordered.filter((item) => ['bom', 'lembrei'].includes(item.resultado)).length,
    facil: ordered.filter((item) => item.resultado === 'facil').length,
  }
  const due = cards.filter((card) => card.ativo !== false && card.proxima_revisao && new Date(card.proxima_revisao) <= now)
  const averageDelay = due.length ? due.reduce((sum, card) => sum + Math.max(0, now - new Date(card.proxima_revisao)) / 86_400_000, 0) / due.length : 0
  const total = ordered.length
  const rate = (value) => total ? value / total : 0
  const recall = total ? (counts.bom + counts.facil) / total : 0
  const recent = ordered.slice(0, config.janela_tendencia)
  const previous = ordered.slice(config.janela_tendencia, config.janela_tendencia * 2)
  const recallOf = (items) => items.length ? items.filter((item) => ['bom', 'facil', 'lembrei'].includes(item.resultado)).length / items.length : null
  const recentRecall = recallOf(recent)
  const previousRecall = recallOf(previous)
  const enough = total >= config.amostra_minima
  const weak = enough && (rate(counts.novamente) >= config.limite_novamente || rate(counts.dificil) >= config.limite_dificil)
  const improving = enough && previousRecall !== null && recentRecall - previousRecall >= 0.2
  return {
    status: !enough ? 'coletando_dados' : weak && !improving ? 'retencao_fraca' : improving ? 'melhorando' : 'estavel',
    amostra: total,
    faltam: Math.max(0, config.amostra_minima - total),
    novamente: counts.novamente,
    dificil: counts.dificil,
    bom: counts.bom,
    facil: counts.facil,
    taxa_recuperacao: Math.round(recall * 100),
    lapsos: cards.reduce((sum, card) => sum + Number(card.lapsos || 0), 0),
    cards_vencidos: due.length,
    atraso_medio_dias: Number(averageDelay.toFixed(1)),
    estabilidade_recente: recentRecall === null ? null : Math.round(recentRecall * 100),
    tendencia: improving ? 'melhora' : weak ? 'queda_ou_instabilidade' : 'estavel',
  }
}

export function calculateStudyEfficiency(timers = [], diagnosis = {}, cardRetention = {}, customPolicy = {}) {
  const policy = resolveMentorPolicy(customPolicy)
  const completed = timers.filter((item) => item.status === 'concluido' && Number(item.segundos_acumulados) > 0)
  const minutes = completed.reduce((sum, item) => sum + Number(item.segundos_acumulados), 0) / 60
  const enough = completed.length >= policy.eficiencia_estudo.sessoes_minimas && minutes >= policy.eficiencia_estudo.minutos_minimos
  const weakPerformance = diagnosis.status === 'prioridade' || cardRetention.status === 'retencao_fraca'
  return {
    status: !enough ? 'coletando_dados' : weakPerformance ? 'alto_tempo_baixo_resultado' : 'estavel',
    sessoes: completed.length,
    minutos: Math.round(minutes),
    sinal_confirmado: enough && weakPerformance,
  }
}

export function topicSignals({ diagnosis, cardRetention = {}, studyEfficiency = {}, totalQuestions = 0, unusedQuestions = 0, dueCards = 0, dueQuestions = 0, lastSeenAt = null, averageSeconds = 0, overdue = 0, subjectWeight = 1, incidence = 0, commitmentWeight = 0, customPolicy = {} }) {
  const policy = resolveMentorPolicy(customPolicy)
  const coefficients = policy.prioridade_topico.coeficientes
  const daysSince = lastSeenAt ? Math.max(0, (Date.now() - new Date(lastSeenAt).getTime()) / 86_400_000) : 30
  const forgettingRisk = Math.min(1, 1 - (0.5 ** (daysSince / 21)))
  const coverage = totalQuestions ? 1 - (unusedQuestions / totalQuestions) : 0
  const uncertainty = (diagnosis.incerteza_estimativa ?? 50) / 100
  const mastery = (diagnosis.probabilidade_dominio ?? diagnosis.dominio ?? 0) / 100
  const sufficientQuestionSample = !['coletando_dados', 'coletando_retencao'].includes(diagnosis.status)
  const cardWeak = cardRetention.status === 'retencao_fraca'
  const questionWeak = sufficientQuestionSample && diagnosis.status === 'prioridade'
  const priority =
    (sufficientQuestionSample ? (1 - mastery) * coefficients.dominio_insuficiente + ((diagnosis.falsa_certeza || 0) / 100) * coefficients.falsa_certeza + uncertainty * coefficients.incerteza_amostral : 0)
    + forgettingRisk * coefficients.esquecimento
    + Math.min(1, overdue / 3) * coefficients.atraso
    + Math.min(1, dueQuestions / 5) * coefficients.revisao_vencida
    + Math.max(0, Number(subjectWeight) - 1) * coefficients.peso_prova
    + Math.max(0, Number(incidence)) * coefficients.incidencia
    + (cardWeak ? coefficients.retencao_fraca : 0)
    + (studyEfficiency.sinal_confirmado ? coefficients.baixa_eficiencia_confirmada : 0)
    + Math.min(1, Number(commitmentWeight) / 5) * coefficients.compromisso_proximo
  const action = cardWeak && questionWeak ? 'revisar_conteudo' : cardWeak ? 'revisar_cards' : questionWeak ? 'resolver_questoes' : sufficientQuestionSample ? 'manutencao' : 'estudar'
  return { ...diagnosis, retencao_cards: cardRetention, eficiencia_estudo: studyEfficiency, acao_recomendada: action, risco_esquecimento: Math.round(forgettingRisk * 100), cobertura: Math.round(coverage * 100), questoes_ineditas: unusedQuestions, questoes_para_revisar: dueQuestions, cards_vencidos: dueCards, tempo_medio: averageSeconds, atraso: overdue, peso_prova: Number(subjectWeight), incidencia: Number(incidence), prioridade_calculada: Number(priority.toFixed(4)) }
}

export function diversifyPriorities(items = [], limit = 3, maxPerSubject = 2) {
  const selected = []
  const bySubject = new Map()
  for (const item of [...items].sort((a, b) => b.prioridade_calculada - a.prioridade_calculada)) {
    const key = item.materia_id || 'sem_materia'
    if ((bySubject.get(key) || 0) >= maxPerSubject) continue
    selected.push(item)
    bySubject.set(key, (bySubject.get(key) || 0) + 1)
    if (selected.length === limit) break
  }
  return selected
}

export function buildScenarios({ coveredTopics, totalTopics, daysRemaining, weeklyMinutes }) {
  if (!Number.isFinite(daysRemaining) || daysRemaining <= 0 || !Number.isFinite(weeklyMinutes) || weeklyMinutes <= 0) return []
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

