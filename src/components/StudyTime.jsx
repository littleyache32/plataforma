import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import FocusTimer from './FocusTimer.jsx'

const label = (seconds = 0) => `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}min`
export default function StudyTime({ catalog }) {
  const [data, setData] = useState(null)
  const [context, setContext] = useState('concurso')
  const [subjectId, setSubjectId] = useState('')
  const objective = useMemo(() => catalog.find((item) => item.tipo === context), [catalog, context])
  const subject = objective?.materias?.find((item) => item.id === subjectId)
  const load = () => api('/api/tempo').then(setData).catch(() => {})
  useEffect(() => { load() }, [])
  useEffect(() => { setSubjectId('') }, [context])
  return <section><header className="page-title compact"><div><p className="eyebrow">CONTROLE DE FOCO</p><h1>Tempo de estudo</h1><p>Escolha a área e a disciplina aqui. O tempo é registrado no mesmo histórico.</p></div></header><div className="metric-grid"><article className="metric-card"><span>Hoje</span><b>{label(data?.resumo?.hoje)}</b><small>tempo concluído</small></article><article className="metric-card"><span>Últimos 7 dias</span><b>{label(data?.resumo?.semana)}</b><small>tempo estudado</small></article><article className="metric-card"><span>Carga planejada</span><b>{label(data?.resumo?.planejado_semana)}</b><small>sem dividir demandas</small></article></div><article className="panel timer-free"><div className="focus-local-filters"><label>Área<select value={context} onChange={(event) => setContext(event.target.value)}><option value="concurso">BACEN</option><option value="faculdade">Faculdade</option></select></label><label>Disciplina<select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">Estudo livre</option>{(objective?.materias || []).map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></label></div><FocusTimer objetivoId={objective?.id} materiaId={subjectId || null} contexto={subjectId ? 'disciplina' : 'livre'} titulo={subject?.nome || `Estudo livre · ${context === 'concurso' ? 'BACEN' : 'Faculdade'}`} onFinish={load}/></article><article className="panel list-panel"><div className="panel-heading"><h2>Tempo por disciplina</h2></div>{(data?.resumo?.disciplinas || []).map((item) => <div className="time-subject-row" key={item.nome}><span>{item.nome}</span><b>{label(item.segundos)}</b></div>)}</article></section>
}
