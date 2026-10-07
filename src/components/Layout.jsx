import { useState } from 'react'
import Icon from './Icon.jsx'
import OfflineStatus from './OfflineStatus.jsx'

const groups = [
  ['', [['semana', 'Meu Plano'], ['tempo', 'Timer'], ['revisoes', 'Revisões']]],
  ['Prática', [['questoes', 'Questões'], ['cards', 'Question Cards'], ['simulados', 'Simulados']]],
  ['Análise', [['desempenho', 'Estatísticas']]],
]
export default function Layout({ area, onAreaChange, catalog, objectiveId, onObjectiveChange, context, onContextChange, onLogout, children }) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileMenu, setMobileMenu] = useState('')
  const selectArea = (id) => { onAreaChange(id); setMobileMenu('') }
  const active = (id) => area === id || (id === 'questoes' && ['caderno', 'discursivas'].includes(area))
  const navButton = ([id, label]) => <button key={id} title={label} aria-label={label} aria-current={active(id) ? 'page' : undefined} className={active(id) ? 'active' : ''} onClick={() => selectArea(id)}><Icon name={id}/><span>{label}</span></button>
  const unified = ['inicio', 'semana', 'tempo'].includes(area)
  return <div className={`platform ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <aside className="sidebar"><button className="wordmark" aria-label="Mentor, Meu Plano" onClick={() => selectArea('semana')}><span>ME</span><div><b>Mentor</b><small>plataforma pessoal</small></div></button>
      <button className="sidebar-toggle secondary" aria-label={collapsed ? 'Expandir sidebar' : 'Recolher sidebar'} aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>{collapsed ? '›' : '‹'}<span>{collapsed ? '' : 'Recolher'}</span></button>
      <nav aria-label="Navegação principal">{groups.map(([label, items], index) => <div className="nav-section" key={index}>{label && <small>{label}</small>}{items.map(navButton)}</div>)}</nav>
      <div className="sidebar-foot">{navButton(['inicio', 'Início'])}<button onClick={onLogout} title="Encerrar sessão" aria-label="Encerrar sessão"><Icon name="controle"/><span>Sair</span></button></div>
    </aside>
    <section className="workspace"><header className="workspace-head"><span className="mobile-brand">ME</span><div className="workspace-controls">{!unified && <><div className="context-switch" aria-label="Contexto de estudo"><button aria-pressed={context === 'faculdade'} className={context === 'faculdade' ? 'active' : ''} onClick={() => onContextChange('faculdade')}>Faculdade</button><button aria-pressed={context === 'concurso'} className={context === 'concurso' ? 'active' : ''} onClick={() => onContextChange('concurso')}>Concurso</button></div>{catalog.length > 1 && <select aria-label="Objetivo ativo" value={objectiveId} onChange={(event) => onObjectiveChange(event.target.value)}>{catalog.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select>}</>}</div><OfflineStatus/></header>
      <main className="page">{children}</main>
      {mobileMenu && <nav className="mobile-sheet" aria-label={mobileMenu === 'pratica' ? 'Prática' : 'Mais'}>{(mobileMenu === 'pratica' ? groups[1][1] : [['tempo', 'Timer'], ['desempenho', 'Estatísticas'], ['inicio', 'Início']]).map(navButton)}<button onClick={() => setMobileMenu('')}>Fechar</button></nav>}
      <nav className="mobile-bottom" aria-label="Navegação mobile">{navButton(['semana', 'Plano'])}{navButton(['revisoes', 'Revisar'])}<button aria-expanded={mobileMenu === 'pratica'} onClick={() => setMobileMenu((value) => value === 'pratica' ? '' : 'pratica')}><Icon name="questoes"/><span>Praticar</span></button><button aria-expanded={mobileMenu === 'mais'} onClick={() => setMobileMenu((value) => value === 'mais' ? '' : 'mais')}><Icon name="controle"/><span>Mais</span></button></nav>
    </section>
  </div>
}
