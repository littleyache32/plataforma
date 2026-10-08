// Factual capacity packing only. No strategy, extra load, debt or legacy defaults.
import { operationalDayLimit } from './mentor-v2-cycle.js'
const validDay = (day) => /^\d{4}-\d{2}-\d{2}$/.test(day || '')
  && Number.isFinite(Date.parse(`${day}T12:00:00Z`))
  && new Date(`${day}T12:00:00Z`).toISOString().slice(0, 10) === day

export function allocateMentorWeekCapacity({ availability, requests, demands, commitments, weekStart, weekEnd, today, initialWeek = false, dailyCapacity = null }) {
  if (!availability || availability.versao !== 'disponibilidade-v2/1') return {
    allocations: [], issues: ['DISPONIBILIDADE_NAO_INFORMADA_OU_NAO_SUPORTADA'], constrained: true,
    signal: { estado: 'UNKNOWN', alocacoes: [], slots_sem_capacidade: requests.map((row) => row.index), divida_minutos: 0 },
  }
  if (Object.keys(availability).some((key) => !['versao', 'dias', 'compromissos_bloqueantes'].includes(key))
    || !Array.isArray(availability.dias) || !Array.isArray(availability.compromissos_bloqueantes ?? [])
    || new Set(availability.dias.map((row) => row?.data)).size !== availability.dias.length
    || availability.dias.some((row) => !row || Object.keys(row).some((key) => !['data', 'minutos'].includes(key))
      || !validDay(row.data) || !Number.isInteger(row.minutos) || row.minutos < 0 || row.minutos > 1440)
    || (availability.compromissos_bloqueantes || []).some((id) => typeof id !== 'string' || !id)
    || new Set(availability.compromissos_bloqueantes || []).size !== (availability.compromissos_bloqueantes || []).length) {
    throw new Error('DISPONIBILIDADE_INVALIDA')
  }
  const blocked = new Set(), blockers = []
  for (const id of availability.compromissos_bloqueantes || []) {
    const rows = commitments.filter((row) => row.id === id)
    if (rows.length !== 1 || !validDay(rows[0].data)) throw new Error('COMPROMISSO_BLOQUEANTE_NAO_IDENTIFICADO')
    blocked.add(rows[0].data)
    blockers.push({ compromisso_id: id, data: rows[0].data })
  }
  const days = availability.dias.filter((row) => row.data >= weekStart && row.data <= weekEnd && row.data >= today)
    .map((row) => {
      // Existing demands consume factual capacity, including completed/user-moved
      // demands. They are never moved or cancelled by this allocator.
      const reserved = demands.filter((demand) => demand.data === row.data && demand.status !== 'cancelada')
        .reduce((sum, demand) => sum + demand.duracao_estimada, 0)
      if (!Number.isFinite(reserved) || reserved < 0) throw new Error('RESERVA_CAPACIDADE_INVALIDA')
      const limit = Math.min(operationalDayLimit(row.data), initialWeek ? (dailyCapacity?.get(row.data) || 0) : Infinity)
      return { data: row.data, minutos: row.minutos, limite_operacional: limit, bloqueado: blocked.has(row.data),
        faculdade_existentes: demands.filter((demand) => demand.data === row.data && demand.status !== 'cancelada'
          && requests.some((request) => request.faculty && request.objectiveId === demand.objetivo_id)).length,
        minutos_existentes: reserved, restantes: blocked.has(row.data) ? 0 : Math.max(0, Math.min(row.minutos, limit) - reserved) }
    }).sort((a, b) => a.data.localeCompare(b.data))
  const allocations = [], remaining = [], rejected = []
  const fits = (request, day) => day.restantes >= request.minutes && (!request.faculty
    || day.faculdade_existentes < (initialWeek ? 1 : commitments.some((row) => row.objetivo_id === request.objectiveId
      && row.concluido === false && ['prova', 'trabalho', 'entrega'].includes(row.tipo)
      && row.data >= day.data && row.data <= weekEnd) ? 3 : 2))
  const place = (request, day) => {
    day.restantes -= request.minutes
    if (request.faculty) day.faculdade_existentes++
    allocations.push({ index: request.index, data: day.data, data_original: request.day, minutos: request.minutes })
  }
  // Reserve valid original days before displaced requests use their spare capacity.
  for (const request of requests) {
    const preferred = days.find((day) => day.data === request.day && fits(request, day))
    if (preferred) place(request, preferred)
    else remaining.push(request)
  }
  for (const request of remaining) {
    // Initial adaptation never packs a missed day into another day's baseline.
    const alternate = !initialWeek && days.find((day) => fits(request, day))
    if (alternate) place(request, alternate)
    else rejected.push(request.index)
  }
  allocations.sort((a, b) => a.index - b.index)
  return { allocations, issues: rejected.length ? ['CAPACIDADE_FACTUAL_INSUFICIENTE'] : [],
    constrained: rejected.length > 0 || allocations.some((row) => row.data !== row.data_original),
    signal: { estado: 'CONHECIDA_POR_DATA', dias: days, compromissos_bloqueantes: blockers.sort((a, b) => a.compromisso_id.localeCompare(b.compromisso_id)),
      alocacoes: allocations, slots_sem_capacidade: rejected, divida_minutos: 0 } }
}
