import { resolveMentorPolicy } from './mentor-policy.js'

export const MENTOR_STATES = Object.freeze({
  ADAPTACAO_1: 'ADAPTACAO_1',
  ADAPTACAO_2: 'ADAPTACAO_2',
  BASE_TEORICA: 'BASE_TEORICA',
  TRANSICAO_PRATICA: 'TRANSICAO_PRATICA',
  PRATICA_PROGRESSIVA: 'PRATICA_PROGRESSIVA',
  BASE_CONCLUIDA: 'BASE_CONCLUIDA',
})

const EXPLANATIONS = Object.freeze({
  ADAPTATION_STAGE: 'A carga desta etapa de adaptação permanece fixa.',
  LOW_ADHERENCE: 'A aderência recente ficou abaixo do limiar operacional; o Mentor avalia reduzir um bloco BACEN.',
  STABLE_LOAD: 'A carga foi mantida até existir evidência suficiente para outro ajuste.',
  LOAD_INCREASE_ELIGIBLE: 'Duas janelas consecutivas sustentam aumento de um bloco BACEN.',
  HEAVY_SELF_REPORTED_LOAD: 'A carga foi percebida como pesada e não será aumentada.',
  EXAM_NEAR: 'Uma prova próxima direciona o bloco acadêmico existente.',
  DELIVERY_NEAR: 'Uma entrega próxima direciona o bloco acadêmico existente.',
  HIGH_INCIDENCE: 'A incidência comprovada aumenta a prioridade do conteúdo.',
  CURRICULUM_GAP: 'Ainda há material curricular elegível a cobrir.',
  PREREQUISITE: 'Um pré-requisito registrado precisa ser respeitado.',
  MATERIAL_IN_PROGRESS: 'O material em andamento continua antes do próximo PDF.',
  BACKLOG: 'Conteúdo pendente retorna à fila sem criar bloco extra.',
  LOW_PRIORITY: 'Conteúdo de menor prioridade cede espaço nesta seleção, sem sair do currículo.',
  UNKNOWN_MASTERY: 'Tempo estudado e aula concluída não comprovam domínio.',
  BASE_COMPLETED_PENDING_TRANSITION: 'A base está coberta, mas a prática aguarda autorização de fase futura.',
  NO_COVERAGE_BENEFIT: 'Sem material elegível restante, aumentar teoria não traz cobertura adicional.',
  FIRST_HIGH_WINDOW: 'Uma janela de alta aderência ainda não sustenta aumento.',
  INSUFFICIENT_HISTORY: 'Ainda não há janelas completas suficientes para mudar a carga.',
  UNSUSTAINABLE_BACKLOG: 'O acúmulo impede aumentar a carga.',
  INSUFFICIENT_AVAILABILITY: 'A disponibilidade informada não comporta mais um bloco diário.',
  MINIMUM_LOAD: 'A carga BACEN já está no mínimo operacional e não pode ser reduzida neste ciclo.',
})

export function explainMentorReasons(reasonCodes = []) {
  return reasonCodes.map((code) => EXPLANATIONS[code]).filter(Boolean).join(' ')
}

export function mentorCycleState(date, context = {}) {
  if (!['adaptacao_teorica_1', 'base_teorica_adaptativa'].includes(context.fase)) return null
  if (date < (context.inicio || context.semana_inicio || context.vigente_desde)) return null
  if (date <= context.fim_etapa_1) return MENTOR_STATES.ADAPTACAO_1
  if (date <= context.fim_etapa_2) return MENTOR_STATES.ADAPTACAO_2
  return MENTOR_STATES.BASE_TEORICA
}

export function classifyMentorPriority({ incidence, incidenceEvidence = false, prerequisiteReady = true, materialInProgress = false, backlog = false, lowPriority = false } = {}) {
  const reasons = []
  if (prerequisiteReady === false) reasons.push('PREREQUISITE')
  if (incidenceEvidence && incidence === 'alta') reasons.push('HIGH_INCIDENCE')
  if (materialInProgress) reasons.push('MATERIAL_IN_PROGRESS')
  if (backlog) reasons.push('BACKLOG')
  if (lowPriority) reasons.push('LOW_PRIORITY')
  return reasons
}

function completeWindows(history = [], minimumDemands = 5) {
  return history.filter((week) => week.inicio && Number(week.planejadas) >= minimumDemands)
    .map((week) => ({ ...week, rate: Number(week.planejadas) > 0 ? Number(week.concluidas || 0) / Number(week.planejadas) : 0 }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(-2)
}

export function decideMentorCycle({ date, cycleKey = date, context = {}, history = [], weeklyMeeting = null, curriculum = {}, commitments = [], pendingCount = 0, availability = context.disponibilidade || {}, policy: customPolicy = {} }) {
  const policy = resolveMentorPolicy(customPolicy).motor_decisao
  const state = mentorCycleState(date, context)
  if (!state) return null
  const currentBacen = Math.max(policy.minimo_bacen_blocos, Number(context.carga_atual?.concurso || 3))
  const stageBacen = state === MENTOR_STATES.ADAPTACAO_1 ? Number(context.etapa_1?.concurso || 2)
    : state === MENTOR_STATES.ADAPTACAO_2 ? Number(context.etapa_2?.concurso || 3) : null
  const windows = completeWindows(history.filter((week) => week.inicio >= (context.inicio || context.semana_inicio)), policy.minimo_demandas_janela)
  const latest = windows.at(-1)
  const consecutive = windows.length === 2 && (Date.parse(`${windows[1].inicio}T12:00:00Z`) - Date.parse(`${windows[0].inicio}T12:00:00Z`)) === 7 * 86_400_000
  const twoHigh = consecutive && windows.every((week) => week.rate >= policy.aderencia_aumento)
  const heavy = weeklyMeeting?.carga_percebida === 'pesada'
  const remaining = Number.isFinite(Number(curriculum.remaining)) ? Number(curriculum.remaining) : null
  const highBacklog = pendingCount > policy.maximo_pendencias_aumento
  const reasonCodes = []
  let action = 'manter'
  let bacenBlocks = stageBacen ?? currentBacen
  if (stageBacen !== null) reasonCodes.push('ADAPTATION_STAGE')
  else if (context.ultima_avaliacao_semana === cycleKey) reasonCodes.push('STABLE_LOAD')
  else if (!latest) reasonCodes.push('INSUFFICIENT_HISTORY', 'STABLE_LOAD')
  else if (latest.rate < policy.aderencia_reducao) {
    bacenBlocks = Math.max(policy.minimo_bacen_blocos, currentBacen - 1)
    action = bacenBlocks < currentBacen ? 'reduzir' : 'manter'
    reasonCodes.push('LOW_ADHERENCE', ...(action === 'manter' ? ['MINIMUM_LOAD'] : []))
  } else if (heavy && highBacklog) {
    bacenBlocks = Math.max(policy.minimo_bacen_blocos, currentBacen - 1)
    action = bacenBlocks < currentBacen ? 'reduzir' : 'manter'
    reasonCodes.push('HEAVY_SELF_REPORTED_LOAD', 'BACKLOG', ...(action === 'manter' ? ['MINIMUM_LOAD'] : []))
  } else if (heavy) reasonCodes.push('HEAVY_SELF_REPORTED_LOAD', 'STABLE_LOAD')
  else if (highBacklog) reasonCodes.push('UNSUSTAINABLE_BACKLOG', 'BACKLOG', 'STABLE_LOAD')
  else if (!twoHigh) reasonCodes.push(latest.rate >= policy.aderencia_aumento ? 'FIRST_HIGH_WINDOW' : 'STABLE_LOAD')
  else if (remaining === 0) reasonCodes.push('NO_COVERAGE_BENEFIT', 'STABLE_LOAD')
  else if (remaining === null) reasonCodes.push('INSUFFICIENT_HISTORY', 'STABLE_LOAD')
  else if (availability.max_blocos_dia != null && Number.isFinite(Number(availability.max_blocos_dia)) && Number(availability.max_blocos_dia) < currentBacen + 2) reasonCodes.push('INSUFFICIENT_AVAILABILITY', 'STABLE_LOAD')
  else {
    action = 'aumentar'
    bacenBlocks = currentBacen + 1
    reasonCodes.push('LOAD_INCREASE_ELIGIBLE', 'CURRICULUM_GAP')
  }
  if (pendingCount > 0 && !reasonCodes.includes('BACKLOG')) reasonCodes.push('BACKLOG')
  if (curriculum.baseComplete === true && remaining === 0) reasonCodes.push('BASE_COMPLETED_PENDING_TRANSITION')
  const nextCommitment = commitments.filter((item) => !item.concluido && item.data >= date && ['prova', 'entrega'].includes(item.tipo)).sort((a, b) => a.data.localeCompare(b.data))[0]
  if (nextCommitment && nextCommitment.data <= new Date(Date.parse(`${date}T12:00:00Z`) + 2 * 86_400_000).toISOString().slice(0, 10)) reasonCodes.push(nextCommitment.tipo === 'prova' ? 'EXAM_NEAR' : 'DELIVERY_NEAR')
  reasonCodes.push('UNKNOWN_MASTERY')
  return { state, action, bacenBlocks, facultyBlocks: 1, mastery: 'UNKNOWN', windows: windows.map((week) => ({ inicio: week.inicio, planejadas: week.planejadas, concluidas: week.concluidas, aderencia: Number(week.rate.toFixed(4)) })), reason_codes: [...new Set(reasonCodes)], explanation: explainMentorReasons([...new Set(reasonCodes)]) }
}
