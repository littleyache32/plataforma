import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../api.js'

const eventName = 'mentor-timer-changed'
const studyPresetMinutes = 50
const restPresetMinutes = 10

export const formatTimerValue = (value = 0) => {
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const seconds = value % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

export function timerDisplay(elapsedSeconds = 0, targetSeconds = 0) {
  if (!targetSeconds) return formatTimerValue(elapsedSeconds)
  return elapsedSeconds <= targetSeconds
    ? formatTimerValue(targetSeconds - elapsedSeconds)
    : `+${formatTimerValue(elapsedSeconds - targetSeconds)}`
}

function createAudioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  return AudioContext ? new AudioContext() : null
}

function playFinishedSound(context) {
  if (!context) return
  if (context.state === 'suspended') context.resume()
  const start = context.currentTime
  for (const [offset, frequency] of [[0, 660], [.18, 880], [.36, 990]]) {
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(.0001, start + offset)
    gain.gain.exponentialRampToValueAtTime(.22, start + offset + .02)
    gain.gain.exponentialRampToValueAtTime(.0001, start + offset + .16)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(start + offset)
    oscillator.stop(start + offset + .18)
  }
}

export default function FocusTimer({ sessaoId, objetivoId, materiaId, topicoId, contexto = 'livre', titulo = 'Estudo livre', suggestedMinutes = 0, onFinish }) {
  const [timer, setTimer] = useState(null)
  const [now, setNow] = useState(Date.now())
  const [focus, setFocus] = useState(false)
  const [message, setMessage] = useState('')
  const [targetMinutes, setTargetMinutes] = useState(() => String(Math.max(0, Number(suggestedMinutes) || 0)))
  const [restUntil, setRestUntil] = useState(0)
  const soundedFor = useRef('')
  const audioContext = useRef(null)

  const load = () => api('/api/tempo').then((data) => { setNow(Date.now()); setTimer(data.ativo); setRestUntil(data.descanso_ate ? new Date(data.descanso_ate).getTime() : 0) }).catch(() => {})
  useEffect(() => { load(); const sync = () => load(); window.addEventListener(eventName, sync); return () => window.removeEventListener(eventName, sync) }, [])
  useEffect(() => {
    if (timer?.status !== 'rodando' && restUntil <= Date.now()) return
    const source = `setInterval(() => postMessage(Date.now()), 500)`
    const url = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }))
    const worker = new Worker(url)
    worker.onmessage = (event) => setNow(Number(event.data) || Date.now())
    return () => { worker.terminate(); URL.revokeObjectURL(url) }
  }, [timer?.status, restUntil])

  const seconds = useMemo(() => !timer ? 0 : timer.status === 'rodando' && timer.retomado_em
    ? (timer.segundos_acumulados || 0) + Math.max(0, Math.floor((now - new Date(timer.retomado_em).getTime()) / 1000))
    : timer.segundos_acumulados || timer.segundos || 0, [timer, now])
  const targetSeconds = Number(timer?.duracao_alvo_segundos || 0)
  const displayTime = timerDisplay(seconds, targetSeconds)
  const restSeconds = Math.max(0, Math.ceil((restUntil - now) / 1000))

  useEffect(() => {
    if (!timer?.id || timer.status !== 'rodando' || !targetSeconds || seconds < targetSeconds || soundedFor.current === timer.id) return
    soundedFor.current = timer.id
    playFinishedSound(audioContext.current)
    if (document.hidden && Notification.permission === 'granted') new Notification('Tempo planejado concluído', { body: 'O timer continua contando até você encerrar.' })
    setMessage('Tempo planejado concluído. O excedente continua sendo contado até você encerrar.')
  }, [seconds, targetSeconds, timer])

  useEffect(() => {
    if (!restUntil || restSeconds > 0) return
    setRestUntil(0)
    api('/api/tempo', { method: 'POST', body: JSON.stringify({ acaoDescanso: 'encerrar' }) }).catch(() => {})
    playFinishedSound(audioContext.current)
    if (document.hidden && Notification.permission === 'granted') new Notification('Descanso concluído', { body: 'Você pode iniciar o próximo bloco.' })
    setMessage('Descanso concluído. Você pode iniciar o próximo bloco.')
  }, [restSeconds, restUntil])

  const same = timer && ((!sessaoId && timer.titulo === titulo) || timer.sessao_id === sessaoId || (materiaId && timer.materia_id === materiaId && timer.contexto === contexto))

  function startRest() {
    const until = Date.now() + restPresetMinutes * 60_000
    setNow(Date.now())
    setRestUntil(until)
    api('/api/tempo', { method: 'POST', body: JSON.stringify({ acaoDescanso: 'iniciar', descansoAte: new Date(until).toISOString() }) }).catch(() => {})
    setMessage('Descanso de 10 minutos iniciado.')
  }

  function stopRest() {
    setRestUntil(0)
    api('/api/tempo', { method: 'POST', body: JSON.stringify({ acaoDescanso: 'encerrar' }) }).catch(() => {})
    setMessage('Descanso encerrado.')
  }

  async function start() {
    setMessage('')
    audioContext.current ||= createAudioContext()
    audioContext.current?.resume()
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {})
    const parsedTarget = Math.max(0, Math.min(720, Number(targetMinutes) || 0))
    const duration = parsedTarget ? parsedTarget * 60 : null
    if (!navigator.onLine) {
      setTimer({ id: `offline-${Date.now()}`, titulo, contexto, status: 'rodando', segundos_acumulados: 0, duracao_alvo_segundos: duration, retomado_em: new Date().toISOString(), offline: true })
      setFocus(true)
      return
    }
    try {
      const data = await api('/api/tempo', { method: 'POST', body: JSON.stringify({ sessaoId, objetivoId, materiaId, topicoId, contexto, titulo, duracaoAlvoSegundos: duration }) })
      const next = data.timer || { id: `offline-${Date.now()}`, titulo, contexto, status: 'rodando', segundos_acumulados: 0, duracao_alvo_segundos: duration, retomado_em: new Date().toISOString(), offline: true }
      setTimer(next)
      setFocus(true)
      window.dispatchEvent(new Event(eventName))
    } catch (error) {
      setMessage(error.message)
      if (error.timer) setTimer(error.timer)
    }
  }

  async function discard() {
    if (!timer || !window.confirm('Apagar este registro de tempo?')) return
    if (!timer.offline) await api(`/api/tempo?id=${encodeURIComponent(timer.id)}`, { method: 'DELETE' })
    setTimer(null); setFocus(false); setMessage('Registro de tempo apagado.')
    window.dispatchEvent(new Event(eventName))
  }

  async function change(acao) {
    if (!timer) return
    const shouldRest = acao === 'concluir' && timer.duracao_alvo_segundos === studyPresetMinutes * 60
    if (timer.offline) {
      if (acao === 'concluir') await api('/api/tempo', { method: 'POST', body: JSON.stringify({ sessaoId, objetivoId, materiaId, topicoId, contexto, titulo, status: 'concluido', segundosAcumulados: seconds }) })
      const next = { ...timer, status: acao === 'concluir' ? 'concluido' : acao === 'pausar' ? 'pausado' : 'rodando', segundos_acumulados: seconds, retomado_em: acao === 'retomar' ? new Date().toISOString() : null }
      setTimer(acao === 'concluir' ? null : next)
      if (acao === 'concluir') { setFocus(false); if (shouldRest) startRest(); onFinish?.() }
      return
    }
    try {
      const data = await api('/api/tempo', { method: 'PATCH', body: JSON.stringify({ id: timer.id, acao }) })
      setTimer(acao === 'concluir' ? null : data.timer)
      if (acao === 'concluir') { setFocus(false); if (shouldRest) startRest(); onFinish?.() }
      window.dispatchEvent(new Event(eventName))
    } catch (error) {
      setMessage(error.message)
    }
  }

  return <>
    <div className="focus-timer">
      <div><small>{restSeconds > 0 ? 'TEMPO DE DESCANSO' : 'TEMPO DE ESTUDO'}</small><b className={displayTime.startsWith('+') ? 'timer-overtime' : ''}>{restSeconds > 0 ? formatTimerValue(restSeconds) : displayTime}</b><span>{restSeconds > 0 ? 'ciclo 50 + 10' : timer ? `${timer.titulo}${targetSeconds ? ` · alvo de ${Math.round(targetSeconds / 60)} min` : ' · contagem livre'}` : 'timer opcional'}</span></div>
      {!timer && restSeconds === 0 && <div className="focus-duration-wrap"><label className="focus-duration">Tempo de foco<input aria-label="Tempo de foco em minutos" inputMode="numeric" type="number" min="0" max="720" value={targetMinutes} onChange={(event) => setTargetMinutes(event.target.value === '' ? '' : String(Math.max(0, Math.min(720, Number(event.target.value) || 0))))}/><span>min</span></label><button className="timer-preset" type="button" onClick={() => setTargetMinutes(String(studyPresetMinutes))}>50 + 10</button></div>}
      <div className="focus-timer-actions">{!timer && restSeconds === 0 && <button className="primary" onClick={start}>Iniciar foco</button>}{restSeconds > 0 && <button className="secondary" onClick={stopRest}>Encerrar descanso</button>}{timer && <><button className="secondary" onClick={() => setFocus(true)}>Modo foco</button>{timer.status === 'rodando' ? <button className="secondary" onClick={() => change('pausar')}>Pausar</button> : <button className="primary" onClick={() => change('retomar')}>Retomar</button>}<button className="secondary" onClick={() => change('concluir')}>Concluir timer</button><button className="ghost danger" onClick={discard}>Apagar horário</button></>}</div>
      {timer && !same && <small className="timer-notice">Há outro foco ativo. Conclua-o antes de iniciar esta atividade.</small>}{message && <small className="timer-notice">{message}</small>}
    </div>
    {focus && timer && <div className="focus-mode" role="dialog" aria-modal="true"><button className="focus-close" onClick={() => setFocus(false)} aria-label="Minimizar modo foco">Minimizar</button><small>MODO FOCO</small><h1>{timer.titulo}</h1><b>{displayTime}</b><p>{targetSeconds ? 'Ao chegar a zero, o excedente continuará sendo contado.' : 'O tempo continua salvo mesmo com o modo foco minimizado.'}</p><div>{timer.status === 'rodando' ? <button className="secondary" onClick={() => change('pausar')}>Pausar</button> : <button className="primary" onClick={() => change('retomar')}>Retomar</button>}<button className="primary" onClick={() => change('concluir')}>Concluir estudo</button><button className="secondary" onClick={() => setFocus(false)}>Minimizar</button></div></div>}
  </>
}
