// Factual cycle configuration and central operational invariants. No calendar
// escalation, mastery inference or independent strategic decision maker.
export const MENTOR_DAILY_CEILINGS = Object.freeze({ weekday: 450, saturday: 240, sunday: 180 })
const validDate = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day || '') && Number.isFinite(Date.parse(`${day}T12:00:00Z`))
  && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day

export function readOperationalCycle(value) {
  if (value == null) return null
  if (value.versao !== 'ciclo-operacional-v2/1' || !/^[a-zA-Z0-9_-]+$/.test(value.id || '')
    || !validDate(value.inicio) || new Date(`${value.inicio}T12:00:00Z`).getUTCDay() !== 1
    || value.etapa_inicial !== 'BASE_CONTEUDO'
    || Object.keys(value).some((key) => !['versao', 'id', 'inicio', 'etapa_inicial'].includes(key))) throw new Error('CICLO_OPERACIONAL_INVALIDO')
  return structuredClone(value)
}
export function isInitialCycleWeek(cycle, weekStart) { return !!cycle && cycle.inicio === weekStart }
export function cycleDemandPrefix(weekStart, cycle) {
  return `v2:${weekStart}:${cycle ? `ciclo:${cycle.id}:` : ''}`
}
export function operationalDayLimit(day) {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay()
  return weekday === 0 ? MENTOR_DAILY_CEILINGS.sunday : weekday === 6 ? MENTOR_DAILY_CEILINGS.saturday : MENTOR_DAILY_CEILINGS.weekday
}

// Maintenance input -> canonical context fields. The input file is not read by
// the runtime; the database context remains the only operational source.
export function prepareCycleContext({ definition, objectives, current = {} }) {
  const cycle = readOperationalCycle(definition.ciclo)
  if (!cycle || !Array.isArray(definition.baseline) || !definition.baseline.length) throw new Error('BASELINE_CICLO_INVALIDO')
  const slots = []
  for (let dia = 0; dia < 7; dia++) for (const entry of definition.baseline) {
    const options = objectives.filter((row) => row.tipo === entry.tipo_objetivo)
    const main = options.find((row) => row.id === current.objetivo_principal_id)
    const objective = entry.tipo_objetivo === 'concurso' && main ? main : options.length === 1 ? options[0] : null
    if (!objective || !Number.isInteger(entry.demandas) || entry.demandas < 1 || entry.duracao_minutos !== 50
      || entry.atividade !== 'ESTUDO') throw new Error('OBJETIVO_OU_BASELINE_CICLO_INVALIDO')
    for (let index = 0; index < entry.demandas; index++) slots.push({ dia, objetivo_id: objective.id,
      atividade: entry.atividade, duracao_minutos: entry.duracao_minutos })
  }
  return { ...structuredClone(current), ciclo_operacional: cycle,
    capacidade_inicial: { versao: 'capacidade-inicial-v2/1', revisao: `baseline-${cycle.id}`, slots } }
}
