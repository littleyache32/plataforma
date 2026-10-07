import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function ReviewCenter({ objective, onOpenQuestion, onOpenCards }) {
  const [data, setData] = useState({ itens: [] })
  const [message, setMessage] = useState('')
  useEffect(() => { if (objective?.id) api(`/api/revisoes?objetivoId=${objective.id}`).then(setData).catch((error) => setMessage(error.message)) }, [objective?.id])
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const dateOf = (item) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.agendada_para))
  const groups = [
    ['Hoje', (item) => dateOf(item) === today],
    ['Atenção', (item) => dateOf(item) < today],
    ['Depois', (item) => dateOf(item) > today],
  ]
  return <section><header className="page-title compact"><div><h1>Revisões</h1><p>Fila complementar ao Meu Plano.</p></div><span className="catalog-total">{data.itens?.length || 0}</span></header>{message && <p className="alert error">{message}</p>}{!data.itens?.length ? <p className="empty-inline">Nenhuma revisão na fila.</p> : groups.map(([label, predicate]) => {
    const items = data.itens.filter(predicate)
    return items.length > 0 && <article className="panel review-center" key={label}><h2>{label}</h2>{items.map((item) => <button key={`${item.tipo}-${item.id}`} onClick={() => item.tipo === 'questao' ? onOpenQuestion(item) : onOpenCards(item)}><div><small>{item.materia} · {item.topico}</small><b>{item.titulo}</b><p>{item.tipo === 'questao' ? 'Questão' : 'Question Card'} · {item.motivo}</p></div><time>{new Date(item.agendada_para).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</time><span>Revisar →</span></button>)}</article>
  })}</section>
}
