export default function Simulations({ objective }) {
  return (
    <section><header className="page-title"><div><p className="eyebrow">PROVAS COMPLETAS</p><h1>Simulados</h1><p>Área reservada para provas cronometradas do objetivo {objective?.nome || 'selecionado'}.</p></div></header><div className="panel module-hold"><span>◷</span><h2>Fluxo funcional ainda não definido</h2><p>O motor de questões foi preservado, mas composição, duração, correção e regras de retomada do simulado precisam ser fechadas antes da implementação.</p><small>Esta área foi restaurada sem criar comportamento fictício.</small></div></section>
  )
}
