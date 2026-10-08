import { lazy, Suspense, useEffect, useState } from 'react'
import { api } from './api.js'
import AccessGate from './components/AccessGate.jsx'
import Layout from './components/Layout.jsx'
import Week from './components/Week.jsx'
import MentorWidget from './components/MentorWidget.jsx'

const Questions = lazy(() => import('./components/Questions.jsx'))
const Home = lazy(() => import('./components/Home.jsx'))
const DiscursiveQuestions = lazy(() => import('./components/DiscursiveQuestions.jsx'))
const Simulations = lazy(() => import('./components/Simulations.jsx'))
const Performance = lazy(() => import('./components/Performance.jsx'))
const QuestionCards = lazy(() => import('./components/QuestionCards.jsx'))
const StudyTime = lazy(() => import('./components/StudyTime.jsx'))
const ReviewCenter = lazy(() => import('./components/ReviewCenter.jsx'))

export default function App() {
  const [status, setStatus] = useState('loading')
  const [cadastroDisponivel, setCadastroDisponivel] = useState(false)
  const [area, setArea] = useState('semana')
  const [catalog, setCatalog] = useState([])
  const [objectiveId, setObjectiveId] = useState('')
  const [context, setContext] = useState('concurso')
  const [reviewQuestionId, setReviewQuestionId] = useState('')
  const [studyTarget, setStudyTarget] = useState(null)
  const [weekTarget, setWeekTarget] = useState(null)
  const [timerTarget, setTimerTarget] = useState(null)

  async function loadCatalog() {
    const data = await api('/api/catalogo')
    if (!Array.isArray(data.objetivos)) throw new Error('Catálogo indisponível.')
    setCatalog(data.objetivos)
    setObjectiveId((current) => current || data.objetivos.find((item) => item.tipo === 'concurso')?.id || data.objetivos[0]?.id || '')
  }

  useEffect(() => {
    api('/api/auth')
      .then(async (auth) => { if (!auth.authenticated) { setCadastroDisponivel(auth.cadastroDisponivel === true); setStatus('guest'); return }; await loadCatalog(); setStatus('ready'); prepareCurrentWeek() })
      .catch(() => setStatus('guest'))
  }, [])

  function prepareCurrentWeek() {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
    const date = new Date(`${today}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() - (date.getUTCDay() || 7) + 1)
    const inicio = date.toISOString().slice(0, 10)
    api('/api/plano', { method: 'POST', body: JSON.stringify({ inicio }) }).catch(() => {})
  }

  async function logout() {
    await api('/api/auth', { method: 'DELETE' })
    setStatus('guest')
  }

  function openReview(questionId) {
    setReviewQuestionId(questionId)
    setArea('questoes')
  }

  function openReviewItem(item) {
    setReviewQuestionId({ questaoId: item.item_id, revisaoId: item.id })
    setArea('questoes')
  }

  function openDemand(item, destination) {
    const targetObjective = catalog.find((entry) => entry.id === item.objetivo?.id)
    if (!targetObjective) return
    setContext(targetObjective.tipo)
    setObjectiveId(targetObjective.id)
    setStudyTarget({ objectiveId: targetObjective.id, subjectId: item.materia?.id || '', topicId: item.topico?.id || '',
      reviewOnly: item.tipo === 'revisao', sessaoId: item.tipo === 'revisao' ? item.id : null })
    setArea(destination)
  }

  function openMentorTarget(item, destination) {
    if (!item) return
    const targetObjective = catalog.find((entry) => entry.id === item.objetivo_id)
    if (targetObjective) {
      setContext(targetObjective.tipo)
      setObjectiveId(targetObjective.id)
    }
    setStudyTarget({ objectiveId: item.objetivo_id || objective?.id, subjectId: item.materia_id || '', topicId: item.id || '', reviewOnly: destination === 'questoes' })
    setArea(destination)
  }

  function changeContext(nextContext) {
    setContext(nextContext)
    const nextObjective = catalog.find((item) => item.tipo === nextContext)
    setObjectiveId(nextObjective?.id || '')
    setReviewQuestionId('')
  }

  if (status === 'loading') return <main className="loading"><span className="brand-mark">ME</span><p>Organizando sua plataforma...</p></main>
  if (status === 'guest') return <AccessGate cadastroDisponivel={cadastroDisponivel} onSuccess={async () => { await loadCatalog(); setStatus('ready'); prepareCurrentWeek() }} />

  const contextCatalog = catalog.filter((item) => item.tipo === context)
  const objective = contextCatalog.find((item) => item.id === objectiveId) || contextCatalog[0]
  const common = { catalog: contextCatalog, objective, objectiveId: objective?.id || '', onCatalogChange: loadCatalog }

  return (
    <Layout area={area} onAreaChange={setArea} catalog={contextCatalog} objectiveId={objective?.id || ''} onObjectiveChange={setObjectiveId} context={context} onContextChange={changeContext} onLogout={logout}>
      <Suspense fallback={<div className="module-loading">Carregando módulo...</div>}>
      {area === 'inicio' && <Home onNavigate={setArea} />}
      {area === 'semana' && <Week catalog={catalog} target={weekTarget} onTargetApplied={() => setWeekTarget(null)} onOpenQuestions={(item) => openDemand(item, 'questoes')} onOpenCards={(item) => openDemand(item, 'cards')} onOpenTimer={(item) => { setTimerTarget(item); setArea('tempo') }} />}
      {area === 'tempo' && <StudyTime catalog={catalog} target={timerTarget} onTargetApplied={() => setTimerTarget(null)} />}
      {area === 'revisoes' && <ReviewCenter objective={objective} onOpenQuestion={openReviewItem} onOpenCards={(item) => { setStudyTarget({ objectiveId: objective?.id, subjectId: item.materia_id || '', topicId: item.topico_id || '', cardId: item.item_id }); setArea('cards') }} />}
      {['questoes', 'caderno', 'discursivas'].includes(area) && <div className="module-tabs" aria-label="Área de questões">{[['questoes', 'Questões'], ['caderno', 'Caderno'], ['discursivas', 'Discursivas']].map(([id, label]) => <button key={id} aria-pressed={area === id} onClick={() => setArea(id)}>{label}</button>)}</div>}
      {area === 'questoes' && <Questions {...common} target={studyTarget?.objectiveId === objective?.id ? studyTarget : null} onTargetApplied={() => setStudyTarget(null)} reviewQuestionId={reviewQuestionId} onReviewLoaded={() => setReviewQuestionId('')} />}
      {area === 'caderno' && <Questions {...common} notebookOnly />}
      {area === 'discursivas' && <DiscursiveQuestions />}
      {area === 'cards' && <QuestionCards objective={objective} target={studyTarget?.objectiveId === objective?.id ? studyTarget : null} onTargetApplied={() => setStudyTarget(null)} />}
      {area === 'simulados' && <Simulations objective={objective} />}
      {area === 'desempenho' && <Performance objective={objective} onReview={openReview} />}
      </Suspense>
      <MentorWidget objectiveId={objective?.id || ''} catalog={catalog} onOpenQuestions={(item) => openMentorTarget(item, 'questoes')} onOpenCards={(item) => openMentorTarget(item, 'cards')} />
    </Layout>
  )
}
