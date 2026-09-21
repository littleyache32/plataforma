import { useState } from 'react'
import { api } from '../api.js'

export default function AccessGate({ onSuccess, cadastroDisponivel = false }) {
  const [mode, setMode] = useState(cadastroDisponivel ? 'criar_conta' : 'entrar')
  const [handle, setHandle] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function enter(event) {
    event.preventDefault(); setLoading(true); setError('')
    try {
      await api('/api/auth', { method: 'POST', body: JSON.stringify({ acao: mode, handle, password }) })
      setPassword('')
      await onSuccess()
    } catch (err) { setError(err.message) } finally { setLoading(false) }
  }

  return (
    <main className="gate">
      <section className="gate-copy"><span className="brand-mark">ME</span><p className="eyebrow">MENTOR DE ESTUDOS</p><h1>Uma plataforma para tudo o que você aprende.</h1><p>Semana, objetivos, materiais, questões e desempenho conectados no mesmo lugar.</p></section>
      <form className="gate-card" onSubmit={enter}><span className="eyebrow">ACESSO PESSOAL</span><div className="gate-tabs"><button type="button" className={mode === 'entrar' ? 'active' : ''} onClick={() => setMode('entrar')}>Entrar</button><button type="button" className={mode === 'criar_conta' ? 'active' : ''} onClick={() => setMode('criar_conta')}>Criar conta</button></div><h2>{mode === 'criar_conta' ? 'Criar sua conta' : 'Entrar'}</h2><p>Sua sessão permanece ativa no computador, iPad e celular. A senha nunca fica armazenada no navegador.</p><label>Usuário</label><input autoComplete="username" placeholder="yngcouto" value={handle} onChange={(event) => setHandle(event.target.value)} autoFocus required /><label>Senha</label><input type="password" autoComplete={mode === 'criar_conta' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength="8" required />{error && <div className="alert error">{error}</div>}<button className="primary" disabled={loading}>{loading ? 'Validando...' : mode === 'criar_conta' ? 'Criar conta' : 'Acessar plataforma'}</button></form>
    </main>
  )
}
