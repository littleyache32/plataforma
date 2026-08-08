import { resolveMentorPolicy } from './mentor-policy.js'

const DAY_MS = 86_400_000
export const MENTORSHIP_START = '2026-08-10'

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function pick(items, index) {
  return items.length ? items[index % items.length] : null
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
  if (weekStart === MENTORSHIP_START && current <= end) return true
  if (today < '2026-08-09') return false
  if (current >= start && current <= end) return true
  const tomorrow = new Date(current); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  return current.getUTCDay() === 0 && isoDate(tomorrow) === weekStart
}

export function planOverdueMoves(sessions, today, weekEnd) {
  if (today > weekEnd) return []
  const movable = sessions.filter((item) => item.status === 'planejada' && item.data < today && !item.movida_em)
  const candidates = []
  for (let date = today; date <= weekEnd;) {
    candidates.push(date)
    const next = new Date(`${date}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1); date = isoDate(next)
  }
  if (!movable.length || !candidates.length) return []
  const load = Object.fromEntries(candidates.map((date) => [date, sessions.filter((item) => item.data === date && item.status !== 'feita').reduce((sum, item) => sum + (item.duracao_estimada || 0), 0)]))
  return movable.sort((a, b) => (a.prioridade || 2) - (b.prioridade || 2)).map((item) => {
    const duration = item.duracao_estimada || 30
    const fitting = candidates.filter((date) => load[date] + duration <= ([0, 6].includes(new Date(`${date}T12:00:00Z`).getUTCDay()) ? 180 : 270))
    const destination = (fitting.length ? fitting : candidates).sort((a, b) => load[a] - load[b])[0]
    load[destination] += duration
    return { id: item.id, data: destination }
  })
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
  if (!rule) return pick(faculty, rotationSeed + day)
  const matching = faculty.filter((item) => rule.aliases.some((alias) => normalized(item.subject).includes(normalized(alias))))
  if (!matching.length) return pick(faculty, rotationSeed + day)
  const priorityIds = new Set(priorities.map((item) => item.id))
  const weakTopics = matching.filter((item) => priorityIds.has(item.topicId))
  return pick(weakTopics.length ? weakTopics : matching, rotationSeed + day)
}

/**
 * Cria uma semana por demandas. O bloco de 30 minutos e uma unidade de calculo,
 * mas cada atividade aparece como um unico cartao de 30, 60 ou 90 minutos.
 */
export function buildMentorWeek({ weekStart, catalog, priorities = [], pendingReviews = 0, commitments = [], policy: customPolicy = {} }) {
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
  const rotationSeed = Math.floor(new Date(`${weekStart}T12:00:00Z`).getTime() / (DAY_MS * 7))
  const onboarding = weekStart >= MENTORSHIP_START && weekStart < '2026-08-24'
  const rows = []

  for (let day = 0; day < 7; day += 1) {
    const urgentPool = byContext.concurso.filter((item) => urgentSubjectIds.has(item.subjectId))
    const bacenPool = prioritized.filter((item) => item.context === 'concurso')
    const bacenTarget = pick(urgentPool.length ? urgentPool : bacenPool.length ? bacenPool : byContext.concurso, rotationSeed + day) || pick(targets, rotationSeed + day)
    const otherBacen = pick(byContext.concurso.filter((item) => item.subjectId !== bacenTarget?.subjectId), rotationSeed + day + 2) || bacenTarget
    const facultyTarget = facultyTargetForDay(targets, priorities, day, rotationSeed, policy) || pick(byContext.faculdade, rotationSeed + day)
    const facultyCardTarget = pick(byContext.faculdade.filter(allowsQuestionCards), rotationSeed + day)

    if (!onboarding) rows.push(demand({ weekStart, day, slot: 'cards-bacen', target: bacenTarget, title: 'Revisar Question Cards BACEN', type: 'especial', duration: 30, priority: 1 }))
    rows.push(demand({ weekStart, day, slot: 'questoes-bacen', target: otherBacen, title: `Resolver questões: ${otherBacen.subject}`, type: 'exercicio', duration: day === 4 ? 60 : 30, priority: 1 }))

    if (day <= 3) {
      const facultyDuration = policy.agenda_faculdade.find((item) => item.dia === day)?.duracao || 60
      if (facultyTarget) rows.push(demand({ weekStart, day, slot: 'estudo', target: facultyTarget, title: `Aula dada, aula estudada: ${facultyTarget.subject}`, type: 'estudo', duration: facultyDuration, priority: 2 }))
      rows.push(demand({ weekStart, day, slot: 'estudo-bacen', target: bacenTarget, title: `Estudar BACEN: ${bacenTarget.topic || bacenTarget.subject}`, type: 'estudo', duration: 60, priority: 1 }))
      if (onboarding) rows.push(demand({ weekStart, day, slot: 'revisao-inicial', target: bacenTarget, title: 'Consolidar o estudo do BACEN', type: 'revisao', duration: 30, priority: 1 }))
    } else if (day === 4) {
      if (!onboarding) rows.push(demand({ weekStart, day, slot: 'cards-faculdade', target: facultyCardTarget, title: 'Revisar Question Cards da faculdade', type: 'especial', duration: 30, priority: 2 }))
      rows.push(demand({ weekStart, day, slot: 'estudo-bacen', target: bacenTarget, title: `Estudar BACEN: ${bacenTarget.topic || bacenTarget.subject}`, type: 'estudo', duration: 60, priority: 1 }))
      if (onboarding) rows.push(demand({ weekStart, day, slot: 'revisao-inicial', target: bacenTarget, title: 'Revisar pontos centrais do BACEN', type: 'revisao', duration: 60, priority: 1 }))
    } else if (day === 5) {
      if (!onboarding) rows.push(demand({ weekStart, day, slot: 'cards-faculdade', target: facultyCardTarget, title: 'Revisar Question Cards da faculdade', type: 'especial', duration: 30, priority: 2 }))
      rows.push(demand({ weekStart, day, slot: 'estudo-bacen', target: bacenTarget, title: `Estudar BACEN: ${bacenTarget.topic || bacenTarget.subject}`, type: 'estudo', duration: 60, priority: 1 }))
      rows.push(demand({ weekStart, day, slot: 'revisao-bacen', target: bacenTarget, title: 'Revisar erros do BACEN', type: 'revisao', duration: 30, priority: 1 }))
      if (onboarding) rows.push(demand({ weekStart, day, slot: 'aprofundamento-inicial', target: otherBacen, title: `Aprofundar BACEN: ${otherBacen.topic || otherBacen.subject}`, type: 'estudo', duration: 60, priority: 1 }))
    } else {
      rows.push(demand({ weekStart, day, slot: 'estudo-bacen', target: bacenTarget, title: `Estudar BACEN: ${bacenTarget.topic || bacenTarget.subject}`, type: 'estudo', duration: 60, priority: 1 }))
      rows.push(demand({ weekStart, day, slot: 'correcao', target: bacenTarget, title: pendingReviews > 0 ? 'Corrigir erros e falsas certezas da semana' : 'Revisar e corrigir a semana', type: 'revisao', duration: 60, priority: 1 }))
      if (onboarding) rows.push(demand({ weekStart, day, slot: 'fechamento-inicial', target: otherBacen, title: 'Fechar lacunas da semana', type: 'revisao', duration: 30, priority: 1 }))
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

  return rows.filter(Boolean)
}
