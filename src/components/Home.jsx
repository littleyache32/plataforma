import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import { brasilDate, duration, summarizeHome, weekDates } from '../home-summary.js'
import DemandIdentity, { subjectAccent } from './StudyIdentity.jsx'

export default function Home({ onNavigate }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const today = brasilDate()
  const dates = useMemo(() => weekDates(today), [today])

  useEffect(() => {
    let active = true
    Promise.all([
      api('/api/tempo'),
      api(`/api/sessoes?inicio=${dates[0]}&fim=${dates[6]}`),
    ]).then(([time, plan]) => {
      if (active) setData({ history: time.historico || [], sessions: plan.sessoes || [] })
    }).catch((cause) => { if (active) setError(cause.message) })
    return () => { active = false }
  }, [dates[0], dates[6]])

  if (error) return <section className="home-page"><div className="alert error">Não foi possível carregar o resumo: {error}</div><button className="secondary" onClick={() => onNavigate('semana')}>Abrir meu plano</button></section>
  if (!data) return <section className="home-page"><div className="panel home-loading">Carregando seu resumo...</div></section>

  return <HomeSummary summary={summarizeHome(data.history, data.sessions, today)} subjectsByName={new Map(data.history.map((item) => [item.materia?.nome, item.materia]))} onNavigate={onNavigate} />
}

export function HomeSummary({ summary, onNavigate, subjectsByName = new Map() }) {
  const maxDay = Math.max(1, ...summary.secondsByDay.values())
  return <section className="home-page">
    <header className="page-title home-title"><div><p className="eyebrow">VISÃO GERAL</p><h1>Início</h1><p>Seu estudo e as próximas atividades.</p></div><button className="primary" onClick={() => onNavigate('semana')}>Abrir meu plano</button></header>
    <div className="home-metrics">
      <article className="panel home-metric"><span>ESTUDO DE HOJE</span><strong>{duration(summary.todaySeconds)}</strong><small>tempo registrado</small></article>
      <article className="panel home-metric"><span>ESTA SEMANA</span><strong>{duration(summary.weekSeconds)}</strong><small>{summary.studiedDays} de 7 dias com estudo</small></article>
      <article className="panel home-metric"><span>DEMANDAS DE HOJE</span><strong>{summary.todayDone}/{summary.todayTotal}</strong><small>{duration(summary.todayPlanned)} planejadas para hoje</small></article>
      <article className="panel home-metric"><span>PLANO SEMANAL</span><strong>{summary.weekDone}/{summary.weekTotal}</strong><small>demandas concluídas</small></article>
    </div>
    <div className="home-main-grid">
      <article className="panel home-panel"><div className="home-panel-head"><div><span className="eyebrow">RITMO</span><h2>Estudo da semana</h2></div><button className="secondary" onClick={() => onNavigate('tempo')}>Ver cronômetro</button></div><div className="home-week-chart" aria-label="Tempo de estudo registrado por dia nesta semana">{summary.dates.map((date) => {
        const seconds = summary.secondsByDay.get(date) || 0
        return <div className="home-week-day" key={date}><div className="home-week-bar-track"><i style={{ height: `${seconds ? Math.max(8, seconds / maxDay * 100) : 0}%` }}/></div><b aria-label={duration(seconds)}>{duration(seconds).replace('min', '')}</b><span>{new Date(`${date}T12:00:00-03:00`).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' }).replace('.', '')}</span></div>
      })}</div></article>
      <article className="panel home-panel"><div className="home-panel-head"><div><span className="eyebrow">SEQUÊNCIA</span><h2>Próximas demandas</h2></div><button className="secondary" onClick={() => onNavigate('semana')}>Ver semana</button></div>{summary.nextDemands.length ? <div className="home-demand-list">{summary.nextDemands.map((item) => <div key={item.id}><div><DemandIdentity item={item}/><b>{item.titulo}</b><small>{new Date(`${item.data}T12:00:00-03:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} · {item.duracao_estimada || 0} min</small></div></div>)}</div> : <p className="home-empty">Nenhuma demanda futura nesta semana. Consulte seu plano para ver a próxima semana.</p>}</article>
    </div>
    <article className="panel home-panel"><div className="home-panel-head"><div><span className="eyebrow">DISCIPLINAS</span><h2>Tempo registrado por disciplina</h2></div><button className="secondary" onClick={() => onNavigate('tempo')}>Ver histórico</button></div>{summary.subjects.length ? <div className="home-subject-list">{summary.subjects.map(([name, seconds]) => <div key={name}><i aria-hidden="true" style={{ background: subjectAccent(subjectsByName.get(name), name) }}/><span>{name}</span><b>{duration(seconds)}</b></div>)}</div> : <p className="home-empty">O tempo por disciplina aparece depois do primeiro registro de estudo.</p>}</article>
    <p className="home-data-note">Os indicadores mostram apenas registros salvos. Questões, Question Cards e simulados continuam conforme a fase definida pelo mentor.</p>
  </section>
}
