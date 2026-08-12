import { useEffect, useState } from 'react'
import Icon from './Icon.jsx'
import OfflineStatus from './OfflineStatus.jsx'

const questionsArea = { id: 'questoes', label: 'Questões', children: [['questoes', 'Objetivas'], ['caderno', 'Caderno de questões'], ['discursivas', 'Discursivas']] }
const studentAreas = [
  { id: 'semana', label: 'Semana' }, { id: 'tempo', label: 'Tempo de estudo' }, { id: 'revisoes', label: 'Revisões' }, questionsArea, { id: 'cards', label: 'Question Cards' }, { id: 'simulados', label: 'Simulados' }, { id: 'desempenho', label: 'Desempenho' },
]

const adminAreas = [
  { id: 'semana', label: 'Semana' }, { id: 'tempo', label: 'Tempo de estudo' }, { id: 'revisoes', label: 'Revisões' }, { id: 'controle', label: 'Controle operacional' }, { id: 'edital', label: 'Comparador de edital' }, { id: 'objetivos', label: 'Objetivos' }, { id: 'prazos', label: 'Provas e entregas' }, { id: 'materiais', label: 'Materiais' },
  questionsArea, { id: 'cards', label: 'Question Cards' }, { id: 'simulados', label: 'Simulados' }, { id: 'desempenho', label: 'Desempenho' },
]

export default function Layout({ area, onAreaChange, catalog, objectiveId, onObjectiveChange, context, onContextChange, mode, onModeChange, onLogout, children }) {
  const areas = mode === 'administrador' ? adminAreas : studentAreas
  const [menuOpen, setMenuOpen] = useState(false)
  const [questionsOpen, setQuestionsOpen] = useState(['questoes', 'caderno', 'discursivas'].includes(area))
  useEffect(() => {
    if (['questoes', 'caderno', 'discursivas'].includes(area)) setQuestionsOpen(true)
  }, [area])
  const selectArea = (id) => { onAreaChange(id); setMenuOpen(false) }
  const renderNavigation = () => areas.map((item) => item.children ? <div className={`nav-group ${questionsOpen ? 'open' : ''}`} key={item.id}>
    <button className={item.children.some(([id]) => id === area) ? 'active' : ''} onClick={() => setQuestionsOpen((value) => !value)} aria-expanded={questionsOpen}><i><Icon name={item.id}/></i><span>{item.label}</span><b className="nav-chevron">⌄</b></button>
    {questionsOpen && <div className="nav-children">{item.children.map(([id, label]) => <button key={id} className={area === id ? 'active' : ''} onClick={() => selectArea(id)}><i><Icon name={id === 'discursivas' ? 'discursivas' : 'questoes'}/></i><span>{label}</span></button>)}</div>}
  </div> : <button key={item.id} className={area === item.id ? 'active' : ''} onClick={() => selectArea(item.id)}><i><Icon name={item.id}/></i><span>{item.label}</span></button>)
  return <div className="platform">
    <aside className="sidebar">
      <button className="wordmark" onClick={() => selectArea('semana')}><span>ME</span><div><b>Mentor</b><small>de Estudos</small></div></button>
      <nav>{renderNavigation()}</nav>
      <div className="sidebar-foot"><button onClick={onLogout}>Encerrar sessão</button><small>Plataforma pessoal</small></div>
    </aside>
    <section className="workspace">
      <header className="workspace-head"><button className="mobile-menu-toggle" onClick={() => setMenuOpen((value) => !value)} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'} aria-expanded={menuOpen}><span/><span/><span/></button><div className="workspace-controls"><span className="mobile-brand">ME</span>{area === 'semana' ? <span className="week-overview-label">Visão geral: Faculdade + BACEN</span> : <><div className="context-switch" aria-label="Contexto de estudo"><button className={context === 'faculdade' ? 'active' : ''} onClick={() => onContextChange('faculdade')}>Faculdade</button><button className={context === 'concurso' ? 'active' : ''} onClick={() => onContextChange('concurso')}>BACEN</button></div>{catalog.length > 1 && <select aria-label="Objetivo ativo" value={objectiveId} onChange={(event) => onObjectiveChange(event.target.value)}>{catalog.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select>}</>}</div><div className="mode-switch" aria-label="Modo de uso"><button className={mode === 'aluno' ? 'active' : ''} onClick={() => onModeChange('aluno')}>Modo Aluno</button><button className={mode === 'administrador' ? 'active' : ''} onClick={() => onModeChange('administrador')}>Administrador</button></div></header>
      <div className="workspace-sync"><OfflineStatus/></div>
      <main className="page">{children}</main>
      <nav className={`mobile-nav ${menuOpen ? 'open' : ''}`}>{renderNavigation()}</nav>
    </section>
  </div>
}
