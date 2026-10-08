import { useEffect, useState } from 'react'
import { api } from '../api.js'
import Icon from './Icon.jsx'

export function MentorOverview({ mentor }) {
  const evaluation = mentor?.avaliacao_mentor_v2
  const summary = mentor?.resumo || {}
  const alerts = mentor?.alertas || []
  const load = evaluation?.carga_semanal?.carga_observada
  const execution = evaluation?.carga_semanal?.sinais?.execucao
  const direction = evaluation?.explicacao || mentor?.decisao_mentor?.explanation
  return <div className="mentor-overview">
    <section><h3>O que está observando</h3>
      <dl><div><dt>Plano</dt><dd>{load ? `${load.demandas} demandas · ${load.minutos} min` : 'Ainda sem carga registrada'}</dd></div>
      <div><dt>Execução</dt><dd>{execution ? `${execution.demandas_concluidas} demandas concluídas` : 'Ainda sem dados de execução'}</dd></div>
      <div><dt>Domínio</dt><dd>{summary.dominio === 'UNKNOWN' || !summary.dominio ? 'Evidência ainda insuficiente' : summary.dominio}</dd></div></dl>
    </section>
    <section><h3>Sinais em atenção</h3>{alerts.length ? <ul>{alerts.slice(0, 3).map((alert, index) => <li key={`${alert.tipo}-${index}`}><b>{alert.titulo}</b><p>{alert.mensagem}</p></li>)}</ul>
      : <p className="muted">Nenhum sinal registrado para exibir.</p>}</section>
    <section><h3>Direção atual</h3><p>{direction || 'A direção aparecerá quando houver uma decisão registrada.'}</p></section>
  </div>
}

export default function MentorWidget({ objectiveId }) {
  const [open, setOpen] = useState(false)
  const [mentor, setMentor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!open) return
    if (!objectiveId) { setMentor(null); return }
    let active = true
    setLoading(true); setMentor(null); setError('')
    api(`/api/mentor?objetivoId=${encodeURIComponent(objectiveId)}&compacto=1`)
      .then((data) => { if (active) setMentor(data) })
      .catch((cause) => { if (active) setError(cause.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [open, objectiveId])
  useEffect(() => {
    if (!open) return
    const close = (event) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [open])
  return <aside className={`mentor-widget ${open ? 'open' : ''}`}>
    {open && <section id="mentor-overview" className="mentor-popover mentor-objective" aria-label="Visão do Mentor">
      <header><div><h2>Mentor</h2><small>Leitura dos seus registros</small></div><button type="button" className="ghost" aria-label="Fechar visão do Mentor" onClick={() => setOpen(false)}>×</button></header>
      {loading ? <p role="status">Carregando leitura…</p> : error ? <p role="alert" className="alert error">{error}</p> : <MentorOverview mentor={mentor} />}
    </section>}
    <button type="button" className="mentor-trigger" title={open ? 'Fechar Mentor' : 'Abrir Mentor'} onClick={() => setOpen((value) => !value)} aria-label={open ? 'Fechar mentor' : 'Abrir mentor'} aria-expanded={open} aria-controls="mentor-overview"><Icon name="controle" /></button>
  </aside>
}
