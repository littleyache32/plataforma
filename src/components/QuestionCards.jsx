import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'
import FocusTimer from './FocusTimer.jsx'
import Icon from './Icon.jsx'

const ratings = [
  ['novamente', 'De novo', '10 min'],
  ['dificil', 'Difícil', 'intervalo curto'],
  ['bom', 'Bom', 'intervalo normal'],
  ['facil', 'Fácil', 'intervalo longo'],
]
const reportReasons = [['card_ambiguo', 'Card ambíguo'], ['card_incompleto', 'Card incompleto'], ['card_incorreto', 'Card incorreto']]
const Lock = () => <i className="catalog-lock" title="Bloqueado até este conteúdo ser estudado" aria-label="Conteúdo bloqueado"><Icon name="bloqueado" /></i>

export default function QuestionCards({ objective, target, onTargetApplied }) {
  const subjects = (objective?.materias || []).filter((item) => !(objective?.tipo === 'faculdade' && ['análise e produção de texto', 'analise e producao de texto'].includes(item.nome.toLocaleLowerCase('pt-BR'))))
  const [subjectId, setSubjectId] = useState('')
  const [expandedSubjectId, setExpandedSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [cards, setCards] = useState([])
  const [counts, setCounts] = useState({ topicos: {}, totais: { questoes: 0, cards: 0 } })
  const [stats, setStats] = useState({ total: 0, vencidos: 0, novos: 0 })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [reviewed, setReviewed] = useState(0)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('card_ambiguo')

  function load() {
    if (!subjectId) {
      setCards([])
      setStats({ total: 0, vencidos: 0, novos: 0 })
      setMessage('')
      return Promise.resolve()
    }
    setLoading(true)
    const params = new URLSearchParams({ recurso: 'cards', objetivoId: objective.id, materiaId: subjectId })
    if (topicId) params.set('topicoId', topicId)
    return api(`/api/questoes?${params}`).then((data) => {
      setCards(data.cards)
      setStats({ total: data.total, vencidos: data.vencidos, novos: data.novos })
      setMessage('')
    }).catch((error) => {
      setCards([])
      setMessage(error.message)
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    setSubjectId(''); setExpandedSubjectId(''); setTopicId(''); setReviewed(0); setRevealed(false)
  }, [objective?.id])
  useEffect(() => {
    if (!objective?.id) return setCounts({ topicos: {}, totais: { questoes: 0, cards: 0 } })
    api(`/api/catalogo?recurso=contagens&objetivoId=${objective.id}`).then(setCounts).catch((error) => setMessage(error.message))
  }, [objective?.id])
  useEffect(() => {
    if (!target?.subjectId || !subjects.some((item) => item.id === target.subjectId)) return
    setSubjectId(target.subjectId)
    setExpandedSubjectId(target.subjectId)
  }, [target?.subjectId, objective?.id])
  useEffect(() => {
    if (target?.subjectId !== subjectId) return
    setTopicId(target.topicId || '')
    setReviewed(0); setRevealed(false)
    onTargetApplied?.()
  }, [subjectId, target?.subjectId, target?.topicId])
  useEffect(() => { load() }, [objective?.id, subjectId, topicId])

  const queue = useMemo(() => cards.filter((item) => item.vencido), [cards])
  const card = queue[0] || null
  const sessionTotal = reviewed + queue.length

  function resetFocus(change) {
    change()
    setReviewed(0)
    setRevealed(false)
  }

  function chooseSubject(id) {
    const opening = expandedSubjectId !== id
    setExpandedSubjectId(opening ? id : '')
    if (!opening) return
    resetFocus(() => { setSubjectId(id); setTopicId('') })
  }

  function chooseTopic(nextSubjectId, nextTopicId) {
    setExpandedSubjectId(nextSubjectId)
    resetFocus(() => { setSubjectId(nextSubjectId); setTopicId(nextTopicId) })
  }

  function subjectCardCount(subject) {
    return (subject.topicos || []).reduce((total, topic) => total + (counts.topicos?.[topic.id]?.cards || 0), 0)
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

  async function report() {
    if (!card) return
    try {
      await api('/api/questoes?recurso=cards', { method: 'POST', body: JSON.stringify({ id: card.id, motivo: reportReason }) })
      setCards((items) => items.filter((item) => item.id !== card.id))
      setReportOpen(false); setRevealed(false); setMessage('Problema registrado. O card saiu da fila para auditoria.')
    } catch (error) { setMessage(error.message) }
  }

  return <section><header className="page-title compact"><div><p className="eyebrow">REVISÃO ESPAÇADA</p><h1>Question Cards</h1><p>Selecione a disciplina ou o tópico para abrir o primeiro card. O timer é opcional.</p></div>{subjectId && <FocusTimer objetivoId={objective?.id} materiaId={subjectId} topicoId={topicId || null} contexto="card" titulo={`Question Cards · ${subjects.find((item) => item.id === subjectId)?.nome || 'disciplina'}`}/>}</header>
    <div className="question-layout"><aside className="panel practice-filter"><div className="catalog-heading"><div><span className="eyebrow">CONTEÚDO</span><h2>Disciplinas e tópicos</h2></div><span className="catalog-total">{counts.totais?.cards || 0}</span></div><div className="subject-catalog">{subjects.map((subject) => { const expanded = expandedSubjectId === subject.id; const selected = subjectId === subject.id; const subjectCount = subjectCardCount(subject); const allLocked = subject.topicos?.length && subject.topicos.every((topic) => counts.topicos?.[topic.id]?.cards_bloqueados); return <div className={`catalog-subject ${expanded ? 'expanded' : ''} ${selected ? 'selected' : ''}`} key={subject.id}><button className="catalog-subject-button" onClick={() => chooseSubject(subject.id)} aria-expanded={expanded}><span className="catalog-chevron">›</span><span><b>{subject.nome}</b><small>{subjectCount} cards</small></span>{allLocked && <Lock />}</button>{expanded && <div className="catalog-topics"><button className={!topicId && selected ? 'active' : ''} onClick={() => chooseTopic(subject.id, '')}><span>Todos os tópicos</span><small>{subjectCount}</small>{allLocked && <Lock />}</button>{(subject.topicos || []).map((topic) => <button className={topicId === topic.id ? 'active' : ''} onClick={() => chooseTopic(subject.id, topic.id)} key={topic.id}><span>{topic.nome}</span><small>{counts.topicos?.[topic.id]?.cards || 0}</small>{counts.topicos?.[topic.id]?.cards_bloqueados && <Lock />}</button>)}</div>}</div> })}</div>{subjectId && <div className="card-queue-stats compact"><span><b>{stats.vencidos}</b> para hoje</span><span><b>{stats.novos}</b> novos</span><span><b>{stats.total}</b> no acervo</span></div>}</aside>
      <div>{loading && !card ? <div className="panel question-empty"><h2>Organizando sua fila...</h2></div> : !subjectId ? <div className="panel question-empty"><span>?</span><h2>Escolha uma disciplina e, se quiser, um tópico.</h2><p>Todos os tópicos mistura os cards da disciplina.</p></div> : !card ? <div className="panel question-empty"><h2>{message || 'Nenhum Question Card está vencido neste foco.'}</h2><p>O mentor mantém a revisão espaçada e mostrará o conteúdo quando ele vencer.</p></div> : <article className="panel question-card card-study"><div className="question-meta"><span>Question Card {reviewed + 1} de {sessionTotal} · {card.topico?.nome}</span><button onClick={() => setReportOpen(true)}>Reportar problema no card</button></div><small>{card.objetivo?.tipo === 'faculdade' ? 'Faculdade' : 'BACEN'} · {card.materia?.nome}</small><h2>{card.frente}</h2>{revealed ? <div className="feedback acerto card-answer"><div className="feedback-head"><span>✓</span><div><small>RESPOSTA</small><h3>Resposta do card</h3></div></div><p className="card-answer-text"><strong>{card.resposta_direta || card.verso}</strong></p>{card.explicacao_curta && <p className="card-explanation">{card.explicacao_curta}</p>}{card.apoio_memoria && <p className="card-memory-aid">{card.apoio_memoria}</p>}<blockquote><small>TRECHO DE ORIGEM</small>{card.trecho_fonte}</blockquote><span className="source-link">{card.fonte}</span><div className="anki-actions">{ratings.map(([id, label, hint]) => <button className={`rating-${id}`} key={id} onClick={() => answer(id)} disabled={loading}><b>{label}</b><small>{hint}</small></button>)}</div></div> : <button className="primary card-reveal" onClick={() => setRevealed(true)}>Mostrar resposta</button>}</article>}</div></div>
      {reportOpen && <div className="modal-backdrop"><div className="modal panel"><span className="eyebrow">CONTROLE DE QUALIDADE</span><h2>Reportar Question Card</h2><p>O card será retirado da fila até a auditoria.</p><label>Motivo</label><select value={reportReason} onChange={(event) => setReportReason(event.target.value)}>{reportReasons.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select><div className="modal-actions"><button className="secondary" onClick={() => setReportOpen(false)}>Cancelar</button><button className="danger-button" onClick={report}>Reportar e retirar</button></div></div></div>}
  </section>
}
