export const brasilDate = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(date)

export const duration = (seconds = 0) => {
  const minutes = Math.floor(Math.max(0, seconds) / 60)
  return `${Math.floor(minutes / 60)}h${String(minutes % 60).padStart(2, '0')}min`
}

export function weekDates(today) {
  const monday = new Date(`${today}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday)
    date.setUTCDate(monday.getUTCDate() + index)
    return date.toISOString().slice(0, 10)
  })
}

export function summarizeHome(history, sessions, today) {
  const dates = weekDates(today)
  const secondsByDay = new Map(dates.map((date) => [date, 0]))
  const secondsBySubject = new Map()
  let todaySeconds = 0
  for (const item of history) {
    if (item.status !== 'concluido') continue
    const day = brasilDate(new Date(item.iniciado_em))
    const seconds = Number(item.segundos || 0)
    if (secondsByDay.has(day)) secondsByDay.set(day, secondsByDay.get(day) + seconds)
    if (day === today) todaySeconds += seconds
    const name = item.materia?.nome || item.titulo || 'Estudo livre'
    secondsBySubject.set(name, (secondsBySubject.get(name) || 0) + seconds)
  }
  const todaySessions = sessions.filter((item) => item.data === today)
  const weekSessions = sessions.filter((item) => dates.includes(item.data))
  return {
    dates,
    secondsByDay,
    subjects: [...secondsBySubject].sort((a, b) => b[1] - a[1]),
    todaySeconds,
    weekSeconds: [...secondsByDay.values()].reduce((sum, seconds) => sum + seconds, 0),
    studiedDays: [...secondsByDay.values()].filter(Boolean).length,
    todayDone: todaySessions.filter((item) => item.status === 'feita').length,
    todayTotal: todaySessions.length,
    weekDone: weekSessions.filter((item) => item.status === 'feita').length,
    weekTotal: weekSessions.length,
    todayPlanned: todaySessions.reduce((sum, item) => sum + Number(item.duracao_estimada || 0) * 60, 0),
    nextDemands: sessions.filter((item) => item.status !== 'feita' && item.data >= today).slice(0, 3),
  }
}
