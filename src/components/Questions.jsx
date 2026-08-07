import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'

const classifications = [['certeza', 'Certeza', 'Eu domino'], ['duvida', 'Dúvida', 'Entre opções'], ['eliminacao', 'Eliminação', 'Cheguei por lógica'], ['sem_conhecimento', 'Sem conhecimento', 'Não sabia']]
const reportReasons = [['gabarito_incorreto', 'Gabarito possivelmente incorreto'], ['questao_ambigua', 'Questão ambígua'], ['fonte_insuficiente', 'Fonte insuficiente'], ['conteudo_desatualizado', 'Conteúdo desatualizado'], ['erro_formatacao', 'Erro de formatação']]

function Source({ value }) {
  const match = String(value || '').match(/(https?:\/\/\S+)$/)
  return match ? <a className="source-link" href={match[1]} target="_blank" rel="noreferrer">{value.slice(0, match.index).replace(/:\s*$/, '')} ↗</a> : <span className="source-link">{value}</span>
}

export default function Questions({ objective, mode, reviewQuestionId, onReviewLoaded }) {
  const subjects = objective?.materias || []
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '')
  const topics = useMemo(() => subjects.find((item) => item.id === subjectId)?.topicos || [], [subjects, subjectId])
  const [topicId, setTopicId] = useState(topics[0]?.id || '')
  const [question, setQuestion] = useState(null)
  const [answer, setAnswer] = useState('')
  const [eliminated, setEliminated] = useState([])
  const [classification, setClassification] = useState('')
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const [quantity, setQuantity] = useState(20)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('gabarito_incorreto')
  const startedAt = useRef(null)

  useEffect(() => { setSubjectId(subjects[0]?.id || ''); setQuestion(null) }, [objective?.id])
  useEffect(() => setTopicId(topics[0]?.id || ''), [subjectId, topics])
  useEffect(() => { if (reviewQuestionId) loadQuestion(reviewQuestionId).then(onReviewLoaded) }, [reviewQuestionId])

  async function loadQuestion(id = '') {
    setLoading(true); setMessage('')
    try {
      const path = id ? `/api/pratica?questaoId=${id}` : `/api/pratica?topicoId=${topicId}`
      const data = await api(path)
      setQuestion(data.questao); setAnswer(''); setEliminated([]); setClassification(''); setResult(null); startedAt.current = Date.now()
    } catch (err) { setQuestion(null); setMessage(err.message) } finally { setLoading(false) }
  }

  async function confirm() {
    setLoading(true)
    try {
      const data = await api('/api/pratica', { method: 'POST', body: JSON.stringify({ questaoId: question.id, resposta: answer, classificacao: classification, tempo: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)) }) })
      setResult(data)
    } catch (err) { setMessage(err.message) } finally { setLoading(false) }
  }

  async function report() {
    await api('/api/questoes', { method: 'POST', body: JSON.stringify({ id: question.id, motivo: reportReason }) })
    setReportOpen(false); setQuestion(null); setMessage('Problema registrado. A questão saiu do baralho para análise.')
  }

  async function seed() {
    setLoading(true); setMessage('Pesquisando e vinculando evidências individuais...')
    try {
      const data = await api('/api/admin/seed', { method: 'POST', body: JSON.stringify({ topicoId, quantidade: Number(quantity) }) })
      setMessage(data.cache ? data.mensagem : `${data.geradas} questões salvas com ${data.evidencias} evidências verificáveis.`)
    } catch (err) { setMessage(err.message) } finally { setLoading(false) }
  }

  const options = question?.tipo === 'CE' ? [['C', 'Certo'], ['E', 'Errado']] : Object.entries(question?.alternativas || {})
  return (
    <section><header className="page-title compact"><div><p className="eyebrow">MOTOR DE PRÁTICA</p><h1>Questões</h1><p>Questões não são descartadas ao abrir. Tentativas e revisões ficam registradas.</p></div>{mode === 'administrador' && <button className="secondary" onClick={() => setAdminOpen(!adminOpen)}>{adminOpen ? 'Fechar administração' : 'Administrar banco'}</button>}</header>
      {adminOpen && <article className="panel admin-strip"><div><span className="eyebrow">GERAÇÃO INTERNA</span><h2>Povoar tópico</h2></div><select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><select value={topicId} onChange={(e) => setTopicId(e.target.value)}>{topics.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><input type="number" min="2" max="20" value={quantity} onChange={(e) => setQuantity(e.target.value)} /><button className="primary" onClick={seed} disabled={loading || !topicId}>Gerar lote</button></article>}
      <div className="question-layout"><aside className="panel practice-filter"><h2>Escolha o foco</h2><label>Disciplina</label><select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><label>Tópico</label><select value={topicId} onChange={(e) => setTopicId(e.target.value)}>{topics.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><button className="primary" onClick={() => loadQuestion()} disabled={!topicId || loading}>{question ? 'Próxima questão' : 'Começar prática'}</button><p>O gabarito aparece somente após resposta e classificação.</p></aside>
        <div>{!question ? <div className="panel question-empty"><span>?</span><h2>{message || 'Escolha um tópico para praticar.'}</h2><p>Questões respondidas podem voltar conforme a fila de revisão.</p></div> : <article className="panel question-card"><div className="question-meta"><span>{question.tipo} · {question.estado}</span><button onClick={() => setReportOpen(true)}>Reportar problema na questão</button></div><h2>{question.enunciado}</h2><div className="answers">{options.map(([letter, text]) => <div className={`answer-option ${answer === letter ? 'selected' : ''} ${eliminated.includes(letter) ? 'eliminated' : ''}`} key={letter}><button className="answer-choice" onClick={() => !result && setAnswer(letter)} disabled={Boolean(result)}><b>{letter}</b><span>{text}</span></button>{question.tipo === 'ME' && <button className="answer-eliminate" aria-label={`${eliminated.includes(letter) ? 'Recuperar' : 'Eliminar'} alternativa ${letter}`} title={eliminated.includes(letter) ? 'Recuperar alternativa' : 'Eliminar alternativa'} onClick={() => !result && setEliminated((current) => current.includes(letter) ? current.filter((item) => item !== letter) : [...current, letter])} disabled={Boolean(result)}>×</button>}</div>)}</div>
          {!result && <div className="confidence"><h3>Como você chegou à resposta?</h3><div>{classifications.map(([id, label, hint]) => <button key={id} className={classification === id ? 'selected' : ''} onClick={() => setClassification(id)}><b>{label}</b><small>{hint}</small></button>)}</div><button className="primary confirm" disabled={!answer || !classification || loading} onClick={confirm}>Confirmar resposta</button></div>}
          {result && <div className={`feedback ${result.resultado}`}><div className="feedback-head"><span>{result.resultado === 'acerto' ? '✓' : '×'}</span><div><small>GABARITO {result.gabarito}</small><h3>{result.resultado === 'acerto' ? 'Resposta correta' : 'Resposta incorreta'}</h3></div></div>{result.revisao_imediata && <div className="alert warning">Falsa certeza: item colocado no topo da fila de revisão.</div>}<p>{result.explicacao}</p><blockquote><small>EVIDÊNCIA VINCULADA</small>{result.trecho_fonte}</blockquote><Source value={result.fonte} /><button className="primary next" onClick={() => loadQuestion()}>Continuar</button></div>}
        </article>}</div></div>
      {reportOpen && <div className="modal-backdrop"><div className="modal panel"><span className="eyebrow">CONTROLE DE QUALIDADE</span><h2>Reportar problema</h2><p>O item será arquivado até análise.</p><label>Motivo</label><select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>{reportReasons.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select><div className="modal-actions"><button className="secondary" onClick={() => setReportOpen(false)}>Cancelar</button><button className="danger-button" onClick={report}>Reportar e retirar</button></div></div></div>}
    </section>
  )
}
