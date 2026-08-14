import { resolveMentorPolicy } from './mentor-policy.js'

const DAY_MS = 86_400_000
export const MENTORSHIP_START = '2026-08-17'

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
  if (weekStart < MENTORSHIP_START) return false
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
    return { nivel: 'aumentar', motivo: 'aderencia_acima_de_85_por_duas_semanas', semanas: measured }
  }
  return { nivel: 'manter', motivo: 'aderencia_sustentavel', semanas: measured }
}

export function weeklyLoadProfile(weekStart, history = [], customPolicy = {}, weeklyMeeting = null) {
  const policy = resolveMentorPolicy(customPolicy)
  const initial = policy.fase_inicial.semanas?.find((week) => weekStart >= week.inicio && weekStart <= week.fim)
  if (initial) return { ...initial, nivel: 'carga_inicial', motivo: 'retorno_gradual_ao_ritmo' }

  const adjustment = adherenceAdjustment(history, weeklyMeeting)
  const recent = adjustment.semanas.at(-1)
  const progression = policy.progressao_carga
  const previousWeekday = Number(recent?.media_segunda_sexta || progression.minimo_segunda_sexta)
  const delta = adjustment.nivel === 'aumentar' ? progression.incremento_minutos : adjustment.nivel === 'reduzir' ? -progression.incremento_minutos : 0
  const weekday = Math.max(progression.minimo_segunda_sexta, Math.min(progression.maximo_segunda_sexta, previousWeekday + delta))
  return {
    segunda_sexta: weekday,
    sabado: Math.min(weekday, progression.maximo_sabado),
    domingo: Math.min(weekday, progression.maximo_domingo),
    nivel: adjustment.nivel,
    motivo: adjustment.motivo,
  }
}

export function validateMentorPlan(demands, { dailyLimit = 480 } = {}) {
  const keys = new Set()
  const load = new Map()
  for (const item of demands) {
    if (!item?.chave_mentor || keys.has(item.chave_mentor)) return { valid: false, reason: 'demanda_duplicada' }
    keys.add(item.chave_mentor)
    load.set(item.data, (load.get(item.data) || 0) + Number(item.duracao_estimada || 0))
  }
  const overloaded = [...load.entries()].find(([, minutes]) => minutes > dailyLimit)
  return overloaded ? { valid: false, reason: 'limite_diario_excedido', data: overloaded[0], minutos: overloaded[1] } : { valid: true }
}

export function planOverdueMoves(sessions, today, weekEnd) {
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
  for (const item of movable.sort((a, b) => (a.prioridade || 2) - (b.prioridade || 2))) {
    if (moves.length >= 3) break
    const duration = item.duracao_estimada || 30
    const fitting = candidates.filter((date) => load[date] + duration <= ([0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? 240 : 300))
    if (!fitting.length) continue
    const destination = fitting.sort((a, b) => load[a] - load[b])[0]
    load[destination] += duration
    moves.push({ id: item.id, data: destination })
  }
  return moves
}

function demand({ weekStart, day, slot, target, title, type, duration, priority = 2 }) {
  if (!target) return null
  const date = new Date(`${weekStart}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + day)
  return {
    chave_mentor: `${weekStart}:${day}:${slot}`,
    objetivo_id: target.objectiveId,
    materia_id: target.subjectId,
    topico_id: target.topicId,
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
  return sameSubject[0] || targets.find((item) => item.objectiveId === commitment.objetivo_id) || null
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

/**
 * Cria uma semana por demandas. O bloco de 30 minutos e uma unidade de calculo,
 * mas cada atividade aparece como um unico cartao de 30, 60 ou 90 minutos.
 */
export function buildMentorWeek({ weekStart, catalog, priorities = [], pendingReviews = 0, scheduledQuestionReviews = [], commitments = [], adherenceHistory = [], studiedTopicIds = null, weeklyMeeting = null, policy: customPolicy = {} }) {
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
    }))
  }))
  if (!targets.length) return []

  const urgentSubjectIds = new Set(commitments.filter((item) => !item.concluido).map((item) => item.materia_id).filter(Boolean))
  const priorityIds = new Set(priorities.map((item) => item.id))
  const prioritized = targets.filter((item) => priorityIds.has(item.topicId))
  const byContext = {
    concurso: targets.filter((item) => item.context === 'concurso'),
    faculdade: targets.filter((item) => item.context === 'faculdade' && !normalized(item.subject).includes('analise e producao de texto')),
  }
  const studied = studiedTopicIds ? new Set(studiedTopicIds) : null
  const practiceBacen = studied ? byContext.concurso.filter((item) => studied.has(item.topicId)) : byContext.concurso
  const rotationSeed = Math.floor(new Date(`${weekStart}T12:00:00Z`).getTime() / (DAY_MS * 7))
  const onboarding = weekStart >= MENTORSHIP_START && weekStart < '2026-08-31'
  const loadProfile = weeklyLoadProfile(weekStart, adherenceHistory, policy, weeklyMeeting)
  const rows = []

  for (let day = 0; day < 7; day += 1) {
    const urgentPool = byContext.concurso.filter((item) => urgentSubjectIds.has(item.subjectId))
    const bacenPool = prioritized.filter((item) => item.context === 'concurso')
    const bacenTarget = pick(urgentPool.length ? urgentPool : bacenPool.length ? bacenPool : byContext.concurso, rotationSeed + day) || pick(targets, rotationSeed + day)
    const otherBacen = pick(byContext.concurso.filter((item) => item.subjectId !== bacenTarget?.subjectId), rotationSeed + day + 2) || bacenTarget
    const facultyTarget = facultyTargetForDay(targets, priorities, day, rotationSeed, policy) || pick(byContext.faculdade, rotationSeed + day)
    const facultyCardTarget = pick(byContext.faculdade.filter(allowsQuestionCards), rotationSeed + day)
    const practiceTarget = pick(practiceBacen.filter((item) => priorityIds.has(item.topicId)), rotationSeed + day)
      || pickDistributed(practiceBacen, rotationSeed + day)
    const otherPracticeTarget = pick(practiceBacen.filter((item) => item.subjectId !== practiceTarget?.subjectId), rotationSeed + day + 2) || practiceTarget

    if (onboarding) {
      const dailyTarget = day <= 4 ? loadProfile.segunda_sexta : day === 5 ? loadProfile.sabado : loadProfile.domingo
      const facultyMinutes = day <= 3 ? policy.fase_inicial.faculdade_minutos_segunda_quinta : 0
      if (facultyMinutes) rows.push(demand({ weekStart, day, slot: 'base-faculdade', target: facultyTarget, title: `Aula dada, aula estudada: ${facultyTarget?.subject || ''}`, type: 'estudo', duration: facultyMinutes, priority: 2 }))
      const bacenBlocks = Math.max(0, Math.floor((dailyTarget - facultyMinutes) / 60))
      for (let block = 0; block < bacenBlocks; block += 1) {
        const baseTarget = pickSequentiallyDistributed(byContext.concurso, day * 3 + block) || bacenTarget
        rows.push(demand({ weekStart, day, slot: `base-bacen-${block + 1}`, target: baseTarget, title: `Construir base BACEN: ${baseTarget.topic || baseTarget.subject}`, type: 'estudo', duration: 60, priority: 1 }))
      }
      continue
    }

    rows.push(demand({ weekStart, day, slot: 'cards-bacen', target: practiceTarget, title: 'Revisar Question Cards BACEN', type: 'especial', duration: 30, priority: 1 }))
    rows.push(demand({ weekStart, day, slot: 'questoes-bacen', target: otherPracticeTarget, title: `Resolver questões: ${otherPracticeTarget?.subject || ''}`, type: 'exercicio', duration: day === 4 ? 60 : 30, priority: 1 }))

    const reviewForDay = scheduledQuestionReviews
      .filter((item) => Math.max(0, Math.min(6, dayIndex(weekStart, item.dueDate))) === day)
      .sort((a, b) => (b.count || 0) - (a.count || 0))[0]
    if (reviewForDay) {
      const reviewTarget = targets.find((item) => item.topicId === reviewForDay.topicId)
      rows.push(demand({ weekStart, day, slot: `revisao-questoes:${reviewForDay.topicId}`, target: reviewTarget, title: `Revisão espaçada: ${reviewForDay.count} questões de ${reviewTarget?.topic || reviewTarget?.subject || 'conteúdo'}`, type: 'revisao', duration: 30, priority: 1 }))
    }

    if (day <= 3) {
      const facultyDuration = policy.agenda_faculdade.find((item) => item.dia === day)?.duracao || 60
      if (facultyTarget) rows.push(demand({ weekStart, day, slot: 'estudo', target: facultyTarget, title: `Aula dada, aula estudada: ${facultyTarget.subject}`, type: 'estudo', duration: facultyDuration, priority: 2 }))
    } else if (day === 5) {
      rows.push(demand({ weekStart, day, slot: 'cards-faculdade', target: facultyCardTarget, title: 'Revisar Question Cards da faculdade', type: 'especial', duration: 30, priority: 2 }))
      rows.push(demand({ weekStart, day, slot: 'revisao-bacen', target: bacenTarget, title: 'Revisar erros do BACEN', type: 'revisao', duration: 30, priority: 1 }))
    } else if (day === 6) {
      rows.push(demand({ weekStart, day, slot: 'cards-faculdade', target: facultyCardTarget, title: 'Revisar Question Cards da faculdade', type: 'especial', duration: 30, priority: 2 }))
      rows.push(demand({ weekStart, day, slot: 'correcao', target: bacenTarget, title: pendingReviews > 0 ? 'Corrigir erros e falsas certezas da semana' : 'Revisar e corrigir a semana', type: 'revisao', duration: 60, priority: 1 }))
    }

    const date = isoDate(new Date(new Date(`${weekStart}T12:00:00Z`).getTime() + day * DAY_MS))
    const dailyTarget = day <= 4 ? loadProfile.segunda_sexta : day === 5 ? loadProfile.sabado : loadProfile.domingo
    let remainingStudy = Math.max(0, dailyTarget - rows.filter((item) => item?.data === date).reduce((sum, item) => sum + Number(item.duracao_estimada || 0), 0))
    for (let block = 0; remainingStudy >= 30; block += 1) {
      const duration = remainingStudy >= 90 ? 90 : remainingStudy >= 60 ? 60 : 30
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
    if (eventDay >= 1 && eventDay <= 13) {
      const prep = demand({
        weekStart,
        day: prepDay,
        slot: `preparo:${commitment.id}`,
        target,
        title: `Preparar: ${commitment.titulo}`,
        type: 'revisao',
        duration: commitment.peso >= 4 ? 90 : 60,
        priority: commitment.peso >= 4 ? 1 : 2,
      })
      if (prep) prep.chave_mentor = `${weekStart}:preparo:${commitment.id}`
      rows.push(prep)
    }
  }

  const orderByDay = new Map()
  return rows.filter(Boolean).map((item) => {
    const ordem = orderByDay.get(item.data) || 0
    orderByDay.set(item.data, ordem + 1)
    return { ...item, ordem }
  })
}
