import { useEffect, useState } from 'react'
import { api } from '../api.js'
import avatar from '../assets/mentor-avatar.svg'

export default function MentorWidget({ objectiveId, onOpenAlerts, onOpenWeek, onOpenNextDemand, onOpenQuestions, onOpenCards }) {
  const [open, setOpen] = useState(false)
  const [mentor, setMentor] = useState(null)
  const [demands, setDemands] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadedFor, setLoadedFor] = useState('')

  useEffect(() => {
    if (!open || !objectiveId || loadedFor === objectiveId) return
    let active = true
    setLoading(true)
    Promise.all([
      api(`/api/mentor?objetivoId=${objectiveId}&compacto=1`),
      api('/api/sessoes?recurso=proxima'),
    ]).then(([mentorData, sessionData]) => {
      if (!active) return
      setMentor(mentorData)
      setDemands(sessionData.demanda ? [sessionData.demanda] : [])
      setLoadedFor(objectiveId)
    }).catch(() => {
      if (active) setMentor(null)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [open, objectiveId, loadedFor])

  const priority = mentor?.prioridades?.[0]
  const nextDemand = demands[0]
  const probable = mentor?.cenarios?.find((item) => item.cenario === 'provavel')
  const basePhase = mentor?.fase?.id === 'construcao_base'
  const cardsReleased = Date.now() >= new Date('2026-08-17T00:00:00-03:00').getTime()
  const restrictedPhase = basePhase || !cardsReleased
  const close = mentor?.fechamento_semanal
  const trajectory = mentor?.trajetoria
  const alerts = mentor?.alertas || []
  const visibleAlerts = cardsReleased ? alerts : alerts.filter((alert) => !/card/i.test(`${alert.tipo} ${alert.titulo} ${alert.mensagem}`))

  return <aside className={`mentor-widget ${open ? 'open' : ''}`}>
    {open && <section className="mentor-popover sketch-chat" aria-live="polite">
      <header className="sketch-chat-head"><div className="sketch-avatar"><img src={avatar} alt="Avatar do mentor"/><i aria-hidden="true"/></div><div><b>Mentor de estudos</b><small><span className="online-dot"/> online · {mentor?.fase?.titulo || 'direcionamento diário'}</small></div></header>
      <div className="sketch-chat-flow">
        {visibleAlerts.slice(0, 4).map((alert, index) => <div className="chat-message received follow-up" key={`${alert.tipo}-${index}`}><div className="chat-avatar-space"/><div className={`chat-bubble ${alert.gravidade === 'alta' ? 'priority-bubble' : ''}`}><small>ALERTA DO MENTOR</small><strong>{alert.titulo}</strong><span>{alert.mensagem}</span></div></div>)}
        {loading ? <div className="typing-message"><img src={avatar} alt=""/><span><i/><i/><i/></span></div> : <>
          <div className="chat-message received"><img src={avatar} alt=""/><div className="chat-bubble"><small>PRÓXIMA DEMANDA</small><strong>{nextDemand?.titulo || 'Abra sua semana para ver o plano'}</strong>{nextDemand && <span>{nextDemand.materia?.nome} · {nextDemand.duracao_estimada} min</span>}</div></div>
          <div className="chat-message received follow-up"><div className="chat-avatar-space"/><div className="chat-bubble"><small>FASE ATUAL</small><strong>{mentor?.fase?.titulo || 'Construção da base'}</strong><span>{mentor?.fase?.descricao || 'O mentor organiza a carga conforme sua fase de preparação.'}</span></div></div>
          {priority && !restrictedPhase && <div className="chat-message received follow-up"><div className="chat-avatar-space"/><div className="chat-bubble priority-bubble"><small>PRIORIDADE</small><strong>{priority.nome}</strong><span>{priority.motivo}</span></div></div>}
          {probable && trajectory?.data_alvo_definida && <div className="chat-message sent"><div className="chat-bubble scenario-bubble"><small>CENÁRIO PROVÁVEL</small><strong>{probable.cobertura_estimada}% de cobertura</strong><span>estimativa até a data-alvo</span></div></div>}
          {close?.planejado > 0 && <div className="chat-message received follow-up"><div className="chat-avatar-space"/><div className="chat-bubble"><small>FECHAMENTO SEMANAL</small><strong>{close.realizado} de {close.planejado} demandas</strong><span>{close.pendencias} pendências · ajuste: {close.ajuste_proxima_semana}</span></div></div>}
          {trajectory?.risco_nao_concluir > 0 && <div className="chat-message received follow-up"><div className="chat-avatar-space"/><div className="chat-bubble priority-bubble"><small>ALERTA DE TRAJETÓRIA</small><strong>{trajectory.risco_nao_concluir}% de risco</strong><span>{trajectory.conteudo_restante} tópicos ainda precisam de domínio.</span></div></div>}
        </>}
      </div>
      {!loading && <div className="mentor-actions sketch-replies">{nextDemand && <button className="primary" onClick={() => onOpenNextDemand(nextDemand)}>Abrir próxima demanda</button>}{visibleAlerts.length > 0 && <button className="secondary" onClick={onOpenAlerts}>Abrir central de alertas</button>}<button className="secondary" onClick={onOpenWeek}>Abrir minha semana</button>{!restrictedPhase && priority?.questoes_para_revisar > 0 && <button className="secondary" onClick={() => onOpenQuestions(priority)}>Revisar questões</button>}{!restrictedPhase && priority?.cards_vencidos > 0 && <button className="secondary" onClick={() => onOpenCards(priority)}>Revisar Question Cards</button>}</div>}
      <footer><span>Direcionamento baseado em rotina, desempenho e recência.</span><i aria-label="Gemini desativado">IA desativada</i></footer>
    </section>}
    <button className="mentor-trigger" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Fechar mentor' : 'Abrir mentor'} aria-expanded={open}><img src={avatar} alt=""/><span aria-hidden="true"/>{visibleAlerts.length > 0 && <b className="mentor-alert-count">{visibleAlerts.length}</b>}</button>
  </aside>
}
