import { resolveMentorPolicy } from './mentor-policy.js'

export const MENTOR_SPECIALIST_MODULES = Object.freeze([
  'mentor_planejamento', 'mentor_trilha', 'mentor_revisao',
  'mentor_desempenho', 'mentor_academico', 'mentor_previsao',
])

const DAY_MS = 86_400_000
const dateMs = (date) => Date.parse(`${date}T12:00:00Z`)
const daysBetween = (start, end) => Math.round((dateMs(end) - dateMs(start)) / DAY_MS)
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0

function planningSignals({ history = [], context = {}, pendingCount = 0, weeklyMeeting = null, policy }) {
  const rules = resolveMentorPolicy(policy).motor_decisao
  const windows = history.filter((item) => item.inicio >= (context.inicio || context.semana_inicio || '9999-12-31') && finite(item.planejadas) >= rules.minimo_demandas_janela)
    .sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(-2)
  const latest = windows.at(-1) || null
  const adherence = latest ? finite(latest.concluidas) / finite(latest.planejadas) : null
  const consecutive = windows.length === 2 && daysBetween(windows[0].inicio, windows[1].inicio) === 7
  const twoHigh = consecutive && windows.every((item) => finite(item.concluidas) / finite(item.planejadas) >= rules.aderencia_aumento)
  const currentBacen = Math.max(rules.minimo_bacen_blocos, finite(context.carga_atual?.concurso || 3))
  const heavy = weeklyMeeting?.carga_percebida === 'pesada'
  const backlogHigh = pendingCount > rules.maximo_pendencias_aumento
  return {
    aderencia: adherence, janelas: windows, carga_atual: { bacen: currentBacen, faculdade: finite(context.carga_atual?.faculdade || 1) },
    capacidade_observada_blocos_dia: latest ? Number((finite(latest.concluidas) / 7).toFixed(2)) : null,
    demandas_perdidas: latest ? Math.max(0, finite(latest.planejadas) - finite(latest.concluidas)) : null,
    backlog: pendingCount, carga_percebida: weeklyMeeting?.carga_percebida || null, dificuldade_percebida: weeklyMeeting?.fatos?.dificuldade_nivel || null,
    possibilidades: {
      manter: true,
      aumentar: twoHigh && Boolean(weeklyMeeting?.semana_inicio) && !heavy && !backlogHigh && weeklyMeeting?.fatos?.dificuldade_nivel !== 'alta',
      reduzir: currentBacen > rules.minimo_bacen_blocos && (adherence !== null && adherence < rules.aderencia_reducao || heavy && backlogHigh),
    },
  }
}

function trailSignals({ studyUnits = [], materialProgress = [], prerequisites = [] }) {
  const progress = new Map(materialProgress.map((item) => [item.material_id, item.estado]))
  const materials = studyUnits.filter((item) => item.context === 'concurso' && item.eligible !== false)
  const bySubject = new Map()
  for (const item of materials) {
    const name = item.courseSubject || item.subject || String(item.subjectId)
    bySubject.set(name, [...(bySubject.get(name) || []), item])
  }
  const disciplinas = [...bySubject].map(([nome, list]) => {
    const ordered = [...list].sort((a, b) => finite(a.order || 9999) - finite(b.order || 9999) || String(a.name).localeCompare(String(b.name)))
    const completed = ordered.filter((item) => progress.get(item.id) === 'concluido').length
    const current = ordered.find((item) => progress.get(item.id) !== 'concluido') || null
    const next = current ? ordered[ordered.indexOf(current) + 1] || null : null
    return { nome, total: ordered.length, concluidos: completed, percentual_coberto: ordered.length ? Number((completed / ordered.length * 100).toFixed(1)) : 0,
      material_atual: current ? { id: current.id, titulo: current.name, estado: progress.get(current.id) || 'nao_iniciado' } : null,
      proxima_aula: next ? { id: next.id, titulo: next.name } : null,
      nao_iniciados: ordered.filter((item) => !progress.has(item.id)).length }
  }).sort((a, b) => a.nome.localeCompare(b.nome))
  const completed = materials.filter((item) => progress.get(item.id) === 'concluido').length
  return { total: materials.length, concluidos: completed, restantes: materials.length - completed,
    percentual_coberto: materials.length ? Number((completed / materials.length * 100).toFixed(1)) : null,
    disciplinas, prerequisitos: prerequisites.filter((item) => item?.fonte && item?.evidencia), risco_cobertura: 'UNKNOWN' }
}

function reviewSignals({ reviewItems = [], date, context = {} }) {
  const operational = context.rotina_pratica?.revisao_pratica === true && !['adaptacao_teorica_1', 'base_teorica_adaptativa'].includes(context.fase)
  const due = reviewItems.filter((item) => item.status === 'pendente' && item.agendada_para && String(item.agendada_para).slice(0, 10) <= date)
  return { operacional: operational, vencidos: due.length, urgencia: operational && due.length ? 'DUE' : 'INACTIVE', retestes: null, modalidade_recomendada: null }
}

function performanceSignals({ answers = [] }) {
  return { mastery: 'UNKNOWN', amostra_respostas: answers.length, acerto: null, confianca: null, falsa_certeza: null,
    ineditas: null, retestes: null, tendencia: null, retencao: null }
}

function academicSignals({ date, commitments = [], academicClasses = [], studiedClassIds = [] }) {
  const upcoming = commitments.filter((item) => !item.concluido && item.data >= date && ['prova', 'entrega'].includes(item.tipo))
    .sort((a, b) => a.data.localeCompare(b.data) || String(a.id).localeCompare(String(b.id)))
  const exam = upcoming.find((item) => item.tipo === 'prova') || null
  const delivery = upcoming.find((item) => item.tipo === 'entrega') || null
  const studied = new Set(studiedClassIds)
  const pendingClasses = academicClasses.filter((item) => !item.studied && !item.completed && !studied.has(item.id))
  return { proxima_prova: exam ? { id: exam.id, data: exam.data, materia_id: exam.materia_id, dias: daysBetween(date, exam.data) } : null,
    proxima_entrega: delivery ? { id: delivery.id, data: delivery.data, materia_id: delivery.materia_id, dias: daysBetween(date, delivery.data) } : null,
    aulas_dadas: academicClasses.length, aulas_estudadas: academicClasses.length - pendingClasses.length,
    conteudos_pendentes: pendingClasses.map((item) => ({ id: item.id, materia_id: item.subjectId || item.materia_id, data: item.date || item.data })) }
}

function forecastSignals({ date, context = {}, policy, trail, materialProgress = [] }) {
  const target = context.data_prova_oficial || context.data_prova_provisoria || policy?.parametros_operacionais?.data_prova_bacen_provisoria || null
  const completions = materialProgress.filter((item) => item.estado === 'concluido' && item.concluido_em)
    .map((item) => String(item.concluido_em).slice(0, 10)).filter((day) => day >= (context.inicio || '9999-12-31') && day <= date)
  const distinctDays = [...new Set(completions)]
  const observedDays = context.inicio && date >= context.inicio ? Math.max(1, daysBetween(context.inicio, date) + 1) : 0
  const pace = distinctDays.length >= 2 && observedDays >= 14 ? Number((completions.length * 7 / observedDays).toFixed(2)) : null
  const remainingDays = target && target >= date ? daysBetween(date, target) : null
  const projected = pace !== null && remainingDays !== null && trail.total > 0
    ? Math.min(100, Number(((trail.concluidos + pace * remainingDays / 7) / trail.total * 100).toFixed(1))) : null
  const risk = projected === null ? 'UNKNOWN' : projected < 100 ? 'HIGH' : 'LOW'
  return { data_referencia: target, tipo_data: context.data_prova_oficial ? 'OFICIAL' : target ? 'PROVISORIA' : 'UNKNOWN',
    ritmo_materiais_semana: pace, cobertura_projetada_percentual: projected, risco_nao_concluir: risk,
    necessidade_acelerar: risk === 'HIGH' ? trail.disciplinas.filter((item) => item.concluidos < item.total).map((item) => item.nome) : [] }
}

export function calculateMentorSpecialistSignals(input = {}) {
  const modules = input.modules || []
  const versions = Object.fromEntries(modules.map((item) => [item.modulo, item.versao]))
  const policy = resolveMentorPolicy(input.policy)
  const planning = planningSignals({ ...input, policy })
  const trail = trailSignals(input)
  const review = reviewSignals(input)
  const performance = performanceSignals(input)
  const academic = academicSignals(input)
  const forecast = forecastSignals({ ...input, policy, trail })
  trail.risco_cobertura = forecast.risco_nao_concluir
  return { planejamento: { ...planning, versao: versions.mentor_planejamento || null }, trilha: { ...trail, versao: versions.mentor_trilha || null },
    revisao: { ...review, versao: versions.mentor_revisao || null }, desempenho: { ...performance, versao: versions.mentor_desempenho || null },
    academico: { ...academic, versao: versions.mentor_academico || null }, previsao: { ...forecast, versao: versions.mentor_previsao || null } }
}
