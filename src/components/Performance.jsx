import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function Performance({ objective, onReview }) {
  const [score, setScore] = useState(null)
  const [mentor, setMentor] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([api('/api/placar'), api('/api/mentor')])
      .then(([scoreData, mentorData]) => { setScore(scoreData); setMentor(mentorData) })
      .catch((err) => setError(err.message))
  }, [objective?.id])
  if (error) return <div className="alert error">{error}</div>
  if (!score || !mentor) return <div className="panel question-empty"><h2>Calculando desempenho...</h2></div>

  const priorities = mentor.prioridades.filter((item) => !objective || item.objetivo === objective.nome)
  const collecting = mentor.topicos.filter((item) => (!objective || item.objetivo === objective.nome) && item.status === 'coletando_dados')
  return (
    <section><header className="page-title"><div><p className="eyebrow">DIAGNÓSTICO E RECÊNCIA</p><h1>Desempenho</h1><p>O placar abaixo é sempre geral. As prioridades respeitam o objetivo selecionado.</p></div></header>
      <div className="score-grid"><article><span>Acerto bruto</span><b>{score.acerto_bruto}%</b><small>{score.total} respostas gerais</small></article><article className="good"><span>Domínio real</span><b>{score.acerto_com_certeza}%</b><small>acerto com certeza</small></article><article className="danger"><span>Falsa certeza</span><b>{score.falsa_certeza}%</b><small>erro com certeza</small></article></div>
      <div className="performance-grid"><article className="panel list-panel"><div className="panel-heading"><h2>Prioridades</h2><span>{priorities.length}/3</span></div>{priorities.length ? priorities.map((item, index) => <div className="priority-row" key={item.id}><span>0{index + 1}</span><div><small>{item.materia}</small><b>{item.nome}</b></div><div><b>{item.falsa_certeza}%</b><small>falsa certeza</small></div></div>) : <div className="empty-inline">Nenhuma prioridade crítica com amostra suficiente.</div>}</article>
        <article className="panel list-panel"><div className="panel-heading"><h2>Fila de revisão</h2><span>{mentor.revisao_imediata.length}</span></div>{mentor.revisao_imediata.length ? mentor.revisao_imediata.map((item) => <div className="review-row" key={item.id}><div><span className={`priority-badge p${item.prioridade}`}>P{item.prioridade}</span><p>{item.enunciado}</p><small>{item.motivo.replaceAll('_', ' ')}</small></div><button className="secondary" onClick={() => onReview(item.questao_id)}>Refazer agora</button></div>) : <div className="empty-inline">Fila de revisão vazia.</div>}</article>
      </div>
      <article className="panel collecting"><div className="panel-heading"><h2>Coletando dados</h2><span>{collecting.length}</span></div><div>{collecting.slice(0, 12).map((item) => <span key={item.id}>{item.nome}<b>{item.amostra}/20</b></span>)}</div></article>
    </section>
  )
}
