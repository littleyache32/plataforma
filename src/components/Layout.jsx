import { useState } from 'react'
import Icon from './Icon.jsx'
import OfflineStatus from './OfflineStatus.jsx'

const groups = [
  ['', [['inicio', 'Início'], ['semana', 'Meu Plano'], ['tempo', 'Timer'], ['revisoes', 'Revisões']]],
  ['Prática', [['questoes', 'Questões'], ['cards', 'Question Cards'], ['simulados', 'Simulados']]],
  ['Análise', [['desempenho', 'Estatísticas']]],
]
export default function Layout({ area, onAreaChange, catalog, objectiveId, onObjectiveChange, context, onContextChange, children }) {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width:760px)').matches)
  const selectArea = (id) => { onAreaChange(id); if (window.matchMedia('(max-width:760px)').matches) setCollapsed(true) }
  const active = (id) => area === id || (id === 'questoes' && ['caderno', 'discursivas'].includes(area))
  const navButton = ([id, label]) => <button key={id} title={label} aria-label={label} aria-current={active(id) ? 'page' : undefined} className={active(id) ? 'active' : ''} onClick={() => selectArea(id)}><Icon name={id}/><span>{label}</span></button>
  const unified = ['inicio', 'semana', 'tempo'].includes(area)
  return <div className={`platform ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar"><button className="wordmark" title={collapsed ? 'Expandir navegação' : 'Recolher navegação'} aria-label={collapsed ? 'Expandir navegação' : 'Recolher navegação'} aria-expanded={!collapsed} aria-controls="primary-navigation" onClick={() => setCollapsed((value) => !value)}><span>ME</span><div><b>Mentor</b><small>plataforma pessoal</small></div></button>
      <nav id="primary-navigation" aria-label="Navegação principal">{groups.map(([label, items], index) => <div className="nav-section" key={index}>{label && <small>{label}</small>}{items.map(navButton)}</div>)}</nav>
    </aside>
    <section className="workspace"><header className="workspace-head"><span className="mobile-brand">ME</span><div className="workspace-controls">{!unified && <><div className="context-switch" aria-label="Contexto de estudo"><button aria-pressed={context === 'faculdade'} className={context === 'faculdade' ? 'active' : ''} onClick={() => onContextChange('faculdade')}>Faculdade</button><button aria-pressed={context === 'concurso'} className={context === 'concurso' ? 'active' : ''} onClick={() => onContextChange('concurso')}>Concurso</button></div>{catalog.length > 1 && <select aria-label="Objetivo ativo" value={objectiveId} onChange={(event) => onObjectiveChange(event.target.value)}>{catalog.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select>}</>}</div><OfflineStatus/></header>
      <main className="page">{children}</main>
    </section>
  </div>
}
