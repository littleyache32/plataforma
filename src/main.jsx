import { StrictMode, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './styles.css'

const classifications = [
  { id: 'certeza', label: 'Certeza', hint: 'Eu domino' },
  { id: 'duvida', label: 'Dúvida', hint: 'Entre opções' },
  { id: 'eliminacao', label: 'Eliminação', hint: 'Cheguei por lógica' },
  { id: 'sem_conhecimento', label: 'Sem conhecimento', hint: 'Não sabia' },
]

function api(path, { key, ...options } = {}) {
  return fetch(path, {
    ...options,
    headers: { 'Content-Type': 'application/json', 'x-app-key': key, ...options.headers },
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(data.error || 'A operação falhou.')
    return data
  })
}

function AccessGate({ onAccess }) {
  const [key, setKey] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function enter(event) {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await api('/api/catalogo', { key })
      sessionStorage.setItem('mentor-bacen-key', key)
      onAccess(key)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="gate">
      <section className="gate-copy">
        <span className="brand-mark">MB</span>
        <p className="eyebrow">MENTOR BACEN</p>
        <h1>Prática que mede o que você realmente sabe.</h1>
        <p className="lead">Questões Cebraspe com fonte visível, confiança registrada e diagnóstico por recência.</p>
      </section>
      <form className="gate-card" onSubmit={enter}>
        <span className="step">ACESSO PESSOAL</span>
        <h2>Entrar na plataforma</h2>
        <p>A chave é validada somente pela função segura do servidor.</p>
        <label>Chave de acesso</label>
        <input type="password" value={key} onChange={(event) => setKey(event.target.value)} autoFocus required />
        {error && <div className="alert error">{error}</div>}
        <button className="primary" disabled={loading}>{loading ? 'Validando...' : 'Entrar'}</button>
      </form>
    </main>
  )
}

function ScoreCard({ label, value, tone, detail }) {
  return (
    <article className={`score-card ${tone || ''}`}>
      <span>{label}</span>
      <strong>{value}%</strong>
      <small>{detail}</small>
    </article>
  )
}

function Source({ source }) {
  const lines = String(source || '').split('\n').filter(Boolean)
  return (
    <div className="sources">
      {lines.map((line, index) => {
        const match = line.match(/(https?:\/\/\S+)$/)
        return match
          ? <a key={index} href={match[1]} target="_blank" rel="noreferrer">{line.slice(0, match.index).replace(/:\s*$/, '')}<span>↗</span></a>
          : <span key={index}>{line}</span>
      })}
    </div>
  )
}

function Practice({ apiKey, catalog, onRefreshScore }) {
  const [subjectId, setSubjectId] = useState(catalog[0]?.id || '')
  const topics = useMemo(() => catalog.find((item) => item.id === subjectId)?.topicos || [], [catalog, subjectId])
  const [topicId, setTopicId] = useState('')
  const [question, setQuestion] = useState(null)
  const [answer, setAnswer] = useState('')
  const [classification, setClassification] = useState('')
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const startedAt = useRef(null)

  useEffect(() => setTopicId(topics[0]?.id || ''), [subjectId, topics])

  async function nextQuestion() {
    setLoading(true)
    setMessage('')
    try {
      const data = await api(`/api/pratica?topicoId=${encodeURIComponent(topicId)}`, { key: apiKey })
      setQuestion(data.questao)
      setAnswer('')
      setClassification('')
      setResult(null)
      startedAt.current = Date.now()
    } catch (error) {
      setQuestion(null)
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function confirm() {
    if (!answer || !classification) return
    setLoading(true)
    try {
      const data = await api('/api/pratica', {
        key: apiKey,
        method: 'POST',
        body: JSON.stringify({
          questaoId: question.id,
          resposta: answer,
          classificacao: classification,
          tempo: Math.max(0, Math.round((Date.now() - startedAt.current) / 1000)),
        }),
      })
      setResult(data)
      onRefreshScore(topicId)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function flagQuestion() {
    if (!question) return
    await api('/api/questoes', { key: apiKey, method: 'PATCH', body: JSON.stringify({ id: question.id, marcadaErrada: true }) })
    setMessage('Questão retirada do baralho.')
    setQuestion(null)
  }

  const options = question?.tipo === 'CE'
    ? [['C', 'Certo'], ['E', 'Errado']]
    : Object.entries(question?.alternativas || {})

  return (
    <section className="page-grid">
      <aside className="practice-setup panel">
        <p className="eyebrow">PRÁTICA POR TÓPICO</p>
        <h2>Escolha o foco</h2>
        <label>Matéria</label>
        <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)}>
          {catalog.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
        <label>Tópico</label>
        <select value={topicId} onChange={(event) => setTopicId(event.target.value)}>
          {topics.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}
        </select>
        <button className="primary" onClick={nextQuestion} disabled={!topicId || loading}>{question ? 'Próxima questão' : 'Começar prática'}</button>
        <div className="setup-note"><b>Regra:</b> escolha como respondeu antes de confirmar o gabarito.</div>
      </aside>

      <div className="question-area">
        {!question && (
          <div className="empty panel">
            <span className="empty-icon">Q</span>
            <h2>{message || 'Seu próximo item começa aqui.'}</h2>
            <p>Selecione matéria e tópico. O gabarito só aparece depois da resposta e da classificação.</p>
          </div>
        )}
        {question && (
          <article className="question panel">
            <div className="question-meta"><span>QUESTÃO {question.tipo}</span><button className="text-button danger-text" onClick={flagQuestion}>Marcar como errada</button></div>
            <h2>{question.enunciado}</h2>
            <div className="answers">
              {options.map(([letter, text]) => (
                <button key={letter} className={`answer ${answer === letter ? 'selected' : ''}`} onClick={() => !result && setAnswer(letter)} disabled={Boolean(result)}>
                  <b>{letter}</b><span>{text}</span>
                </button>
              ))}
            </div>

            {!result && (
              <div className="confidence">
                <p>Como você chegou à resposta?</p>
                <div className="confidence-grid">
                  {classifications.map((item) => (
                    <button key={item.id} className={classification === item.id ? 'selected' : ''} onClick={() => setClassification(item.id)}>
                      <b>{item.label}</b><small>{item.hint}</small>
                    </button>
                  ))}
                </div>
                <button className="primary confirm" onClick={confirm} disabled={!answer || !classification || loading}>Confirmar resposta</button>
              </div>
            )}

            {result && (
              <div className={`feedback ${result.resultado}`}>
                <div className="feedback-title">
                  <span>{result.resultado === 'acerto' ? '✓' : '×'}</span>
                  <div><small>GABARITO {result.gabarito}</small><h3>{result.resultado === 'acerto' ? 'Resposta correta' : 'Resposta incorreta'}</h3></div>
                </div>
                {result.revisao_imediata && <div className="alert warning">Falsa certeza detectada. Este item entrou na revisão imediata.</div>}
                <p>{result.explicacao}</p>
                <blockquote><span>Trecho de origem</span>{result.trecho_fonte}</blockquote>
                <Source source={result.fonte} />
                <button className="primary" onClick={nextQuestion}>Continuar</button>
              </div>
            )}
          </article>
        )}
      </div>
    </section>
  )
}

function Mentor({ apiKey }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  useEffect(() => { api('/api/mentor', { key: apiKey }).then(setData).catch((err) => setError(err.message)) }, [apiKey])
  if (error) return <div className="panel alert error">{error}</div>
  if (!data) return <div className="panel empty"><h2>Calculando diagnóstico...</h2></div>

  const collecting = data.topicos.filter((item) => item.status === 'coletando_dados')
  return (
    <section className="mentor-page">
      <header className="section-head"><div><p className="eyebrow">MENTOR V1</p><h1>Prioridades com evidência.</h1></div><p>O diagnóstico usa as últimas 20 respostas, confiança e recência. No máximo três prioridades.</p></header>
      <div className="priority-grid">
        {data.prioridades.length ? data.prioridades.map((item, index) => (
          <article className="priority-card" key={item.id}>
            <span className="rank">0{index + 1}</span><small>{item.materia}</small><h2>{item.nome}</h2>
            <div className="metrics"><span><b>{item.dominio}%</b> domínio</span><span><b>{item.falsa_certeza}%</b> falsa certeza</span></div>
          </article>
        )) : <div className="panel no-priority"><h2>Nenhuma prioridade crítica.</h2><p>Isso pode significar desempenho estável ou amostra ainda insuficiente.</p></div>}
      </div>
      <div className="mentor-columns">
        <article className="panel"><div className="panel-title"><h2>Revisão imediata</h2><span>{data.revisao_imediata.length}</span></div>
          {data.revisao_imediata.length ? data.revisao_imediata.map((item) => <p className="review-item" key={`${item.questao_id}-${item.criado_em}`}>{item.enunciado}</p>) : <p className="muted">Nenhuma falsa certeza registrada.</p>}
        </article>
        <article className="panel"><div className="panel-title"><h2>Coletando dados</h2><span>{collecting.length}</span></div>
          {collecting.slice(0, 8).map((item) => <div className="collect-item" key={item.id}><span>{item.nome}</span><b>{item.amostra}/20</b></div>)}
        </article>
      </div>
    </section>
  )
}

function Admin({ apiKey, catalog }) {
  const [subjectId, setSubjectId] = useState(catalog[0]?.id || '')
  const topics = catalog.find((item) => item.id === subjectId)?.topicos || []
  const [topicId, setTopicId] = useState(topics[0]?.id || '')
  const [quantity, setQuantity] = useState(20)
  const [seedStatus, setSeedStatus] = useState('')
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [materialStatus, setMaterialStatus] = useState('')
  const [materials, setMaterials] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => setTopicId(topics[0]?.id || ''), [subjectId])
  const loadMaterials = () => api('/api/admin/materiais', { key: apiKey }).then((data) => setMaterials(data.materiais)).catch(() => {})
  useEffect(loadMaterials, [apiKey])

  async function seed() {
    setLoading(true); setSeedStatus('Gerando lote com pesquisa e validação...')
    try {
      const result = await api('/api/admin/seed', { key: apiKey, method: 'POST', body: JSON.stringify({ topicoId, quantidade: Number(quantity) }) })
      setSeedStatus(result.cache ? result.mensagem : `${result.geradas} questões salvas com ${result.fontes} fontes pesquisadas.`)
    } catch (error) { setSeedStatus(error.message) } finally { setLoading(false) }
  }

  function fileToBase64(input) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result).split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(input)
    })
  }

  async function submitMaterial(event) {
    event.preventDefault(); setLoading(true); setMaterialStatus('Avaliando pertinência, qualidade e repetição...')
    try {
      const payload = file
        ? { materiaId: subjectId, tipo: 'pdf', nome: file.name, arquivoBase64: await fileToBase64(file) }
        : { materiaId: subjectId, tipo: 'texto', nome: 'Texto colado', conteudo: text }
      const result = await api('/api/admin/materiais', { key: apiKey, method: 'POST', body: JSON.stringify(payload) })
      setMaterialStatus(`${result.status.toUpperCase()}: ${result.motivo}`)
      setText(''); setFile(null); loadMaterials()
    } catch (error) { setMaterialStatus(error.message) } finally { setLoading(false) }
  }

  async function force(id) {
    await api('/api/admin/materiais', { key: apiKey, method: 'PATCH', body: JSON.stringify({ id }) })
    loadMaterials()
  }

  return (
    <section className="admin-page">
      <header className="section-head"><div><p className="eyebrow">ADMIN</p><h1>Motor de conteúdo.</h1></div><p>Gere em rodadas curtas para respeitar a cota. Materiais só entram depois da avaliação.</p></header>
      <div className="admin-grid">
        <article className="panel admin-card">
          <div className="card-number">01</div><h2>Povoar banco</h2><p>O cache é consultado antes do Gemini. Cada lote exige grounding e os dois formatos.</p>
          <label>Matéria</label><select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{catalog.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
          <label>Tópico</label><select value={topicId} onChange={(e) => setTopicId(e.target.value)}>{topics.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</select>
          <label>Questões disponíveis desejadas</label><input type="number" min="2" max="20" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <button className="primary" onClick={seed} disabled={loading || !topicId}>Gerar com Gemini</button>
          {seedStatus && <div className="status-box">{seedStatus}</div>}
        </article>

        <form className="panel admin-card" onSubmit={submitMaterial}>
          <div className="card-number">02</div><h2>Anexar material</h2><p>Cole texto ou envie um PDF de até 8 MB. O conteúdo original fica registrado para auditoria.</p>
          <label>Texto</label><textarea rows="7" value={text} onChange={(e) => { setText(e.target.value); if (e.target.value) setFile(null) }} placeholder="Cole aqui o conteúdo do professor ou uma fonte relevante..." />
          <div className="or"><span>ou</span></div>
          <label className="file-input"><input type="file" accept="application/pdf" onChange={(e) => { setFile(e.target.files[0]); if (e.target.files[0]) setText('') }} /><span>{file ? file.name : 'Selecionar PDF'}</span></label>
          <button className="primary" disabled={loading || (!file && text.length < 120)}>Verificar material</button>
          {materialStatus && <div className="status-box">{materialStatus}</div>}
        </form>
      </div>

      <article className="panel material-list"><div className="panel-title"><h2>Histórico de materiais</h2><span>{materials.length}</span></div>
        {materials.length ? materials.map((item) => (
          <div className="material-row" key={item.id}>
            <div><small>{item.materia?.nome} · {item.tipo.toUpperCase()}</small><b>{item.nome || 'Material sem nome'}</b><p>{item.motivo}</p></div>
            <div className="material-action"><span className={`badge ${item.status}`}>{item.forcado ? 'FORÇADO' : item.status.toUpperCase()}</span>{item.status === 'recusado' && <button className="secondary" onClick={() => force(item.id)}>Forçar entrada</button>}</div>
          </div>
        )) : <p className="muted">Nenhum material avaliado.</p>}
      </article>
    </section>
  )
}

function App() {
  const [apiKey, setApiKey] = useState(() => sessionStorage.getItem('mentor-bacen-key') || '')
  const [catalog, setCatalog] = useState([])
  const [tab, setTab] = useState('pratica')
  const [score, setScore] = useState({ acerto_bruto: 0, acerto_com_certeza: 0, falsa_certeza: 0, total: 0 })
  const [ready, setReady] = useState(false)

  function load(key = apiKey) {
    return Promise.all([api('/api/catalogo', { key }), api('/api/placar', { key })])
      .then(([catalogData, scoreData]) => { setCatalog(catalogData.materias); setScore(scoreData); setReady(true) })
      .catch(() => { sessionStorage.removeItem('mentor-bacen-key'); setApiKey(''); setReady(false) })
  }
  useEffect(() => { if (apiKey) load(apiKey) }, [apiKey])
  const refreshScore = (topicId) => api(`/api/placar?topicoId=${topicId}`, { key: apiKey }).then(setScore)

  if (!apiKey) return <AccessGate onAccess={(key) => setApiKey(key)} />
  if (!ready) return <main className="loading-screen"><span className="brand-mark">MB</span><p>Carregando seu banco...</p></main>

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="logo" onClick={() => setTab('pratica')}><span>MB</span><div><b>Mentor BACEN</b><small>Área 1 · Cebraspe</small></div></button>
        <nav>{[['pratica', 'Prática'], ['mentor', 'Mentor'], ['admin', 'Admin']].map(([id, label]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</nav>
        <button className="exit" onClick={() => { sessionStorage.removeItem('mentor-bacen-key'); setApiKey('') }}>Sair</button>
      </header>
      <div className="score-strip">
        <ScoreCard label="Acerto bruto" value={score.acerto_bruto} detail={`${score.total} respostas`} />
        <ScoreCard label="Domínio real" value={score.acerto_com_certeza} tone="good" detail="acerto com certeza" />
        <ScoreCard label="Falsa certeza" value={score.falsa_certeza} tone="danger" detail="erro com certeza" />
      </div>
      <main className="content">
        {tab === 'pratica' && <Practice apiKey={apiKey} catalog={catalog} onRefreshScore={refreshScore} />}
        {tab === 'mentor' && <Mentor apiKey={apiKey} />}
        {tab === 'admin' && <Admin apiKey={apiKey} catalog={catalog} />}
      </main>
    </div>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
