// Factual calculator only. The sole policy engine decides; this module never
// emits decisions, chooses thresholds, creates demands or interprets feedback.
const STUDY_TYPES = new Set(['estudo', 'exercicio', 'especial', 'revisao'])
const dayInBrazil = (timestamp) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo',
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(timestamp))
const addDays = (day, count) => { const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + count); return date.toISOString().slice(0, 10) }
const monday = (day) => { const date = new Date(`${day}T12:00:00Z`); return addDays(day, 1 - (date.getUTCDay() || 7)) }
const validDay = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day || '') && Number.isFinite(Date.parse(`${day}T12:00:00Z`))
  && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day

function uniqueRows(rows) {
  const indexed = new Map()
  for (const row of rows) {
    if (!row?.id || indexed.has(row.id)) throw new Error('REGISTROS_CARGA_SEM_IDENTIDADE_UNICA')
    indexed.set(row.id, row)
  }
  return [...indexed.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)))
}

function plannedLoad(rows, objectives) {
  const selected = rows.filter((row) => STUDY_TYPES.has(row.tipo) && row.status !== 'cancelada')
  const byGoal = new Map()
  let minutes = 0
  for (const row of selected) {
    if (!row.objetivo_id || !validDay(row.data) || !Number.isFinite(row.duracao_estimada) || row.duracao_estimada <= 0) throw new Error('ESTIMATIVA_CARGA_INVALIDA')
    minutes += row.duracao_estimada
    const entry = byGoal.get(row.objetivo_id) || { objetivo_id: row.objetivo_id,
      tipo_objetivo: objectives.get(row.objetivo_id)?.tipo || 'UNKNOWN', demandas: 0, minutos: 0, blocos_30: 0, blocos_50: 0 }
    entry.demandas++; entry.minutos += row.duracao_estimada
    if (row.duracao_estimada === 30) entry.blocos_30++
    if (row.duracao_estimada === 50) entry.blocos_50++
    byGoal.set(row.objetivo_id, entry)
  }
  return { demandas: selected.length, minutos: minutes, por_objetivo: [...byGoal.values()].sort((a, b) => String(a.objetivo_id).localeCompare(String(b.objetivo_id))) }
}

export function calculateMentorV2LoadFacts({ facts, weekStart, weekEnd, referenceInstant }) {
  const cut = Date.parse(referenceInstant), today = dayInBrazil(referenceInstant)
  const sources = facts.loadSources || {}
  for (const key of ['history', 'times', 'objectives', 'commitments']) {
    if (sources[key] !== undefined && !Array.isArray(sources[key])) throw new Error('FONTES_CARGA_INVALIDAS')
  }
  const history = uniqueRows(sources.history || [])
  const times = uniqueRows(sources.times || [])
  const goals = uniqueRows(sources.objectives || [])
  const objectives = new Map(goals.map((row) => [row.id, row]))
  const current = facts.demands.filter((row) => row.data >= weekStart && row.data <= weekEnd)
  const load = plannedLoad(current, objectives)
  const groups = new Map()
  for (const row of history.filter((row) => STUDY_TYPES.has(row.tipo) && row.data < weekStart)) {
    if (!validDay(row.data)) throw new Error('DATA_HISTORICO_CARGA_INVALIDA')
    const start = monday(row.data)
    groups.set(start, [...(groups.get(start) || []), row])
  }
  const series = [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([start, rows]) => {
    const end = addDays(start, 6), closed = end < today
    const eligible = rows.filter((row) => row.status !== 'cancelada')
    const missingCompletionTime = eligible.filter((row) => row.status === 'feita' && !Number.isFinite(Date.parse(row.concluida_em)))
    const completed = eligible.filter((row) => row.status === 'feita' && Number.isFinite(Date.parse(row.concluida_em))
      && Date.parse(row.concluida_em) <= cut && dayInBrazil(row.concluida_em) <= end)
    const days = [...new Set(completed.map((row) => dayInBrazil(row.concluida_em)))].sort()
    return { semana_inicio: start, semana_fim: end, janela_fechada: closed,
      base_plano: 'EFETIVO_OBSERVADO_NO_CORTE', comparabilidade: 'NAO_QUALIFICADA',
      carga_planejada: plannedLoad(rows, objectives), demandas_elegiveis: eligible.length,
      concluidas_no_prazo: completed.length, conclusoes_sem_instante: missingCompletionTime.length,
      aderencia: closed && eligible.length && !missingCompletionTime.length ? completed.length / eligible.length : null,
      regularidade: { dias_com_entrega: days, quantidade_dias: days.length },
      cancelamentos_mentor: rows.filter((row) => row.status === 'cancelada' && row.cancelamento_origem === 'mentor').length,
      exclusoes_manuais: rows.filter((row) => row.status === 'cancelada' && row.cancelamento_origem !== 'mentor').length,
      demandas_ids: rows.map((row) => row.id).sort() }
  })
  const completedCurrent = current.filter((row) => STUDY_TYPES.has(row.tipo) && row.status === 'feita'
    && Number.isFinite(Date.parse(row.concluida_em)) && Date.parse(row.concluida_em) <= cut)
  const countedTimes = times.filter((row) => row.status === 'concluido' && Number.isFinite(Date.parse(row.finalizado_em))
    && Date.parse(row.finalizado_em) <= cut)
  if (countedTimes.some((row) => !Number.isFinite(row.segundos_acumulados) || row.segundos_acumulados < 0)) throw new Error('TEMPO_REAL_CARGA_INVALIDO')
  const weekTimes = countedTimes.filter((row) => dayInBrazil(row.finalizado_em) >= weekStart && dayInBrazil(row.finalizado_em) <= weekEnd)
  const pending = [...history, ...current].filter((row) => STUDY_TYPES.has(row.tipo)
    && (row.status === 'nao_concluida' || (['planejada', 'parcial', 'remanejada'].includes(row.status) && row.data < today)))
  const commitments = uniqueRows(sources.commitments || []).filter((row) => !row.concluido && validDay(row.data)
    && row.data >= today && row.data <= weekEnd).map((row) => ({ id: row.id, objetivo_id: row.objetivo_id,
    materia_id: row.materia_id || null, tipo: row.tipo, data: row.data,
    dias_ate: Math.round((Date.parse(`${row.data}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000) }))
  return { carga_plano_efetivo: load,
    execucao: { demandas_concluidas: completedCurrent.length,
      conclusoes_sem_instante: current.filter((row) => STUDY_TYPES.has(row.tipo) && row.status === 'feita' && !Number.isFinite(Date.parse(row.concluida_em))).length,
      segundos_reais: sources.times === undefined ? null : weekTimes.reduce((sum, row) => sum + row.segundos_acumulados, 0),
      segundos_vinculados: sources.times === undefined ? null : weekTimes.filter((row) => row.sessao_id).reduce((sum, row) => sum + row.segundos_acumulados, 0),
      segundos_livres: sources.times === undefined ? null : weekTimes.filter((row) => !row.sessao_id).reduce((sum, row) => sum + row.segundos_acumulados, 0),
      convencao_tempo: 'DIA_DA_FINALIZACAO_EM_BRASILIA', tempo_ids: weekTimes.map((row) => row.id).sort() },
    historico: series, pendencias: { demandas: pending.length, demanda_ids: pending.map((row) => row.id).sort(), divida_minutos: 0 },
    compromissos: commitments,
    lacunas: ['history', 'times', 'objectives', 'commitments'].filter((key) => sources[key] === undefined),
    fontes_observadas: { demandas: uniqueRows(facts.demands), history, times, objectives: goals,
      commitments: uniqueRows(sources.commitments || []) }, corte: referenceInstant }
}
