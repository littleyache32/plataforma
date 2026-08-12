import { useEffect, useState } from 'react'
import { api } from '../api.js'

const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Sem registro'

export default function AdminPanel() {
  const [data, setData] = useState(null)
  const [tab, setTab] = useState('saude')
  const [message, setMessage] = useState('')
  const load = () => api('/api/admin/painel').then(setData).catch((error) => setMessage(error.message))
  useEffect(() => { load() }, [])

  async function act(tipo, id, acao) {
    let conteudo
    if (acao === 'reativar') {
      const report = [...(data?.relatos_questoes || []).map((item) => ({ ...item, conteudo: item.questao })), ...(data?.relatos_cards || []).map((item) => ({ ...item, conteudo: item.card }))].find((item) => item.id === id)
      const original = report?.conteudo?.enunciado || report?.conteudo?.frente || ''
      conteudo = window.prompt('Corrija o conteúdo antes de reativar:', original)
      if (!conteudo || conteudo.trim() === original.trim()) return
    }
    try { await api('/api/admin/painel', { method: 'PATCH', body: JSON.stringify({ tipo, id, acao, conteudo }) }); await load() } catch (error) { setMessage(error.message) }
  }

  async function downloadBackup() {
    try {
      const backup = await api('/api/admin/painel?recurso=exportar')
      const link = document.createElement('a')
      link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
      link.download = `backup-plataforma-${new Date().toISOString().slice(0, 10)}.json`
      link.click(); URL.revokeObjectURL(link.href)
    } catch (error) { setMessage(error.message) }
  }

  if (!data) return <div className="module-loading">{message || 'Carregando controle operacional...'}</div>
  const reports = [...data.relatos_questoes.map((item) => ({ ...item, tipo: 'questao', conteudo: item.questao })), ...data.relatos_cards.map((item) => ({ ...item, tipo: 'card', conteudo: item.card }))]
  const blocked = data.cobertura.filter((item) => item.expansao_bloqueada)
  return <section><header className="page-title compact"><div><p className="eyebrow">ADMINISTRADOR</p><h1>Controle operacional</h1><p>Saúde do mentor, auditoria, cobertura, proteções e backup.</p></div><button className="secondary" onClick={downloadBackup}>Exportar backup</button></header><div className="performance-tabs admin-tabs">{[['saude','Saúde'],['auditoria','Auditoria'],['cobertura','Cobertura'],['falhas','Falhas']].map(([id,label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
    {tab === 'saude' && <><div className="metric-grid"><article className="metric-card"><span>Última execução</span><b>{data.saude.ultima_execucao?.status || 'nenhuma'}</b><small>{formatDate(data.saude.ultima_execucao?.concluido_em)}</small></article><article className="metric-card"><span>Próxima execução</span><b>{new Date(data.saude.proxima_execucao).toLocaleDateString('pt-BR')}</b><small>{new Date(data.saude.proxima_execucao).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</small></article><article className="metric-card"><span>Semana gerada</span><b>{data.saude.semana_gerada || 'não'}</b><small>política {data.saude.politica || 'não registrada'}</small></article><article className={`metric-card ${data.saude.falhas_abertas ? 'danger' : 'good'}`}><span>Falhas abertas</span><b>{data.saude.falhas_abertas}</b><small>funções e cron</small></article></div><article className="panel performance-panel"><h2>Proteções ativas</h2><div className="admin-protections"><span>Limite diário <b>{data.protecoes.limite_diario_minutos} min</b></span><span>Transferências por fechamento <b>{data.protecoes.limite_pendencias_transferidas}</b></span><span>Tópicos bloqueados <b>{data.protecoes.topicos_bloqueados}</b></span><span>Demandas sem duplicidade <b>ativa</b></span></div></article></>}
    {tab === 'auditoria' && <article className="panel list-panel"><div className="panel-heading"><h2>Itens denunciados</h2><span>{reports.length}</span></div>{reports.length ? reports.map((item) => <div className="audit-row" key={`${item.tipo}-${item.id}`}><div><small>{item.tipo === 'questao' ? 'QUESTÃO' : 'QUESTION CARD'} · {item.conteudo?.topico?.materia?.nome} · {item.conteudo?.topico?.nome}</small><b>{item.conteudo?.enunciado || item.conteudo?.frente}</b><p>{item.motivo} · Fonte: {item.conteudo?.fonte}</p></div><div><button className="secondary" onClick={() => act(item.tipo, item.id, 'reativar')}>Reativar corrigido</button><button className="danger-button" onClick={() => act(item.tipo, item.id, 'descartar')}>Manter arquivado</button></div></div>) : <div className="empty-inline">Nenhum item aguardando auditoria.</div>}</article>}
    {tab === 'cobertura' && <article className="panel list-panel"><div className="panel-heading"><h2>Cobertura do acervo</h2><span>{data.cobertura.length - blocked.length}/{data.cobertura.length} com fonte</span></div><div className="coverage-table">{data.cobertura.map((item) => <div className={item.expansao_bloqueada ? 'blocked' : ''} key={item.topico_id}><div><b>{item.topico?.nome}</b><small>{item.topico?.materia?.nome} · {item.topico?.materia?.objetivo?.nome}</small></div><span>{item.questoes} questões</span><span>{item.cards} cards</span><strong>{item.expansao_bloqueada ? 'Sem fonte' : 'Com fonte'}</strong></div>)}</div></article>}
    {tab === 'falhas' && <article className="panel list-panel"><div className="panel-heading"><h2>Monitoramento de falhas</h2><span>{data.falhas.length}</span></div>{data.falhas.length ? data.falhas.map((item) => <div className="audit-row" key={item.id}><div><small>{item.origem} · {formatDate(item.criado_em)}</small><b>{item.mensagem}</b>{item.detalhe && <p>{item.detalhe.slice(0, 300)}</p>}</div><button className="secondary" onClick={() => act('falha', item.id, 'resolver')}>Marcar resolvida</button></div>) : <div className="empty-inline">Nenhuma falha aberta.</div>}</article>}
    {message && <p className="alert error">{message}</p>}
  </section>
}
