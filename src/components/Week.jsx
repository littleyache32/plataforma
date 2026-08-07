import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

function weekRange() {
  const today = new Date()
  const day = today.getDay() || 7
  const start = new Date(today); start.setDate(today.getDate() - day + 1)
  const end = new Date(start); end.setDate(start.getDate() + 6)
  const iso = (date) => date.toISOString().slice(0, 10)
  return { start: iso(start), end: iso(end) }
}

export default function Week({ catalog, objective }) {
  const range = useMemo(weekRange, [])
  const [sessions, setSessions] = useState([])
  const [form, setForm] = useState({ titulo: '', data: range.start, duracao: 50 })
  const [message, setMessage] = useState('')

  const load = () => api(`/api/sessoes?inicio=${range.start}&fim=${range.end}&objetivoId=${objective?.id || ''}`).then((data) => setSessions(data.sessoes)).catch((err) => setMessage(err.message))
  useEffect(() => { load() }, [range.start, range.end, objective?.id])

  async function create(event) {
    event.preventDefault()
    if (!objective) return
    await api('/api/sessoes', { method: 'POST', body: JSON.stringify({ objetivoId: objective.id, titulo: form.titulo, data: form.data, duracaoEstimada: Number(form.duracao) }) })
    setForm({ ...form, titulo: '' }); load()
  }

  async function finish(id) {
    await api('/api/sessoes', { method: 'PATCH', body: JSON.stringify({ id, status: 'feita' }) }); load()
  }

  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${range.start}T12:00:00`); date.setDate(date.getDate() + index)
    const iso = date.toISOString().slice(0, 10)
    return { iso, label: date.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), number: date.getDate() }
  })

  return (
    <section>
      <header className="page-title"><div><p className="eyebrow">VISÃO CENTRAL</p><h1>Sua semana</h1><p>Organize faculdade e concursos no mesmo tempo disponível.</p></div><span className="date-range">{new Date(`${range.start}T12:00`).toLocaleDateString('pt-BR')} a {new Date(`${range.end}T12:00`).toLocaleDateString('pt-BR')}</span></header>
      <div className="week-grid">{days.map((day) => <article key={day.iso} className="day-column"><header><span>{day.label}</span><b>{day.number}</b></header><div>{sessions.filter((item) => item.data === day.iso).map((item) => <button className={`session-card ${item.status}`} key={item.id} onClick={() => item.status === 'planejada' && finish(item.id)}><small>{item.objetivo?.nome}</small><b>{item.titulo}</b><span>{item.duracao_estimada} min · {item.status}</span></button>)}</div></article>)}</div>
      <div className="two-columns week-bottom">
        <form className="panel form-card" onSubmit={create}><span className="eyebrow">NOVA SESSÃO</span><h2>Planejar na semana</h2><label>Título</label><input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} placeholder="Ex.: Revisar atos administrativos" required /><div className="form-row"><div><label>Data</label><input type="date" min={range.start} max={range.end} value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div><div><label>Duração</label><input type="number" min="10" value={form.duracao} onChange={(e) => setForm({ ...form, duracao: e.target.value })} /></div></div><button className="primary">Adicionar sessão</button>{message && <p className="muted">{message}</p>}</form>
        <article className="panel objective-summary"><span className="eyebrow">OBJETIVOS ATIVOS</span><h2>{catalog.length} frentes conectadas</h2>{catalog.map((item) => <div className="summary-row" key={item.id}><span className={`type-dot ${item.tipo}`}></span><div><b>{item.nome}</b><small>{item.tipo} · {item.materias?.length || 0} disciplinas</small></div></div>)}</article>
      </div>
    </section>
  )
}
