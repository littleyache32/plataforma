import { useEffect, useMemo, useState } from 'react'
import { api } from '../api.js'

const eventName = 'mentor-timer-changed'
const format = (value = 0) => {
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export default function FocusTimer({ sessaoId, objetivoId, materiaId, topicoId, contexto = 'livre', titulo = 'Estudo livre', onFinish }) {
  const [timer, setTimer] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [focus, setFocus] = useState(false)
  const [message, setMessage] = useState('')

  const load = () => api('/api/tempo').then((data) => setTimer(data.ativo)).catch(() => {})
  useEffect(() => { load(); const sync = () => load(); window.addEventListener(eventName, sync); return () => window.removeEventListener(eventName, sync) }, [])
  useEffect(() => { if (timer?.status !== 'rodando') return; const interval = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(interval) }, [timer?.status])
  const seconds = useMemo(() => !timer ? 0 : timer.status === 'rodando' && timer.retomado_em ? (timer.segundos_acumulados || 0) + Math.max(0, Math.floor((now - new Date(timer.retomado_em).getTime()) / 1000)) : timer.segundos_acumulados || timer.segundos || 0, [timer, now])
  const same = timer && ((!sessaoId && timer.titulo === titulo) || timer.sessao_id === sessaoId || (materiaId && timer.materia_id === materiaId && timer.contexto === contexto))

  async function start() {
    setMessage('')
    if (!navigator.onLine) { setTimer({ id: `offline-${Date.now()}`, titulo, contexto, status: 'rodando', segundos_acumulados: 0, retomado_em: new Date().toISOString(), offline: true }); setFocus(true); return }
    try {
      const data = await api('/api/tempo', { method: 'POST', body: JSON.stringify({ sessaoId, objetivoId, materiaId, topicoId, contexto, titulo }) })
      const next = data.timer || { id: `offline-${Date.now()}`, titulo, contexto, status: 'rodando', segundos_acumulados: 0, retomado_em: new Date().toISOString(), offline: true }
      setTimer(next); setFocus(true); window.dispatchEvent(new Event(eventName))
    } catch (error) { setMessage(error.message); if (error.timer) setTimer(error.timer) }
  }
  async function change(acao) {
    if (!timer) return
    if (timer.offline) {
      if (acao === 'concluir') await api('/api/tempo', { method: 'POST', body: JSON.stringify({ sessaoId, objetivoId, materiaId, topicoId, contexto, titulo, status: 'concluido', segundosAcumulados: seconds }) })
      const next = { ...timer, status: acao === 'concluir' ? 'concluido' : acao === 'pausar' ? 'pausado' : 'rodando', segundos_acumulados: seconds, retomado_em: acao === 'retomar' ? new Date().toISOString() : null }
      setTimer(acao === 'concluir' ? null : next); if (acao === 'concluir') { setFocus(false); onFinish?.() }
      return
    }
    try {
      const data = await api('/api/tempo', { method: 'PATCH', body: JSON.stringify({ id: timer.id, acao }) })
      setTimer(acao === 'concluir' ? null : data.timer); if (acao === 'concluir') { setFocus(false); onFinish?.() }; window.dispatchEvent(new Event(eventName))
    } catch (error) { setMessage(error.message) }
  }

  return <>
    <div className="focus-timer"><div><small>TEMPO DE ESTUDO</small><b>{format(seconds)}</b><span>{timer ? timer.titulo : 'timer opcional'}</span></div><div className="focus-timer-actions">{!timer && <button className="primary" onClick={start}>Iniciar foco</button>}{timer && <><button className="secondary" onClick={() => setFocus(true)}>Modo foco</button>{timer.status === 'rodando' ? <button className="secondary" onClick={() => change('pausar')}>Pausar</button> : <button className="primary" onClick={() => change('retomar')}>Retomar</button>}<button className="secondary" onClick={() => change('concluir')}>Concluir timer</button></>}</div>{timer && !same && <small className="timer-notice">Há outro foco ativo. Conclua-o antes de iniciar esta atividade.</small>}{message && <small className="timer-error">{message}</small>}</div>
    {focus && timer && <div className="focus-mode" role="dialog" aria-modal="true"><button className="focus-close" onClick={() => setFocus(false)} aria-label="Sair do modo foco">×</button><small>MODO FOCO</small><h1>{timer.titulo}</h1><b>{format(seconds)}</b><p>O tempo continua salvo mesmo se você fechar esta tela.</p><div>{timer.status === 'rodando' ? <button className="secondary" onClick={() => change('pausar')}>Pausar</button> : <button className="primary" onClick={() => change('retomar')}>Retomar</button>}<button className="primary" onClick={() => change('concluir')}>Concluir estudo</button></div></div>}
  </>
}
