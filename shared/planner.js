const DAY_MS = 86_400_000

function isoDate(date) {
  return date.toISOString().slice(0, 10)
}

function pick(items, index) {
  return items.length ? items[index % items.length] : null
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

/**
 * Cria uma semana por demandas. O bloco de 30 minutos e uma unidade de calculo,
 * mas cada atividade aparece como um unico cartao de 30, 60 ou 90 minutos.
 */
export function buildMentorWeek({ weekStart, catalog, priorities = [], pendingReviews = 0 }) {
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

  const priorityIds = new Set(priorities.map((item) => item.id))
  const prioritized = targets.filter((item) => priorityIds.has(item.topicId))
  const byContext = {
    concurso: targets.filter((item) => item.context === 'concurso'),
    faculdade: targets.filter((item) => item.context === 'faculdade'),
  }
  const rotationSeed = Math.floor(new Date(`${weekStart}T12:00:00Z`).getTime() / (DAY_MS * 7))
  const contexts = ['concurso', 'faculdade', 'concurso', 'faculdade', 'concurso', 'faculdade', 'concurso']
  const rows = []

  for (let day = 0; day < 7; day += 1) {
    const context = contexts[day]
    const pool = prioritized.filter((item) => item.context === context)
    const target = pick(pool.length ? pool : byContext[context], rotationSeed + day) || pick(targets, rotationSeed + day)
    const complementary = pick(byContext[context === 'concurso' ? 'faculdade' : 'concurso'], rotationSeed + day)
    const questionDuration = day >= 5 ? 30 : 60
    const studyDuration = day >= 5 ? 60 : 90

    rows.push(demand({ weekStart, day, slot: 'cards', target: complementary || target, title: 'Revisar Question Cards', type: 'especial', duration: 30, priority: 1 }))
    rows.push(demand({ weekStart, day, slot: 'questoes', target, title: `Resolver questões: ${target.subject}`, type: 'exercicio', duration: questionDuration, priority: 1 }))

    const correctionDay = (day === 2 && pendingReviews > 0) || day === 6
    if (correctionDay) {
      rows.push(demand({ weekStart, day, slot: 'correcao', target, title: pendingReviews > 0 ? 'Corrigir erros e falsas certezas' : 'Revisar e corrigir a semana', type: 'revisao', duration: 60, priority: 1 }))
    } else {
      rows.push(demand({ weekStart, day, slot: 'estudo', target, title: `Estudar: ${target.topic || target.subject}`, type: 'estudo', duration: studyDuration, priority: day >= 5 ? 3 : 2 }))
    }
    if (day === 4) {
      rows.push(demand({ weekStart, day, slot: 'consolidacao', target: complementary || target, title: 'Consolidar os pontos estudados na semana', type: 'revisao', duration: 60, priority: 2 }))
    }
  }

  return rows.filter(Boolean)
}
