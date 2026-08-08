import { useEffect, useState } from 'react'
import { api } from '../api.js'
import avatar from '../assets/mentor-avatar.svg'

export default function MentorWidget({ objectiveId }) {
  const [open, setOpen] = useState(false)
  const [mentor, setMentor] = useState(null)

  useEffect(() => {
    if (!objectiveId) return
    api(`/api/mentor?objetivoId=${objectiveId}`).then(setMentor).catch(() => setMentor(null))
  }, [objectiveId])

  const priority = mentor?.prioridades?.[0]
  return <aside className={`mentor-widget ${open ? 'open' : ''}`}>
    {open && <section className="mentor-popover" aria-live="polite">
      <header><img src={avatar} alt="Avatar do mentor"/><div><b>Seu mentor</b><small>{mentor?.politica?.versao || 'Analisando sua evolução'}</small></div></header>
      {priority ? <><p>Prioridade atual</p><strong>{priority.nome}</strong><small>{priority.motivo || 'Reforço definido pelo seu desempenho recente.'}</small></> : <><p>Diagnóstico atual</p><strong>Coletando evidências</strong><small>Continue respondendo questões para o direcionamento ganhar precisão.</small></>}
      <footer>Conversa com o mentor em preparação.</footer>
    </section>}
    <button className="mentor-trigger" onClick={() => setOpen((value) => !value)} aria-label={open ? 'Fechar mentor' : 'Abrir mentor'} aria-expanded={open}><img src={avatar} alt=""/></button>
  </aside>
}
