import { lazy, Suspense, useEffect, useState } from 'react'
import { api } from './api.js'
import AccessGate from './components/AccessGate.jsx'
import Layout from './components/Layout.jsx'
import Week from './components/Week.jsx'
import MentorWidget from './components/MentorWidget.jsx'

const Objectives = lazy(() => import('./components/Objectives.jsx'))
const Materials = lazy(() => import('./components/Materials.jsx'))
const Questions = lazy(() => import('./components/Questions.jsx'))
const DiscursiveQuestions = lazy(() => import('./components/DiscursiveQuestions.jsx'))
const Simulations = lazy(() => import('./components/Simulations.jsx'))
const Performance = lazy(() => import('./components/Performance.jsx'))
const QuestionCards = lazy(() => import('./components/QuestionCards.jsx'))
const Deadlines = lazy(() => import('./components/Deadlines.jsx'))
const AdminPanel = lazy(() => import('./components/AdminPanel.jsx'))
const StudyTime = lazy(() => import('./components/StudyTime.jsx'))
const ReviewCenter = lazy(() => import('./components/ReviewCenter.jsx'))
const EdictComparator = lazy(() => import('./components/EdictComparator.jsx'))

export default function App() {
  const [status, setStatus] = useState('loading')
  const [area, setArea] = useState('semana')
  const [catalog, setCatalog] = useState([])
  const [objectiveId, setObjectiveId] = useState('')
  const [context, setContext] = useState('concurso')
  const [mode, setMode] = useState('aluno')
  const [reviewQuestionId, setReviewQuestionId] = useState('')
  const [studyTarget, setStudyTarget] = useState(null)
  const [weekTarget, setWeekTarget] = useState(null)

  async function loadCatalog() {
    const data = await api('/api/catalogo')
    if (!Array.isArray(data.objetivos)) throw new Error('Catálogo indisponível.')
    setCatalog(data.objetivos)
    setObjectiveId((current) => current || data.objetivos.find((item) => item.tipo === 'concurso')?.id || data.objetivos[0]?.id || '')
  }

  useEffect(() => {
    api('/api/auth')
      .then(async () => { await loadCatalog(); setStatus('ready') })
      .catch(() => setStatus('guest'))
  }, [])

  async function logout() {
    await api('/api/auth', { method: 'DELETE' })
    setStatus('guest')
  }

  function openReview(questionId) {
    setReviewQuestionId(questionId)
    setArea('questoes')
  }

  function openReviewItem(item) {
    setReviewQuestionId(item.item_id)
    setArea('questoes')
  }

  function openDemand(item, destination) {
    const targetObjective = catalog.find((entry) => entry.id === item.objetivo?.id)
    if (!targetObjective) return
    setContext(targetObjective.tipo)
    setObjectiveId(targetObjective.id)
    setStudyTarget({ objectiveId: targetObjective.id, subjectId: item.materia?.id || '', topicId: item.topico?.id || '', reviewOnly: item.tipo === 'revisao' && item.titulo?.startsWith('Revisão espaçada:') })
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

  function changeMode(nextMode) {
    setMode(nextMode)
    if (nextMode === 'aluno' && ['objetivos', 'materiais', 'prazos', 'controle', 'edital'].includes(area)) setArea('semana')
  }

  if (status === 'loading') return <main className="loading"><span className="brand-mark">ME</span><p>Organizando sua plataforma...</p></main>
  if (status === 'guest') return <AccessGate onSuccess={async () => { await loadCatalog(); setStatus('ready') }} />

  const contextCatalog = catalog.filter((item) => item.tipo === context)
  const objective = contextCatalog.find((item) => item.id === objectiveId) || contextCatalog[0]
  const common = { catalog: contextCatalog, objective, objectiveId: objective?.id || '', onCatalogChange: loadCatalog, mode }

  return (
    <Layout area={area} onAreaChange={setArea} catalog={contextCatalog} objectiveId={objective?.id || ''} onObjectiveChange={setObjectiveId} context={context} onContextChange={changeContext} mode={mode} onModeChange={changeMode} onLogout={logout}>
      {area === 'semana' && <Week catalog={catalog} target={weekTarget} onTargetApplied={() => setWeekTarget(null)} onOpenQuestions={(item) => openDemand(item, 'questoes')} onOpenCards={(item) => openDemand(item, 'cards')} />}
      <Suspense fallback={<div className="module-loading">Carregando módulo...</div>}>
      {area === 'objetivos' && mode === 'administrador' && <Objectives {...common} />}
      {area === 'materiais' && mode === 'administrador' && <Materials {...common} />}
      {area === 'prazos' && mode === 'administrador' && <Deadlines catalog={catalog} />}
      {area === 'controle' && mode === 'administrador' && <AdminPanel />}
      {area === 'edital' && mode === 'administrador' && <EdictComparator objective={objective} />}
      {area === 'tempo' && <StudyTime catalog={catalog} />}
      {area === 'revisoes' && <ReviewCenter objective={objective} onOpenQuestion={openReviewItem} onOpenCards={(item) => { setStudyTarget({ objectiveId: objective?.id, subjectId: item.materia_id || '', topicId: item.topico_id || '' }); setArea('cards') }} />}
      {area === 'questoes' && <Questions {...common} target={studyTarget?.objectiveId === objective?.id ? studyTarget : null} onTargetApplied={() => setStudyTarget(null)} reviewQuestionId={reviewQuestionId} onReviewLoaded={() => setReviewQuestionId('')} />}
      {area === 'caderno' && <Questions {...common} notebookOnly />}
      {area === 'discursivas' && <DiscursiveQuestions />}
      {area === 'cards' && <QuestionCards objective={objective} target={studyTarget?.objectiveId === objective?.id ? studyTarget : null} onTargetApplied={() => setStudyTarget(null)} />}
      {area === 'simulados' && <Simulations objective={objective} />}
      {area === 'desempenho' && <Performance objective={objective} mode={mode} onReview={openReview} />}
      </Suspense>
      {mode === 'aluno' && <MentorWidget objectiveId={objective?.id || ''} onOpenAlerts={() => setArea('revisoes')} onOpenWeek={() => setArea('semana')} onOpenNextDemand={(item) => { setWeekTarget(item); setArea('semana') }} onOpenQuestions={(item) => openMentorTarget(item, 'questoes')} onOpenCards={(item) => openMentorTarget(item, 'cards')} />}
    </Layout>
  )
}
