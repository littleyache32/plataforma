import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Deadlines({ catalog }) {
  const [items, setItems] = useState([])
  const [form, setForm] = useState({ objetivoId: catalog[0]?.id || '', materiaId: '', titulo: '', tipo: 'prova', data: '', peso: 3, duracaoMinutos: 90 })
  const [message, setMessage] = useState('')
  const objective = catalog.find((item) => item.id === form.objetivoId)
  const subjects = objective?.materias || []

  function load() { return api('/api/objetivos?recurso=compromissos').then((data) => setItems(data.compromissos)).catch((error) => setMessage(error.message)) }
  useEffect(() => { load() }, [])
  useEffect(() => { if (!form.objetivoId && catalog[0]?.id) setForm((current) => ({ ...current, objetivoId: catalog[0].id })) }, [catalog, form.objetivoId])

  async function create(event) {
    event.preventDefault(); setMessage('')
    try {
      await api('/api/objetivos?recurso=compromissos', { method: 'POST', body: JSON.stringify(form) })
      setForm((current) => ({ ...current, materiaId: '', titulo: '', data: '' }))
      await load()
    } catch (error) { setMessage(error.message) }
  }

  async function toggle(item) {
    await api('/api/objetivos?recurso=compromissos', { method: 'PATCH', body: JSON.stringify({ id: item.id, concluido: !item.concluido }) })
    setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, concluido: !entry.concluido } : entry))
  }

  return <section><header className="page-title"><div><p className="eyebrow">CALENDÁRIO DO MENTOR</p><h1>Provas e entregas</h1><p>Estas datas entram automaticamente no cálculo de prioridade e na preparação semanal.</p></div></header><div className="two-columns"><form className="panel form-card" onSubmit={create}><h2>Novo compromisso</h2><label>Objetivo</label><select value={form.objetivoId} onChange={(event) => setForm({ ...form, objetivoId: event.target.value, materiaId: '' })}>{catalog.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><label>Disciplina</label><select value={form.materiaId} onChange={(event) => setForm({ ...form, materiaId: event.target.value })}><option value="">Geral</option>{subjects.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><label>Título</label><input value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} required /><div className="form-row"><div><label>Tipo</label><select value={form.tipo} onChange={(event) => setForm({ ...form, tipo: event.target.value })}><option value="prova">Prova</option><option value="entrega">Entrega</option></select></div><div><label>Data</label><input type="date" value={form.data} onChange={(event) => setForm({ ...form, data: event.target.value })} required /></div></div><div className="form-row"><div><label>Peso</label><input type="number" min="1" max="5" value={form.peso} onChange={(event) => setForm({ ...form, peso: event.target.value })} /></div><div><label>Duração estimada</label><input type="number" min="30" step="30" value={form.duracaoMinutos} onChange={(event) => setForm({ ...form, duracaoMinutos: event.target.value })} /></div></div><button className="primary">Adicionar ao mentor</button></form><article className="panel list-panel"><div className="panel-heading"><h2>Próximos compromissos</h2><span>{items.filter((item) => !item.concluido).length}</span></div>{items.length ? items.map((item) => <div className={`review-row ${item.concluido ? 'done' : ''}`} key={item.id}><div><span className="priority-badge">P{item.peso}</span><p>{item.titulo}</p><small>{item.materia?.nome || item.objetivo?.nome} · {new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')} · {item.tipo}</small></div><button className="secondary" onClick={() => toggle(item)}>{item.concluido ? 'Reabrir' : 'Concluir'}</button></div>) : <div className="empty-inline">Nenhuma prova ou entrega cadastrada.</div>}</article></div>{message && <p className="alert error">{message}</p>}</section>
}
