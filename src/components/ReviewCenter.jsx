import { useEffect, useState } from 'react'
import { api } from '../api.js'
import { REVIEW_CATEGORIES } from '../../shared/review-v2-queue.js'

const EMPTY = { Hoje: 'Nenhuma revisão para hoje.', Atenção: 'Nenhuma revisão pendente de atenção.', Depois: 'Nenhuma revisão futura.' }
const dateLabel = (value) => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })

export function ReviewCenterList({ data, onOpenQuestion, onOpenCards }) {
  return REVIEW_CATEGORIES.map((label) => {
    const items = data.categorias?.find((group) => group.nome === label)?.itens || []
    return <article className={items.length ? 'panel review-center' : 'review-center'} key={label}>
      <h2>{label.toLocaleUpperCase('pt-BR')}</h2>
      {!items.length ? <p className="empty-inline">{EMPTY[label]}</p> : items.map((item) => <button type="button"
        key={`${item.tipo}-${item.id}`} disabled={!item.pode_revisar}
        aria-label={`Revisar ${item.tipo === 'questao' ? 'questão' : 'Question Card'} de ${item.topico || item.materia || 'conteúdo'}`}
        title={!item.pode_revisar ? 'Prática não liberada.' : undefined}
        onClick={() => item.tipo === 'questao' ? onOpenQuestion(item) : onOpenCards(item)}>
        <div><small>{item.materia || 'Matéria não informada'} · {item.topico || 'Tópico não informado'}</small>
          <b>{item.tipo === 'questao' ? 'Questão' : 'Question Card'}</b><p>{item.motivo || 'Revisão agendada.'}</p>
          {item.ultima_interacao && <time dateTime={item.ultima_interacao}>Última interação: {dateLabel(item.ultima_interacao)}</time>}
        </div><span>Revisar →</span>
      </button>)}
    </article>
  })
}

export default function ReviewCenter({ objective, onOpenQuestion, onOpenCards }) {
  const [data, setData] = useState({ itens: [], categorias: [] })
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(Boolean(objective?.id))
  useEffect(() => {
    let active = true
    setData({ itens: [], categorias: [] }); setMessage('')
    if (!objective?.id) { setLoading(false); return }
    setLoading(true)
    api(`/api/revisoes?objetivoId=${encodeURIComponent(objective.id)}`)
      .then((response) => { if (active) setData(response) })
      .catch((error) => { if (active) setMessage(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [objective?.id])
  return <section><header className="page-title compact"><div><h1>Revisões</h1><p>Fila complementar ao Meu Plano.</p></div></header>
    {message ? <p className="alert error" role="alert">{message}</p>
      : loading ? <p className="empty-inline" role="status">Carregando revisões…</p>
        : <ReviewCenterList data={data} onOpenQuestion={onOpenQuestion} onOpenCards={onOpenCards} />}
  </section>
}
