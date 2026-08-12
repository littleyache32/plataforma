import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const labels = { mantido: 'Mantido', novo: 'Novo', removido: 'Removido', sem_material: 'Sem material' }
export default function EdictComparator({ objective }) {
  const [data, setData] = useState({ editais: [] })
  const [name, setName] = useState('Novo edital BACEN')
  const [text, setText] = useState('')
  const [message, setMessage] = useState('')
  const topics = useMemo(() => (objective?.materias || []).flatMap((subject) => (subject.topicos || []).map((topic) => ({ ...topic, subject: subject.nome }))), [objective])
  const load = () => objective?.id && api(`/api/admin/edital?objetivoId=${objective.id}`).then(setData).catch((error) => setMessage(error.message))
  useEffect(() => { load() }, [objective?.id])
  async function create() {
    const prefix = { '=': 'mantido', '+': 'novo', '-': 'removido', '?': 'sem_material' }
    const items = text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => { const classification = prefix[line[0]] || 'novo'; const itemName = prefix[line[0]] ? line.slice(1).trim() : line; const match = topics.find((topic) => topic.nome.toLocaleLowerCase('pt-BR') === itemName.toLocaleLowerCase('pt-BR')); return { nome: itemName, classificacao: classification, topicoId: match?.id || null, impacto: match ? `${match.subject}: tópico localizado no acervo.` : 'Requer conferência de material e impacto na trajetória.' } })
    if (!items.length) return setMessage('Informe pelo menos um item do edital.')
    try { await api('/api/admin/edital', { method: 'POST', body: JSON.stringify({ objetivoId: objective.id, nome: name, itens }) }); setText(''); await load() } catch (error) { setMessage(error.message) }
  }
  async function classify(item, classification, archive = false) {
    if (archive && !window.confirm('Arquivar as questões e os cards vinculados a este tópico?')) return
    try { const result = await api('/api/admin/edital', { method: 'PATCH', body: JSON.stringify({ id: item.id, classificacao: classification, impacto: item.impacto, arquivar: archive }) }); setMessage(archive ? `${result.arquivados.questoes} questões e ${result.arquivados.cards} cards arquivados.` : 'Classificação atualizada.'); await load() } catch (error) { setMessage(error.message) }
  }
  return <section><header className="page-title compact"><div><p className="eyebrow">ADMINISTRADOR</p><h1>Comparador de edital BACEN</h1><p>Cadastre a nova estrutura para medir alterações e preservar somente o acervo pertinente.</p></div></header><article className="panel edict-import"><h2>Importar estrutura</h2><p>Uma linha por item. Prefixos: = mantido, + novo, - removido, ? sem material.</p><input value={name} onChange={(event) => setName(event.target.value)} /><textarea rows="9" value={text} onChange={(event) => setText(event.target.value)} placeholder="= Sistema Financeiro Nacional&#10;+ Novo conteúdo&#10;- Conteúdo removido"/><button className="primary" onClick={create}>Comparar edital</button></article>{message && <p className="alert warning">{message}</p>}{data.editais.map((edict) => { const counts = edict.itens.reduce((sum, item) => ({ ...sum, [item.classificacao]: (sum[item.classificacao] || 0) + 1 }), {}); return <article className="panel edict-version" key={edict.id}><div className="panel-heading"><div><h2>{edict.nome}</h2><small>Impacto estimado: {(counts.novo || 0) + (counts.sem_material || 0)} itens exigem ação</small></div><span>{edict.itens.length}</span></div><div className="edict-summary">{Object.entries(labels).map(([id,label]) => <span key={id}>{label}: <b>{counts[id] || 0}</b></span>)}</div>{edict.itens.map((item) => <div className="edict-item" key={item.id}><div><b>{item.nome}</b><small>{item.impacto}</small></div><select value={item.classificacao} onChange={(event) => classify(item, event.target.value)}>{Object.entries(labels).map(([id,label]) => <option value={id} key={id}>{label}</option>)}</select>{item.classificacao === 'removido' && item.topico_id && <button className="danger-button" onClick={() => classify(item, 'removido', true)}>Arquivar acervo</button>}</div>)}</article> })}</section>
}
