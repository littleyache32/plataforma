import { buildMentorWeek, validateMentorPlan, weeklyLoadProfile } from '../shared/planner.js'

const DAY_MS = 86_400_000
const start = process.argv.find((item) => item.startsWith('--inicio='))?.split('=')[1] || '2026-08-17'
const weeks = Math.max(3, Number(process.argv.find((item) => item.startsWith('--semanas='))?.split('=')[1] || 52))
const activeQuestions = Math.max(0, Number(process.argv.find((item) => item.startsWith('--questoes='))?.split('=')[1] || 0))
const activeCards = Math.max(0, Number(process.argv.find((item) => item.startsWith('--cards='))?.split('=')[1] || 0))

const addDays = (date, days) => new Date(new Date(`${date}T12:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10)
const facultySubjects = [
  'Direito das Pessoas e dos Negócios Jurídicos',
  'Teoria do Crime',
  'Teorias da Justiça',
  'Teoria da Constituição e Direitos Fundamentais',
].map((nome, index) => ({ id: `fac-${index}`, nome, topicos: [{ id: `fac-${index}-topico`, nome: 'Conteúdo atual' }] }))
const bacenSubjects = Array.from({ length: 12 }, (_, index) => ({ id: `bacen-${index}`, nome: `Disciplina BACEN ${index + 1}`, topicos: Array.from({ length: 6 }, (__, topic) => ({ id: `bacen-${index}-${topic}`, nome: `Tópico ${topic + 1}` })) }))
const catalog = [
  { id: 'faculdade', tipo: 'faculdade', materias: facultySubjects },
  { id: 'bacen', tipo: 'concurso', materias: bacenSubjects },
]
const studiedTopicIds = bacenSubjects.flatMap((subject) => subject.topicos.map((topic) => topic.id))

const scenarios = [
  { id: 'conservador', adherence: 0.72, weekdayCapacity: 180 },
  { id: 'provavel', adherence: 0.9, weekdayCapacity: 240 },
  { id: 'intensivo', adherence: 0.95, weekdayCapacity: 360 },
]

function simulate(scenario) {
  const history = []
  const timeline = []
  let totalMinutes = 0
  let impossiblePractice = 0
  let firstCards = null
  for (let index = 0; index < weeks; index += 1) {
    const weekStart = addDays(start, index * 7)
    const recentHistory = history.slice(-2)
    const profile = weeklyLoadProfile(weekStart, recentHistory)
    const demands = buildMentorWeek({ weekStart, catalog, adherenceHistory: recentHistory, studiedTopicIds })
    const validation = validateMentorPlan(demands)
    if (!validation.valid) throw new Error(`${scenario.id}: plano inválido em ${weekStart}: ${validation.reason}`)
    const cards = demands.filter((item) => item.tipo === 'especial')
    const questions = demands.filter((item) => item.tipo === 'exercicio')
    if (cards.length && !firstCards) firstCards = weekStart
    if (activeCards === 0) impossiblePractice += cards.length
    if (activeQuestions === 0) impossiblePractice += questions.length
    const plannedMinutes = demands.reduce((sum, item) => sum + item.duracao_estimada, 0)
    const completedMinutes = Math.round(plannedMinutes * scenario.adherence)
    const actualWeekday = Math.min(scenario.weekdayCapacity, profile.segunda_sexta + 60)
    history.push({
      inicio: weekStart,
      planejadas: demands.length,
      concluidas: Math.round(demands.length * scenario.adherence),
      pendencias: Math.max(0, demands.length - Math.round(demands.length * scenario.adherence)),
      minutos_planejados: plannedMinutes,
      minutos_concluidos: completedMinutes,
      media_segunda_sexta: profile.segunda_sexta,
      media_real_segunda_sexta: actualWeekday,
    })
    totalMinutes += plannedMinutes
    timeline.push({ semana: index + 1, inicio: weekStart, dias_uteis_min: profile.segunda_sexta, fim_semana_min: profile.sabado, qc_diario_min: cards.length ? 30 : 0, ajuste: profile.nivel, demandas: demands.length, horas_planejadas: Number((plannedMinutes / 60).toFixed(1)) })
  }
  const last = timeline.at(-1)
  return {
    cenario: scenario.id,
    aderencia_simulada: scenario.adherence,
    periodo: { inicio: start, fim: addDays(start, weeks * 7 - 1), semanas: weeks },
    primeira_semana_com_qc: firstCards,
    carga_final: { dias_uteis_min: last.dias_uteis_min, fim_semana_min: last.fim_semana_min, qc_diario_min: last.qc_diario_min },
    horas_planejadas_total: Number((totalMinutes / 60).toFixed(1)),
    demandas_de_pratica_sem_acervo: impossiblePractice,
    semanas_chave: timeline.filter((item, index) => index < 3 || index === timeline.length - 1 || item.ajuste !== timeline[index - 1]?.ajuste),
  }
}

console.log(JSON.stringify({
  tipo: 'simulacao_hipotetica_sem_data_alvo_real',
  observacao: 'O BACEN não possui data-alvo cadastrada. O período de 52 semanas serve apenas como teste de estresse.',
  inventario: { questoes_ativas: activeQuestions, cards_ativos: activeCards },
  resultados: scenarios.map(simulate),
}, null, 2))
