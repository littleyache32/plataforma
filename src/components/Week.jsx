import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'
import DemandReason, { loadDemandReason } from './DemandReason.jsx'

const typeLabels = { estudo: 'Estudo', revisao: 'Revisão', exercicio: 'Exercício', especial: 'Especial', questoes: 'Exercício', simulado: 'Exercício', aula: 'Estudo', prova: 'Exercício', trabalho: 'Estudo' }
const typeClasses = { estudo: 'estudo', revisao: 'revisao', exercicio: 'exercicio', especial: 'especial', questoes: 'exercicio', simulado: 'exercicio', aula: 'estudo', prova: 'exercicio', trabalho: 'estudo' }
const priorities = { 1: 'Alta', 2: 'Média', 3: 'Baixa', 4: 'Flexível' }

function localIso(date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function initialWeekOffset() {
  const today = new Date()
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

export default function Week({ catalog, target, onTargetApplied, onOpenQuestions, onOpenCards, onOpenTimer }) {
  const [weekOffset, setWeekOffset] = useState(initialWeekOffset)
  const range = useMemo(() => weekRange(weekOffset), [weekOffset])
  const [sessions, setSessions] = useState([])
  const [message, setMessage] = useState('')
  const [planning, setPlanning] = useState(true)
  const [planningNotice, setPlanningNotice] = useState('')
  const [draggingId, setDraggingId] = useState('')
  const [selected, setSelected] = useState(null)
  const [reason, setReason] = useState(null)
  const [contextFilter, setContextFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const draggedRecently = useRef(false)
  const modalRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    const id = selected?.id
    if (id) loadDemandReason(id).then((text) => { if (!cancelled) setReason({ id, text }) })
    return () => { cancelled = true }
  }, [selected?.id])

  useEffect(() => {
    if (!selected) return
    const previousFocus = document.activeElement
    modalRef.current?.querySelector('button')?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') setSelected(null)
      if (event.key !== 'Tab') return
      const controls = [...(modalRef.current?.querySelectorAll('button:not(:disabled), select, input, [tabindex="0"]') || [])]
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previousFocus?.focus() }
  }, [selected?.id])

  async function shiftSelected(direction) {
    const items = sessions.filter((item) => item.data === selected.data).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    const index = items.findIndex((item) => item.id === selected.id)
    const destination = direction < 0 ? items[index - 1]?.id : items[index + 2]?.id || null
    if (index + direction < 0 || index + direction >= items.length) return
    await reorderDemand(selected.data, destination, { preventDefault() {}, stopPropagation() {}, dataTransfer: { getData: () => selected.id } })
  }

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
          setPlanningNotice(plan.aguardando_domingo ? 'A próxima semana será preparada no domingo, depois do fechamento da semana atual.' : '')
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

  useEffect(() => {
    if (!target?.id) return
    setSelected(target)
    onTargetApplied?.()
  }, [target?.id])


  async function reorderDemand(day, targetId, event) {
    event.preventDefault()
    event.stopPropagation()
    const demandId = event.dataTransfer.getData('text/plain') || draggingId
    if (!demandId) return
    const demand = sessions.find((item) => item.id === demandId)
    setDraggingId('')
    if (!demand) return
    const dayItems = sessions.filter((item) => item.data === day).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    const withoutDragged = dayItems.filter((item) => item.id !== demandId)
    const targetIndex = targetId ? withoutDragged.findIndex((item) => item.id === targetId) : withoutDragged.length
    if (targetIndex < 0) return
    withoutDragged.splice(targetIndex, 0, demand)
    const orderedIds = withoutDragged.map((item) => item.id)
    const orderById = new Map(orderedIds.map((id, ordem) => [id, ordem]))
    const previous = sessions
    setSessions((items) => items.map((item) => item.id === demandId ? { ...item, data: day, ordem: orderById.get(item.id) } : orderById.has(item.id) ? { ...item, ordem: orderById.get(item.id) } : item))
    setMessage('')
    try {
      await api('/api/sessoes', { method: 'PATCH', body: JSON.stringify({ orderedIds, data: day }) })
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
  const plannedMinutes = sessions.reduce((sum, item) => sum + Number(item.duracao_estimada || 0), 0)
  const completedMinutes = sessions.filter((item) => item.status === 'feita').reduce((sum, item) => sum + Number(item.duracao_estimada || 0), 0)
  const weekProgress = sessions.length ? Math.round(sessions.filter((item) => item.status === 'feita').length / sessions.length * 100) : 0
  const weekLabel = new Date(`${range.start}T12:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })

  return (
    <section className="week-page">
      <header className="page-title week-title"><div><h1>Meu Plano</h1><p>Semana de {weekLabel}</p></div><div className="week-navigation"><button className="secondary" onClick={() => setWeekOffset((value) => value - 1)} aria-label="Semana anterior">‹</button><button className="secondary" onClick={() => setWeekOffset(0)}>Semana atual</button><button className="secondary" onClick={() => setWeekOffset((value) => value + 1)} aria-label="Próxima semana">›</button></div></header>
      <div className="week-summary"><span><b>{minutesLabel(plannedMinutes)}</b> planejadas</span><span><b>{minutesLabel(completedMinutes)}</b> de demandas concluídas</span><span><b>{weekProgress}%</b> das demandas</span></div>
      <div className="week-legends" aria-label="Filtros das demandas"><button className={`context-key faculdade ${contextFilter === 'faculdade' ? 'active' : ''}`} aria-pressed={contextFilter === 'faculdade'} onClick={() => setContextFilter((current) => current === 'faculdade' ? '' : 'faculdade')}>Faculdade</button><button className={`context-key concurso ${contextFilter === 'concurso' ? 'active' : ''}`} aria-pressed={contextFilter === 'concurso'} onClick={() => setContextFilter((current) => current === 'concurso' ? '' : 'concurso')}>BACEN</button>{Object.entries({ estudo: 'Estudo', revisao: 'Revisão', exercicio: 'Exercício', especial: 'Especial' }).map(([id, label]) => <button className={`context-key demand-type ${id} ${typeFilter === id ? 'active' : ''}`} aria-pressed={typeFilter === id} key={id} onClick={() => setTypeFilter((current) => current === id ? '' : id)}>{label}</button>)}</div>
      {planning && <p className="mentor-status">Carregando esta semana...</p>}
      {!planning && planningNotice && <p className="mentor-status">{planningNotice}</p>}
      {message && <p className="alert error">{message}</p>}
      <div className="week-board-heading"><div><span>QUADRO SEMANAL</span><b>Suas próximas demandas</b></div><small>{sessions.length} demandas nesta semana</small></div>
      <div className="week-grid mentor-week-grid">{days.map((day) => <article key={day.iso} className={`day-column demand-day ${day.iso === range.today ? 'today' : ''}`} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => reorderDemand(day.iso, null, event)}><header><div><span>{day.label}</span><b>{day.number}</b>{day.iso === range.today && <small>Hoje</small>}</div><em>{day.demands.length} demandas</em></header><div>{day.demands.map((item) => <article className={`demand-card ${item.objetivo?.tipo || ''} ${typeClasses[item.tipo] || 'estudo'} ${item.status === 'feita' ? 'feita' : ''}`} key={item.id} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelected(item) } }} draggable onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={(event) => reorderDemand(day.iso, item.id, event)} onClick={() => { if (draggedRecently.current) { draggedRecently.current = false; return }; setSelected(item) }} onDragStart={(event) => { draggedRecently.current = true; setDraggingId(item.id); event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', item.id) }} onDragEnd={() => setDraggingId('')}><div className="demand-card-top"><span>{item.material?.disciplina_curso || item.materia?.nome || 'Matéria a definir'}</span><i>{typeLabels[item.tipo] || 'Estudo'}</i></div><b>{item.titulo}</b><footer><span>{minutesLabel(item.duracao_estimada)}</span>{item.prioridade === 1 && <span className="priority p1">{priorities[1]} prioridade</span>}</footer></article>)}{!day.demands.length && <p className="day-empty">Solte uma demanda aqui.</p>}</div></article>)}</div>

      {selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null) }}><div ref={modalRef} className="modal panel" role="dialog" aria-modal="true" aria-labelledby="demand-title"><button className="ghost modal-close" aria-label="Fechar demanda" onClick={() => setSelected(null)}>×</button><small>{selected.material?.disciplina_curso || selected.materia?.nome}</small><h2 id="demand-title">{selected.titulo}</h2><p>{minutesLabel(selected.duracao_estimada)}</p><DemandReason text={reason?.id === selected.id ? reason.text : ''}/><label>Mover para<select value={selected.data} onChange={async (event) => { const date = event.target.value; await reorderDemand(date, null, { preventDefault() {}, stopPropagation() {}, dataTransfer: { getData: () => selected.id } }); setSelected(null) }}>{days.map((day) => <option key={day.iso} value={day.iso}>{day.label} {day.number}</option>)}</select></label><div className="modal-position-actions"><button className="secondary" onClick={() => shiftSelected(-1)}>Mover acima</button><button className="secondary" onClick={() => shiftSelected(1)}>Mover abaixo</button></div><div className="modal-actions"><button className="secondary" onClick={() => { setSelected(null); onOpenTimer?.(selected) }}>Abrir timer</button><button className="secondary" onClick={() => { setSelected(null); onOpenQuestions(selected) }}>Resolver questões</button><button className="secondary" onClick={() => { setSelected(null); onOpenCards(selected) }}>Estudar com Question Cards</button><button className={selected.status === 'feita' ? 'secondary' : 'primary'} onClick={toggleDemand}>{selected.status === 'feita' ? 'Desmarcar conclusão' : 'Marcar como concluída'}</button></div></div></div>}
    </section>
  )
}
