import { useEffect, useState } from 'react'
import { api } from './api.js'
import AccessGate from './components/AccessGate.jsx'
import Layout from './components/Layout.jsx'
import Week from './components/Week.jsx'
import Objectives from './components/Objectives.jsx'
import Materials from './components/Materials.jsx'
import Questions from './components/Questions.jsx'
import Simulations from './components/Simulations.jsx'
import Performance from './components/Performance.jsx'
import QuestionCards from './components/QuestionCards.jsx'

export default function App() {
  const [status, setStatus] = useState('loading')
  const [area, setArea] = useState('semana')
  const [catalog, setCatalog] = useState([])
  const [objectiveId, setObjectiveId] = useState('')
  const [context, setContext] = useState('concurso')
  const [mode, setMode] = useState('aluno')
  const [reviewQuestionId, setReviewQuestionId] = useState('')

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

  function changeContext(nextContext) {
    setContext(nextContext)
    const nextObjective = catalog.find((item) => item.tipo === nextContext)
    setObjectiveId(nextObjective?.id || '')
    setReviewQuestionId('')
  }

  function changeMode(nextMode) {
    setMode(nextMode)
    if (nextMode === 'aluno' && ['objetivos', 'materiais'].includes(area)) setArea('semana')
  }

  if (status === 'loading') return <main className="loading"><span className="brand-mark">ME</span><p>Organizando sua plataforma...</p></main>
  if (status === 'guest') return <AccessGate onSuccess={async () => { await loadCatalog(); setStatus('ready') }} />

  const contextCatalog = catalog.filter((item) => item.tipo === context)
  const objective = contextCatalog.find((item) => item.id === objectiveId) || contextCatalog[0]
  const common = { catalog: contextCatalog, objective, objectiveId: objective?.id || '', onCatalogChange: loadCatalog, mode }

  return (
    <Layout area={area} onAreaChange={setArea} catalog={contextCatalog} objectiveId={objective?.id || ''} onObjectiveChange={setObjectiveId} context={context} onContextChange={changeContext} mode={mode} onModeChange={changeMode} onLogout={logout}>
      {area === 'semana' && <Week catalog={catalog} onOpenQuestions={() => setArea('questoes')} onOpenCards={() => setArea('cards')} />}
      {area === 'objetivos' && mode === 'administrador' && <Objectives {...common} />}
      {area === 'materiais' && mode === 'administrador' && <Materials {...common} />}
      {area === 'questoes' && <Questions {...common} reviewQuestionId={reviewQuestionId} onReviewLoaded={() => setReviewQuestionId('')} />}
      {area === 'cards' && <QuestionCards objective={objective} />}
      {area === 'simulados' && <Simulations objective={objective} />}
      {area === 'desempenho' && <Performance objective={objective} mode={mode} onReview={openReview} />}
    </Layout>
  )
}
