import { useEffect, useState } from 'react'
import { api } from '../api.js'

export default function ReviewCenter({ objective, onOpenQuestion, onOpenCards }) {
  const [data, setData] = useState({ itens: [] })
  const [message, setMessage] = useState('')
  useEffect(() => { if (objective?.id) api(`/api/revisoes?objetivoId=${objective.id}`).then(setData).catch((error) => setMessage(error.message)) }, [objective?.id])
  return <section><header className="page-title compact"><div><p className="eyebrow">FILA INTELIGENTE</p><h1>Central de revisão</h1><p>Erros, dúvidas, falta de conhecimento, cards vencidos e revisões do mentor em ordem de urgência.</p></div><span className="catalog-total">{data.itens?.length || 0}</span></header>{message && <p className="alert error">{message}</p>}<article className="panel review-center">{data.itens?.length ? data.itens.map((item) => <button key={`${item.tipo}-${item.id}`} onClick={() => item.tipo === 'questao' ? onOpenQuestion(item) : onOpenCards(item)}><span className={`review-priority p${item.prioridade || 2}`}>{item.prioridade === 1 ? 'Urgente' : 'Revisar'}</span><div><b>{item.titulo}</b><small>{item.materia} · {item.topico}</small><p>{item.motivo}</p></div><time>{new Date(item.agendada_para).toLocaleDateString('pt-BR')}</time></button>) : <div className="empty-inline">Sua fila de revisão está em dia.</div>}</article></section>
}
