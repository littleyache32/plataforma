// Somente Vite local: dados sintéticos, sem backend, login real ou conexão ao Supabase.
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from '../../src/App.jsx'
import '../../src/styles.css'
import '../../src/product-theme.css'

const subjects = ['Português', 'Direito Administrativo', 'Raciocínio Lógico', 'Informática'].map((nome, index) => ({ id: `m${index}`, nome, topicos: [{ id: `t${index}`, nome: ['Ortografia e acentuação', 'Organização administrativa', 'Proposições', 'Redes de computadores'][index] }] }))
const objective = { id: 'o1', nome: 'Concurso', tipo: 'concurso', materias: subjects }
const faculty = { id: 'o2', nome: 'Faculdade', tipo: 'faculdade', materias: [{ id: 'f1', nome: 'Teoria do Crime', topicos: [] }] }
const reference = new Date(); reference.setDate(reference.getDate() - (reference.getDay() || 7) + 1)
const iso = (date) => new Intl.DateTimeFormat('en-CA').format(date)
let sessions = Array.from({ length: 21 }, (_, i) => { const day = new Date(reference); day.setDate(day.getDate() + Math.floor(i / 3)); const subject = subjects[i % subjects.length]; return { id: `s${i}`, data: iso(day), ordem: i % 3, tipo: 'estudo', status: i < 5 ? 'feita' : 'planejada', duracao_estimada: 50, prioridade: i % 4 ? 2 : 1, titulo: `Aula ${i + 1} · ${subject.topicos[0].nome}`, objetivo: objective, materia: subject, topico: subject.topicos[0], material_id: `pdf${i}` } })
// Variações estritamente sintéticas para conferir contexto e atividade no plano.
sessions = sessions.map((item, index) => index % 3 === 2 ? { ...item, objetivo: faculty, materia: faculty.materias[0], titulo: 'PDF sintético antigo', reason_codes: ['ACADEMIC_CLASS_SAME_DAY'], material: { disciplina_curso: 'Arquivo antigo não canônico' } } : { ...item, tipo: index % 5 === 1 ? 'revisao' : index % 5 === 3 ? 'exercicio' : 'estudo' })
let activeTimer = null
const history = Array.from({ length: 7 }, (_, index) => { const day = new Date(reference); day.setDate(day.getDate() + index); return { id: `h${index}`, status: 'concluido', iniciado_em: `${iso(day)}T09:00:00-03:00`, segundos: (index + 1) * 1500, materia: subjects[index % subjects.length] } })
let card = { id: 'card1', frente: 'Qual é a diferença entre órgão e entidade administrativa?', verso: 'Órgão não tem personalidade jurídica própria; entidade tem.', explicacao_curta: 'A distinção decorre da personalidade jurídica.', vencido: true, materia: subjects[1], topico: subjects[1].topicos[0], objetivo: objective, fonte: 'Fonte sintética de teste' }
const question = { id: 'q1', tipo: 'ME', enunciado: 'Assinale a alternativa que caracteriza uma entidade administrativa.', alternativas: { A: 'Unidade sem personalidade jurídica própria.', B: 'Pessoa jurídica que integra a administração.', C: 'Departamento interno de um ministério.', D: 'Divisão de um órgão.' }, topico: subjects[1].topicos[0] }
const confidence = ['sem_conhecimento', 'eliminacao', 'duvida', 'certeza'].map((id) => ({ id, total: 5, taxa: 60, acertos: 3 }))
window.fetch = async (path, options = {}) => {
  const url = new URL(path, window.location.origin)
  if (url.origin !== window.location.origin || !url.pathname.startsWith('/api/')) throw new Error('Fixture bloqueia conexões externas e APIs não sintéticas.')
  const body = options.body ? JSON.parse(options.body) : {}
  let data = {}
  if (url.pathname === '/api/auth') data = { authenticated: true }
  if (url.pathname === '/api/catalogo') data = url.searchParams.has('recurso') ? { totais: { questoes: 20, cards: 12 }, topicos: Object.fromEntries(subjects.map((s) => [s.topicos[0].id, { questoes: 5, cards: 3 }])) } : { objetivos: [objective, faculty] }
  if (url.pathname === '/api/sessoes') { if (options.method === 'PATCH') { if (body.id) sessions = sessions.map((s) => s.id === body.id ? { ...s, status: body.status } : s); else sessions = sessions.map((s) => body.orderedIds.includes(s.id) ? { ...s, data: body.data, ordem: body.orderedIds.indexOf(s.id) } : s) }; data = { sessoes: sessions } }
  if (url.pathname === '/api/tempo') {
    if (options.method === 'POST' && !body.acaoDescanso) activeTimer = { id: 'timer1', sessao_id: body.sessaoId, titulo: body.titulo, status: 'rodando', segundos_acumulados: 0, retomado_em: new Date().toISOString(), duracao_alvo_segundos: body.duracaoAlvoSegundos }
    if (options.method === 'PATCH') activeTimer = body.acao === 'concluir' ? null : { ...activeTimer, status: body.acao === 'pausar' ? 'pausado' : 'rodando' }
    data = { ativo: activeTimer, timer: activeTimer, historico: history, resumo: { hoje: 3000, semana: 15000, planejado_semana: 63000, disciplinas: [], atividades: [] } }
  }
  if (url.pathname === '/api/mentor') data = { prioridades: [], revisao_imediata: [], resumo: { dominio: 'UNKNOWN' }, avaliacao_mentor_v2: { explicacao: 'Continuidade curricular com prioridade estrutural do concurso.', carga_semanal: { carga_observada: { demandas: 21, minutos: 1050 }, sinais: { execucao: { demandas_concluidas: 5 } } } }, alertas: [{ titulo: 'Continuidade curricular', mensagem: 'O material em andamento permanece na sequência.' }] }
  if (url.pathname === '/api/revisoes') { const now = new Date(); data = { itens: [{ id: 'r1', item_id: 'q1', tipo: 'questao', titulo: 'Órgão ou entidade?', materia: 'Direito Administrativo', topico: 'Organização administrativa', motivo: 'erro com certeza', agendada_para: now.toISOString() }] } }
  if (url.pathname === '/api/pratica') data = options.method === 'POST' ? { resultado: body.resposta === 'B' ? 'acerto' : 'erro', gabarito: 'B', explicacao: 'Entidades têm personalidade jurídica própria.', comentarios_alternativas: { A: 'Confunde entidade com órgão.', B: 'A personalidade jurídica distingue a entidade.', C: 'Um departamento é órgão.', D: 'Uma divisão é órgão.' }, proxima_revisao: new Date().toISOString() } : { questao: question, disponiveis: 20 }
  if (url.pathname === '/api/questoes') { if (options.method === 'PATCH') card = null; data = { cards: card ? [card] : [], total: 12, vencidos: card ? 1 : 0, novos: 0 } }
  if (url.pathname === '/api/placar') data = { questoes: { total: 20, acertos: 12, acerto_bruto: 60, acerto_com_certeza: 15, falsa_certeza: 10, tempo_medio: 75, confianca: confidence, evolucao: [], materias: [], topicos: [], ritmo: [] } }
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
createRoot(document.getElementById('root')).render(<App/>);
