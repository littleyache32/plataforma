import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import FocusTimer from './FocusTimer.jsx'
import Icon from './Icon.jsx'

const classifications = [['sem_conhecimento', 'Sem conhecimento', 'Não sabia'], ['eliminacao', 'Eliminação', 'Cheguei por lógica'], ['duvida', 'Dúvida', 'Entre opções'], ['certeza', 'Certeza', 'Convicção na resposta']]
const reportReasons = [['gabarito_incorreto', 'Gabarito possivelmente incorreto'], ['questao_ambigua', 'Questão ambígua'], ['fonte_insuficiente', 'Fonte insuficiente'], ['conteudo_desatualizado', 'Conteúdo desatualizado'], ['erro_formatacao', 'Erro de formatação']]
const Lock = () => <i className="catalog-lock" title="Bloqueado até este conteúdo ser estudado" aria-label="Conteúdo bloqueado"><Icon name="bloqueado" /></i>

function Source({ value }) {
  const match = String(value || '').match(/(https?:\/\/\S+)$/)
  return match ? <a className="source-link" href={match[1]} target="_blank" rel="noreferrer">{value.slice(0, match.index).replace(/:\s*$/, '')} ↗</a> : <span className="source-link">{value}</span>
}

export default function Questions({ objective, target, onTargetApplied, reviewQuestionId, onReviewLoaded, notebookOnly = false }) {
  const subjects = (objective?.materias || []).filter((item) => !(objective?.tipo === 'faculdade' && ['análise e produção de texto', 'analise e producao de texto'].includes(item.nome.toLocaleLowerCase('pt-BR'))))
  const [subjectId, setSubjectId] = useState('')
  const [expandedSubjectId, setExpandedSubjectId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [question, setQuestion] = useState(null)
  const [counts, setCounts] = useState({ topicos: {}, totais: { questoes: 0, cards: 0 } })
  const [available, setAvailable] = useState(0)
  const [position, setPosition] = useState(0)
  const [answer, setAnswer] = useState('')
  const [eliminated, setEliminated] = useState([])
  const [classification, setClassification] = useState('')
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [reportReason, setReportReason] = useState('gabarito_incorreto')
  const startedAt = useRef(null)
  const executionContext = useRef(null)
  const operationId = useRef(null)
  const requestBody = useRef(null)

  useEffect(() => { setSubjectId(''); setExpandedSubjectId(''); setTopicId(''); setReviewOnly(false); setQuestion(null); setAvailable(0); setPosition(0) }, [objective?.id])
  useEffect(() => { loadCounts() }, [objective?.id, notebookOnly])
  useEffect(() => {
    if (!target?.subjectId || !subjects.some((item) => item.id === target.subjectId)) return
    setSubjectId(target.subjectId)
    setExpandedSubjectId(target.subjectId)
  }, [target?.subjectId, objective?.id])
  useEffect(() => {
    if (target?.subjectId !== subjectId) return
    const nextTopicId = target.topicId || ''
    const nextReviewOnly = Boolean(target.reviewOnly)
    setTopicId(nextTopicId); setReviewOnly(nextReviewOnly); setQuestion(null); setAvailable(0); setPosition(0)
    loadQuestion('', false, { subjectId, topicId: nextTopicId, reviewOnly: nextReviewOnly, sessaoId: target.sessaoId })
    onTargetApplied?.()
  }, [subjectId, target?.subjectId, target?.topicId, target?.reviewOnly])
  useEffect(() => { if (reviewQuestionId) loadQuestion(reviewQuestionId).then(onReviewLoaded) }, [reviewQuestionId])

  async function loadQuestion(id = '', advance = false, focus = {}) {
    setLoading(true); setMessage('')
    try {
      const selectedSubjectId = focus.subjectId ?? subjectId
      const selectedTopicId = focus.topicId ?? topicId
      const selectedReviewOnly = focus.reviewOnly ?? reviewOnly
      const reviewParam = selectedReviewOnly ? '&revisao=1' : notebookOnly ? '&caderno=1' : ''
      const path = id ? `/api/pratica?questaoId=${id}` : selectedTopicId ? `/api/pratica?topicoId=${selectedTopicId}${reviewParam}` : `/api/pratica?materiaId=${selectedSubjectId}${reviewParam}`
      const context = typeof id === 'object' ? id : focus
      const link = context.revisaoId ? `&revisaoId=${encodeURIComponent(context.revisaoId)}`
        : context.sessaoId ? `&sessaoId=${encodeURIComponent(context.sessaoId)}` : ''
      const requestPath = typeof id === 'object' ? `/api/pratica?questaoId=${encodeURIComponent(id.questaoId)}${link}` : `${path}${link}`
      const data = await api(requestPath)
      executionContext.current = data.revisao_contexto || null
      operationId.current = crypto.randomUUID(); requestBody.current = null
      setQuestion(data.questao); setAvailable(data.disponiveis || 1); setPosition((current) => id ? 1 : advance ? Math.min(current + 1, data.disponiveis || current + 1) : 1); setAnswer(''); setEliminated([]); setClassification(''); setResult(null); startedAt.current = Date.now()
    } catch (err) { setQuestion(null); setMessage(err.message) } finally { setLoading(false) }
  }

  async function confirm() {
    setLoading(true)
    try {
      requestBody.current ||= JSON.stringify({ questaoId: question.id, resposta: answer, classificacao: classification,
        tempo: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)), operacaoId: operationId.current, ...executionContext.current })
      const data = await api('/api/pratica', { method: 'POST', body: requestBody.current })
      setResult(data)
      if (notebookOnly) loadCounts()
    } catch (err) { setMessage(err.message) } finally { setLoading(false) }
  }

  async function report() {
    await api('/api/questoes', { method: 'POST', body: JSON.stringify({ id: question.id, motivo: reportReason }) })
    setReportOpen(false); setQuestion(null); setMessage('Problema registrado. A questão saiu do baralho para análise.')
  }

  function chooseSubject(id) {
    const opening = expandedSubjectId !== id
    setExpandedSubjectId(opening ? id : '')
    if (!opening) return
    setSubjectId(id); setTopicId(''); setReviewOnly(false); setQuestion(null); setAvailable(0); setPosition(0)
    loadQuestion('', false, { subjectId: id, topicId: '', reviewOnly: false })
  }

  function chooseTopic(nextSubjectId, nextTopicId) {
    setSubjectId(nextSubjectId); setExpandedSubjectId(nextSubjectId); setTopicId(nextTopicId); setReviewOnly(false); setQuestion(null); setAvailable(0); setPosition(0)
    loadQuestion('', false, { subjectId: nextSubjectId, topicId: nextTopicId, reviewOnly: false })
  }


  function loadCounts() {
    if (!objective?.id) {
      setCounts({ topicos: {}, totais: { questoes: 0, cards: 0 } })
      return Promise.resolve()
    }
    const notebookParam = notebookOnly ? '&caderno=1' : ''
    return api(`/api/catalogo?recurso=contagens&objetivoId=${objective.id}${notebookParam}`).then(setCounts).catch((error) => setMessage(error.message))
  }

  function subjectQuestionCount(subject) {
    return (subject.topicos || []).reduce((total, topic) => total + (counts.topicos?.[topic.id]?.questoes || 0), 0)
  }

  const options = question?.tipo === 'CE' ? [['C', 'Certo'], ['E', 'Errado']] : Object.entries(question?.alternativas || {})
  return (
    <section><header className="page-title compact"><div><p className="eyebrow">{notebookOnly ? 'REVISÃO PESSOAL' : 'MOTOR DE PRÁTICA'}</p><h1>{notebookOnly ? 'Caderno de Questões' : 'Questões'}</h1><p>{notebookOnly ? 'Erros, Dúvida e Sem conhecimento entram aqui automaticamente para futuras revisões.' : 'Selecione seu foco e inicie a sessão.'}</p></div>{question && <details className="practice-timer"><summary>Timer opcional</summary><FocusTimer objetivoId={objective?.id} materiaId={subjectId} topicoId={topicId || null} contexto="questao" titulo={`Questões · ${subjects.find((item) => item.id === subjectId)?.nome || 'disciplina'}`}/></details>}</header>
      <div className="question-layout"><aside className="panel practice-filter"><label>Disciplina<select value={subjectId} onChange={(event) => { setSubjectId(event.target.value); setTopicId(''); setQuestion(null); setReviewOnly(false) }}><option value="">Selecione</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.nome} · {subjectQuestionCount(subject)}</option>)}</select></label><label>Assunto<select value={topicId} onChange={(event) => { setTopicId(event.target.value); setQuestion(null) }}><option value="">Todos</option>{(subjects.find((subject) => subject.id === subjectId)?.topicos || []).map((topic) => <option key={topic.id} value={topic.id} disabled={counts.topicos?.[topic.id]?.bloqueado}>{topic.nome}{counts.topicos?.[topic.id]?.bloqueado ? ' · bloqueado' : ''}</option>)}</select></label><button className="primary" disabled={!subjectId || loading} onClick={() => loadQuestion('', false)}>Iniciar sessão</button>{reviewOnly && <small>Revisão programada</small>}{available > 0 && <small>{available} questões disponíveis</small>}</aside>
        <div>{!question ? <div className="panel question-empty"><span>?</span><h2>{message || 'Escolha uma disciplina e, se quiser, um tópico.'}</h2><p>Deixe “Todos os tópicos” selecionado para misturar toda a disciplina.</p></div> : <article className="panel question-card"><div className="question-meta"><span>Questão {position} de {available} · {question.topico?.nome || question.tipo}</span><button onClick={() => setReportOpen(true)}>Reportar problema na questão</button></div><h2>{question.enunciado}</h2><div className="answers">{options.map(([letter, text]) => <div className={`answer-option ${answer === letter ? 'selected' : ''} ${eliminated.includes(letter) ? 'eliminated' : ''}`} key={letter}><button className="answer-choice" onClick={() => !result && !requestBody.current && setAnswer(letter)} disabled={Boolean(result || requestBody.current)}><b>{letter}</b><span>{text}</span></button>{question.tipo === 'ME' && <button className="answer-eliminate" aria-label={`${eliminated.includes(letter) ? 'Recuperar' : 'Eliminar'} alternativa ${letter}`} title={eliminated.includes(letter) ? 'Recuperar alternativa' : 'Eliminar alternativa'} onClick={() => !result && !requestBody.current && setEliminated((current) => current.includes(letter) ? current.filter((item) => item !== letter) : [...current, letter])} disabled={Boolean(result || requestBody.current)}>×</button>}</div>)}</div>
          {!result && <div className="confidence"><h3>Como você chegou à resposta?</h3><div>{classifications.map(([id, label, hint], index) => <button key={id} className={classification === id ? 'selected' : ''} disabled={loading || Boolean(requestBody.current)} onClick={() => setClassification(id)}><b>{index + 1} {label}</b><small>{hint}</small></button>)}</div><button className="primary confirm" disabled={!answer || !classification || loading} onClick={confirm}>Confirmar resposta</button></div>}
          {result && <div className={`feedback ${result.resultado}`}><div className="feedback-head"><span>{result.resultado === 'acerto' ? '✓' : '×'}</span><div><small>GABARITO {result.gabarito}</small><h3>{result.resultado === 'acerto' ? 'Resposta correta' : 'Resposta incorreta'}</h3></div></div>{result.revisao_imediata && <div className="alert warning">Falsa certeza: item colocado no topo da fila de revisão.</div>}{result.explicacao ? <><p>{result.explicacao}</p>{result.comentarios_alternativas && <div className="alternative-comments"><h4>Comentário das alternativas</h4>{Object.entries(result.comentarios_alternativas).map(([letter, comment]) => <div key={letter} className={letter === result.gabarito ? 'correct' : ''}><b>{letter}</b><p>{comment}</p></div>)}</div>}<blockquote><small>EVIDÊNCIA VINCULADA</small>{result.trecho_fonte}</blockquote><Source value={result.fonte} /></> : <p className="feedback-compact">Acerto confirmado. A explicação foi ocultada conforme sua classificação.</p>}<small className="next-review-label">Tentativa registrada. O Mentor reavalia a necessidade de reteste.</small><button className="primary next" onClick={() => loadQuestion('', true)}>Continuar</button></div>}
        </article>}</div></div>
      {reportOpen && <div className="modal-backdrop"><div className="modal panel"><span className="eyebrow">CONTROLE DE QUALIDADE</span><h2>Reportar problema</h2><p>O item será arquivado até análise.</p><label>Motivo</label><select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>{reportReasons.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select><div className="modal-actions"><button className="secondary" onClick={() => setReportOpen(false)}>Cancelar</button><button className="danger-button" onClick={report}>Reportar e retirar</button></div></div></div>}
    </section>
  )
}
