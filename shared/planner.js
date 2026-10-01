import { resolveMentorPolicy } from './mentor-policy.js'
export { completedMaterialIdsFromProgress } from './material-progress.js'

const DAY_MS = 86_400_000
export const MENTORSHIP_START = '2026-08-17'
export const ACTIVE_PLANNING_START = '2026-09-21'
export const NEW_CYCLE_START = '2026-10-02'
const NEW_CYCLE_STAGE_1_END = '2026-10-08'
const NEW_CYCLE_STAGE_2_END = '2026-10-15'
const MAX_BLOCKS_BY_WEEKDAY = [4, 9, 9, 9, 9, 9, 5]

export function dailyCapacity(date, scheduledBlocks = 0) {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay()
  return {
    academicAvailability: weekday >= 1 && weekday <= 4 ? 'CLASS_DAY' : 'NON_CLASS_DAY',
    scheduled_blocks: scheduledBlocks,
    max_blocks: MAX_BLOCKS_BY_WEEKDAY[weekday],
  }
}

export function equivalentActiveDemand(candidate, existing = []) {
  return existing.find((item) => item.status !== 'cancelada' && item.data === candidate.data
    && item.tipo === candidate.tipo && item.objetivo_id === candidate.objetivo_id
    && item.materia_id === candidate.materia_id && item.material_id === candidate.material_id
    && Number(item.ordem) === Number(candidate.ordem)
    && (candidate.material_id || item.titulo === candidate.titulo)) || null
}

export function newCycleStage(date, menteeContext) {
  if (menteeContext?.fase !== 'adaptacao_teorica_1' || date < (menteeContext.inicio || menteeContext.semana_inicio || NEW_CYCLE_START)) return null
  if (date <= (menteeContext.fim_etapa_1 || NEW_CYCLE_STAGE_1_END)) return { concurso: Number(menteeContext.etapa_1?.concurso || 2), faculdade: Number(menteeContext.etapa_1?.faculdade || 1), duration: 50 }
  if (date <= (menteeContext.fim_etapa_2 || NEW_CYCLE_STAGE_2_END)) return { concurso: Number(menteeContext.etapa_2?.concurso || 3), faculdade: Number(menteeContext.etapa_2?.faculdade || 1), duration: 50 }
  return null
}

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function pick(items, index) {
  return items.length ? items[index % items.length] : null
}

function pickDistributed(items, index) {
  const groups = [...items.reduce((map, item) => map.set(item.subjectId, [...(map.get(item.subjectId) || []), item]), new Map()).values()]
  const group = pick(groups, index)
  return group ? pick(group, index) : null
}

function pickSequentiallyDistributed(items, index) {
  const groups = [...items.reduce((map, item) => map.set(item.subjectId, [...(map.get(item.subjectId) || []), item]), new Map()).values()]
  if (!groups.length) return null
  const group = groups[index % groups.length]
  return group[Math.floor(index / groups.length) % group.length]
}

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

export function allowsQuestionCards(target) {
  return !(target.context === 'faculdade' && normalized(target.subject).includes('analise e producao de texto'))
}

export function canGenerateMentorWeek({ weekStart, today }) {
  if (weekStart < ACTIVE_PLANNING_START) return false
  const start = new Date(`${weekStart}T12:00:00Z`)
  const end = new Date(start); end.setUTCDate(end.getUTCDate() + 6)
  const current = new Date(`${today}T12:00:00Z`)
  if (today < '2026-08-16') return false
  if (current >= start && current <= end) return true
  const tomorrow = new Date(current); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return current.getUTCDay() === 0 && isoDate(tomorrow) === weekStart
}

export function adherenceAdjustment(history = [], weeklyMeeting = null) {
  const measured = history
    .filter((week) => Number(week.planejadas) >= 5)
    .map((week) => ({
      ...week,
      taxa: Number(week.minutos_planejados) > 0
        ? Number(week.minutos_concluidos || 0) / Number(week.minutos_planejados)
        : Number(week.concluidas || 0) / Number(week.planejadas),
    }))
    .slice(-2)
  if (!measured.length) {
    if (weeklyMeeting?.carga_percebida === 'pesada') return { nivel: 'reduzir', motivo: 'encontro_semanal_indica_sobrecarga', semanas: [] }
    return { nivel: 'manter', motivo: 'coletando_aderencia', semanas: [] }
  }
  const recent = measured[measured.length - 1]
  if (recent.taxa < 0.7) return { nivel: 'reduzir', motivo: 'aderencia_abaixo_de_70', semanas: measured }
  if (weeklyMeeting?.carga_percebida === 'pesada') return { nivel: 'reduzir', motivo: 'encontro_semanal_indica_sobrecarga', semanas: measured }
  if (Number(recent.pendencias || 0) > 3) return { nivel: 'manter', motivo: 'acumulo_impede_aumento', semanas: measured }
  if (measured.length === 2 && measured.every((week) => week.taxa >= 0.85)) {
    const capacityDemonstrated = measured.every((week) => Number(week.media_real_segunda_sexta || 0) >= Number(week.media_segunda_sexta || 0) + 30)
    if (!capacityDemonstrated) return { nivel: 'manter', motivo: 'tempo_real_nao_sustenta_aumento', semanas: measured }
    return { nivel: 'aumentar', motivo: 'aderencia_acima_de_85_por_duas_semanas', semanas: measured }
  }
  return { nivel: 'manter', motivo: 'aderencia_sustentavel', semanas: measured }
}

export function weeklyLoadProfile(weekStart, history = [], customPolicy = {}, weeklyMeeting = null, menteeContext = null) {
  const policy = resolveMentorPolicy(customPolicy)
  if (menteeContext?.fase === 'adaptacao_teorica_1' && weekStart >= '2026-10-12') {
    const recent = history.filter((week) => week.inicio >= NEW_CYCLE_START)
    const adjustment = adherenceAdjustment(recent, weeklyMeeting)
    const previousBlocks = Math.max(2, Number(menteeContext?.carga_atual?.concurso || 3))
    const change = adjustment.nivel === 'aumentar' ? 1 : adjustment.nivel === 'reduzir' ? -1 : 0
    const daily = (Math.max(2, previousBlocks + change) + 1) * 50
    return { segunda_sexta: daily, sabado: daily, domingo: daily, nivel: adjustment.nivel, motivo: adjustment.motivo }
  }
  if (menteeContext?.fase === 'construcao_habito_base_teorica' && weekStart >= menteeContext.semana_inicio) {
    const block = Number(menteeContext.carga_atual?.minutos_bloco || 50)
    const base = Number(menteeContext.carga_atual?.blocos_dia || 3) * block
    const recent = history.filter((week) => week.inicio >= menteeContext.semana_inicio && Number(week.planejadas) >= 5).slice(-2)
    const sustained = recent.length === 2 && recent.every((week) => {
      const rate = Number(week.minutos_planejados) > 0
        ? Number(week.minutos_concluidos || 0) / Number(week.minutos_planejados)
        : Number(week.concluidas || 0) / Number(week.planejadas)
      return rate >= Number(policy.progressao_carga.aumentar_acima_de || 0.85) && Number(week.pendencias || 0) <= Number(policy.progressao_carga.maximo_pendencias_para_aumentar || 3)
    })
    const increase = sustained && weeklyMeeting?.carga_percebida !== 'pesada'
    const extra = increase ? block : 0
    const daily = base + extra
    return { segunda_sexta: daily, sabado: daily, domingo: daily, nivel: increase ? 'aumentar' : 'manter', motivo: increase ? 'aderencia_sustentada_em_duas_semanas' : 'base_preservada_ate_constancia_suficiente' }
  }
  const initial = policy.fase_inicial.semanas?.find((week) => weekStart >= week.inicio && weekStart <= week.fim)
  if (initial) return { ...initial, nivel: 'carga_inicial', motivo: 'retorno_gradual_ao_ritmo' }

  const adjustment = adherenceAdjustment(history, weeklyMeeting)
  const recent = adjustment.semanas.at(-1)
  const progression = policy.progressao_carga
  const block = policy.fase_inicial.bloco_estudo_minutos || 50
  const previousWeekday = Math.round(Number(recent?.media_segunda_sexta || progression.minimo_segunda_sexta) / block) * block
  const delta = adjustment.nivel === 'aumentar' ? progression.incremento_minutos : adjustment.nivel === 'reduzir' ? -progression.incremento_minutos : 0
  const weekday = Math.max(progression.minimo_segunda_sexta, previousWeekday + delta)
  return {
    segunda_sexta: weekday,
    sabado: Math.max(progression.minimo_sabado, Math.round(weekday * 2 / 3 / block) * block),
    domingo: Math.max(progression.minimo_domingo, Math.round(weekday * 2 / 3 / block) * block),
    nivel: adjustment.nivel,
    motivo: adjustment.motivo,
  }
}

export function practiceEligibility(weekStart, history = [], customPolicy = {}) {
  const policy = resolveMentorPolicy(customPolicy)
  const adaptation = policy.adaptacao_estudo
  if (weekStart < adaptation.pratica_primeira_semana_possivel) {
    return { eligible: false, reason: 'fase_de_estudo_basico' }
  }
  const requiredWeeks = Number(adaptation.pratica_exige_semanas_aderentes || 2)
  const threshold = Number(adaptation.pratica_limiar_aderencia || policy.progressao_carga.aumentar_acima_de || 0.85)
  const measured = history
    .filter((week) => Number(week.planejadas) >= 5)
    .map((week) => ({
      ...week,
      taxa: Number(week.minutos_planejados) > 0
        ? Number(week.minutos_concluidos || 0) / Number(week.minutos_planejados)
        : Number(week.concluidas || 0) / Number(week.planejadas),
    }))
    .slice(-requiredWeeks)
  if (measured.length < requiredWeeks) return { eligible: false, reason: 'aderencia_ainda_sem_duas_semanas' }
  if (!measured.every((week) => week.taxa >= threshold)) return { eligible: false, reason: 'aderencia_insuficiente' }
  return { eligible: true, reason: 'aderencia_sustentada' }
}

export function validateMentorPlan(demands, { dailyLimit = null } = {}) {
  const keys = new Set()
  const load = new Map()
  const blocks = new Map()
  for (const item of demands) {
    if (!item?.chave_mentor || keys.has(item.chave_mentor)) return { valid: false, reason: 'demanda_duplicada' }
    if (item.tipo === 'estudo' && Number(item.duracao_estimada) !== 50) return { valid: false, reason: 'duracao_estudo_invalida' }
    keys.add(item.chave_mentor)
    load.set(item.data, (load.get(item.data) || 0) + Number(item.duracao_estimada || 0))
    if (item.tipo === 'estudo') blocks.set(item.data, (blocks.get(item.data) || 0) + 1)
  }
  const overloaded = Number.isFinite(dailyLimit) && dailyLimit > 0 ? [...load.entries()].find(([, minutes]) => minutes > dailyLimit) : null
  if (overloaded) return { valid: false, reason: 'limite_diario_excedido', data: overloaded[0], minutos: overloaded[1] }
  const overCapacity = [...blocks.entries()].find(([date, count]) => count > dailyCapacity(date).max_blocks)
  return overCapacity ? { valid: false, reason: 'capacidade_diaria_excedida', data: overCapacity[0], blocos: overCapacity[1] } : { valid: true }
}

export function planOverdueMoves(sessions, today, weekEnd, { maxCarryover = 3 } = {}) {
  if (today > weekEnd) return []
  const movable = sessions.filter((item) => item.status === 'planejada' && item.data < today)
  const candidates = []
  for (let date = today; date <= weekEnd;) {
    candidates.push(date)
    const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1); date = isoDate(next)
  }
  if (!movable.length || !candidates.length) return []
  const load = Object.fromEntries(candidates.map((date) => [date, sessions.filter((item) => item.data === date && item.status !== 'feita').reduce((sum, item) => sum + (item.duracao_estimada || 0), 0)]))
  const moves = []
  for (const item of movable.sort((a, b) => (a.prioridade || 2) - (b.prioridade || 2)).slice(0, maxCarryover)) {
    const duration = item.duracao_estimada || 30
    const destination = [...candidates].sort((a, b) => load[a] - load[b] || a.localeCompare(b))[0]
    load[destination] += duration
    moves.push({ id: item.id, data: destination })
  }
  return moves
}

export function currentPhaseCarryover(sessions, menteeContext) {
  const phaseStart = menteeContext?.semana_inicio
  return phaseStart ? sessions.filter((item) => item.data >= phaseStart) : sessions
}

export function isMentorRestartWeek(weekStart, customPolicy = {}) {
  const restart = resolveMentorPolicy(customPolicy).reinicio
  return weekStart >= restart.inicio && weekStart <= restart.fim
}

export function isMentorResumptionWeek(weekStart, customPolicy = {}) {
  const resumption = resolveMentorPolicy(customPolicy).retomada
  return weekStart === resumption.inicio
}

function demand({ weekStart, day, slot, target, title, type, duration, priority = 2, academicClassId = null }) {
  if (!target) return null
  const date = new Date(`${weekStart}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + day)
  return {
    chave_mentor: `${weekStart}:${day}:${slot}`,
    objetivo_id: target.objectiveId,
    materia_id: target.subjectId,
    topico_id: target.topicId,
    material_id: target.materialId || null,
    aula_origem_id: academicClassId,
    titulo: title,
    tipo: type,
    data: isoDate(date),
    duracao_estimada: duration,
    prioridade: priority,
    origem: 'mentor',
  }
}

function dayIndex(weekStart, date) {
  return Math.round((new Date(`${date}T12:00:00Z`) - new Date(`${weekStart}T12:00:00Z`)) / DAY_MS)
}

function targetForCommitment(targets, commitment) {
  const sameSubject = targets.filter((item) => item.objectiveId === commitment.objetivo_id && (!commitment.materia_id || item.subjectId === commitment.materia_id))
  const linked = new Set((commitment.topicos || []).map((item) => item.topico_id || item.topico?.id).filter(Boolean))
  const exact = sameSubject.find((item) => linked.has(item.topicId))
  if (exact) return exact
  const expected = normalized(commitment.conteudo_previsto)
  const textual = expected ? sameSubject.find((item) => expected.includes(normalized(item.topic)) || normalized(item.topic).includes(expected)) : null
  return textual || sameSubject[0] || targets.find((item) => item.objectiveId === commitment.objetivo_id) || null
}

function facultyTargetForDay(targets, priorities, day, rotationSeed, policy) {
  const rule = policy.agenda_faculdade.find((item) => item.dia === day)
  const faculty = targets.filter((item) => item.context === 'faculdade' && !normalized(item.subject).includes('analise e producao de texto'))
  if (!rule) return pickDistributed(faculty, rotationSeed + day)
  const matching = faculty.filter((item) => rule.aliases.some((alias) => normalized(item.subject).includes(normalized(alias))))
  if (!matching.length) return pickDistributed(faculty, rotationSeed + day)
  const priorityIds = new Set(priorities.map((item) => item.id))
  const weakTopics = matching.filter((item) => priorityIds.has(item.topicId))
  return pick(weakTopics.length ? weakTopics : matching, rotationSeed + day)
}

function facultyCatchUpActive(weeklyMeeting, policy) {
  const signals = weeklyMeeting?.classificacoes || []
  if (signals.includes('faculdade_em_dia')) return false
  if (signals.includes('faculdade_atrasada')) return true
  return policy.fase_inicial.faculdade_recuperacao_ativa === true
}

function subjectOnly(target) {
  return target ? { ...target, topicId: null, topic: '' } : null
}

function facultyStudyTitle(target, block, catchUpActive) {
  if (!catchUpActive) return `Aula dada, aula estudada: ${target?.subject || ''}`
  return `${block === 0 ? 'Recuperar conteúdo atrasado desde a primeira aula' : 'Continuar recuperação do conteúdo atrasado'}: ${target?.subject || ''}`
}

/**
 * Cria uma semana por demandas. O bloco normal tem 50 minutos de estudo.
 * Question Cards mantêm os 30 minutos explicitamente definidos pelo usuário.
 */
export function buildMentorWeek({ weekStart, catalog, priorities = [], pendingReviews = 0, scheduledQuestionReviews = [], commitments = [], adherenceHistory = [], studiedTopicIds = null, studyUnits = [], completedMaterialIds = [], academicClasses = [], weeklyMeeting = null, policy: customPolicy = {}, menteeContext = null }) {
  const policy = resolveMentorPolicy(customPolicy)
  const targets = catalog.flatMap((objective) => (objective.materias || []).flatMap((subject) => {
    const topics = subject.topicos?.length ? subject.topicos : [{ id: null, nome: '' }]
    return topics.map((topic) => ({
      objectiveId: objective.id,
      context: objective.tipo,
      subjectId: subject.id,
      subject: subject.nome,
      topicId: topic.id,
      topic: topic.nome,
      subjectWeight: Number(subject.peso_prova || 1),
      incidence: Number(topic.incidencia || 0),
    }))
  }))
  if (!targets.length) return []

  const urgentSubjectIds = new Set(commitments.filter((item) => !item.concluido).map((item) => item.materia_id).filter(Boolean))
  const priorityIds = new Set(priorities.map((item) => item.id))
  const priorityOrder = new Map(priorities.map((item, index) => [item.id, index]))
  const prioritized = targets.filter((item) => priorityIds.has(item.topicId)).sort((a, b) => (priorityOrder.get(a.topicId) ?? 999) - (priorityOrder.get(b.topicId) ?? 999))
  const byContext = {
    concurso: targets.filter((item) => item.context === 'concurso'),
    faculdade: targets.filter((item) => item.context === 'faculdade' && !normalized(item.subject).includes('analise e producao de texto')),
  }
  const studied = studiedTopicIds ? new Set(studiedTopicIds) : null
  const practiceBacen = studied ? byContext.concurso.filter((item) => studied.has(item.topicId)) : byContext.concurso
  const rotationSeed = Math.floor(new Date(`${weekStart}T12:00:00Z`).getTime() / (DAY_MS * 7))
  const adaptiveStudyPeriod = weekStart > policy.retomada.fim_semana_especial
  const practice = practiceEligibility(weekStart, adherenceHistory, policy)
  const currentBase = menteeContext?.fase === 'construcao_habito_base_teorica' && weekStart >= menteeContext.semana_inicio
  const baseOnly = currentBase || (adaptiveStudyPeriod
    ? !practice.eligible
    : weekStart >= MENTORSHIP_START && weekStart < policy.fase_inicial.question_cards_inicio)
  const loadProfile = weeklyLoadProfile(weekStart, adherenceHistory, policy, weeklyMeeting, menteeContext)
  const studyBlock = policy.fase_inicial.bloco_estudo_minutos || 50
  const catchUpActive = currentBase ? false : adaptiveStudyPeriod
    ? facultyCatchUpActive(weeklyMeeting, policy)
    : weekStart >= policy.retomada.inicio && policy.retomada?.bloquear_questoes_e_cards_ate_autorizacao === true
      ? false
      : facultyCatchUpActive(weeklyMeeting, policy)
  const facultyBlocks = currentBase ? Number(menteeContext.carga_atual.faculdade || 1) : Math.min(
    Number(policy.adaptacao_estudo.faculdade_maximo_blocos_dia || 2),
    catchUpActive
      ? policy.fase_inicial.faculdade_blocos_recuperacao || 2
      : policy.fase_inicial.faculdade_blocos_regular || 1,
  )
  const rows = []
  const completedMaterials = new Set(completedMaterialIds)
  const hasBacenMaterials = studyUnits.some((item) => item.context === 'concurso')
  const lessonGroups = [...studyUnits.filter((item) => item.context === 'concurso' && !completedMaterials.has(item.id)).reduce((map, item) => {
    const courseSubject = item.courseSubject || item.subject || item.subjectId
    const group = map.get(courseSubject) || []
    group.push(item)
    map.set(courseSubject, group)
    return map
  }, new Map()).values()].map((group) => group.sort((a, b) => Number(a.order || 9999) - Number(b.order || 9999) || a.name.localeCompare(b.name)))
  let lessonSelection = 0
  function nextBacenLesson() {
    if (!lessonGroups.length) return null
    for (let attempt = 0; attempt < lessonGroups.length; attempt += 1) {
      const groupIndex = (lessonSelection + attempt) % lessonGroups.length
      const group = lessonGroups[groupIndex]
      lessonSelection = groupIndex + 1
      // Um bloco concluído não conclui a aula. Só o progresso explícito avança o PDF.
      const item = group[0]
      if (item.eligible === false) continue
      return { objectiveId: item.objectiveId, context: item.context, subjectId: item.subjectId, subject: item.subject, topicId: null, topic: '', materialId: item.id, materialName: item.name, materialOrder: item.order }
    }
    return null
  }

  // O ciclo vigente é decidido por data, inclusive nas semanas que cruzam etapas.
  // O planejamento anterior a 02/10 permanece histórico e não é reconstruído.
  if (menteeContext?.fase === 'adaptacao_teorica_1') {
    const orderByDay = new Map()
    const selectedClasses = new Set()
    for (let day = 0; day < 7; day += 1) {
      const date = isoDate(new Date(new Date(`${weekStart}T12:00:00Z`).getTime() + day * DAY_MS))
      if (date < (menteeContext.inicio || menteeContext.semana_inicio || NEW_CYCLE_START)) continue
      const stage = newCycleStage(date, menteeContext)
      const requestedConcurso = stage?.concurso ?? Math.max(2, Math.round(loadProfile.segunda_sexta / 50) - 1)
      const facultyBlocksForDay = stage?.faculdade ?? 1
      const capacity = dailyCapacity(date, requestedConcurso + facultyBlocksForDay)
      const concursoBlocks = Math.max(0, Math.min(requestedConcurso, capacity.max_blocks - facultyBlocksForDay))
      const nearbyExam = commitments
        .filter((item) => !item.concluido && item.tipo === 'prova' && item.materia_id && item.data >= date)
        .sort((a, b) => a.data.localeCompare(b.data))[0]
      const regularFaculty = facultyTargetForDay(targets, priorities, day, rotationSeed, policy) || pick(byContext.faculdade, rotationSeed + day)
      const examWithinTwoDays = nearbyExam && nearbyExam.data <= isoDate(new Date(new Date(`${date}T12:00:00Z`).getTime() + 2 * DAY_MS))
      const facultyTarget = subjectOnly((examWithinTwoDays && byContext.faculdade.find((item) => item.subjectId === nearbyExam.materia_id)) || regularFaculty)
      const taughtClass = !examWithinTwoDays && capacity.academicAvailability === 'CLASS_DAY'
        ? academicClasses.find((item) => item.date <= date && item.subjectId === facultyTarget?.subjectId && item.studied !== true && item.completed !== true && !selectedClasses.has(item.id))
        : null
      if (taughtClass) selectedClasses.add(taughtClass.id)
      for (let block = 0; block < facultyBlocksForDay; block += 1) {
        const title = nearbyExam && facultyTarget?.subjectId === nearbyExam.materia_id
          ? `Preparar prova: ${facultyTarget.subject}`
          : taughtClass
            ? `Estudar aula ministrada em ${taughtClass.date}: ${taughtClass.content || facultyTarget.subject}`
            : `Estudo: ${facultyTarget?.subject || ''}`
        rows.push(demand({ weekStart, day, slot: `ciclo-faculdade-${block + 1}`, target: facultyTarget, title, type: 'estudo', duration: 50, priority: 2, academicClassId: taughtClass?.id }))
      }
      for (let block = 0; block < concursoBlocks; block += 1) {
        const target = nextBacenLesson() || (!hasBacenMaterials ? pickSequentiallyDistributed(byContext.concurso, day * concursoBlocks + block) : null)
        const label = target?.materialName ? `Aula ${target.materialOrder}: ${target.materialName.replace(/\.pdf$/i, '').replace(/^(\s*\d+\.\s*)+/, '').trim()}` : (target?.topic || target?.subject)
        rows.push(demand({ weekStart, day, slot: `ciclo-bacen-${block + 1}`, target, title: `BACEN · ${target?.subject || ''} · ${label || ''}`, type: 'estudo', duration: 50, priority: 1 }))
      }
    }
    return rows.filter(Boolean).map((item) => {
      const ordem = orderByDay.get(item.data) || 0
      orderByDay.set(item.data, ordem + 1)
      return { ...item, ordem }
    })
  }

  if (isMentorResumptionWeek(weekStart, policy)) {
    const resumption = policy.retomada
    const theoryCrime = subjectOnly(byContext.faculdade.find((item) => normalized(item.subject).includes('teoria do crime')) || byContext.faculdade[0])
    const theoryBlocks = [
      'Direito Penal, controle social e conceitos de crime',
      'Princípios constitucionais penais',
      'Aplicação da lei penal no tempo',
      'Aplicação da lei penal no espaço e às pessoas',
      'Hermenêutica jurídico-penal e conflito aparente de normas',
      'Teoria do delito: causalismo, finalismo e funcionalismo',
      'Delito como fato típico e mapa de revisão',
    ]
    for (let block = 0; block < Number(resumption.segunda_especial?.faculdade || 0); block += 1) {
      rows.push(demand({
        weekStart,
        day: 0,
        slot: `retomada-prova-${block + 1}`,
        target: theoryCrime,
        title: `Teoria do Crime · ${theoryBlocks[block] || `Revisão orientada ${block + 1}`}`,
        type: 'estudo',
        duration: studyBlock,
        priority: 1,
      }))
    }
    for (let block = 0; block < Number(resumption.segunda_especial?.concurso || 0); block += 1) {
      const target = nextBacenLesson() || pickSequentiallyDistributed(byContext.concurso, block) || pick(byContext.concurso, block)
      const lessonLabel = target?.materialName ? `Aula ${target.materialOrder}: ${target.materialName.replace(/\.pdf$/i, '').replace(/^(\s*\d+\.\s*)+/, '').trim()}` : (target?.topic || target?.subject)
      rows.push(demand({ weekStart, day: 0, slot: `retomada-bacen-${block + 1}`, target, title: `BACEN · ${target?.subject || ''} · ${lessonLabel || ''}`, type: 'estudo', duration: studyBlock, priority: 2 }))
    }

    for (let block = 0; block < Number(resumption.dia_prova_bacen_blocos || 0); block += 1) {
      const target = nextBacenLesson() || pickSequentiallyDistributed(byContext.concurso, block + 2) || pick(byContext.concurso, block + 2)
      const lessonLabel = target?.materialName ? `Aula ${target.materialOrder}: ${target.materialName.replace(/\.pdf$/i, '').replace(/^(\s*\d+\.\s*)+/, '').trim()}` : (target?.topic || target?.subject)
      rows.push(demand({ weekStart, day: 1, slot: `retomada-bacen-${block + 1}`, target, title: `BACEN · ${target?.subject || ''} · ${lessonLabel || ''}`, type: 'estudo', duration: studyBlock, priority: 1 }))
    }

    for (let day = 2; day < 7; day += 1) {
      const facultyTarget = subjectOnly(facultyTargetForDay(targets, priorities, day, rotationSeed, policy) || pickDistributed(byContext.faculdade, rotationSeed + day))
      for (let block = 0; block < Number(resumption.rotina_restante?.faculdade || 0); block += 1) {
        rows.push(demand({ weekStart, day, slot: `retomada-faculdade-${block + 1}`, target: facultyTarget, title: `Aula dada, aula estudada: ${facultyTarget?.subject || ''}`, type: 'estudo', duration: studyBlock, priority: 2 }))
      }
      for (let block = 0; block < Number(resumption.rotina_restante?.concurso || 0); block += 1) {
        const target = nextBacenLesson() || pickSequentiallyDistributed(byContext.concurso, day * 3 + block) || pick(byContext.concurso, day + block)
        const lessonLabel = target?.materialName ? `Aula ${target.materialOrder}: ${target.materialName.replace(/\.pdf$/i, '').replace(/^(\s*\d+\.\s*)+/, '').trim()}` : (target?.topic || target?.subject)
        rows.push(demand({ weekStart, day, slot: `retomada-bacen-${block + 1}`, target, title: `BACEN · ${target?.subject || ''} · ${lessonLabel || ''}`, type: 'estudo', duration: studyBlock, priority: 1 }))
      }
    }
    const orderByDay = new Map()
    return rows.filter(Boolean).map((item) => {
      const ordem = orderByDay.get(item.data) || 0
      orderByDay.set(item.data, ordem + 1)
      return { ...item, ordem }
    })
  }

  if (isMentorRestartWeek(weekStart, policy)) {
    const restart = policy.reinicio
    const theoryCrime = subjectOnly(byContext.faculdade.find((item) => normalized(item.subject).includes('teoria do crime')) || byContext.faculdade[0])
    for (let day = 0; day < 7; day += 1) {
      const date = isoDate(new Date(new Date(`${weekStart}T12:00:00Z`).getTime() + day * DAY_MS))
      const regularFaculty = subjectOnly(facultyTargetForDay(targets, priorities, day, rotationSeed, policy) || pickDistributed(byContext.faculdade, rotationSeed + day))
      const examPreparationActive = date <= restart.prova_teoria_crime
      const secondFaculty = examPreparationActive ? theoryCrime : subjectOnly(pickDistributed(byContext.faculdade, rotationSeed + day + 1))
      const facultyTargets = day <= 3
        ? [regularFaculty, secondFaculty]
        : [examPreparationActive ? theoryCrime : regularFaculty]
      for (let block = 0; block < facultyTargets.length; block += 1) {
        const target = facultyTargets[block]
        const title = day <= 3 && block === 0
          ? `Aula dada, aula estudada: ${target?.subject || ''}`
          : examPreparationActive && target?.subjectId === theoryCrime?.subjectId
            ? 'Preparar prova: Teoria do Crime'
            : `Recuperar conteúdo atrasado: ${target?.subject || ''}`
        rows.push(demand({ weekStart, day, slot: `reinicio-faculdade-${block + 1}`, target, title, type: 'estudo', duration: studyBlock, priority: examPreparationActive && target?.subjectId === theoryCrime?.subjectId ? 1 : 2 }))
      }
      const bacenBlocks = day <= 3 ? restart.bacen_segunda_quinta : day === 4 ? restart.bacen_sexta : restart.bacen_fim_semana
      for (let block = 0; block < bacenBlocks; block += 1) {
        const target = nextBacenLesson() || pickSequentiallyDistributed(byContext.concurso, day * 3 + block) || pick(byContext.concurso, day + block)
        const lessonLabel = target?.materialName ? `Aula ${target.materialOrder}: ${target.materialName.replace(/\.pdf$/i, '').replace(/^(\s*\d+\.\s*)+/, '').trim()}` : (target?.topic || target?.subject)
        rows.push(demand({ weekStart, day, slot: `reinicio-bacen-${block + 1}`, target, title: `BACEN · ${target?.subject || ''} · ${lessonLabel || ''}`, type: 'estudo', duration: studyBlock, priority: 1 }))
      }
    }
    const orderByDay = new Map()
    return rows.filter(Boolean).map((item) => {
      const ordem = orderByDay.get(item.data) || 0
      orderByDay.set(item.data, ordem + 1)
      return { ...item, ordem }
    })
  }

  for (let day = 0; day < 7; day += 1) {
    const urgentPool = byContext.concurso.filter((item) => urgentSubjectIds.has(item.subjectId))
    const bacenPool = prioritized.filter((item) => item.context === 'concurso')
    const bacenTarget = pick(urgentPool.length ? urgentPool : bacenPool.length ? bacenPool : byContext.concurso, rotationSeed + day) || pick(targets, rotationSeed + day)
    const otherBacen = pick(byContext.concurso.filter((item) => item.subjectId !== bacenTarget?.subjectId), rotationSeed + day + 2) || bacenTarget
    const studyDate = isoDate(new Date(new Date(`${weekStart}T12:00:00Z`).getTime() + day * DAY_MS))
    const nearbyExam = currentBase ? commitments.find((item) => !item.concluido && item.tipo === 'prova' && item.materia_id && item.data >= studyDate && item.data <= isoDate(new Date(new Date(`${studyDate}T12:00:00Z`).getTime() + 2 * DAY_MS))) : null
    const facultyTarget = subjectOnly((nearbyExam && byContext.faculdade.find((item) => item.subjectId === nearbyExam.materia_id)) || facultyTargetForDay(targets, priorities, day, rotationSeed, policy) || pick(byContext.faculdade, rotationSeed + day))
    const facultyCardTarget = pick(byContext.faculdade.filter(allowsQuestionCards), rotationSeed + day)
    const priorityPracticeSlots = Math.min(3, priorities.length * 2)
    const practiceTarget = (day < priorityPracticeSlots ? pick(practiceBacen.filter((item) => priorityIds.has(item.topicId)), rotationSeed + day) : null)
      || pickDistributed(practiceBacen.filter((item) => !priorityIds.has(item.topicId)), rotationSeed + day)
      || pickDistributed(practiceBacen, rotationSeed + day)
    const otherPracticeTarget = pick(practiceBacen.filter((item) => item.subjectId !== practiceTarget?.subjectId), rotationSeed + day + 2) || practiceTarget

    if (baseOnly) {
      const facultyBlocksForDay = currentBase ? facultyBlocks : adaptiveStudyPeriod && day >= 4 ? 1 : facultyBlocks
      if (day <= 4) {
        for (let block = 0; block < facultyBlocksForDay; block += 1) {
          rows.push(demand({ weekStart, day, slot: `base-faculdade-${block + 1}`, target: facultyTarget, title: nearbyExam ? `Preparar prova: ${facultyTarget?.subject || ''}` : facultyStudyTitle(facultyTarget, block, catchUpActive), type: 'estudo', duration: studyBlock, priority: nearbyExam ? 1 : 2 }))
        }
      } else if (currentBase) {
        for (let block = 0; block < facultyBlocksForDay; block += 1) rows.push(demand({ weekStart, day, slot: `base-faculdade-${block + 1}`, target: facultyTarget, title: nearbyExam ? `Preparar prova: ${facultyTarget?.subject || ''}` : facultyStudyTitle(facultyTarget, block, false), type: 'estudo', duration: studyBlock, priority: nearbyExam ? 1 : 2 }))
      } else {
        rows.push(demand({ weekStart, day, slot: 'base-faculdade-fim-semana', target: facultyTarget, title: 'Recuperar conteúdo atrasado da faculdade', type: 'estudo', duration: studyBlock, priority: 2 }))
      }
      const minimumBacenBlocks = currentBase ? Number(menteeContext.carga_atual.concurso || 2) : day <= 4 ? policy.fase_inicial.bacen_blocos_segunda_sexta : policy.fase_inicial.bacen_blocos_fim_semana
      const dailyTarget = day <= 4 ? loadProfile.segunda_sexta : day === 5 ? loadProfile.sabado : loadProfile.domingo
      const facultyMinutes = facultyBlocksForDay * studyBlock
      const bacenBlocks = adaptiveStudyPeriod
        ? Math.max(minimumBacenBlocks, Math.floor(Math.max(0, dailyTarget - facultyMinutes) / studyBlock))
        : minimumBacenBlocks
      for (let block = 0; block < bacenBlocks; block += 1) {
        const baseTarget = nextBacenLesson() || pickSequentiallyDistributed(byContext.concurso, day * 3 + block) || bacenTarget
        const lessonLabel = baseTarget.materialName ? `Aula ${baseTarget.materialOrder}: ${baseTarget.materialName.replace(/\.pdf$/i, '').replace(/^(\s*\d+\.\s*)+/, '').trim()}` : (baseTarget.topic || baseTarget.subject)
        rows.push(demand({ weekStart, day, slot: `base-bacen-${block + 1}`, target: baseTarget, title: `BACEN · ${baseTarget.subject} · ${lessonLabel}`, type: 'estudo', duration: studyBlock, priority: 1 }))
      }
      continue
    }

    const cardTarget = day >= 5 ? facultyCardTarget : practiceTarget
    rows.push(demand({ weekStart, day, slot: 'cards-diarios', target: cardTarget, title: day >= 5 ? 'Revisar Question Cards da faculdade' : 'Revisar Question Cards BACEN', type: 'especial', duration: policy.fase_inicial.question_cards_diarios_minutos, priority: 1 }))
    rows.push(demand({ weekStart, day, slot: 'questoes-bacen', target: otherPracticeTarget, title: `Resolver questões: ${otherPracticeTarget?.subject || ''}`, type: 'exercicio', duration: studyBlock, priority: 1 }))

    const reviewForDay = scheduledQuestionReviews
      .filter((item) => Math.max(0, Math.min(6, dayIndex(weekStart, item.dueDate))) === day)
      .sort((a, b) => (b.count || 0) - (a.count || 0))[0]
    if (reviewForDay) {
      const reviewTarget = targets.find((item) => item.topicId === reviewForDay.topicId)
      rows.push(demand({ weekStart, day, slot: `revisao-questoes:${reviewForDay.topicId}`, target: reviewTarget, title: `Revisão espaçada: ${reviewForDay.count} questões de ${reviewTarget?.topic || reviewTarget?.subject || 'conteúdo'}`, type: 'revisao', duration: studyBlock, priority: 1 }))
    }

    if (day <= 4) {
      const facultyDuration = policy.agenda_faculdade.find((item) => item.dia === day)?.duracao || studyBlock
      for (let block = 0; block < facultyBlocks; block += 1) {
        if (facultyTarget) rows.push(demand({ weekStart, day, slot: `estudo-faculdade-${block + 1}`, target: facultyTarget, title: facultyStudyTitle(facultyTarget, block, catchUpActive), type: 'estudo', duration: facultyDuration, priority: 2 }))
      }
    } else if (day === 5) {
      rows.push(demand({ weekStart, day, slot: 'revisao-bacen', target: bacenTarget, title: 'Revisar erros do BACEN', type: 'revisao', duration: studyBlock, priority: 1 }))
    } else if (day === 6) {
      rows.push(demand({ weekStart, day, slot: 'correcao', target: bacenTarget, title: pendingReviews > 0 ? 'Corrigir erros e falsas certezas da semana' : 'Revisar e corrigir a semana', type: 'revisao', duration: studyBlock, priority: 1 }))
    }

    const date = isoDate(new Date(new Date(`${weekStart}T12:00:00Z`).getTime() + day * DAY_MS))
    const dailyTarget = day <= 4 ? loadProfile.segunda_sexta : day === 5 ? loadProfile.sabado : loadProfile.domingo
    let remainingStudy = Math.max(0, dailyTarget - rows.filter((item) => item?.data === date && item.tipo !== 'especial').reduce((sum, item) => sum + Number(item.duracao_estimada || 0), 0))
    for (let block = 0; remainingStudy >= studyBlock; block += 1) {
      const duration = studyBlock
      const studyTarget = pickSequentiallyDistributed(byContext.concurso, rotationSeed + day * 4 + block) || bacenTarget
      rows.push(demand({ weekStart, day, slot: `estudo-bacen-${block + 1}`, target: studyTarget, title: `Estudar BACEN: ${studyTarget.topic || studyTarget.subject}`, type: 'estudo', duration, priority: 1 }))
      remainingStudy -= duration
    }
  }


  for (const commitment of commitments.filter((item) => !item.concluido)) {
    const target = targetForCommitment(targets, commitment)
    if (!target) continue
    const eventDay = dayIndex(weekStart, commitment.data)
    if (eventDay >= 0 && eventDay <= 6) {
      const item = demand({
        weekStart,
        day: eventDay,
        slot: `compromisso:${commitment.id}`,
        target,
        title: commitment.titulo,
        type: commitment.tipo === 'prova' ? 'prova' : 'trabalho',
        duration: commitment.tipo === 'prova' ? commitment.duracao_minutos : Math.min(90, commitment.duracao_minutos),
        priority: commitment.peso >= 4 ? 1 : commitment.peso >= 2 ? 2 : 3,
      })
      if (item) item.chave_mentor = `${weekStart}:compromisso:${commitment.id}`
      rows.push(item)
    }
    const prepDay = Math.min(6, Math.max(0, eventDay - (commitment.peso >= 4 ? 2 : 1)))
    if (!currentBase && eventDay >= 1 && eventDay <= 13) {
      const prepBlocks = commitment.peso >= 4 ? 2 : 1
      for (let block = 0; block < prepBlocks; block += 1) {
      const prep = demand({
        weekStart,
        day: prepDay,
        slot: `preparo:${commitment.id}:${block + 1}`,
        target,
        title: priorityIds.has(target.topicId) ? `Revisar: ${target.topic || target.subject}` : `Estudar: ${target.topic || target.subject}`,
        type: priorityIds.has(target.topicId) ? 'revisao' : 'estudo',
        duration: 50,
        priority: commitment.peso >= 4 ? 1 : 2,
      })
      if (prep) prep.chave_mentor = `${weekStart}:preparo:${commitment.id}:${block + 1}`
      rows.push(prep)
      }
    }
  }

  const orderByDay = new Map()
  return rows.filter(Boolean).map((item) => {
    const ordem = orderByDay.get(item.data) || 0
    orderByDay.set(item.data, ordem + 1)
    return { ...item, ordem }
  })
}
