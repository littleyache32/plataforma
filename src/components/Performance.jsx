import { useEffect, useState } from 'react'
import { api } from '../api.js'

const labels = { certeza: 'Certeza', duvida: 'Dúvida', eliminacao: 'Eliminação', sem_conhecimento: 'Sem conhecimento' }
function timeLabel(seconds) { if (!seconds) return 'Sem dados'; const min = Math.floor(seconds / 60); return min ? `${min}min ${seconds % 60}s` : `${seconds}s` }
function Metric({ label, value, detail, tone = '' }) { return <article className={`metric-card ${tone}`}><span>{label}</span><b>{value}</b><small>{detail}</small></article> }

function Confidence({ entries }) {
  const maximum = Math.max(1, ...entries.map((item) => item.total))
  return <article className="panel performance-panel"><div className="panel-heading"><h2>Acertos e erros por classificação</h2><span>{entries.reduce((sum, item) => sum + item.total, 0)} respostas</span></div><div className="confidence-chart">{entries.map((item) => <div key={item.id}><header><b>{labels[item.id]}</b><span>{item.taxa}% · {item.acertos}/{item.total}</span></header><div className="stacked-bar" style={{ width: `${Math.max(8, (item.total / maximum) * 100)}%` }}><i className="correct" style={{ width: `${item.taxa}%` }} /><i className="wrong" style={{ width: `${100 - item.taxa}%` }} /></div></div>)}</div><footer className="chart-legend"><span className="correct">Acertos</span><span className="wrong">Erros</span></footer></article>
}

function Evolution({ entries }) {
  const maximum = Math.max(1, ...entries.map((item) => item.taxa))
  return <article className="panel performance-panel"><div className="panel-heading"><h2>Evolução recente</h2><span>últimos dias</span></div>{entries.length ? <div className="evolution-bars">{entries.map((item) => <div key={item.data}><i style={{ height: `${Math.max(8, (item.taxa / maximum) * 100)}%` }} /><small>{item.data.slice(5).replace('-', '/')}</small><b>{item.taxa}%</b></div>)}</div> : <div className="empty-inline">Responda questões para acompanhar sua evolução.</div>}</article>
}

function Subjects({ entries }) {
  return <article className="panel performance-panel"><div className="panel-heading"><h2>Desempenho por disciplina</h2><span>{entries.length}</span></div>{entries.length ? <div className="subject-performance">{entries.map((item) => <div key={item.materia}><div><b>{item.materia}</b><small>{item.acertos}/{item.total} acertos · falsa certeza {item.falsa_certeza}</small></div><strong>{item.taxa}%</strong></div>)}</div> : <div className="empty-inline">Sem respostas registradas neste contexto.</div>}</article>
}

function Topics({ entries }) {
  return <article className="panel performance-panel"><div className="panel-heading"><h2>Análise por tópico</h2><span>prioridade visual</span></div>{entries.length ? <div className="topic-performance">{entries.map((item) => <div key={`${item.materia}-${item.topico}`}><div><small>{item.materia}</small><b>{item.topico}</b></div><span>{item.acertos}/{item.total}</span><strong className={item.taxa < 60 ? 'danger-text' : ''}>{item.taxa}%</strong></div>)}</div> : <div className="empty-inline">Os tópicos aparecerão depois das primeiras respostas.</div>}</article>
}

function TimeAnalysis({ entries, average }) {
  return <article className="panel performance-panel"><div className="panel-heading"><h2>Análise de tempo</h2><span>média {timeLabel(average)}</span></div><div className="time-analysis">{entries.map((item) => <div key={item.id}><span>{item.label}</span><b>{item.total}</b><small>{item.total ? `${item.taxa}% de acerto` : 'sem respostas'}</small></div>)}</div></article>
}

export default function Performance({ objective, onReview }) {
  const [data, setData] = useState(null)
  const [mentor, setMentor] = useState(null)
  const [error, setError] = useState('')

  function load() {
    const suffix = objective?.id ? `?objetivoId=${objective.id}` : ''
    return Promise.all([api(`/api/placar${suffix}`), api(`/api/mentor${suffix}`)]).then(([scoreData, mentorData]) => { setData(scoreData); setMentor(mentorData); setError('') }).catch((err) => setError(err.message))
  }

  useEffect(() => { load() }, [objective?.id])

  if (error) return <div className="alert error">{error}</div>
  if (!data || !mentor) return <div className="panel question-empty"><h2>Calculando desempenho...</h2></div>
  const score = data.questoes
  const certainty = score.confianca.find((item) => item.id === 'certeza')
  return <section><header className="page-title"><div><p className="eyebrow">DESEMPENHO</p><h1>Estatísticas</h1><p>Leitura completa das questões respondidas no contexto selecionado.</p></div></header><div className="performance-tabs" role="tablist"><button className="active">Questões</button><button disabled title="Simulados temporariamente indisponíveis">Simulados indisponíveis</button></div>
    <div className="metric-grid"><Metric label="Desempenho geral" value={`${score.acertos}/${score.total}`} detail={`${score.acerto_bruto}% de acerto`} /><Metric label="Taxa com certeza" value={`${certainty?.taxa || 0}%`} detail={`${certainty?.acertos || 0}/${certainty?.total || 0} acertos`} tone="good" /><Metric label="Acertos com certeza" value={`${score.acerto_com_certeza}%`} detail="acertos marcados com certeza" tone="good" /><Metric label="Falsa certeza" value={`${score.falsa_certeza}%`} detail="erros marcados com certeza" tone="danger" /><Metric label="Tempo por questão" value={timeLabel(score.tempo_medio)} detail="média das respostas" /></div>
    <div className="performance-detail-grid"><Confidence entries={score.confianca} /><Evolution entries={score.evolucao} /></div><div className="performance-detail-grid"><Subjects entries={score.materias} /><TimeAnalysis entries={score.ritmo || []} average={score.tempo_medio} /></div><Topics entries={score.topicos || []} />
    <div className="performance-grid"><article className="panel list-panel"><div className="panel-heading"><h2>Prioridades de estudo</h2><span>{mentor.prioridades.length}/3</span></div>{mentor.prioridades.length ? mentor.prioridades.map((item, index) => <div className="priority-row" key={item.id}><span>0{index + 1}</span><div><small>{item.materia}</small><b>{item.nome}</b></div><div><b>{item.falsa_certeza}%</b><small>falsa certeza</small></div></div>) : <div className="empty-inline">O mentor ainda não identificou uma prioridade crítica.</div>}</article><article className="panel list-panel"><div className="panel-heading"><h2>Revisão imediata</h2><span>{mentor.revisao_imediata.length}</span></div>{mentor.revisao_imediata.length ? mentor.revisao_imediata.map((item) => <div className="review-row" key={item.id}><div><span className={`priority-badge p${item.prioridade}`}>P{item.prioridade}</span><p>{item.enunciado}</p><small>{item.motivo.replaceAll('_', ' ')}</small></div><button className="secondary" onClick={() => onReview(item.questao_id)}>Refazer agora</button></div>) : <div className="empty-inline">Fila de revisão vazia.</div>}</article></div>
  </section>
}
