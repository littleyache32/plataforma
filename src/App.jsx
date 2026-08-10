import { useEffect, useState } from 'react'
import { api } from './api.js'
import AccessGate from './components/AccessGate.jsx'
import Layout from './components/Layout.jsx'
import Week from './components/Week.jsx'
import Objectives from './components/Objectives.jsx'
import Materials from './components/Materials.jsx'
import Questions from './components/Questions.jsx'
import DiscursiveQuestions from './components/DiscursiveQuestions.jsx'
import Simulations from './components/Simulations.jsx'
import Performance from './components/Performance.jsx'
import QuestionCards from './components/QuestionCards.jsx'
import Deadlines from './components/Deadlines.jsx'
import MentorWidget from './components/MentorWidget.jsx'

export default function App() {
  const [status, setStatus] = useState('loading')
  const [area, setArea] = useState('semana')
  const [catalog, setCatalog] = useState([])
  const [objectiveId, setObjectiveId] = useState('')
  const [context, setContext] = useState('concurso')
  const [mode, setMode] = useState('aluno')
  const [reviewQuestionId, setReviewQuestionId] = useState('')
  const [studyTarget, setStudyTarget] = useState(null)

  async function loadCatalog() {
    const data = await api('/api/catalogo')
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

  function openDemand(item, destination) {
    const targetObjective = catalog.find((entry) => entry.id === item.objetivo?.id)
    if (!targetObjective) return
    setContext(targetObjective.tipo)
    setObjectiveId(targetObjective.id)
    setStudyTarget({ objectiveId: targetObjective.id, subjectId: item.materia?.id || '', topicId: item.topico?.id || '', reviewOnly: item.tipo === 'revisao' && item.titulo?.startsWith('Revisão espaçada:') })
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
    if (nextMode === 'aluno' && ['objetivos', 'materiais', 'prazos'].includes(area)) setArea('semana')
  }

  if (status === 'loading') return <main className="loading"><span className="brand-mark">ME</span><p>Organizando sua plataforma...</p></main>
  if (status === 'guest') return <AccessGate onSuccess={async () => { await loadCatalog(); setStatus('ready') }} />

  const contextCatalog = catalog.filter((item) => item.tipo === context)
  const objective = contextCatalog.find((item) => item.id === objectiveId) || contextCatalog[0]
  const common = { catalog: contextCatalog, objective, objectiveId: objective?.id || '', onCatalogChange: loadCatalog, mode }

  return (
    <Layout area={area} onAreaChange={setArea} catalog={contextCatalog} objectiveId={objective?.id || ''} onObjectiveChange={setObjectiveId} context={context} onContextChange={changeContext} mode={mode} onModeChange={changeMode} onLogout={logout}>
      {area === 'semana' && <Week catalog={catalog} onOpenQuestions={(item) => openDemand(item, 'questoes')} onOpenCards={(item) => openDemand(item, 'cards')} />}
      {area === 'objetivos' && mode === 'administrador' && <Objectives {...common} />}
      {area === 'materiais' && mode === 'administrador' && <Materials {...common} />}
      {area === 'prazos' && mode === 'administrador' && <Deadlines catalog={catalog} />}
      {area === 'questoes' && <Questions {...common} target={studyTarget?.objectiveId === objective?.id ? studyTarget : null} onTargetApplied={() => setStudyTarget(null)} reviewQuestionId={reviewQuestionId} onReviewLoaded={() => setReviewQuestionId('')} />}
      {area === 'discursivas' && <DiscursiveQuestions />}
      {area === 'cards' && <QuestionCards objective={objective} target={studyTarget?.objectiveId === objective?.id ? studyTarget : null} onTargetApplied={() => setStudyTarget(null)} />}
      {area === 'simulados' && <Simulations objective={objective} />}
      {area === 'desempenho' && <Performance objective={objective} mode={mode} onReview={openReview} />}
      {mode === 'aluno' && <MentorWidget objectiveId={objective?.id || ''} />}
    </Layout>
  )
}
