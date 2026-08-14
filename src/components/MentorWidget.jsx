import { useEffect, useState } from 'react'
import { api } from '../api.js'
import avatar from '../assets/mentor-avatar.svg'

export default function MentorWidget({ objectiveId, onOpenAlerts, onOpenQuestions, onOpenCards }) {
  const [open, setOpen] = useState(false)
  const [mentor, setMentor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadedFor, setLoadedFor] = useState('')
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [meetingMessage, setMeetingMessage] = useState('')
  const [meeting, setMeeting] = useState({ cargaPercebida: 'adequada', observacoes: '' })

  useEffect(() => {
    if (!open || !objectiveId || loadedFor === objectiveId) return
    let active = true
    setLoading(true)
    api(`/api/mentor?objetivoId=${objectiveId}&compacto=1`).then((mentorData) => {
      if (!active) return
      setMentor(mentorData)
      setLoadedFor(objectiveId)
    }).catch(() => {
      if (active) setMentor(null)
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [open, objectiveId, loadedFor])

  useEffect(() => {
    const saved = mentor?.encontro_semanal
    if (!saved) return
    setMeeting({ cargaPercebida: saved.carga_percebida, observacoes: saved.observacoes || '' })
  }, [mentor?.encontro_semanal])

  async function saveMeeting(event) {
    event.preventDefault(); setMeetingMessage('Salvando encontro...')
    try {
      const result = await api('/api/mentor', { method: 'POST', body: JSON.stringify({ semanaInicio: mentor?.semana_atual, ...meeting }) })
      setMentor((current) => ({ ...current, encontro_semanal: result.encontro_semanal }))
      setMeetingMessage('Encontro registrado. O mentor considerará estas informações na próxima semana.')
    } catch (error) { setMeetingMessage(error.message) }
  }

  const priority = mentor?.prioridades?.[0]
  const probable = mentor?.cenarios?.find((item) => item.cenario === 'provavel')
  const basePhase = mentor?.fase?.id === 'construcao_base'
  const cardsReleased = Date.now() >= new Date('2026-08-17T00:00:00-03:00').getTime()
  const restrictedPhase = basePhase || !cardsReleased
  const close = mentor?.fechamento_semanal
  const trajectory = mentor?.trajetoria
  const alerts = mentor?.alertas || []
  const visibleAlerts = cardsReleased ? alerts : alerts.filter((alert) => !/card/i.test(`${alert.tipo} ${alert.titulo} ${alert.mensagem}`))

  return <aside className={`mentor-widget ${open ? 'open' : ''}`}>
    {open && <section className={`mentor-popover sketch-chat ${meetingOpen ? 'meeting-open' : ''}`} aria-live="polite">
      <header className="sketch-chat-head"><div className="sketch-avatar"><img src={avatar} alt="Avatar do mentor"/><i aria-hidden="true"/></div><div><b>Mentor de estudos</b><small><span className="online-dot"/> online · {mentor?.fase?.titulo || 'direcionamento diário'}</small></div></header>
      <div className="sketch-chat-flow">
        {visibleAlerts.slice(0, 4).map((alert, index) => <div className="chat-message received follow-up" key={`${alert.tipo}-${index}`}><div className="chat-avatar-space"/><div className={`chat-bubble ${alert.gravidade === 'alta' ? 'priority-bubble' : ''}`}><small>ALERTA DO MENTOR</small><strong>{alert.titulo}</strong><span>{alert.mensagem}</span></div></div>)}
        {loading ? <div className="typing-message"><img src={avatar} alt=""/><span><i/><i/><i/></span></div> : <>
          <div className="chat-message received"><img src={avatar} alt=""/><div className="chat-bubble"><small>PAINEL DO MENTOR</small><strong>{visibleAlerts.length ? `${visibleAlerts.length} avisos para acompanhar` : 'Nenhum risco urgente agora'}</strong><span>{mentor?.resumo?.revisoes_imediatas || 0} revisões imediatas · {mentor?.resumo?.topicos_cobertos || 0} tópicos dominados</span></div></div>
          {priority && !restrictedPhase && <div className="chat-message received follow-up"><div className="chat-avatar-space"/><div className="chat-bubble priority-bubble"><small>PRIORIDADE</small><strong>{priority.nome}</strong><span>{priority.motivo}</span></div></div>}
          {probable && trajectory?.data_alvo_definida && <div className="chat-message sent"><div className="chat-bubble scenario-bubble"><small>CENÁRIO PROVÁVEL</small><strong>{probable.cobertura_estimada}% de cobertura</strong><span>estimativa até a data-alvo</span></div></div>}
          {close?.planejado > 0 && <div className="chat-message received follow-up"><div className="chat-avatar-space"/><div className="chat-bubble"><small>FECHAMENTO SEMANAL</small><strong>{close.realizado} de {close.planejado} demandas</strong><span>{close.pendencias} pendências · ajuste: {close.ajuste_proxima_semana}</span></div></div>}
        </>}
      </div>
      {!loading && <div className="mentor-actions sketch-replies"><button className="secondary" onClick={() => setMeetingOpen((value) => !value)}>{meetingOpen ? 'Fechar encontro semanal' : 'Encontro semanal'}</button>{visibleAlerts.length > 0 && <button className="primary" onClick={onOpenAlerts}>Abrir central de alertas</button>}{!restrictedPhase && priority?.questoes_para_revisar > 0 && <button className="secondary" onClick={() => onOpenQuestions(priority)}>Revisar questões</button>}{!restrictedPhase && priority?.cards_vencidos > 0 && <button className="secondary" onClick={() => onOpenCards(priority)}>Revisar Question Cards</button>}</div>}
      {meetingOpen && <form className="mentor-weekly-meeting" onSubmit={saveMeeting}><div><h3>Encontro semanal</h3><p>Registre as questões da semana. Sono, energia e humor não entram no cálculo do mentor.</p></div><label>Como ficou a carga planejada?<select value={meeting.cargaPercebida} onChange={(event) => setMeeting((current) => ({ ...current, cargaPercebida: event.target.value }))}><option value="leve">Leve</option><option value="adequada">Adequada</option><option value="pesada">Pesada</option></select></label><label>Questões da semana<textarea rows="4" maxLength="1200" value={meeting.observacoes} onChange={(event) => setMeeting((current) => ({ ...current, observacoes: event.target.value }))} placeholder="O que funcionou, quais dificuldades surgiram e o que precisa de atenção?"/></label><button className="primary" type="submit">Registrar encontro</button>{meetingMessage && <small>{meetingMessage}</small>}</form>}
      <footer><span>Direcionamento baseado em rotina, desempenho e recência.</span><i aria-label="Gemini desativado">IA desativada</i></footer>
    </section>}
    <button className="mentor-trigger" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Fechar mentor' : 'Abrir mentor'} aria-expanded={open}><img src={avatar} alt=""/><span aria-hidden="true"/>{visibleAlerts.length > 0 && <b className="mentor-alert-count">{visibleAlerts.length}</b>}</button>
  </aside>
}
