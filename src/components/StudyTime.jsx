import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import FocusTimer from './FocusTimer.jsx'

const label = (seconds = 0) => `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`
const chartColors = ['#22685e', '#55877f', '#83aaa3', '#b2cbc6', '#dce7e4', '#60726e']
const todayIso = () => new Intl.DateTimeFormat('en-CA').format(new Date())

export default function StudyTime({ catalog, target, onTargetApplied }) {
  const [data, setData] = useState(null)
  const [context, setContext] = useState('concurso')
  const [demand, setDemand] = useState(null)
  const [subjectId, setSubjectId] = useState('')
  const [manualOpen, setManualOpen] = useState(false)
  const [manualDate, setManualDate] = useState(todayIso)
  const [manualHours, setManualHours] = useState('')
  const [manualMinutes, setManualMinutes] = useState('')
  const [manualMessage, setManualMessage] = useState('')
  const [manualSaving, setManualSaving] = useState(false)
  const objective = useMemo(() => catalog.find((item) => item.tipo === context), [catalog, context])
  const subject = objective?.materias?.find((item) => item.id === subjectId)
  const load = () => api('/api/tempo').then(setData).catch(() => {})
  useEffect(() => { load() }, [])
  useEffect(() => { if (!target) return; setDemand(target); setContext(target.objetivo?.tipo || 'concurso'); setSubjectId(target.materia?.id || ''); onTargetApplied?.() }, [target?.id])
  const subjects = data?.resumo?.disciplinas || []
  const activities = data?.resumo?.atividades || []
  const total = subjects.reduce((sum, item) => sum + item.segundos, 0)
  let cursor = 0
  const slices = subjects.map((item, index) => {
    const start = cursor
    cursor += total ? item.segundos / total * 100 : 0
    return `${chartColors[index % chartColors.length]} ${start}% ${cursor}%`
  })

  async function addManualTime(event) {
    event.preventDefault()
    setManualMessage('')
    const seconds = (Math.max(0, Number(manualHours) || 0) * 60 + Math.max(0, Number(manualMinutes) || 0)) * 60
    if (seconds < 60) { setManualMessage('Informe pelo menos 1 minuto.'); return }
    if (seconds > 43200) { setManualMessage('O limite por registro é de 12 horas.'); return }
    if (!manualDate) { setManualMessage('Escolha a data do estudo.'); return }
    try {
      setManualSaving(true)
      const result = await api('/api/tempo', { method: 'POST', body: JSON.stringify({ objetivoId: objective?.id || null, materiaId: subjectId || null, contexto: subjectId ? 'disciplina' : 'livre', titulo: subject?.nome || `Estudo livre · ${context === 'concurso' ? 'BACEN' : 'Faculdade'}`, status: 'concluido', segundosAcumulados: seconds, iniciadoEm: `${manualDate}T12:00:00-03:00` }) })
      if (!result?.offline) await load()
      setManualHours(''); setManualMinutes('')
      setManualMessage(result?.offline ? 'Tempo salvo no aparelho. Ele será sincronizado quando a conexão voltar.' : `${label(seconds)} adicionados com sucesso.`)
    } catch (error) { setManualMessage(error.message) }
    finally { setManualSaving(false) }
  }

  return <section className="study-time-page">
    <header className="page-title compact"><div><p className="eyebrow">CONTROLE DE FOCO</p><h1>Timer</h1><p>{demand ? demand.titulo : 'Selecione a matéria e comece.'}</p></div></header>
    <div className="metric-grid study-time-metrics"><article className="metric-card"><span>Hoje</span><b>{label(data?.resumo?.hoje)}</b><small>tempo concluído</small></article><article className="metric-card"><span>Últimos 7 dias</span><b>{label(data?.resumo?.semana)}</b><small>tempo estudado</small></article><article className="metric-card"><span>Carga planejada</span><b>{label(data?.resumo?.planejado_semana)}</b><small>sem dividir demandas</small></article></div>
    <article className="panel timer-free">{demand ? <button className="secondary" onClick={() => { setDemand(null); setSubjectId('') }}>Estudo livre</button> : <div className="focus-local-filters"><label>Matéria<select value={subjectId} onChange={(event) => { const id = event.target.value; const parent = catalog.find((item) => item.materias?.some((subject) => subject.id === id)); setContext(parent?.tipo || 'concurso'); setSubjectId(id) }}><option value="">Estudo livre</option>{catalog.map((item) => <optgroup label={item.nome} key={item.id}>{(item.materias || []).map((subject) => <option value={subject.id} key={subject.id}>{subject.nome}</option>)}</optgroup>)}</select></label></div>}<FocusTimer key={demand?.id || 'livre'} sessaoId={demand?.id} objetivoId={demand?.objetivo?.id || objective?.id} materiaId={demand?.materia?.id || subjectId || null} topicoId={demand?.topico?.id || null} contexto={demand ? 'demanda' : subjectId ? 'disciplina' : 'livre'} titulo={demand?.titulo || subject?.nome || 'Estudo livre'} suggestedMinutes={demand?.duracao_estimada || 50} onFinish={load}/><div className="manual-time-entry"><button className="secondary" type="button" onClick={() => { setManualOpen((value) => !value); setManualMessage('') }}>{manualOpen ? 'Fechar' : 'Adicionar tempo esquecido'}</button>{manualOpen && <form onSubmit={addManualTime}><label>Data<input type="date" max={todayIso()} value={manualDate} onChange={(event) => setManualDate(event.target.value)} required/></label><label>Horas<input type="number" min="0" max="12" inputMode="numeric" value={manualHours} onChange={(event) => setManualHours(event.target.value)} placeholder="0"/></label><label>Minutos<input type="number" min="0" max="59" inputMode="numeric" value={manualMinutes} onChange={(event) => setManualMinutes(event.target.value)} placeholder="0"/></label><button className="primary" type="submit" disabled={manualSaving}>{manualSaving ? 'Salvando...' : 'Adicionar tempo'}</button></form>}{manualMessage && <small className="timer-notice" role="status" aria-live="polite">{manualMessage}</small>}</div></article>
    <article className="panel study-time-chart"><div className="panel-heading"><h2>Tempo por disciplina</h2><span>{subjects.length}</span></div>{subjects.length ? <div className="study-pie-layout"><div className="study-pie" role="img" aria-label="Distribuição do tempo por disciplina" style={{ background: `conic-gradient(${slices.join(',')})` }}><span><b>{label(total)}</b><small>total</small></span></div><div className="study-pie-legend">{subjects.map((item, index) => <div key={item.nome}><i style={{ background: chartColors[index % chartColors.length] }}/><span>{item.nome}</span><b>{label(item.segundos)}</b><small>{total ? Math.round(item.segundos / total * 100) : 0}%</small></div>)}</div></div> : <div className="empty-inline">O gráfico aparecerá depois do primeiro timer concluído.</div>}</article>
    <article className="panel"><div className="panel-heading"><h2>Tempo por atividade</h2></div><div className="activity-time-grid">{activities.map((item) => <div className={`activity-time activity-${item.tipo}`} key={item.tipo}><span>{({ estudo: 'Estudo', questoes: 'Questões', question_cards: 'Question Cards', simulados: 'Simulados' })[item.tipo]}</span><b>{label(item.segundos)}</b></div>)}</div></article>
    <article className="panel"><div className="panel-heading"><h2>Horários registrados</h2><span>{data?.historico?.length || 0}</span></div><div className="timer-history">{(data?.historico || []).filter((item) => item.status === 'concluido').slice(0, 30).map((item) => <div key={item.id}><span><b>{item.titulo}</b><small>{new Date(item.iniciado_em).toLocaleString('pt-BR')} · {label(item.segundos)}</small></span><button className="ghost danger" onClick={async () => { if (!window.confirm('Apagar este horário?')) return; await api(`/api/tempo?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' }); load() }}>Apagar</button></div>)}</div></article>
  </section>
}
