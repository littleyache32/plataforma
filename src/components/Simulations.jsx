import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const classifications = [['certeza', 'Certeza'], ['duvida', 'Dúvida'], ['eliminacao', 'Eliminação'], ['sem_conhecimento', 'Sem conhecimento']]

function timeLabel(seconds) { const min = Math.max(0, Math.floor(seconds / 60)); return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}` }

export default function Simulations({ objective }) {
  const subjects = objective?.materias || []
  const [subjectId, setSubjectId] = useState('')
  const [amount, setAmount] = useState(10)
  const [duration, setDuration] = useState(30)
  const [simulation, setSimulation] = useState(null)
  const [items, setItems] = useState([])
  const [index, setIndex] = useState(0)
  const [message, setMessage] = useState('')
  const [now, setNow] = useState(Date.now())

  useEffect(() => { setSubjectId(subjects[0]?.id || ''); setSimulation(null); setItems([]) }, [objective?.id])
  useEffect(() => { if (!simulation || simulation.status === 'finalizado') return undefined; const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [simulation?.id, simulation?.status])
  const remaining = useMemo(() => simulation ? simulation.duracao_minutos * 60 - Math.floor((now - new Date(simulation.iniciado_em).getTime()) / 1000) : 0, [simulation, now])
  const current = items[index]

  async function start() {
    try { const data = await api('/api/simulados', { method: 'POST', body: JSON.stringify({ objetivoId: objective.id, materiaId: subjectId || null, quantidade: Number(amount), duracaoMinutos: Number(duration) }) }); await load(data.id) } catch (error) { setMessage(error.message) }
  }
  async function load(id) { const data = await api(`/api/simulados?id=${id}`); setSimulation(data.simulado); setItems(data.itens); setIndex(0); setNow(Date.now()) }
  async function save(item, changes) { const data = { simuladoId: simulation.id, itemId: item.id, tempo: item.tempo || 0, eliminadas: item.eliminadas || [], ...changes }; await api('/api/simulados', { method: 'PATCH', body: JSON.stringify(data) }); setItems((all) => all.map((entry) => entry.id === item.id ? { ...entry, ...changes, pulada: typeof changes.pular === 'boolean' ? changes.pular : entry.pulada } : entry)) }
  async function respond() { if (!current?.resposta || !current.classificacao) return; await save(current, { resposta: current.resposta, classificacao: current.classificacao, pular: false }); if (index < items.length - 1) setIndex(index + 1) }
  async function finish() { await api('/api/simulados', { method: 'PATCH', body: JSON.stringify({ simuladoId: simulation.id, finalizar: true }) }); await load(simulation.id) }
  const answered = items.filter((item) => item.resposta).length

  if (!simulation) return <section><header className="page-title"><div><p className="eyebrow">PROVAS CRONOMETRADAS</p><h1>Simulados</h1><p>Questões sorteadas, sem filtro durante a prova e com retomada automática.</p></div></header><article className="panel simulation-start"><h2>Novo simulado</h2><label>Disciplina</label><select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Todas do contexto</option>{subjects.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><div className="form-row"><div><label>Questões</label><input type="number" min="2" max="50" value={amount} onChange={(event) => setAmount(event.target.value)} /></div><div><label>Duração (minutos)</label><input type="number" min="5" value={duration} onChange={(event) => setDuration(event.target.value)} /></div></div><button className="primary" onClick={start}>Iniciar simulado</button>{message && <p className="alert error">{message}</p>}</article></section>
  const options = current.questao.tipo === 'CE' ? [['C', 'Certo'], ['E', 'Errado']] : Object.entries(current.questao.alternativas || {})
  return <section className="simulation-page"><header className="simulation-head"><div><span>SIMULADO EM ANDAMENTO</span><b>{answered}/{items.length} respondidas</b></div><strong className={remaining <= 0 ? 'time-ended' : ''}>{timeLabel(remaining)}</strong><button className="secondary" onClick={finish}>Finalizar</button></header><div className="simulation-layout"><aside className="simulation-numbers">{items.map((item, itemIndex) => <button key={item.id} className={`${itemIndex === index ? 'active' : ''} ${item.resposta ? 'answered' : ''} ${item.pulada ? 'skipped' : ''}`} onClick={() => setIndex(itemIndex)}>{item.ordem}</button>)}</aside><article className="panel simulation-question"><div className="question-meta"><span>Questão {current.ordem} de {items.length}</span><button onClick={() => save(current, { pular: true })}>Pular para depois</button></div><h2>{current.questao.enunciado}</h2><div className="answers">{options.map(([letter, text]) => <div className={`answer-option ${current.resposta === letter ? 'selected' : ''} ${(current.eliminadas || []).includes(letter) ? 'eliminated' : ''}`} key={letter}><button className="answer-choice" onClick={() => setItems((all) => all.map((item) => item.id === current.id ? { ...item, resposta: letter, pulada: false } : item))}><b>{letter}</b><span>{text}</span></button>{current.questao.tipo === 'ME' && <button className="answer-eliminate" onClick={() => setItems((all) => all.map((item) => item.id === current.id ? { ...item, eliminadas: item.eliminadas?.includes(letter) ? item.eliminadas.filter((value) => value !== letter) : [...(item.eliminadas || []), letter] } : item))}>×</button>}</div>)}</div><div className="confidence"><h3>Como você chegou à resposta?</h3><div>{classifications.map(([id, label]) => <button key={id} className={current.classificacao === id ? 'selected' : ''} onClick={() => setItems((all) => all.map((item) => item.id === current.id ? { ...item, classificacao: id } : item))}><b>{label}</b></button>)}</div><button className="primary confirm" disabled={!current.resposta || !current.classificacao} onClick={respond}>Salvar e avançar</button></div></article></div></section>
}
