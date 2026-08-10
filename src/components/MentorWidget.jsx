import { useEffect, useState } from 'react'
import { api } from '../api.js'
import avatar from '../assets/mentor-avatar.svg'

function todayIso() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10)
}

export default function MentorWidget({ objectiveId, onOpenWeek, onOpenQuestions, onOpenCards }) {
  const [open, setOpen] = useState(false)
  const [mentor, setMentor] = useState(null)
  const [demands, setDemands] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadedFor, setLoadedFor] = useState('')

  useEffect(() => {
    if (!open || !objectiveId || loadedFor === objectiveId) return
    let active = true
    const today = todayIso()
    setLoading(true)
    Promise.all([
      api(`/api/mentor?objetivoId=${objectiveId}&compacto=1`),
      api(`/api/sessoes?inicio=${today}&fim=${today}`),
    ]).then(([mentorData, sessionData]) => {
      if (!active) return
      setMentor(mentorData)
      setDemands((sessionData.sessoes || []).filter((item) => item.status !== 'feita').sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0)))
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

  return <aside className={`mentor-widget ${open ? 'open' : ''}`}>
    {open && <section className="mentor-popover" aria-live="polite">
      <header><img src={avatar} alt="Avatar do mentor"/><div><b>Seu mentor de estudos</b><small>{mentor?.fase?.titulo || 'Direcionamento diário'}</small></div></header>
      {loading ? <div className="mentor-loading"><span></span><p>Organizando seu direcionamento...</p></div> : <>
        <div className="mentor-guidance"><span>PRÓXIMA DEMANDA</span><strong>{nextDemand?.titulo || 'Abra sua semana para ver o plano'}</strong>{nextDemand && <small>{nextDemand.materia?.nome} · {nextDemand.duracao_estimada} min</small>}</div>
        <div className="mentor-guidance"><span>FASE ATUAL</span><strong>{mentor?.fase?.titulo || 'Construção da base'}</strong><small>{mentor?.fase?.descricao || 'O mentor organiza a carga conforme sua fase de preparação.'}</small></div>
        {priority && !basePhase && <div className="mentor-guidance"><span>PRIORIDADE</span><strong>{priority.nome}</strong><small>{priority.motivo}</small></div>}
        {probable && <div className="mentor-scenario"><span>Cenário provável</span><b>{probable.cobertura_estimada}%</b><small>de cobertura estimada até a data-alvo</small></div>}
        <div className="mentor-actions">
          <button className="primary" onClick={onOpenWeek}>Abrir minha semana</button>
          {!basePhase && priority?.questoes_para_revisar > 0 && <button className="secondary" onClick={() => onOpenQuestions(priority)}>Revisar questões</button>}
          {!basePhase && priority?.cards_vencidos > 0 && <button className="secondary" onClick={() => onOpenCards(priority)}>Revisar Question Cards</button>}
        </div>
      </>}
      <footer>O direcionamento usa sua rotina, desempenho, recência e revisões. O Gemini permanece desativado.</footer>
    </section>}
    <button className="mentor-trigger" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Fechar mentor' : 'Abrir mentor'} aria-expanded={open}><img src={avatar} alt=""/></button>
  </aside>
}
