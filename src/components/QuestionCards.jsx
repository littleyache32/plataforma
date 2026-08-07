import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

export default function QuestionCards({ objective }) {
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [revealed, setRevealed] = useState(false)

  function load() {
    setLoading(true)
    const suffix = objective?.id ? `?objetivoId=${objective.id}` : ''
    return api(`/api/question-cards${suffix}`).then((data) => { setCards(data.cards); setMessage('') }).catch((error) => setMessage(error.message)).finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [objective?.id])

  const dueCards = useMemo(() => cards.filter((item) => item.vencido), [cards])
  const card = dueCards[0] || cards[0]

  async function answer(resultado) {
    if (!card) return
    await api('/api/question-cards', { method: 'POST', body: JSON.stringify({ id: card.id, resultado }) })
    setCards((items) => items.filter((item) => item.id !== card.id))
    setRevealed(false)
  }

  return <section><header className="page-title compact"><div><p className="eyebrow">REVISAO ATIVA</p><h1>Question Cards</h1><p>Cards nascem das questoes e simulados que voce resolve. Um mesmo conceito e reforcado, nao duplicado.</p></div><span className="date-range">{dueCards.length} para revisar</span></header>
    {loading ? <div className="panel question-empty"><h2>Organizando seus cards...</h2></div> : !card ? <div className="panel question-empty"><span>◫</span><h2>{message || 'Nenhum Question Card ainda.'}</h2><p>Ao responder questoes ou simulados, conceitos importantes aparecerao aqui para revisao.</p></div> : <article className="panel card-study"><div className="card-study-meta"><span>{card.objetivo?.tipo === 'faculdade' ? 'Faculdade' : 'BACEN'} · {card.materia?.nome}</span><small>{card.topico?.nome}</small></div><div className="card-face"><span>{revealed ? 'RESPOSTA E EXPLICACAO' : 'PERGUNTA'}</span><h2>{revealed ? card.verso : card.frente}</h2></div>{revealed ? <><blockquote><small>TRECHO DE ORIGEM</small>{card.trecho_fonte}</blockquote><span className="source-link">{card.fonte}</span><div className="card-actions"><button className="secondary" onClick={() => answer('revisar')}>Preciso revisar</button><button className="primary" onClick={() => answer('lembrei')}>Lembrei</button></div></> : <button className="primary card-reveal" onClick={() => setRevealed(true)}>Ver resposta</button>}</article>}
  </section>
}
