const areas = [
  ['semana', 'Semana', '◫'], ['objetivos', 'Objetivos', '◎'], ['materiais', 'Materiais', '▤'],
  ['questoes', 'Questões', '?'], ['simulados', 'Simulados', '◷'], ['desempenho', 'Desempenho', '↗'],
]

export default function Layout({ area, onAreaChange, catalog, objectiveId, onObjectiveChange, onLogout, children }) {
  return (
    <div className="platform">
      <aside className="sidebar">
        <button className="wordmark" onClick={() => onAreaChange('semana')}><span>ME</span><div><b>Mentor</b><small>de Estudos</small></div></button>
        <nav>{areas.map(([id, label, icon]) => <button key={id} className={area === id ? 'active' : ''} onClick={() => onAreaChange(id)}><i>{icon}</i>{label}</button>)}</nav>
        <div className="sidebar-foot"><button onClick={onLogout}>Encerrar sessão</button><small>Plataforma pessoal</small></div>
      </aside>
      <section className="workspace">
        <header className="workspace-head"><div><span className="mobile-brand">ME</span><select value={objectiveId} onChange={(event) => onObjectiveChange(event.target.value)}>{catalog.map((item) => <option value={item.id} key={item.id}>{item.nome}</option>)}</select></div><span className="session-chip">Sessão protegida</span></header>
        <main className="page">{children}</main>
        <nav className="mobile-nav">{areas.map(([id, label, icon]) => <button key={id} className={area === id ? 'active' : ''} onClick={() => onAreaChange(id)}><i>{icon}</i><small>{label}</small></button>)}</nav>
      </section>
    </div>
  )
}
