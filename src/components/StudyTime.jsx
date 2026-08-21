import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import FocusTimer from './FocusTimer.jsx'

const label = (seconds = 0) => `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`
const chartColors = ['#4267b2', '#6b8f71', '#c27b5a', '#8b6fa8', '#d3a94a', '#4f8f9d', '#b75d69', '#7386c5', '#8c7a5b', '#629f83', '#a0648b', '#577590']

export default function StudyTime({ catalog }) {
  const [data, setData] = useState(null)
  const [context, setContext] = useState('concurso')
  const [subjectId, setSubjectId] = useState('')
  const objective = useMemo(() => catalog.find((item) => item.tipo === context), [catalog, context])
  const subject = objective?.materias?.find((item) => item.id === subjectId)
  const load = () => api('/api/tempo').then(setData).catch(() => {})
  useEffect(() => { load() }, [])
  useEffect(() => { setSubjectId('') }, [context])
  const subjects = data?.resumo?.disciplinas || []
  const activities = data?.resumo?.atividades || []
  const total = subjects.reduce((sum, item) => sum + item.segundos, 0)
  let cursor = 0
  const slices = subjects.map((item, index) => {
    const start = cursor
    cursor += total ? item.segundos / total * 100 : 0
    return `${chartColors[index % chartColors.length]} ${start}% ${cursor}%`
  })

  return <section className="study-time-page">
    <header className="page-title compact"><div><p className="eyebrow">CONTROLE DE FOCO</p><h1>Tempo de estudo</h1><p>Escolha a área, a disciplina e o tempo de foco. Use o ciclo 50 + 10 quando quiser; o aviso sonoro não encerra o timer.</p></div></header>
    <div className="metric-grid study-time-metrics"><article className="metric-card"><span>Hoje</span><b>{label(data?.resumo?.hoje)}</b><small>tempo concluído</small></article><article className="metric-card"><span>Últimos 7 dias</span><b>{label(data?.resumo?.semana)}</b><small>tempo estudado</small></article><article className="metric-card"><span>Carga planejada</span><b>{label(data?.resumo?.planejado_semana)}</b><small>sem dividir demandas</small></article></div>
    <article className="panel timer-free"><div className="focus-local-filters"><label>Área<select value={context} onChange={(event) => setContext(event.target.value)}><option value="concurso">BACEN</option><option value="faculdade">Faculdade</option></select></label><label>Disciplina<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Estudo livre</option>{(objective?.materias || []).map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label></div><FocusTimer objetivoId={objective?.id} materiaId={subjectId || null} contexto={subjectId ? 'disciplina' : 'livre'} titulo={subject?.nome || `Estudo livre · ${context === 'concurso' ? 'BACEN' : 'Faculdade'}`} suggestedMinutes={0} onFinish={load}/></article>
    <article className="panel study-time-chart"><div className="panel-heading"><h2>Tempo por disciplina</h2><span>{subjects.length}</span></div>{subjects.length ? <div className="study-pie-layout"><div className="study-pie" role="img" aria-label="Distribuição do tempo por disciplina" style={{ background: `conic-gradient(${slices.join(',')})` }}><span><b>{label(total)}</b><small>total</small></span></div><div className="study-pie-legend">{subjects.map((item, index) => <div key={item.nome}><i style={{ background: chartColors[index % chartColors.length] }}/><span>{item.nome}</span><b>{label(item.segundos)}</b><small>{total ? Math.round(item.segundos / total * 100) : 0}%</small></div>)}</div></div> : <div className="empty-inline">O gráfico aparecerá depois do primeiro timer concluído.</div>}</article>
    <article className="panel"><div className="panel-heading"><h2>Tempo por atividade</h2></div><div className="activity-time-grid">{activities.map((item) => <div className={`activity-time activity-${item.tipo}`} key={item.tipo}><span>{({ estudo: 'Estudo', questoes: 'Questões', question_cards: 'Question Cards', simulados: 'Simulados' })[item.tipo]}</span><b>{label(item.segundos)}</b></div>)}</div></article>
    <article className="panel"><div className="panel-heading"><h2>Horários registrados</h2><span>{data?.historico?.length || 0}</span></div><div className="timer-history">{(data?.historico || []).filter((item) => item.status === 'concluido').slice(0, 30).map((item) => <div key={item.id}><span><b>{item.titulo}</b><small>{new Date(item.iniciado_em).toLocaleString('pt-BR')} · {label(item.segundos)}</small></span><button className="ghost danger" onClick={async () => { if (!window.confirm('Apagar este horário?')) return; await api(`/api/tempo?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' }); load() }}>Apagar</button></div>)}</div></article>
  </section>
}
