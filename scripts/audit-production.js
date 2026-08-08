import { createClient } from '@supabase/supabase-js'
import { librarySpecs } from './acervo-specs.js'

const baseUrl = process.env.PLATFORM_URL || 'https://plataforma-three-virid.vercel.app'
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!process.env.SUPABASE_URL || !key || !process.env.APP_ACCESS_KEY) throw new Error('Ambiente local incompleto para a auditoria.')
const supabase = createClient(process.env.SUPABASE_URL, key, { auth: { persistSession: false } })

const login = await fetch(`${baseUrl}/api/auth`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: process.env.APP_ACCESS_KEY }) })
if (!login.ok) throw new Error(`Login de produção falhou: ${login.status}`)
const cookie = login.headers.get('set-cookie')?.split(';')[0]
const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { cookie, 'content-type': 'application/json', ...options.headers } })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`${path}: ${response.status} ${data.error || ''}`)
  return data
}

const [{ data: questions }, { data: cards }, { data: knowledge }, { data: objectives }] = await Promise.all([
  supabase.from('questao').select('id,tipo,alternativas,gabarito,fonte,trecho_fonte,topico_id'),
  supabase.from('question_card').select('id,fonte,trecho_fonte,topico_id'),
  supabase.from('conhecimento').select('id,origem,topico_id'),
  supabase.from('objetivo').select('id,tipo,materias:materia(id,nome)').eq('ativo', true),
])
const plannedTopics = librarySpecs.reduce((sum, item) => sum + item.topics.length, 0)
const formatErrors = (questions || []).filter((item) => item.tipo === 'CE' ? !['C', 'E'].includes(item.gabarito) || item.alternativas !== null : !['A', 'B', 'C', 'D', 'E'].includes(item.gabarito) || ['A', 'B', 'C', 'D', 'E'].some((letter) => !item.alternativas?.[letter]))
const provenanceErrors = (questions || []).filter((item) => !String(item.fonte || '').trim() || !String(item.trecho_fonte || '').trim())
const cardProvenanceErrors = (cards || []).filter((item) => !String(item.fonte || '').trim() || !String(item.trecho_fonte || '').trim())
const archiveKnowledge = (knowledge || []).filter((item) => item.origem?.startsWith('acervo-completo:'))
if (formatErrors.length || provenanceErrors.length || cardProvenanceErrors.length || archiveKnowledge.length < plannedTopics) throw new Error(`Auditoria do acervo falhou: formato=${formatErrors.length}, origem_questao=${provenanceErrors.length}, origem_card=${cardProvenanceErrors.length}, capitulos=${archiveKnowledge.length}/${plannedTopics}`)

const faculty = objectives.find((item) => item.tipo === 'faculdade')
const subject = faculty?.materias?.find((item) => item.nome === 'Teoria do Crime') || faculty?.materias?.[0]
if (!faculty || !subject) throw new Error('Faculdade ou disciplina de teste ausente.')
let commitmentId
try {
  const created = await request('/api/objetivos?recurso=compromissos', { method: 'POST', body: JSON.stringify({ objetivoId: faculty.id, materiaId: subject.id, titulo: 'Auditoria temporária do mentor', tipo: 'prova', data: '2026-08-13', peso: 5, duracaoMinutos: 120 }) })
  commitmentId = created.compromisso.id
  const plan = await request('/api/plano', { method: 'POST', body: JSON.stringify({ inicio: '2026-08-10' }) })
  const { data: sessions, error } = await supabase.from('sessao').select('id,chave_mentor,titulo,tipo,data,duracao_estimada,prioridade').in('chave_mentor', [`2026-08-10:compromisso:${commitmentId}`, `2026-08-10:preparo:${commitmentId}`])
  if (error) throw error
  const exam = sessions.find((item) => item.tipo === 'prova')
  const preparation = sessions.find((item) => item.tipo === 'revisao')
  if (!exam || exam.duracao_estimada !== 120 || exam.data !== '2026-08-13' || !preparation || preparation.data !== '2026-08-11') throw new Error('O compromisso não gerou prova e preparação corretamente.')
  console.log(JSON.stringify({ acervo: { topicos_planejados: plannedTopics, capitulos: archiveKnowledge.length, questoes: questions.length, cards: cards.length, erros_formato: formatErrors.length, erros_origem: provenanceErrors.length + cardProvenanceErrors.length }, mentor: { compromisso: 'ok', prova_minutos: exam.duracao_estimada, preparacao: preparation.data, plano: plan } }, null, 2))
} finally {
  if (commitmentId) {
    await supabase.from('sessao').delete().in('chave_mentor', [`2026-08-10:compromisso:${commitmentId}`, `2026-08-10:preparo:${commitmentId}`])
    await supabase.from('compromisso').delete().eq('id', commitmentId)
  }
}
