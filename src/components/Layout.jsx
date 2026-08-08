import { useState } from 'react'
import Icon from './Icon.jsx'

const studentAreas = [
  ['semana', 'Semana'], ['questoes', 'Questões'], ['cards', 'Question Cards'], ['simulados', 'Simulados'], ['desempenho', 'Desempenho'],
]

const adminAreas = [
  ['semana', 'Semana'], ['objetivos', 'Objetivos'], ['prazos', 'Provas e entregas'], ['materiais', 'Materiais'],
  ['questoes', 'Questões'], ['cards', 'Question Cards'], ['simulados', 'Simulados'], ['desempenho', 'Desempenho'],
]

export default function Layout({ area, onAreaChange, catalog, objectiveId, onObjectiveChange, context, onContextChange, mode, onModeChange, onLogout, children }) {
  const areas = mode === 'administrador' ? adminAreas : studentAreas
  const [menuOpen, setMenuOpen] = useState(false)
  const selectArea = (id) => { onAreaChange(id); setMenuOpen(false) }
  return <div className="platform">
    <aside className="sidebar">
      <button className="wordmark" onClick={() => selectArea('semana')}><span>ME</span><div><b>Mentor</b><small>de Estudos</small></div></button>
      <nav>{areas.map(([id, label]) => <button key={id} className={area === id ? 'active' : ''} onClick={() => selectArea(id)}><i><Icon name={id}/></i>{label}</button>)}</nav>
      <div className="sidebar-foot"><button onClick={onLogout}>Encerrar sessão</button><small>Plataforma pessoal</small></div>
    </aside>
    <section className="workspace">
      <header className="workspace-head"><button className="mobile-menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen}><span/><span/><span/></button><div className="workspace-controls"><span className="mobile-brand">ME</span>{area === 'semana' ? <span className="week-overview-label">Visão geral: Faculdade + BACEN</span> : <><div className="context-switch" aria-label="Contexto de estudo"><button className={context === 'faculdade' ? 'active' : ''} onClick={() => onContextChange('faculdade')}>Faculdade</button><button className={context === 'concurso' ? 'active' : ''} onClick={() => onContextChange('concurso')}>BACEN</button></div>{catalog.length > 1 && <select aria-label="Objetivo ativo" value={objectiveId} onChange={(event) => onObjectiveChange(event.target.value)}>{catalog.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select>}</>}</div><div className="mode-switch" aria-label="Modo de uso"><button className={mode === 'aluno' ? 'active' : ''} onClick={() => onModeChange('aluno')}>Modo Aluno</button><button className={mode === 'administrador' ? 'active' : ''} onClick={() => onModeChange('administrador')}>Administrador</button></div></header>
      <main className="page">{children}</main>
      <nav className={`mobile-nav ${menuOpen ? 'open' : ''}`}>{areas.map(([id, label]) => <button key={id} className={area === id ? 'active' : ''} onClick={() => selectArea(id)}><i><Icon name={id}/></i><span>{label}</span></button>)}</nav>
    </section>
  </div>
}
