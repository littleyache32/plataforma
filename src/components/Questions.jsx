import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'

const classifications = [['certeza', 'Certeza', 'Eu domino'], ['duvida', 'Dúvida', 'Entre opções'], ['eliminacao', 'Eliminação', 'Cheguei por lógica'], ['sem_conhecimento', 'Sem conhecimento', 'Não sabia']]
const reportReasons = [['gabarito_incorreto', 'Gabarito possivelmente incorreto'], ['questao_ambigua', 'Questão ambígua'], ['fonte_insuficiente', 'Fonte insuficiente'], ['conteudo_desatualizado', 'Conteúdo desatualizado'], ['erro_formatacao', 'Erro de formatação']]

function Source({ value }) {
  const match = String(value || '').match(/(https?:\/\/\S+)$/)
  return match ? <a className="source-link" href={match[1]} target="_blank" rel="noreferrer">{value.slice(0, match.index).replace(/:\s*$/, '')} ↗</a> : <span className="source-link">{value}</span>
}

function elapsedLabel(seconds) {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const rest = seconds % 60
  return hours ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}` : `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

export default function Questions({ objective, target, onTargetApplied, reviewQuestionId, onReviewLoaded }) {
  const subjects = (objective?.materias || []).filter((item) => !(objective?.tipo === 'faculdade' && ['análise e produção de texto', 'analise e producao de texto'].includes(item.nome.toLocaleLowerCase('pt-BR'))))
  const [subjectId, setSubjectId] = useState(subjects[0]?.id || '')
  const topics = useMemo(() => subjects.find((item) => item.id === subjectId)?.topicos || [], [subjects, subjectId])
  const [topicId, setTopicId] = useState('')
  const [question, setQuestion] = useState(null)
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
  const [sessionStartedAt, setSessionStartedAt] = useState(null)
  const [sessionNow, setSessionNow] = useState(Date.now())

  useEffect(() => { setSubjectId(subjects[0]?.id || ''); setQuestion(null); setSessionStartedAt(null) }, [objective?.id])
  useEffect(() => {
    if (!target?.subjectId || !subjects.some((item) => item.id === target.subjectId)) return
    setSubjectId(target.subjectId)
  }, [target?.subjectId, objective?.id])
  useEffect(() => {
    if (target?.subjectId !== subjectId) return
    setTopicId(target.topicId || ''); setQuestion(null); setAvailable(0); setPosition(0); setSessionStartedAt(null)
    onTargetApplied?.()
  }, [subjectId, target?.subjectId, target?.topicId])
  useEffect(() => { if (reviewQuestionId) loadQuestion(reviewQuestionId).then(onReviewLoaded) }, [reviewQuestionId])
  useEffect(() => {
    if (!sessionStartedAt) return undefined
    const timer = setInterval(() => setSessionNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [sessionStartedAt])

  async function loadQuestion(id = '', advance = false) {
    setLoading(true); setMessage('')
    if (!sessionStartedAt) {
      const started = Date.now()
      setSessionStartedAt(started)
      setSessionNow(started)
    }
    try {
      const path = id ? `/api/pratica?questaoId=${id}` : topicId ? `/api/pratica?topicoId=${topicId}` : `/api/pratica?materiaId=${subjectId}`
      const data = await api(path)
      setQuestion(data.questao); setAvailable(data.disponiveis || 1); setPosition((current) => id ? 1 : advance ? Math.min(current + 1, data.disponiveis || current + 1) : 1); setAnswer(''); setEliminated([]); setClassification(''); setResult(null); startedAt.current = Date.now()
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

  const options = question?.tipo === 'CE' ? [['C', 'Certo'], ['E', 'Errado']] : Object.entries(question?.alternativas || {})
  const sessionSeconds = sessionStartedAt ? Math.max(0, Math.floor((sessionNow - sessionStartedAt) / 1000)) : 0
  return (
    <section><header className="page-title compact"><div><p className="eyebrow">MOTOR DE PRÁTICA</p><h1>Questões</h1><p>Questões não são descartadas ao abrir. Tentativas e revisões ficam registradas.</p></div><div className="card-session-clock"><small>TEMPO DE PRÁTICA</small><b>{elapsedLabel(sessionSeconds)}</b><span>{sessionStartedAt ? 'sessão em andamento' : 'inicia com a primeira questão'}</span></div></header>
      <div className="question-layout"><aside className="panel practice-filter"><h2>Escolha o foco</h2><label>Disciplina</label><select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setTopicId(''); setQuestion(null); setAvailable(0); setPosition(0); setSessionStartedAt(null) }}>{subjects.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><label>Tópico</label><select value={topicId} onChange={(e) => { setTopicId(e.target.value); setQuestion(null); setAvailable(0); setPosition(0) }}><option value="">Todos os tópicos</option>{topics.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select><button className="primary" onClick={() => loadQuestion('', Boolean(question))} disabled={!subjectId || loading}>{question ? 'Próxima questão' : 'Começar prática'}</button>{available > 0 && <strong className="available-count">{available} questões disponíveis</strong>}<p>O gabarito aparece somente após resposta e classificação.</p></aside>
        <div>{!question ? <div className="panel question-empty"><span>?</span><h2>{message || 'Escolha uma disciplina e, se quiser, um tópico.'}</h2><p>Deixe “Todos os tópicos” selecionado para misturar toda a disciplina.</p></div> : <article className="panel question-card"><div className="question-meta"><span>Questão {position} de {available} · {question.topico?.nome || question.tipo}</span><button onClick={() => setReportOpen(true)}>Reportar problema na questão</button></div><h2>{question.enunciado}</h2><div className="answers">{options.map(([letter, text]) => <div className={`answer-option ${answer === letter ? 'selected' : ''} ${eliminated.includes(letter) ? 'eliminated' : ''}`} key={letter}><button className="answer-choice" onClick={() => !result && setAnswer(letter)} disabled={Boolean(result)}><b>{letter}</b><span>{text}</span></button>{question.tipo === 'ME' && <button className="answer-eliminate" aria-label={`${eliminated.includes(letter) ? 'Recuperar' : 'Eliminar'} alternativa ${letter}`} title={eliminated.includes(letter) ? 'Recuperar alternativa' : 'Eliminar alternativa'} onClick={() => !result && setEliminated((current) => current.includes(letter) ? current.filter((item) => item !== letter) : [...current, letter])} disabled={Boolean(result)}>×</button>}</div>)}</div>
          {!result && <div className="confidence"><h3>Como você chegou à resposta?</h3><div>{classifications.map(([id, label, hint]) => <button key={id} className={classification === id ? 'selected' : ''} onClick={() => setClassification(id)}><b>{label}</b><small>{hint}</small></button>)}</div><button className="primary confirm" disabled={!answer || !classification || loading} onClick={confirm}>Confirmar resposta</button></div>}
          {result && <div className={`feedback ${result.resultado}`}><div className="feedback-head"><span>{result.resultado === 'acerto' ? '✓' : '×'}</span><div><small>GABARITO {result.gabarito}</small><h3>{result.resultado === 'acerto' ? 'Resposta correta' : 'Resposta incorreta'}</h3></div></div>{result.revisao_imediata && <div className="alert warning">Falsa certeza: item colocado no topo da fila de revisão.</div>}<p>{result.explicacao}</p><blockquote><small>EVIDÊNCIA VINCULADA</small>{result.trecho_fonte}</blockquote><Source value={result.fonte} /><button className="primary next" onClick={() => loadQuestion('', true)}>Continuar</button></div>}
        </article>}</div></div>
      {reportOpen && <div className="modal-backdrop"><div className="modal panel"><span className="eyebrow">CONTROLE DE QUALIDADE</span><h2>Reportar problema</h2><p>O item será arquivado até análise.</p><label>Motivo</label><select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>{reportReasons.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select><div className="modal-actions"><button className="secondary" onClick={() => setReportOpen(false)}>Cancelar</button><button className="danger-button" onClick={report}>Reportar e retirar</button></div></div></div>}
    </section>
  )
}
