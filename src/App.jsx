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

export default function App() {
  const [status, setStatus] = useState('loading')
  const [area, setArea] = useState('semana')
  const [catalog, setCatalog] = useState([])
  const [objectiveId, setObjectiveId] = useState('')
  const [reviewQuestionId, setReviewQuestionId] = useState('')

  async function loadCatalog() {
    const data = await api('/api/catalogo')
    setCatalog(data.objetivos)
    setObjectiveId((current) => current || data.objetivos[0]?.id || '')
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

  if (status === 'loading') return <main className="loading"><span className="brand-mark">ME</span><p>Organizando sua plataforma...</p></main>
  if (status === 'guest') return <AccessGate onSuccess={async () => { await loadCatalog(); setStatus('ready') }} />

  const objective = catalog.find((item) => item.id === objectiveId) || catalog[0]
  const common = { catalog, objective, objectiveId: objective?.id || '', onCatalogChange: loadCatalog }

  return (
    <Layout area={area} onAreaChange={setArea} catalog={catalog} objectiveId={objective?.id || ''} onObjectiveChange={setObjectiveId} onLogout={logout}>
      {area === 'semana' && <Week {...common} />}
      {area === 'objetivos' && <Objectives {...common} />}
      {area === 'materiais' && <Materials {...common} />}
      {area === 'questoes' && <Questions {...common} reviewQuestionId={reviewQuestionId} onReviewLoaded={() => setReviewQuestionId('')} />}
      {area === 'simulados' && <Simulations objective={objective} />}
      {area === 'desempenho' && <Performance objective={objective} onReview={openReview} />}
    </Layout>
  )
}
