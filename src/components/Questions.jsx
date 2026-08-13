import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import FocusTimer from './FocusTimer.jsx'
import Icon from './Icon.jsx'

const classifications = [['certeza', 'Certeza', 'Eu domino'], ['duvida', 'Dúvida', 'Entre opções'], ['eliminacao', 'Eliminação', 'Cheguei por lógica'], ['sem_conhecimento', 'Sem conhecimento', 'Não sabia']]
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
    loadQuestion('', false, { subjectId, topicId: nextTopicId, reviewOnly: nextReviewOnly })
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
      const data = await api(path)
      setQuestion(data.questao); setAvailable(data.disponiveis || 1); setPosition((current) => id ? 1 : advance ? Math.min(current + 1, data.disponiveis || current + 1) : 1); setAnswer(''); setEliminated([]); setClassification(''); setResult(null); startedAt.current = Date.now()
    } catch (err) { setQuestion(null); setMessage(err.message) } finally { setLoading(false) }
  }

  async function confirm() {
    setLoading(true)
    try {
      const data = await api('/api/pratica', { method: 'POST', body: JSON.stringify({ questaoId: question.id, resposta: answer, classificacao: classification, tempo: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)) }) })
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
    <section><header className="page-title compact"><div><p className="eyebrow">{notebookOnly ? 'REVISÃO PESSOAL' : 'MOTOR DE PRÁTICA'}</p><h1>{notebookOnly ? 'Caderno de Questões' : 'Questões'}</h1><p>{notebookOnly ? 'Erros, Dúvida e Sem conhecimento entram aqui automaticamente para futuras revisões.' : 'Selecione a disciplina ou o tópico para abrir a primeira questão. O timer é opcional.'}</p></div>{subjectId && <FocusTimer objetivoId={objective?.id} materiaId={subjectId} topicoId={topicId || null} contexto="questao" titulo={`Questões · ${subjects.find((item) => item.id === subjectId)?.nome || 'disciplina'}`}/>}</header>
      <div className="question-layout"><aside className="panel practice-filter"><div className="catalog-heading"><div><span className="eyebrow">CONTEÚDO</span><h2>{reviewOnly ? 'Revisão programada' : 'Disciplinas e tópicos'}</h2></div><span className="catalog-total">{counts.totais?.questoes || 0}</span></div>{reviewOnly && <p className="alert warning">O mentor mostrará somente as questões que venceram nesta revisão.</p>}<div className="subject-catalog">{subjects.map((subject) => { const expanded = expandedSubjectId === subject.id; const selected = subjectId === subject.id; const subjectCount = subjectQuestionCount(subject); const allLocked = subject.topicos?.length && subject.topicos.every((topic) => counts.topicos?.[topic.id]?.bloqueado); return <div className={`catalog-subject ${expanded ? 'expanded' : ''} ${selected ? 'selected' : ''}`} key={subject.id}><button className="catalog-subject-button" onClick={() => chooseSubject(subject.id)} aria-expanded={expanded}><span className="catalog-chevron">›</span><span><b>{subject.nome}</b><small>{subjectCount} questões</small></span>{allLocked && <Lock />}</button>{expanded && <div className="catalog-topics"><button className={!topicId && selected ? 'active' : ''} onClick={() => chooseTopic(subject.id, '')}><span>Todos os tópicos</span><small>{subjectCount}</small>{allLocked && <Lock />}</button>{(subject.topicos || []).map((topic) => <button className={topicId === topic.id ? 'active' : ''} onClick={() => chooseTopic(subject.id, topic.id)} key={topic.id}><span>{topic.nome}</span><small>{counts.topicos?.[topic.id]?.questoes || 0}</small>{counts.topicos?.[topic.id]?.bloqueado && <Lock />}</button>)}</div>}</div> })}</div>{question && <button className="primary sketch-action" onClick={() => loadQuestion('', true)} disabled={loading}>Próxima questão</button>}{available > 0 && <strong className="available-count">{available} questões disponíveis</strong>}<p>O gabarito aparece somente após resposta e classificação.</p></aside>
        <div>{!question ? <div className="panel question-empty"><span>?</span><h2>{message || 'Escolha uma disciplina e, se quiser, um tópico.'}</h2><p>Deixe “Todos os tópicos” selecionado para misturar toda a disciplina.</p></div> : <article className="panel question-card"><div className="question-meta"><span>Questão {position} de {available} · {question.topico?.nome || question.tipo}</span><button onClick={() => setReportOpen(true)}>Reportar problema na questão</button></div><h2>{question.enunciado}</h2><div className="answers">{options.map(([letter, text]) => <div className={`answer-option ${answer === letter ? 'selected' : ''} ${eliminated.includes(letter) ? 'eliminated' : ''}`} key={letter}><button className="answer-choice" onClick={() => !result && setAnswer(letter)} disabled={Boolean(result)}><b>{letter}</b><span>{text}</span></button>{question.tipo === 'ME' && <button className="answer-eliminate" aria-label={`${eliminated.includes(letter) ? 'Recuperar' : 'Eliminar'} alternativa ${letter}`} title={eliminated.includes(letter) ? 'Recuperar alternativa' : 'Eliminar alternativa'} onClick={() => !result && setEliminated((current) => current.includes(letter) ? current.filter((item) => item !== letter) : [...current, letter])} disabled={Boolean(result)}>×</button>}</div>)}</div>
          {!result && <div className="confidence"><h3>Como você chegou à resposta?</h3><div>{classifications.map(([id, label, hint]) => <button key={id} className={classification === id ? 'selected' : ''} onClick={() => setClassification(id)}><b>{label}</b><small>{hint}</small></button>)}</div><button className="primary confirm" disabled={!answer || !classification || loading} onClick={confirm}>Confirmar resposta</button></div>}
          {result && <div className={`feedback ${result.resultado}`}><div className="feedback-head"><span>{result.resultado === 'acerto' ? '✓' : '×'}</span><div><small>GABARITO {result.gabarito}</small><h3>{result.resultado === 'acerto' ? 'Resposta correta' : 'Resposta incorreta'}</h3></div></div>{result.revisao_imediata && <div className="alert warning">Falsa certeza: item colocado no topo da fila de revisão.</div>}{result.mostrar_explicacao ? <><p>{result.explicacao}</p>{result.comentarios_alternativas && <div className="alternative-comments"><h4>Comentário das alternativas</h4>{Object.entries(result.comentarios_alternativas).map(([letter, comment]) => <div key={letter} className={letter === result.gabarito ? 'correct' : ''}><b>{letter}</b><p>{comment}</p></div>)}</div>}<blockquote><small>EVIDÊNCIA VINCULADA</small>{result.trecho_fonte}</blockquote><Source value={result.fonte} /></> : <p className="feedback-compact">Acerto confirmado. A explicação foi ocultada conforme sua classificação.</p>}<small className="next-review-label">Próxima revisão: {new Date(result.proxima_revisao).toLocaleDateString('pt-BR')}.</small><button className="primary next" onClick={() => loadQuestion('', true)}>Continuar</button></div>}
        </article>}</div></div>
      {reportOpen && <div className="modal-backdrop"><div className="modal panel"><span className="eyebrow">CONTROLE DE QUALIDADE</span><h2>Reportar problema</h2><p>O item será arquivado até análise.</p><label>Motivo</label><select value={reportReason} onChange={(e) => setReportReason(e.target.value)}>{reportReasons.map(([id, label]) => <option value={id} key={id}>{label}</option>)}</select><div className="modal-actions"><button className="secondary" onClick={() => setReportOpen(false)}>Cancelar</button><button className="danger-button" onClick={report}>Reportar e retirar</button></div></div></div>}
    </section>
  )
}
