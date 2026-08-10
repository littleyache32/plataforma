import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'

const typeLabels = { estudo: 'Estudo', revisao: 'Revisão', exercicio: 'Exercício', especial: 'Especial', questoes: 'Exercício', simulado: 'Exercício', aula: 'Estudo', prova: 'Exercício', trabalho: 'Estudo' }
const typeClasses = { estudo: 'estudo', revisao: 'revisao', exercicio: 'exercicio', especial: 'especial', questoes: 'exercicio', simulado: 'exercicio', aula: 'estudo', prova: 'exercicio', trabalho: 'estudo' }
const priorities = { 1: 'Alta', 2: 'Média', 3: 'Baixa', 4: 'Flexível' }
const mentorshipStart = '2026-08-10'

function localIso(date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function initialWeekOffset() {
  const today = new Date()
  if (localIso(today) < mentorshipStart) return 1
  return today.getDay() === 0 ? 1 : 0
}

function weekRange(offset = 0) {
  const today = new Date()
  const day = today.getDay() || 7
  const start = new Date(today)
  start.setDate(today.getDate() - day + 1 + offset * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return { start: localIso(start), end: localIso(end), today: localIso(today) }
}

function minutesLabel(minutes) {
  if (!minutes) return 'Sem carga planejada'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}h${rest ? ` ${rest}min` : ''}` : `${rest} min`
}

export default function Week({ catalog, onOpenQuestions, onOpenCards }) {
  const [weekOffset, setWeekOffset] = useState(initialWeekOffset)
  const range = useMemo(() => weekRange(weekOffset), [weekOffset])
  const [sessions, setSessions] = useState([])
  const [message, setMessage] = useState('')
  const [planning, setPlanning] = useState(true)
  const [planningNotice, setPlanningNotice] = useState('')
  const [draggingId, setDraggingId] = useState('')
  const [selected, setSelected] = useState(null)
  const [contextFilter, setContextFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const draggedRecently = useRef(false)

  useEffect(() => {
    let active = true
    async function prepareAndLoad() {
      setPlanning(true)
      try {
        let data = await api(`/api/sessoes?inicio=${range.start}&fim=${range.end}`)
        let plan = {}
        if (!data.sessoes?.length) {
          plan = await api('/api/plano', { method: 'POST', body: JSON.stringify({ inicio: range.start }) })
          data = await api(`/api/sessoes?inicio=${range.start}&fim=${range.end}`)
        }
        if (active) {
          setSessions(data.sessoes)
          setMessage('')
          setPlanningNotice(plan.aguardando_domingo ? (range.end < mentorshipStart ? 'A mentoria começa em 10 de agosto.' : 'A próxima semana será preparada no domingo, depois do fechamento da semana atual.') : '')
        }
      } catch (error) {
        if (active) setMessage(error.message)
      } finally {
        if (active) setPlanning(false)
      }
    }
    prepareAndLoad()
    return () => { active = false }
  }, [range.start, range.end])

  async function reorderDemand(day, targetId, event) {
    event.preventDefault()
    event.stopPropagation()
    const demandId = event.dataTransfer.getData('text/plain') || draggingId
    if (!demandId) return
    const demand = sessions.find((item) => item.id === demandId)
    setDraggingId('')
    if (!demand) return
    if (demand.data !== day) {
      setMessage('Você pode reorganizar as demandas apenas dentro do mesmo dia.')
      return
    }
    const dayItems = sessions.filter((item) => item.data === day).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    const withoutDragged = dayItems.filter((item) => item.id !== demandId)
    const targetIndex = targetId ? withoutDragged.findIndex((item) => item.id === targetId) : withoutDragged.length
    if (targetIndex < 0) return
    withoutDragged.splice(targetIndex, 0, demand)
    const orderedIds = withoutDragged.map((item) => item.id)
    const orderById = new Map(orderedIds.map((id, ordem) => [id, ordem]))
    const previous = sessions
    setSessions((items) => items.map((item) => orderById.has(item.id) ? { ...item, ordem: orderById.get(item.id) } : item))
    setMessage('')
    try {
      await api('/api/sessoes', { method: 'PATCH', body: JSON.stringify({ orderedIds }) })
    } catch (error) {
      setSessions(previous)
      setMessage(error.message)
    }
  }

  async function toggleDemand() {
    if (!selected) return
    try {
      const status = selected.status === 'feita' ? 'planejada' : 'feita'
      await api('/api/sessoes', { method: 'PATCH', body: JSON.stringify({ id: selected.id, status }) })
      setSessions((items) => items.map((item) => item.id === selected.id ? { ...item, status } : item))
      setSelected(null)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${range.start}T12:00:00`)
    date.setDate(date.getDate() + index)
    const iso = localIso(date)
    const demands = sessions.filter((item) => item.data === iso && (!contextFilter || item.objetivo?.tipo === contextFilter) && (!typeFilter || typeClasses[item.tipo] === typeFilter)).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    const total = demands.filter((item) => item.status !== 'feita').reduce((sum, item) => sum + (item.duracao_estimada || 0), 0)
    return { iso, label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), number: date.getDate(), demands, total }
  })
  const today = days.find((day) => day.iso === range.today)
  const remainingWeekMinutes = days.reduce((sum, day) => sum + day.total, 0)
  const subjectCount = catalog.reduce((total, objective) => total + (objective.materias?.length || 0), 0)
  const weekLabel = new Date(`${range.start}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <section className="week-page">
      <header className="page-title week-title"><div><p className="eyebrow">PLANO DO MENTOR</p><h1>Sua semana</h1><p>O mentor organiza Faculdade e BACEN por demandas. Arraste os cartões para definir a ordem de execução dentro do próprio dia.</p><div className="week-navigation"><button className="secondary" onClick={() => setWeekOffset((value) => value - 1)} aria-label="Semana anterior">‹</button><button className="secondary" onClick={() => setWeekOffset(0)}>Semana atual</button><span>Semana de {weekLabel}</span><button className="secondary" onClick={() => setWeekOffset((value) => value + 1)} aria-label="Próxima semana">›</button></div></div><div className="today-load"><small>{today ? 'HOJE' : 'SEMANA'}</small><b>{minutesLabel(today?.total ?? remainingWeekMinutes)}</b><span>{today?.demands.length ?? sessions.length} demandas</span></div></header>
      <div className="week-legends" aria-label="Filtros das demandas"><button className={`context-key faculdade ${contextFilter === 'faculdade' ? 'active' : ''}`} aria-pressed={contextFilter === 'faculdade'} onClick={() => setContextFilter((current) => current === 'faculdade' ? '' : 'faculdade')}>Faculdade</button><button className={`context-key concurso ${contextFilter === 'concurso' ? 'active' : ''}`} aria-pressed={contextFilter === 'concurso'} onClick={() => setContextFilter((current) => current === 'concurso' ? '' : 'concurso')}>BACEN</button>{Object.entries({ estudo: 'Estudo', revisao: 'Revisão', exercicio: 'Exercício', especial: 'Especial' }).map(([id, label]) => <button className={`context-key demand-type ${id} ${typeFilter === id ? 'active' : ''}`} aria-pressed={typeFilter === id} key={id} onClick={() => setTypeFilter((current) => current === id ? '' : id)}>{label}</button>)}</div>
      {planning && <p className="mentor-status">Carregando esta semana...</p>}
      {!planning && planningNotice && <p className="mentor-status">{planningNotice}</p>}
      {message && <p className="alert error">{message}</p>}
      <div className="week-grid mentor-week-grid">{days.map((day) => <article key={day.iso} className={`day-column demand-day ${day.iso === range.today ? 'today' : ''}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => reorderDemand(day.iso, null, event)}><header><div><span>{day.label}</span><b>{day.number}</b>{day.iso === range.today && <small>Hoje</small>}</div><em>{minutesLabel(day.total)}</em></header><div>{day.demands.map((item) => <article className={`demand-card ${item.objetivo?.tipo || ''} ${typeClasses[item.tipo] || 'estudo'} ${item.status === 'feita' ? 'feita' : ''}`} key={item.id} draggable onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => reorderDemand(day.iso, item.id, event)} onClick={() => { if (draggedRecently.current) { draggedRecently.current = false; return }; setSelected(item) }} onDragStart={(event) => { draggedRecently.current = true; setDraggingId(item.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id) }} onDragEnd={() => setDraggingId('')}><div className="demand-card-top"><span>{item.objetivo?.tipo === 'faculdade' ? 'Faculdade' : 'BACEN'}</span><i>{typeLabels[item.tipo] || 'Estudo'}</i></div><b>{item.titulo}</b><p>{item.materia?.nome || 'Matéria a definir'}</p>{item.topico?.nome && <small>{item.topico.nome}</small>}<footer><span>{minutesLabel(item.duracao_estimada)}</span><span className={`priority p${item.prioridade || 2}`}>{priorities[item.prioridade || 2]}</span></footer></article>)}{!day.demands.length && <p className="day-empty">Sem demandas.</p>}</div></article>)}</div>
      <footer className="week-footnote"><span>{subjectCount} disciplinas conectadas</span><span>O mentor distribui estudo, revisão, exercício e atividades especiais conforme a fase e as evidências disponíveis.</span></footer>{selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><div className="modal panel" role="dialog" aria-modal="true" aria-labelledby="demand-title"><span className="eyebrow">DEMANDA DA SEMANA</span><h2 id="demand-title">{selected.titulo}</h2><p>{selected.materia?.nome}{selected.topico?.nome ? ` · ${selected.topico.nome}` : ''}</p><div className="modal-actions"><button className="secondary" onClick={() => { setSelected(null); onOpenQuestions(selected) }}>Resolver questões</button><button className="secondary" onClick={() => { setSelected(null); onOpenCards(selected) }}>Estudar com Question Cards</button><button className={selected.status === 'feita' ? 'secondary' : 'primary'} onClick={toggleDemand}>{selected.status === 'feita' ? 'Desmarcar conclusão' : 'Marcar como concluída'}</button></div></div></div>}</section>
  )
}
