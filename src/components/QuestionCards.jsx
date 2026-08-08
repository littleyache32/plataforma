import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const ratings = [
  ['novamente', 'De novo', '10 min'],
  ['dificil', 'Difícil', 'intervalo curto'],
  ['bom', 'Bom', 'intervalo normal'],
  ['facil', 'Fácil', 'intervalo longo'],
]

function clockLabel(seconds) {
  const safe = Math.max(0, seconds)
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}

export default function QuestionCards({ objective }) {
  const subjects = objective?.materias || []
  const [subjectId, setSubjectId] = useState('')
  const topics = useMemo(() => subjects.find((item) => item.id === subjectId)?.topicos || [], [subjects, subjectId])
  const [topicId, setTopicId] = useState('')
  const [cards, setCards] = useState([])
  const [stats, setStats] = useState({ total: 0, vencidos: 0, novos: 0 })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [startedAt] = useState(() => Date.now())
  const [now, setNow] = useState(Date.now())

  function load() {
    setLoading(true)
    const params = new URLSearchParams({ recurso: 'cards' })
    if (objective?.id) params.set('objetivoId', objective.id)
    if (subjectId) params.set('materiaId', subjectId)
    if (topicId) params.set('topicoId', topicId)
    return api(`/api/questoes?${params}`).then((data) => {
      setCards(data.cards)
      setStats({ total: data.total, vencidos: data.vencidos, novos: data.novos })
      setMessage('')
    }).catch((error) => setMessage(error.message)).finally(() => setLoading(false))
  }

  useEffect(() => { setSubjectId(''); setTopicId(''); setReviewed(0) }, [objective?.id])
  useEffect(() => { load() }, [objective?.id, subjectId, topicId])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer) }, [])

  const queue = useMemo(() => cards.filter((item) => item.vencido), [cards])
  const card = queue[0]
  const remainingSeconds = 30 * 60 - Math.floor((now - startedAt) / 1000)

  async function answer(resultado) {
    if (!card) return
    setLoading(true)
    try {
      await api('/api/questoes?recurso=cards', { method: 'PATCH', body: JSON.stringify({ id: card.id, resultado }) })
      setCards((items) => items.filter((item) => item.id !== card.id))
      setReviewed((current) => current + 1)
      setRevealed(false)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  return <section><header className="page-title compact"><div><p className="eyebrow">REVISÃO ESPAÇADA</p><h1>Question Cards</h1><p>Sessão diária de 30 minutos. A próxima revisão é calculada pela dificuldade que você informa.</p></div><div className="card-session-clock"><small>SESSÃO DE HOJE</small><b>{clockLabel(remainingSeconds)}</b><span>{reviewed} revisados</span></div></header>
    <article className="panel card-filter"><div><label>Disciplina</label><select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setTopicId('') }}><option value="">Todas as disciplinas</option>{subjects.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></div><div><label>Tópico</label><select value={topicId} onChange={(event) => setTopicId(event.target.value)} disabled={!subjectId}><option value="">Todos os tópicos</option>{topics.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></div><div className="card-queue-stats"><span><b>{stats.vencidos}</b> para hoje</span><span><b>{stats.novos}</b> novos</span><span><b>{stats.total}</b> no acervo</span></div></article>
    {loading && !card ? <div className="panel question-empty"><h2>Organizando sua fila...</h2></div> : !card ? <div className="panel question-empty"><span>✓</span><h2>{message || 'Revisões disponíveis concluídas.'}</h2><p>Os próximos cards aparecerão automaticamente na data calculada.</p></div> : <article className="panel card-study"><div className="card-study-meta"><span>{card.objetivo?.tipo === 'faculdade' ? 'Faculdade' : 'BACEN'} · {card.materia?.nome}</span><small>{card.topico?.nome}</small></div><div className="card-face"><span>{revealed ? 'RESPOSTA E EXPLICAÇÃO' : 'PERGUNTA'}</span><h2>{revealed ? card.verso : card.frente}</h2></div>{revealed ? <><blockquote><small>TRECHO DE ORIGEM</small>{card.trecho_fonte}</blockquote><span className="source-link">{card.fonte}</span><div className="anki-actions">{ratings.map(([id, label, hint]) => <button className={`rating-${id}`} key={id} onClick={() => answer(id)} disabled={loading}><b>{label}</b><small>{hint}</small></button>)}</div></> : <button className="primary card-reveal" onClick={() => setRevealed(true)}>Mostrar resposta</button>}</article>}
  </section>
}
