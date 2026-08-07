import { useState } from 'react'
import { api } from '../api.js'

export default function AccessGate({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function enter(event) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      await api('/api/auth', { method: 'POST', body: JSON.stringify({ password }) })
      setPassword('')
      await onSuccess()
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <main className="gate">
      <section className="gate-copy"><span className="brand-mark">ME</span><p className="eyebrow">MENTOR DE ESTUDOS</p><h1>Uma plataforma para tudo o que você aprende.</h1><p>Semana, objetivos, materiais, questões e desempenho conectados no mesmo lugar.</p></section>
      <form className="gate-card" onSubmit={enter}><span className="eyebrow">ACESSO PESSOAL</span><h2>Entrar</h2><p>A senha é trocada por uma sessão segura no servidor e não fica armazenada no navegador.</p><label>Senha</label><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoFocus required />{error && <div className="alert error">{error}</div>}<button className="primary" disabled={loading}>{loading ? 'Validando...' : 'Acessar plataforma'}</button></form>
    </main>
  )
}
