import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const typeLabels = { estudo: 'Estudo', revisao: 'Revisao', exercicio: 'Exercicio', especial: 'Especial', questoes: 'Exercicio', simulado: 'Exercicio', aula: 'Estudo', prova: 'Exercicio', trabalho: 'Estudo' }
const priorities = { 1: 'Alta', 2: 'Media', 3: 'Baixa', 4: 'Flexivel' }

function localIso(date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function weekRange() {
  const today = new Date()
  const day = today.getDay() || 7
  const start = new Date(today); start.setDate(today.getDate() - day + 1)
  const end = new Date(start); end.setDate(start.getDate() + 6)
  return { start: localIso(start), end: localIso(end), today: localIso(today) }
}

function minutesLabel(minutes) {
  if (!minutes) return 'Sem carga planejada'
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return hours ? `${hours}h${rest ? ` ${rest}min` : ''}` : `${rest} min`
}

export default function Week({ catalog, onOpenQuestions, onOpenCards }) {
  const range = useMemo(weekRange, [])
  const [sessions, setSessions] = useState([])
  const [message, setMessage] = useState('')
  const [draggingId, setDraggingId] = useState('')
  const [selected, setSelected] = useState(null)
  const [filter, setFilter] = useState('todos')

  const load = () => api(`/api/sessoes?inicio=${range.start}&fim=${range.end}`).then((data) => setSessions(data.sessoes)).catch((err) => setMessage(err.message))
  useEffect(() => { load() }, [range.start, range.end])

  async function moveDemand(day) {
    if (!draggingId) return
    const demand = sessions.find((item) => item.id === draggingId)
    setDraggingId('')
    if (!demand || demand.data === day) return
    try {
      await api('/api/sessoes', { method: 'PATCH', body: JSON.stringify({ id: demand.id, data: day }) })
      setSessions((items) => items.map((item) => item.id === demand.id ? { ...item, data: day } : item))
    } catch (err) { setMessage(err.message) }
  }

  async function finishDemand() {
    if (!selected) return
    await api('/api/sessoes', { method: 'PATCH', body: JSON.stringify({ id: selected.id, status: 'feita' }) })
    setSessions((items) => items.map((item) => item.id === selected.id ? { ...item, status: 'feita' } : item))
    setSelected(null)
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${range.start}T12:00:00`); date.setDate(date.getDate() + index)
    const iso = localIso(date)
    const demands = sessions.filter((item) => item.data === iso && (filter === 'todos' || typeLabels[item.tipo] === filter))
    const total = demands.filter((item) => item.status !== 'feita').reduce((sum, item) => sum + (item.duracao_estimada || 0), 0)
    return { iso, label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), number: date.getDate(), demands, total }
  })
  const today = days.find((day) => day.iso === range.today)
  const subjectCount = catalog.reduce((total, objective) => total + (objective.materias?.length || 0), 0)

  return (
    <section className="week-page">
      <header className="page-title week-title"><div><p className="eyebrow">PLANO DO MENTOR</p><h1>Sua semana</h1><p>Faculdade e BACEN no mesmo quadro. Mova uma demanda de dia quando precisar, sem reorganizar horarios.</p></div><div className="today-load"><small>HOJE</small><b>{minutesLabel(today?.total || 0)}</b><span>{today?.demands.length || 0} demandas</span></div></header>
      <div className="week-legends" aria-label="Legendas das demandas"><span className="context-key faculdade">Faculdade</span><span className="context-key concurso">BACEN</span><button className={filter === 'todos' ? 'active' : ''} onClick={() => setFilter('todos')}>Todas</button>{Object.entries(typeLabels).filter(([id]) => ['estudo', 'revisao', 'exercicio', 'especial'].includes(id)).map(([id, label]) => <button className={`type-key ${id} ${filter === label ? 'active' : ''}`} key={id} onClick={() => setFilter(label)}>{label}</button>)}</div>
      {message && <p className="alert error">{message}</p>}
      <div className="week-grid mentor-week-grid">{days.map((day) => <article key={day.iso} className={`day-column demand-day ${day.iso === range.today ? 'today' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={() => moveDemand(day.iso)}><header><div><span>{day.label}</span><b>{day.number}</b>{day.iso === range.today && <small>Hoje</small>}</div><em>{minutesLabel(day.total)}</em></header><div>{day.demands.map((item) => <article className={`demand-card ${item.objetivo?.tipo || ''} ${typeLabels[item.tipo]?.toLowerCase() || 'estudo'} ${item.status === 'feita' ? 'feita' : ''}`} key={item.id} draggable onClick={() => setSelected(item)} onDragStart={() => setDraggingId(item.id)} onDragEnd={() => setDraggingId('')}><div className="demand-card-top"><span>{item.objetivo?.tipo === 'faculdade' ? 'Faculdade' : 'BACEN'}</span><i>{typeLabels[item.tipo] || 'Estudo'}</i></div><b>{item.titulo}</b><p>{item.materia?.nome || 'Materia a definir'}</p>{item.topico?.nome && <small>{item.topico.nome}</small>}<footer><span>{minutesLabel(item.duracao_estimada)}</span><span className={`priority p${item.prioridade || 2}`}>{priorities[item.prioridade || 2]}</span></footer></article>)}{!day.demands.length && <p className="day-empty">Sem demandas.</p>}</div></article>)}</div>
      <footer className="week-footnote"><span>{subjectCount} disciplinas conectadas</span><span>As demandas do mentor aparecerao aqui conforme seu plano e suas revisoes.</span></footer>{selected && <div className="modal-backdrop"><div className="modal panel"><span className="eyebrow">DEMANDA DA SEMANA</span><h2>{selected.titulo}</h2><p>{selected.materia?.nome}{selected.topico?.nome ? ` · ${selected.topico.nome}` : ''}</p><div className="modal-actions"><button className="secondary" onClick={() => { setSelected(null); onOpenQuestions() }}>Resolver questões</button><button className="secondary" onClick={() => { setSelected(null); onOpenCards() }}>Estudar com Question Cards</button><button className="primary" onClick={finishDemand}>Marcar como concluída</button></div></div></div>}</section>
  )
}
