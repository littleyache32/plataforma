import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, requireAccess } from './http.js'
import { calculateCardRetention, calculateStudyEfficiency, calculateTopicDiagnosis, diversifyPriorities, topicSignals } from '../../shared/mentor.js'
import { NEW_CYCLE_START, adherenceAdjustment, buildMentorWeek, canGenerateMentorWeek, completedMaterialIdsFromProgress, currentPhaseCarryover, isMentorRestartWeek, isMentorResumptionWeek, planOverdueMoves, reconcileMentorDemands, validateMentorPlan, weeklyLoadProfile } from '../../shared/planner.js'
import { resolveMentorPolicy } from '../../shared/mentor-policy.js'
import { classifyMentorPriority, decideMentorCycle, mentorCycleState, rankMentorMaterials } from '../../shared/mentor-decision.js'
import { calculateMentorSpecialistSignals } from '../../shared/mentor-specialists.js'
import { loadMentorSpecialists, loadModuleKnowledge } from './module-knowledge.js'
import { createHash } from 'node:crypto'

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const addDays = (date, days) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10) }
const brazilDate = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))
export const brazilToday = () => brazilDate(new Date())
export const mondayForDate = (date, next = false) => { const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() - (value.getUTCDay() || 7) + 1 + (next ? 7 : 0)); return value.toISOString().slice(0, 10) }
const normalized = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

async function ensureResumptionCommitments(supabase, catalog, policy) {
  const faculty = catalog.find((item) => item.tipo === 'faculdade')
  if (!faculty || !Array.isArray(policy.retomada?.avaliacoes)) return
  for (const item of policy.retomada.avaliacoes) {
    const expected = normalized(item.materia)
    const subject = (faculty.materias || []).find((entry) => normalized(entry.nome).includes(expected) || expected.includes(normalized(entry.nome)))
    if (!subject) continue
    const existing = await supabase.from('compromisso').select('id').eq('materia_id', subject.id).eq('data', item.data).maybeSingle()
    if (existing.error) throw existing.error
    if (existing.data) continue
    const title = item.tipo === 'trabalho_em_grupo' ? `Trabalho em grupo de ${subject.nome}` : `Prova de ${subject.nome}`
    const inserted = await supabase.from('compromisso').insert({ objetivo_id: faculty.id, materia_id: subject.id, titulo: title, tipo: item.tipo === 'trabalho_em_grupo' ? 'entrega' : 'prova', data: item.data, peso: item.tipo === 'trabalho_em_grupo' ? 4 : 5, duracao_minutos: item.tipo === 'trabalho_em_grupo' ? 50 : 90, concluido: false })
    if (inserted.error) throw inserted.error
  }
}

function adherenceHistory(sessions, timers, weekStart) {
  return [-14, -7].map((offset) => {
    const inicio = addDays(weekStart, offset)
    const fim = addDays(inicio, 6)
    const week = sessions.filter((item) => item.status !== 'cancelada' && item.data_planejada_original >= inicio && item.data_planejada_original <= fim)
    const concludedByEnd = (item) => item.status === 'feita' && item.concluida_em && brazilDate(item.concluida_em) <= fim
    const completed = week.filter(concludedByEnd)
    const weekdays = week.filter((item) => {
      const day = new Date(`${item.data_planejada_original}T12:00:00Z`).getUTCDay()
      return day >= 1 && day <= 5
    })
    const weekdayDates = new Set(weekdays.map((item) => item.data_planejada_original))
    const completedTimers = timers.filter((item) => item.status === 'concluido' && item.finalizado_em && brazilDate(item.finalizado_em) >= inicio && brazilDate(item.finalizado_em) <= fim)
    const weekdayTimerDates = new Set(completedTimers.map((item) => brazilDate(item.finalizado_em)).filter((date) => {
      const day = new Date(`${date}T12:00:00Z`).getUTCDay()
      return day >= 1 && day <= 5
    }))
    const weekdayRealSeconds = completedTimers.filter((item) => weekdayTimerDates.has(brazilDate(item.finalizado_em))).reduce((sum, item) => sum + Number(item.segundos_acumulados || 0), 0)
    return {
      inicio,
      planejadas: week.length,
      concluidas: completed.length,
      pendencias: week.length - completed.length,
      minutos_planejados: week.reduce((sum, item) => sum + Number(item.duracao_estimada || 0), 0),
      minutos_concluidos: completed.reduce((sum, item) => sum + Number(item.duracao_estimada || 0), 0),
      media_segunda_sexta: weekdayDates.size ? Math.round(weekdays.reduce((sum, item) => sum + Number(item.duracao_estimada || 0), 0) / weekdayDates.size) : 0,
      minutos_reais: Math.round(completedTimers.reduce((sum, item) => sum + Number(item.segundos_acumulados || 0), 0) / 60),
      media_real_segunda_sexta: weekdayTimerDates.size ? Math.round(weekdayRealSeconds / 60 / weekdayTimerDates.size) : 0,
    }
  })
}

function allocateQuestionReviews(groups, weekStart, weekEnd) {
  const occupied = new Set()
  const allocated = []
  const ordered = [...groups].sort((a, b) => a.dueDate.localeCompare(b.dueDate) || (b.count || 0) - (a.count || 0))
  for (const group of ordered) {
    for (let date = group.dueDate < weekStart ? weekStart : group.dueDate; date <= weekEnd; date = addDays(date, 1)) {
      if (occupied.has(date)) continue
      occupied.add(date)
      allocated.push({ ...group, dueDate: date })
      break
    }
  }
  return allocated
}

async function reallocateOverdue(supabase, sessions, today, weekEnd) {
  let moved = 0
  for (const move of planOverdueMoves(sessions, today, weekEnd)) {
    const { error } = await supabase.from('sessao').update({ data: move.data, ordem: 1000 + moved, movida_pelo_mentor_em: new Date().toISOString() }).eq('id', move.id)
    if (error) throw error
    moved += 1
  }
  return moved
}

export async function closeMentorWeek({ inicio, today = brazilToday(), supabase = getSupabaseAdmin() }) {
  const end = addDays(inicio, 6)
  if (end >= today || inicio < NEW_CYCLE_START) return { closed: 0 }
  const { data, error } = await supabase.from('sessao').select('id').eq('origem', 'mentor').eq('status', 'planejada').gte('data_planejada_original', inicio).lte('data_planejada_original', end).lte('data', end)
  if (error) throw error
  if (!data?.length) return { closed: 0 }
  const updated = await supabase.from('sessao').update({ status: 'nao_concluida' }).in('id', data.map((item) => item.id)).eq('status', 'planejada')
  if (updated.error) throw updated.error
  return { closed: data.length }
}

async function recordPlanAudit(supabase, { inicio, source, meeting, existing, demands, decision, signals, updated = 0, removed = 0, reasons = [] }) {
  const planBefore = existing.map((item) => ({ chave: item.chave_mentor, data: item.data, status: item.status, cancelamento_origem: item.cancelamento_origem, material_id: item.material_id }))
  const reasonByKey = new Map(reasons.map((item) => [item.chave_mentor, item.reason_codes]))
  const planAfter = demands.map((item) => ({ chave: item.chave_mentor, data: item.data, material_id: item.material_id, reason_codes: reasonByKey.get(item.chave_mentor) || [] }))
  const auditData = { inicio, source, estado: meeting ? 'apos_encontro' : 'provisorio', plano_original: planBefore, plano_final: planAfter, atualizadas: updated, removidas: removed, decisao: decision, sinais: signals }
  const auditKey = createHash('sha256').update(JSON.stringify({ inicio, source, planBefore, planAfter, decisao: decision?.reason_codes })).digest('hex')
  const audit = await supabase.from('mentor_decisao').upsert({ chave_operacao: auditKey, tipo: 'planejamento_semanal', decisao: meeting ? 'Replanejar após encontro' : 'Preparar plano provisório', justificativa: decision?.explanation || 'Planejamento pela política vigente.', dados: auditData }, { onConflict: 'chave_operacao', ignoreDuplicates: true })
  if (audit.error) throw audit.error
}

export async function prepareMentorWeek({ inicio, today = brazilToday(), force = false, source = 'abertura' }) {
  if (!DATE_PATTERN.test(String(inicio || ''))) return { status: 400, body: { error: 'Inicio da semana invalido.' } }
  if (!force && !canGenerateMentorWeek({ weekStart: inicio, today })) return { status: 200, body: { criadas: 0, total_planejado: 0, aguardando_domingo: true } }
  const supabase = getSupabaseAdmin()
  if (inicio > NEW_CYCLE_START) await closeMentorWeek({ inicio: addDays(inicio, -7), today, supabase })
  const weekEnd = addDays(inicio, 6)
  const commitmentEnd = addDays(inicio, 13)
  const adherenceStart = addDays(inicio, -14)
  const results = await Promise.all([
    supabase.from('objetivo').select('id,tipo,materias:materia(id,nome,peso_prova,topicos:topico(id,nome,incidencia))').eq('ativo', true).order('criado_em'),
    supabase.from('registro').select('resultado,classificacao,criado_em,questao!inner(topico_id)').order('criado_em', { ascending: false }),
    supabase.from('revisao_item').select('id', { count: 'exact', head: true }).eq('status', 'pendente'),
    supabase.from('compromisso').select('id,objetivo_id,materia_id,titulo,tipo,data,peso,duracao_minutos,conteudo_previsto,concluido,topicos:compromisso_topico(topico_id)').eq('concluido', false).lte('data', commitmentEnd).gte('data', inicio),
    supabase.from('sessao').select('id,chave_mentor,objetivo_id,materia_id,material_id,titulo,tipo,data,status,cancelamento_origem,movida_em,movida_pelo_mentor_em,ordenada_em,ordem,duracao_estimada,prioridade').gte('data', inicio).lte('data', weekEnd),
    supabase.from('sessao').select('id,data,status,movida_em,movida_pelo_mentor_em,ordem,duracao_estimada,prioridade').eq('status', 'planejada').lt('data', inicio).order('data').limit(100),
    loadModuleKnowledge(supabase, 'mentor').then((data) => ({ data })),
    supabase.from('questao').select('id,topico_id,proxima_revisao').eq('ativa', true).eq('marcada_errada', false).not('proxima_revisao', 'is', null).lte('proxima_revisao', `${weekEnd}T23:59:59-03:00`),
    supabase.from('acervo_meta').select('topico_id').eq('expansao_bloqueada', false),
    supabase.from('sessao').select('data_planejada_original,status,concluida_em,duracao_estimada').eq('origem', 'mentor').gte('data_planejada_original', adherenceStart).lt('data_planejada_original', inicio),
    supabase.from('sessao').select('topico_id').eq('tipo', 'estudo').eq('status', 'feita').not('topico_id', 'is', null),
    supabase.from('mentor_encontro_semanal').select('semana_inicio,carga_percebida,observacoes,classificacoes,fatos').eq('semana_inicio', addDays(inicio, -7)).maybeSingle(),
    supabase.from('tempo_estudo').select('status,finalizado_em,segundos_acumulados,objetivo_id,materia_id,topico_id,contexto').eq('status', 'concluido').gte('finalizado_em', `${adherenceStart}T00:00:00-03:00`).lt('finalizado_em', `${inicio}T00:00:00-03:00`),
    supabase.from('question_card').select('id,topico_id,proxima_revisao,lapsos,ativo'),
    supabase.from('question_card_registro').select('resultado,criado_em,question_card!inner(topico_id)').order('criado_em', { ascending: false }),
    supabase.from('material').select('id,objetivo_id,materia_id,nome,ordem_estudo,ordem_curso,disciplina_curso,estado_extracao,materia:materia_id(nome),objetivo:objetivo_id(tipo)').eq('status', 'aceito').order('materia_id').order('ordem_estudo').order('nome'),
    supabase.from('material_progresso').select('material_id,estado,concluido_em'),
    supabase.from('mentor_contexto').select('fase,vigente_desde,semana_inicio,dados').eq('id', 1).single(),
    supabase.from('sessao').select('id,materia_id,titulo,data').eq('tipo', 'aula').eq('status', 'feita').gte('data', addDays(inicio, -90)).lte('data', weekEnd),
    supabase.from('sessao').select('aula_origem_id').eq('tipo', 'estudo').eq('status', 'feita').not('aula_origem_id', 'is', null),
    supabase.from('sessao').select('material_id,materia_id,objetivo_id,data').eq('origem', 'mentor').eq('tipo', 'estudo').in('status', ['planejada', 'nao_concluida']).gte('data', addDays(today, -14) > NEW_CYCLE_START ? addDays(today, -14) : NEW_CYCLE_START).lt('data', today).order('data').limit(100),
    loadMentorSpecialists(supabase).then((data) => ({ data })),
    supabase.from('material_prioridade_evidencia').select('material_id,incidencia,dificuldade,fonte,evidencia,atualizado_em'),
    supabase.from('revisao_item').select('id,status,agendada_para').eq('status', 'pendente').limit(500),
  ])
  const error = results.find((item) => item.error)?.error
  if (error) throw error
  const [catalogResult, recordsResult, reviewResult, commitmentsResult, existingResult, carryoverResult, knowledgeResult, spacedQuestionResult, availableTopicsResult, adherenceResult, studiedTopicsResult, meetingResult, timersResult, cardsResult, cardRecordsResult, materialsResult, completedMaterialsResult, contextResult, classEventsResult, studiedClassesResult, pendingMaterialsResult, specialistsResult, metadataResult, reviewItemsResult] = results
  const reportedCommitments = (meetingResult.data?.fatos?.avaliacoes || []).filter((item) => item.data >= inicio && item.data <= commitmentEnd).map((item) => ({ ...item, concluido: false, peso: item.tipo === 'prova' ? 5 : 4, topicos: [] }))
  const activeCommitments = [...(commitmentsResult.data || []), ...reportedCommitments.filter((reported) => !(commitmentsResult.data || []).some((item) => item.tipo === reported.tipo && item.data === reported.data && item.materia_id === reported.materia_id && item.titulo === reported.titulo))]
  if (!knowledgeResult.data) throw new Error('Conhecimento principal do Mentor ausente.')
  const availableTopicIds = new Set((availableTopicsResult.data || []).map((item) => item.topico_id))
  const mentorCatalog = (catalogResult.data || []).map((objective) => objective.tipo !== 'concurso' ? objective : ({
    ...objective,
    materias: (objective.materias || []).map((subject) => ({
      ...subject,
      topicos: (subject.topicos || []).filter((topic) => availableTopicIds.has(topic.id)),
    })).filter((subject) => subject.topicos.length),
  }))
  const modularPolicy = knowledgeResult.data?.conteudo?.politica
  const policy = { ...(modularPolicy || {}), versao: knowledgeResult.data.versao }
  const menteeContext = { ...contextResult.data.dados, fase: contextResult.data.fase, vigente_desde: contextResult.data.vigente_desde, semana_inicio: contextResult.data.semana_inicio }
  const newCycle = ['adaptacao_teorica_1', 'base_teorica_adaptativa'].includes(menteeContext.fase)
  const adaptiveStart = addDays(menteeContext.fim_etapa_2 || '2026-10-15', 1)
  if (today >= adaptiveStart && menteeContext.fase === 'adaptacao_teorica_1') {
    const transitioned = await supabase.from('mentor_contexto').update({ fase: 'base_teorica_adaptativa', vigente_desde: adaptiveStart, atualizado_em: new Date().toISOString() }).eq('id', 1).eq('fase', 'adaptacao_teorica_1')
    if (transitioned.error) throw transitioned.error
    menteeContext.fase = 'base_teorica_adaptativa'
  }
  if (!newCycle) await ensureResumptionCommitments(supabase, catalogResult.data || [], { ...policy, retomada: { ...resolveMentorPolicy().retomada, ...(policy.retomada || {}) } })
  if (isMentorResumptionWeek(inicio, policy) && policy.retomada?.zerar_pendencias_anteriores !== false) {
    const cleared = await supabase.from('sessao').delete().neq('status', 'feita').lt('data', inicio)
    if (cleared.error) throw cleared.error
  }
  const grouped = new Map()
  for (const record of recordsResult.data || []) {
    const id = record.questao?.topico_id
    if (!id) continue
    grouped.set(id, [...(grouped.get(id) || []), record])
  }
  const cardsByTopic = new Map()
  for (const card of cardsResult.data || []) cardsByTopic.set(card.topico_id, [...(cardsByTopic.get(card.topico_id) || []), card])
  const cardRecordsByTopic = new Map()
  for (const record of cardRecordsResult.data || []) {
    const id = record.question_card?.topico_id
    if (id) cardRecordsByTopic.set(id, [...(cardRecordsByTopic.get(id) || []), record])
  }
  const timersByTopic = new Map()
  for (const timer of timersResult.data || []) if (timer.topico_id) timersByTopic.set(timer.topico_id, [...(timersByTopic.get(timer.topico_id) || []), timer])
  const topicMetadata = new Map(mentorCatalog.flatMap((objective) => (objective.materias || []).flatMap((subject) => (subject.topicos || []).map((topic) => [topic.id, { subjectId: subject.id, weight: subject.peso_prova, incidence: topic.incidencia }]))))
  const commitmentWeight = new Map()
  for (const commitment of activeCommitments) {
    for (const link of commitment.topicos || []) commitmentWeight.set(link.topico_id, Math.max(commitmentWeight.get(link.topico_id) || 0, Number(commitment.peso) || 0))
  }
  const ranked = [...new Set([...grouped.keys(), ...cardsByTopic.keys(), ...topicMetadata.keys()])].map((id) => {
    const diagnosis = calculateTopicDiagnosis(grouped.get(id) || [], policy)
    const cardRetention = calculateCardRetention(cardRecordsByTopic.get(id) || [], cardsByTopic.get(id) || [], policy)
    const efficiency = calculateStudyEfficiency(timersByTopic.get(id) || [], diagnosis, cardRetention, policy)
    const metadata = topicMetadata.get(id) || {}
    return { id, materia_id: metadata.subjectId, ...topicSignals({ diagnosis, cardRetention, studyEfficiency: efficiency, dueCards: cardRetention.cards_vencidos, subjectWeight: metadata.weight, incidence: metadata.incidence, commitmentWeight: commitmentWeight.get(id), customPolicy: policy }) }
  }).filter((item) => item.status === 'prioridade' || item.retencao_cards?.status === 'retencao_fraca' || item.questoes_para_revisar || item.cards_vencidos)
  const priorities = diversifyPriorities(ranked, policy.decisao_semanal?.maximo_prioridades || 3, policy.prioridade_topico?.maximo_mesma_disciplina || 2)
  const reviewGroups = new Map()
  for (const question of spacedQuestionResult.data || []) {
    const due = String(question.proxima_revisao).slice(0, 10)
    const dueDate = due < inicio ? inicio : due
    const key = `${dueDate}|${question.topico_id}`
    const current = reviewGroups.get(key) || { dueDate, topicId: question.topico_id, count: 0 }
    current.count += 1
    reviewGroups.set(key, current)
  }
  const scheduledQuestionReviews = allocateQuestionReviews(reviewGroups.values(), inicio, weekEnd)
  const history = adherenceHistory(adherenceResult.data || [], timersResult.data || [], inicio)
  const adjustment = newCycle ? null : inicio >= '2026-08-17' && inicio < '2026-09-07'
    ? { nivel: 'carga_inicial_fixa', motivo: 'fase_de_construcao_de_base', semanas: history }
    : adherenceAdjustment(history, meetingResult.data)
  const studiedTopicIds = [...new Set((studiedTopicsResult.data || []).map((item) => item.topico_id))]
  const studyUnits = (materialsResult.data || []).map((item) => ({ id: item.id, objectiveId: item.objetivo_id, context: item.objetivo?.tipo, subjectId: item.materia_id, subject: item.disciplina_curso || item.materia?.nome, courseSubject: item.disciplina_curso || item.materia?.nome, name: item.nome || 'Material', order: item.ordem_curso || item.ordem_estudo || 9999, eligible: item.estado_extracao !== 'pendente_ocr' }))
  const completedMaterialIds = completedMaterialIdsFromProgress(completedMaterialsResult.data || [])
  const pendingMaterialIds = [...new Set((pendingMaterialsResult.data || []).map((item) => item.material_id))]
  const facultyObjectiveIds = new Set(mentorCatalog.filter((item) => item.tipo === 'faculdade').map((item) => item.id))
  const pendingFacultySubjectIds = [...new Set((pendingMaterialsResult.data || []).filter((item) => facultyObjectiveIds.has(item.objetivo_id)).map((item) => item.materia_id))]
  const remainingMaterials = studyUnits.filter((item) => item.context === 'concurso' && item.eligible !== false && !completedMaterialIds.includes(item.id)).length
  const studiedClassIds = (studiedClassesResult.data || []).map((item) => item.aula_origem_id)
  const academicClasses = (classEventsResult.data || []).map((item) => ({ id: item.id, subjectId: item.materia_id, date: item.data, content: item.titulo, studied: studiedClassIds.includes(item.id) }))
  const specialistSignals = newCycle ? calculateMentorSpecialistSignals({
    date: inicio < menteeContext.inicio ? menteeContext.inicio : inicio, context: menteeContext, history, pendingCount: pendingMaterialIds.length + pendingFacultySubjectIds.length,
    weeklyMeeting: meetingResult.data, studyUnits, materialProgress: completedMaterialsResult.data || [],
    commitments: activeCommitments, academicClasses, studiedClassIds,
    reviewItems: reviewItemsResult.data || [], answers: recordsResult.data || [], policy, modules: specialistsResult.data,
  }) : null
  const subjectWeights = Object.fromEntries(mentorCatalog.flatMap((objective) => (objective.materias || []).map((subject) => [subject.id, subject.peso_prova])))
  const materialPriorities = newCycle ? rankMentorMaterials({ studyUnits, completedMaterialIds,
    metadata: metadataResult.data || [], subjectWeights, pendingMaterialIds, prerequisites: specialistSignals.trilha.prerequisitos,
    commitments: activeCommitments, date: inicio < menteeContext.inicio ? menteeContext.inicio : inicio }) : []
  const decisionSignals = { curriculum: { remaining: studyUnits.length ? remainingMaterials : undefined, baseComplete: studyUnits.length > 0 && remainingMaterials === 0 }, commitments: activeCommitments, pendingCount: pendingMaterialIds.length + pendingFacultySubjectIds.length, specialistSignals }
  const newCycleLoad = newCycle ? weeklyLoadProfile(inicio, history, policy, meetingResult.data, menteeContext, decisionSignals) : null
  const mentorDecision = newCycle ? (newCycleLoad?.decision || decideMentorCycle({ date: inicio < menteeContext.inicio ? menteeContext.inicio : inicio, cycleKey: inicio, context: menteeContext, history, weeklyMeeting: meetingResult.data, policy, ...decisionSignals })) : null
  const proposedDemands = buildMentorWeek({ weekStart: inicio, catalog: mentorCatalog, priorities, pendingReviews: reviewResult.count || 0, scheduledQuestionReviews, commitments: activeCommitments, adherenceHistory: history, studiedTopicIds, studyUnits, completedMaterialIds, pendingMaterialIds, pendingFacultySubjectIds, academicClasses, weeklyMeeting: meetingResult.data, policy, menteeContext, mentorDecision, materialPriorities })
  if (!proposedDemands.length) return { status: 200, body: { criadas: 0, motivo: 'Nenhuma disciplina disponivel.' } }
  const { demands, recalibrated, activeKeys } = reconcileMentorDemands(proposedDemands, existingResult.data || [])
  if (!demands.length) {
    await recordPlanAudit(supabase, { inicio, source, meeting: meetingResult.data, existing: existingResult.data || [], demands, decision: mentorDecision, signals: specialistSignals })
    return { status: 200, body: { criadas: 0, total_planejado: 0, motivo: 'Todas as demandas desta semana foram apagadas.', planejamento_estado: meetingResult.data ? 'apos_encontro' : 'provisorio' } }
  }
  const validation = validateMentorPlan(demands)
  if (!validation.valid) throw new Error(`Planejamento incoerente bloqueado: ${validation.reason}.`)
  const inProgressMaterials = new Set((completedMaterialsResult.data || []).filter((item) => item.estado === 'em_andamento').map((item) => item.material_id))
  const materialPriorityById = new Map(materialPriorities.map((item) => [item.material_id, item]))
  const demandReasons = newCycle ? demands.map((item) => ({ chave_mentor: item.chave_mentor, reason_codes: [...new Set([
    'UNKNOWN_MASTERY',
    ...(item.data <= (menteeContext.fim_etapa_2 || '2026-10-15') ? ['ADAPTATION_STAGE'] : []),
    ...(materialPriorityById.get(item.material_id)?.reason_codes || []),
    ...classifyMentorPriority({ materialInProgress: inProgressMaterials.has(item.material_id), backlog: pendingMaterialIds.includes(item.material_id) || pendingFacultySubjectIds.includes(item.materia_id) }),
    ...(item.titulo.startsWith('Preparar prova:') ? ['EXAM_NEAR'] : []),
    ...(item.titulo.startsWith('Preparar entrega:') ? ['DELIVERY_NEAR'] : []),
  ])] })) : []
  const reasonsByKey = new Map(demandReasons.map((item) => [item.chave_mentor, item.reason_codes]))
  const upsert = recalibrated.length
    ? await supabase.from('sessao').upsert(recalibrated.map((item) => ({ ...item, reason_codes: reasonsByKey.get(item.chave_mentor) || [] })), { onConflict: 'chave_mentor' }).select('id')
    : { data: [], error: null }
  if (upsert.error) throw upsert.error
  const onboardingWithoutBacenPractice = inicio >= '2026-08-17' && inicio < '2026-08-31'
  const obsoleteIds = (existingResult.data || []).filter((item) => {
    if (item.status !== 'planejada') return false
    if (onboardingWithoutBacenPractice && item.chave_mentor && !activeKeys.has(item.chave_mentor)) return true
    return item.chave_mentor && !activeKeys.has(item.chave_mentor) && !item.movida_em
  }).map((item) => item.id)
  if (obsoleteIds.length) {
    const removed = newCycle
      ? await supabase.from('sessao').update({ status: 'cancelada', cancelamento_origem: 'mentor' }).in('id', obsoleteIds)
      : await supabase.from('sessao').delete().in('id', obsoleteIds)
    if (removed.error) throw removed.error
  }
  const refreshed = await supabase.from('sessao').select('id,data,status,movida_em,movida_pelo_mentor_em,ordem,duracao_estimada,prioridade').gte('data', inicio).lte('data', weekEnd)
  if (refreshed.error) throw refreshed.error
  const discardPriorBacklog = isMentorRestartWeek(inicio, policy) && policy.reinicio?.descartar_pendencias_anteriores !== false
  const sessionsForReallocation = [...(discardPriorBacklog ? [] : currentPhaseCarryover(carryoverResult.data || [], menteeContext)), ...(refreshed.data || [])]
  const reallocationAnchor = today < inicio ? inicio : today
  const moved = !newCycle && reallocationAnchor <= weekEnd ? await reallocateOverdue(supabase, sessionsForReallocation, reallocationAnchor, weekEnd) : 0
  const currentState = newCycle && today >= NEW_CYCLE_START ? mentorCycleState(today, menteeContext) : null
  if (newCycle && meetingResult.data && today >= adaptiveStart && weekEnd >= adaptiveStart && inicio <= today && (!menteeContext.ultima_avaliacao_semana || inicio > menteeContext.ultima_avaliacao_semana)) {
    const load = newCycleLoad
    const concursoBlocks = Math.max(2, Math.round(load.segunda_sexta / 50) - 1)
    const updatedContext = {
      ...contextResult.data.dados,
      carga_atual: { ...menteeContext.carga_atual, concurso: concursoBlocks, faculdade: 1, minutos_bloco: 50 },
      ultima_avaliacao_semana: inicio,
      estado: currentState,
    }
    const saved = await supabase.from('mentor_contexto').update({ dados: updatedContext, atualizado_em: new Date().toISOString() }).eq('id', 1)
    if (saved.error) throw saved.error
  } else if (currentState && contextResult.data.dados?.estado !== currentState) {
    const saved = await supabase.from('mentor_contexto').update({ dados: { ...contextResult.data.dados, estado: currentState }, atualizado_em: new Date().toISOString() }).eq('id', 1)
    if (saved.error) throw saved.error
  }
  const meetingSignals = meetingResult.data?.classificacoes || []
  await recordPlanAudit(supabase, { inicio, source, meeting: meetingResult.data, existing: existingResult.data || [], demands, decision: mentorDecision, signals: specialistSignals, updated: upsert.data?.length || 0, removed: obsoleteIds.length, reasons: demandReasons })
  return { status: 200, body: { planejamento_estado: meetingResult.data ? 'apos_encontro' : 'provisorio', atualizadas: upsert.data?.length || 0, removidas: obsoleteIds.length, total_planejado: demands.length, revisoes_espacadas_planejadas: scheduledQuestionReviews.length, revisoes_adiadas: Math.max(0, reviewGroups.size - scheduledQuestionReviews.length), remanejadas: moved, aderencia_analisada: history, ajuste_carga: mentorDecision ? { nivel: mentorDecision.action, motivo: mentorDecision.reason_codes[0], semanas: mentorDecision.windows } : adjustment, decisao_mentor: mentorDecision, sinais_especialistas: specialistSignals, prioridades_materiais: materialPriorities, motivos_demandas: newCycle ? demandReasons : [], prioridades_aplicadas: priorities.map((item) => ({ topico_id: item.id, acao: item.acao_recomendada, pontuacao: item.prioridade_calculada })), encontro_aplicado: meetingSignals, politica_mentor: policy.versao } }
}

export default async function planHandler(req, res) {
  if (!allowMethods(req, res, ['POST']) || !requireAccess(req, res)) return
  try {
    const result = await prepareMentorWeek({ inicio: req.body?.inicio, force: req.body?.force === true })
    return res.status(result.status).json(result.body)
  } catch (error) {
    return fail(res, error, 'Nao foi possivel preparar sua semana.')
  }
}
