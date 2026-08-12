const paths = {
  semana: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
  questoes: <><circle cx="12" cy="12" r="9"/><path d="M9.7 9a2.4 2.4 0 1 1 3.7 2c-1 .7-1.4 1.2-1.4 2.5M12 17h.01"/></>,
  discursivas: <><path d="M4 20h4l11-11a2.8 2.8 0 0 0-4-4L4 16v4Z"/><path d="m13.5 6.5 4 4M4 12v-7h7"/></>,
  bloqueado: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  cards: <><rect x="3" y="6" width="15" height="13" rx="2"/><path d="m7 6 2-3h12v13l-3 2"/></>,
  simulados: <><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  desempenho: <><path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/></>,
  objetivos: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></>,
  prazos: <><rect x="4" y="5" width="16" height="16" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h3M8 17h6"/></>,
  materiais: <><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h6M9 17h6"/></>,
  controle: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="m3 7 5-3 5 4 7-5"/></>,
  tempo: <><circle cx="12" cy="13" r="8"/><path d="M12 9v5l3 2M9 2h6"/></>,
  revisoes: <><path d="M20 11a8 8 0 1 0-2 5.5M20 5v6h-6"/><path d="m9 12 2 2 4-5"/></>,
  edital: <><path d="M6 3h9l4 4v14H6zM14 3v5h5"/><path d="m9 14 2 2 4-5"/></>,
}

export default function Icon({ name }) {
  return <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.questoes}</svg>
}
