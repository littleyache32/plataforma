import { useEffect, useState } from 'react'
import { api } from '../api.js'
import avatar from '../assets/mentor-avatar.svg'

const panels = [
  ['resumo', 'Resumo'],
  ['alertas', 'Alertas'],
  ['progresso', 'Progresso'],
  ['encontro', 'Encontro'],
]

const meetingSignals = [
  ['dificuldade_conteudo', 'Dificuldade com conteúdo'],
  ['dificuldade_volume', 'Dificuldade com volume'],
  ['dificuldade_questoes', 'Dificuldade com questões'],
  ['dificuldade_revisao', 'Dificuldade com revisão'],
  ['problema_material', 'Problema no material'],
  ['estrategia_funcionou', 'Estratégia funcionou'],
]

const facultyStatus = (classifications = []) => classifications.includes('faculdade_em_dia') ? 'em_dia' : classifications.includes('faculdade_atrasada') ? 'atrasada' : 'nao_informado'

export default function MentorWidget({ objectiveId, onOpenQuestions, onOpenCards }) {
  const [open, setOpen] = useState(false)
  const [mentor, setMentor] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadedFor, setLoadedFor] = useState('')
  const [activePanel, setActivePanel] = useState('resumo')
  const [meetingMessage, setMeetingMessage] = useState('')
  const [meeting, setMeeting] = useState({ cargaPercebida: '', observacoes: '', classificacoes: [] })

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
    setMeeting({ cargaPercebida: saved.carga_percebida || '', observacoes: saved.observacoes || '', classificacoes: saved.classificacoes || [] })
  }, [mentor?.encontro_semanal])

  async function saveMeeting(event) {
    event.preventDefault()
    setMeetingMessage('Salvando encontro...')
    try {
      const result = await api('/api/mentor', { method: 'POST', body: JSON.stringify({ semanaInicio: mentor?.semana_atual, ...meeting }) })
      setMentor((current) => ({ ...current, encontro_semanal: result.encontro_semanal }))
      setMeetingMessage('Encontro registrado. O mentor considerará estas informações na próxima semana.')
    } catch (error) {
      setMeetingMessage(error.message)
    }
  }

  function setFacultyStatus(status) {
    setMeeting((current) => ({
      ...current,
      classificacoes: [...current.classificacoes.filter((item) => !['faculdade_atrasada', 'faculdade_em_dia'].includes(item)), ...(status === 'em_dia' ? ['faculdade_em_dia'] : status === 'atrasada' ? ['faculdade_atrasada'] : [])],
    }))
  }

  const priority = mentor?.prioridades?.[0]
  const probable = mentor?.cenarios?.find((item) => item.cenario === 'provavel')
  const basePhase = mentor?.fase?.id === 'construcao_base'
  const cardsReleased = mentor?.cards_liberados === true
  const restrictedPhase = basePhase || !cardsReleased
  const close = mentor?.fechamento_semanal
  const trajectory = mentor?.trajetoria
  const decision = mentor?.decisao_mentor
  const alerts = mentor?.alertas || []
  const visibleAlerts = cardsReleased ? alerts : alerts.filter((alert) => !/card/i.test(`${alert.tipo} ${alert.titulo} ${alert.mensagem}`))
  const summary = mentor?.resumo || {}
  const adherence = close?.planejado > 0 ? Math.round((close.realizado / close.planejado) * 100) : null

  return <aside className={`mentor-widget ${open ? 'open' : ''}`}>
    {open && <section className={`mentor-popover sketch-chat ${activePanel === 'encontro' ? 'meeting-open' : ''}`} aria-live="polite">
      <header className="sketch-chat-head">
        <div className="sketch-avatar"><img src={avatar} alt="Avatar do mentor"/><i aria-hidden="true"/></div>
        <div><b>Mentor de estudos</b><small><span className="online-dot"/> orientação disponível</small></div>
      </header>

      <nav className="mentor-panel-tabs" aria-label="Opções do mentor">
        {panels.map(([id, label]) => <button key={id} type="button" className={activePanel === id ? 'active' : ''} aria-pressed={activePanel === id} onClick={() => setActivePanel(id)}>
          {label}{id === 'alertas' && visibleAlerts.length > 0 ? <b>{visibleAlerts.length}</b> : null}
        </button>)}
      </nav>

      {loading ? <div className="sketch-chat-flow"><div className="typing-message"><img src={avatar} alt=""/><span><i/><i/><i/></span></div></div> : <>
        {activePanel === 'resumo' && <div className="mentor-panel-content">
          <div className="mentor-summary-grid">
            <article><small>AVISOS</small><strong>{visibleAlerts.length}</strong><span>{visibleAlerts.length === 1 ? 'item para acompanhar' : 'itens para acompanhar'}</span></article>
            <article><small>REVISÕES</small><strong>{summary.revisoes_imediatas || 0}</strong><span>prioridade imediata</span></article>
            <article><small>ESTÁVEIS</small><strong>{summary.topicos_cobertos || 0}<i>/{summary.topicos_totais || 0}</i></strong><span>tópicos com amostra e estabilidade</span></article>
            <article><small>ADERÊNCIA</small><strong>{adherence === null ? '...' : `${adherence}%`}</strong><span>último fechamento</span></article>
          </div>
          <div className="chat-message received"><img src={avatar} alt=""/><div className="chat-bubble"><small>LEITURA DO MENTOR</small><strong>{visibleAlerts.length ? 'Há pontos que merecem atenção' : 'Nenhum risco urgente agora'}</strong><span>{visibleAlerts[0]?.mensagem || 'Continue executando as demandas planejadas. O mentor atualizará a leitura com seus resultados.'}</span></div></div>
        </div>}

        {activePanel === 'alertas' && <div className="mentor-panel-content">
          <div className="sketch-chat-flow mentor-alert-flow">
            {visibleAlerts.length === 0 && <div className="chat-message received"><img src={avatar} alt=""/><div className="chat-bubble"><small>CENTRAL DE ALERTAS</small><strong>Nenhum alerta ativo</strong><span>Revisões, pendências, prazos, falsa certeza e riscos aparecerão aqui.</span></div></div>}
            {visibleAlerts.map((alert, index) => <div className="chat-message received follow-up" key={`${alert.tipo}-${index}`}><div className="chat-avatar-space"/><div className={`chat-bubble ${alert.gravidade === 'alta' ? 'priority-bubble' : ''}`}><small>{alert.gravidade === 'alta' ? 'ATENÇÃO' : 'ALERTA DO MENTOR'}</small><strong>{alert.titulo}</strong><span>{alert.mensagem}</span></div></div>)}
          </div>
          <div className="mentor-actions sketch-replies">
            {!restrictedPhase && priority?.questoes_para_revisar > 0 && <button className="secondary" onClick={() => onOpenQuestions(priority)}>Revisar questões</button>}
            {!restrictedPhase && priority?.cards_vencidos > 0 && <button className="secondary" onClick={() => onOpenCards(priority)}>Revisar Question Cards</button>}
          </div>
        </div>}

        {activePanel === 'progresso' && <div className="mentor-panel-content mentor-progress">
          {decision && <section><small>DECISÃO DO MENTOR</small><strong>{decision.action === 'aumentar' ? 'Carga elegível para aumento' : decision.action === 'reduzir' ? 'Carga ajustada para baixo' : 'Carga mantida'}</strong><span>{decision.explanation}</span></section>}
          <section><small>FECHAMENTO SEMANAL</small><strong>{close?.planejado > 0 ? `${close.realizado} de ${close.planejado} demandas` : 'Ainda sem fechamento'}</strong><span>{close?.planejado > 0 ? `${close.pendencias} pendências · ${close.minutos_realizados || 0} minutos realizados` : 'O primeiro resultado aparecerá após uma semana de uso.'}</span></section>
          <section><small>PRIORIDADE DE CORREÇÃO</small><strong>{priority && !restrictedPhase ? priority.nome : 'Nenhuma prioridade liberada'}</strong><span>{priority && !restrictedPhase ? priority.motivo : 'O mentor aguardará dados suficientes e conteúdos liberados.'}</span></section>
          <section><small>TRAJETÓRIA ATÉ A PROVA</small><strong>{trajectory?.data_alvo_definida && probable ? `${probable.cobertura_estimada}% de cobertura provável` : 'Projeção em calibração'}</strong><span>{trajectory?.data_alvo_definida ? `${trajectory.conteudo_restante} tópicos restantes${trajectory.data_provisoria ? ' · data provisória até o edital' : ''}` : 'A projeção será atualizada com os dados de estudo.'}</span></section>
        </div>}

        {activePanel === 'encontro' && <form className="mentor-weekly-meeting" onSubmit={saveMeeting}>
          <div><h3>Encontro semanal</h3><p>Informe fatos da semana. O Mentor decide prioridades, estratégia e carga seguinte.</p></div>
          <label>Como ficou a carga planejada? <small>Opcional</small><select value={meeting.cargaPercebida} onChange={(event) => setMeeting((current) => ({ ...current, cargaPercebida: event.target.value }))}><option value="">Não informado</option><option value="leve">Leve</option><option value="adequada">Adequada</option><option value="pesada">Pesada</option></select></label>
          <label>A Faculdade está em dia? <small>Opcional</small><select value={facultyStatus(meeting.classificacoes)} onChange={(event) => setFacultyStatus(event.target.value)}><option value="nao_informado">Não informado</option><option value="atrasada">Ainda preciso recuperar conteúdo</option><option value="em_dia">Sim, estou em dia</option></select></label>
          <fieldset className="mentor-meeting-signals"><legend>O que marcou a semana? <small>Opcional</small></legend>{meetingSignals.map(([id, label]) => <label key={id}><input type="checkbox" checked={meeting.classificacoes.includes(id)} onChange={() => setMeeting((current) => ({ ...current, classificacoes: current.classificacoes.includes(id) ? current.classificacoes.filter((item) => item !== id) : [...current.classificacoes, id] }))}/><span>{label}</span></label>)}</fieldset>
          <label>Dificuldades, material ou exceções<textarea rows="4" maxLength="1200" value={meeting.observacoes} onChange={(event) => setMeeting((current) => ({ ...current, observacoes: event.target.value }))} placeholder="O que a plataforma não consegue saber sozinha?"/></label>
          <button className="primary" type="submit">Registrar encontro</button>{meetingMessage && <small>{meetingMessage}</small>}
        </form>}
      </>}

      <footer><span>Direcionamento baseado em rotina, desempenho e recência.</span><i aria-label="Gemini desativado">IA desativada</i></footer>
    </section>}
    <button className="mentor-trigger" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Fechar mentor' : 'Abrir mentor'} aria-expanded={open}><img src={avatar} alt=""/><span aria-hidden="true"/>{visibleAlerts.length > 0 && <b className="mentor-alert-count">{visibleAlerts.length}</b>}</button>
  </aside>
}
