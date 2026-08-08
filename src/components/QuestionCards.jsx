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

export default function QuestionCards({ objective, target, onTargetApplied }) {
  const subjects = (objective?.materias || []).filter((item) => !(objective?.tipo === 'faculdade' && ['análise e produção de texto', 'analise e producao de texto'].includes(item.nome.toLocaleLowerCase('pt-BR'))))
  const [subjectId, setSubjectId] = useState('')
  const topics = useMemo(() => subjects.find((item) => item.id === subjectId)?.topicos || [], [subjects, subjectId])
  const [topicId, setTopicId] = useState('')
  const [cards, setCards] = useState([])
  const [stats, setStats] = useState({ total: 0, vencidos: 0, novos: 0 })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [startedAt, setStartedAt] = useState(null)
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

  useEffect(() => { setSubjectId(''); setTopicId(''); setReviewed(0); setStartedAt(null) }, [objective?.id])
  useEffect(() => {
    if (!target?.subjectId || !subjects.some((item) => item.id === target.subjectId)) return
    setSubjectId(target.subjectId)
  }, [target?.subjectId, objective?.id])
  useEffect(() => {
    if (target?.subjectId !== subjectId) return
    setTopicId(target.topicId || '')
    setReviewed(0); setStartedAt(null); setRevealed(false)
    onTargetApplied?.()
  }, [subjectId, target?.subjectId, target?.topicId])
  useEffect(() => { load() }, [objective?.id, subjectId, topicId])
  useEffect(() => {
    if (!startedAt) return undefined
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [startedAt])

  const queue = useMemo(() => cards.filter((item) => item.vencido), [cards])
  const remainingSeconds = startedAt ? 30 * 60 - Math.floor((now - startedAt) / 1000) : 30 * 60
  const sessionEnded = Boolean(startedAt) && remainingSeconds <= 0
  const card = startedAt && !sessionEnded ? queue[0] : null

  function resetSessionFilters(change) {
    change()
    setStartedAt(null)
    setReviewed(0)
    setRevealed(false)
  }

  function startSession() {
    const started = Date.now()
    setStartedAt(started)
    setNow(started)
    setReviewed(0)
    setRevealed(false)
  }

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

  return <section><header className="page-title compact"><div><p className="eyebrow">REVISÃO ESPAÇADA</p><h1>Question Cards</h1><p>Sessão diária de 30 minutos. O tempo começa somente quando você inicia.</p></div><div className="card-session-clock"><small>SESSÃO DE HOJE</small><b>{clockLabel(remainingSeconds)}</b><span>{reviewed} revisados</span></div></header>
    <article className="panel card-filter"><div><label>Disciplina</label><select value={subjectId} onChange={(event) => resetSessionFilters(() => { setSubjectId(event.target.value); setTopicId('') })}><option value="">Todas as disciplinas</option>{subjects.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></div><div><label>Tópico</label><select value={topicId} onChange={(event) => resetSessionFilters(() => setTopicId(event.target.value))} disabled={!subjectId}><option value="">Todos os tópicos</option>{topics.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></div><div className="card-queue-stats"><span><b>{stats.vencidos}</b> para hoje</span><span><b>{stats.novos}</b> novos</span><span><b>{stats.total}</b> no acervo</span></div></article>
    {loading && !startedAt ? <div className="panel question-empty"><h2>Organizando sua fila...</h2></div> : !startedAt ? <div className="panel question-empty"><h2>{message || `${stats.vencidos} cards disponíveis para hoje.`}</h2><p>O cronômetro de 30 minutos ainda não começou.</p><button className="primary" onClick={startSession} disabled={!stats.vencidos}>Iniciar Question Cards</button></div> : sessionEnded ? <div className="panel question-empty"><h2>Sessão de 30 minutos concluída.</h2><p>{reviewed} cards foram revisados.</p></div> : !card ? <div className="panel question-empty"><h2>{message || 'Revisões disponíveis concluídas.'}</h2><p>Você terminou a fila antes do tempo.</p></div> : <article className="panel card-study"><div className="card-study-meta"><span>{card.objetivo?.tipo === 'faculdade' ? 'Faculdade' : 'BACEN'} · {card.materia?.nome}</span><small>{card.topico?.nome}</small></div><div className="card-face"><span>{revealed ? 'RESPOSTA E EXPLICAÇÃO' : 'PERGUNTA'}</span><h2>{revealed ? card.verso : card.frente}</h2></div>{revealed ? <><blockquote><small>TRECHO DE ORIGEM</small>{card.trecho_fonte}</blockquote><span className="source-link">{card.fonte}</span><div className="anki-actions">{ratings.map(([id, label, hint]) => <button className={`rating-${id}`} key={id} onClick={() => answer(id)} disabled={loading}><b>{label}</b><small>{hint}</small></button>)}</div></> : <button className="primary card-reveal" onClick={() => setRevealed(true)}>Mostrar resposta</button>}</article>}
  </section>
}
