import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'
import { loadMentorSpecialists, loadModuleKnowledge } from './_lib/module-knowledge.js'
import { buildScenarios, calculateCardRetention, calculateStudyEfficiency, calculateTopicDiagnosis, classifyQuestionAttempts, diversifyPriorities, mentorPhase, topicSignals } from '../shared/mentor.js'
import { adherenceAdjustment } from '../shared/planner.js'
import { decideMentorCycle } from '../shared/mentor-decision.js'
import { calculateMentorSpecialistSignals } from '../shared/mentor-specialists.js'

function mondayForDate(date, next = false) {
  const value = new Date(`${date}T12:00:00Z`)
  value.setUTCDate(value.getUTCDate() - (value.getUTCDay() || 7) + 1 + (next ? 7 : 0))
  return value.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10)
}
const brazilDate = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin()
    if (req.method === 'POST') {
      const semanaInicio = String(req.body?.semanaInicio || '')
      const cargaPercebida = String(req.body?.cargaPercebida || '')
      if (!/^\d{4}-\d{2}-\d{2}$/.test(semanaInicio) || new Date(`${semanaInicio}T12:00:00Z`).getUTCDay() !== 1) return res.status(400).json({ error: 'Informe a segunda-feira da semana do encontro.' })
      const today = brazilDate(new Date())
      if (semanaInicio !== mondayForDate(today)) return res.status(400).json({ error: 'O encontro deve corresponder à semana atual.' })
      if (cargaPercebida && !['leve', 'adequada', 'pesada'].includes(cargaPercebida)) return res.status(400).json({ error: 'Classifique a carga como leve, adequada ou pesada.' })
      const allowedClassifications = ['dificuldade_conteudo', 'dificuldade_volume', 'dificuldade_questoes', 'dificuldade_revisao', 'problema_material', 'estrategia_funcionou', 'faculdade_atrasada', 'faculdade_em_dia']
      const classifications = [...new Set((Array.isArray(req.body?.classificacoes) ? req.body.classificacoes : []).filter((item) => allowedClassifications.includes(item)))]
      const nextWeek = mondayForDate(today, true)
      const unavailable = [...new Set((Array.isArray(req.body?.fatos?.indisponivel_em) ? req.body.fatos.indisponivel_em : []).filter((item) => /^\d{4}-\d{2}-\d{2}$/.test(item) && item >= nextWeek && item <= addDays(nextWeek, 6)))]
      const difficultyLevel = String(req.body?.fatos?.dificuldade_nivel || '')
      if (difficultyLevel && !['baixa', 'media', 'alta'].includes(difficultyLevel)) return res.status(400).json({ error: 'Classifique a dificuldade como baixa, média ou alta.' })
      const facts = { acontecimentos: String(req.body?.fatos?.acontecimentos || '').trim().slice(0, 600), dificuldade_nivel: difficultyLevel || null, dificuldade: String(req.body?.fatos?.dificuldade || '').trim().slice(0, 600), impedimentos: String(req.body?.fatos?.impedimentos || '').trim().slice(0, 600), excecoes: String(req.body?.fatos?.excecoes || '').trim().slice(0, 600), indisponivel_em: unavailable }
      facts.avaliacoes = []
      const assessments = Array.isArray(req.body?.fatos?.avaliacoes) ? req.body.fatos.avaliacoes.slice(0, 10) : []
      for (const assessment of assessments) {
        if (!['prova', 'entrega'].includes(assessment?.tipo) || !/^\d{4}-\d{2}-\d{2}$/.test(assessment.data || '') || assessment.data < today || !assessment.materia_id || !String(assessment.titulo || '').trim()) return res.status(400).json({ error: 'Informe tipo, data, disciplina e título de cada prova ou entrega.' })
        const subject = await supabase.from('materia').select('id,objetivo_id,objetivo:objetivo_id(tipo)').eq('id', assessment.materia_id).maybeSingle()
        if (subject.error) throw subject.error
        if (subject.data?.objetivo?.tipo !== 'faculdade') return res.status(400).json({ error: 'Selecione uma disciplina da Faculdade.' })
        facts.avaliacoes.push({ tipo: assessment.tipo, data: assessment.data, objetivo_id: subject.data.objetivo_id, materia_id: subject.data.id, titulo: String(assessment.titulo).trim().slice(0, 160) })
      }
      const payload = {
        semana_inicio: semanaInicio,
        carga_percebida: cargaPercebida || null,
        observacoes: String(req.body?.observacoes || '').trim().slice(0, 1200) || null,
        classificacoes: classifications,
        fatos: facts,
        realizado_em: new Date().toISOString(),
        atualizado_em: new Date().toISOString(),
      }
      const { data, error } = await supabase.from('mentor_encontro_semanal').upsert(payload, { onConflict: 'semana_inicio' }).select('*').single()
      if (error) throw error
      if (new Date(`${today}T12:00:00Z`).getUTCDay() !== 0) return res.status(200).json({ encontro_semanal: data, planejamento_pendente: true })
      try {
        const { prepareMentorWeek } = await import('./_lib/plano-handler.js')
        const planned = await prepareMentorWeek({ inicio: nextWeek, today, force: true, source: 'encontro' })
        return res.status(200).json({ encontro_semanal: data, planejamento: planned.body, planejamento_pendente: planned.status !== 200 })
      } catch {
        return res.status(200).json({ encontro_semanal: data, planejamento_pendente: true })
      }
    }
    const objetivoId = queryParam(req, 'objetivoId')
    const compact = queryParam(req, 'compacto') === '1'
    const currentWeek = mondayForDate(brazilDate(new Date()))
    const previousStart = addDays(currentWeek, -7)
    const previousEnd = addDays(currentWeek, -1)
    const [{ data: topics, error: topicsError }, { data: records, error: recordsError }, { data: reviewItems, error: reviewError }, { data: inventory, error: inventoryError }, modularKnowledge, { data: menteeContext, error: contextError }, { data: objective }, { data: weeklySessions, error: sessionsError }, { data: pendingSessions, error: pendingError }, { data: commitments, error: commitmentsError }, { data: weeklyMeeting, error: meetingError }, { data: cards, error: cardsError }, { data: cardRecords, error: cardRecordsError }, { data: timers, error: timersError }, { data: materials, error: materialsError }, { data: materialProgress, error: progressError }, { data: previousMeeting, error: previousMeetingError }, specialistModules, { data: classEvents, error: classEventsError }, { data: studiedClasses, error: studiedClassesError }] = await Promise.all([
      supabase.from('topico').select('id,nome,incidencia,materia:materia_id(id,nome,peso_prova,objetivo:objetivo_id(id,nome))'),
      supabase.from('registro').select('resultado,classificacao,tempo,criado_em,questao!inner(id,topico_id,topico:topico_id(materia:materia_id(objetivo_id)))').order('criado_em', { ascending: false }),
      supabase.from('revisao_item').select('id,status,motivo,prioridade,agendada_para,questao:questao_id(id,enunciado,topico_id,topico:topico_id(materia:materia_id(objetivo_id)))').eq('status', 'pendente').order('prioridade').order('agendada_para').limit(20),
      supabase.from('mentor_acervo_topico').select('*'),
      loadModuleKnowledge(supabase, 'mentor'),
      supabase.from('mentor_contexto').select('fase,vigente_desde,semana_inicio,dados').eq('id', 1).single(),
      objetivoId ? supabase.from('objetivo').select('id,data_alvo,config').eq('id', objetivoId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('sessao').select('id,status,data,data_planejada_original,duracao_estimada,topico_id,objetivo_id,concluida_em').eq('origem', 'mentor').gte('data_planejada_original', addDays(previousStart, -7)).lte('data_planejada_original', previousEnd),
      supabase.from('sessao').select('id,titulo,data,prioridade,objetivo_id').neq('status','feita').neq('status','cancelada').lte('data',addDays(currentWeek,6)).order('data').limit(30),
      supabase.from('compromisso').select('id,titulo,data,tipo,objetivo_id,materia_id,concluido').eq('concluido',false).gte('data',new Date().toISOString().slice(0,10)).lte('data',addDays(new Date().toISOString().slice(0,10),14)).order('data').limit(20),
      supabase.from('mentor_encontro_semanal').select('id,semana_inicio,carga_percebida,observacoes,classificacoes,fatos,realizado_em,atualizado_em').eq('semana_inicio', currentWeek).maybeSingle(),
      supabase.from('question_card').select('id,topico_id,proxima_revisao,lapsos,ativo'),
      supabase.from('question_card_registro').select('resultado,criado_em,question_card!inner(topico_id)').order('criado_em', { ascending: false }),
      supabase.from('tempo_estudo').select('topico_id,status,segundos_acumulados,finalizado_em').eq('status','concluido').gte('finalizado_em', addDays(new Date().toISOString().slice(0,10), -28)),
      supabase.from('material').select('id,objetivo_id,materia_id,nome,disciplina_curso,ordem_curso,estado_extracao,objetivo:objetivo_id(tipo)').eq('status', 'aceito'),
      supabase.from('material_progresso').select('material_id,estado,concluido_em'),
      supabase.from('mentor_encontro_semanal').select('semana_inicio,carga_percebida,fatos').eq('semana_inicio', previousStart).maybeSingle(),
      loadMentorSpecialists(supabase),
      supabase.from('sessao').select('id,materia_id,titulo,data').eq('tipo', 'aula').eq('status', 'feita').gte('data', addDays(currentWeek, -90)).lte('data', addDays(currentWeek, 14)),
      supabase.from('sessao').select('aula_origem_id').eq('tipo', 'estudo').eq('status', 'feita').not('aula_origem_id', 'is', null),
    ])
    if (topicsError || recordsError || reviewError || inventoryError || contextError || sessionsError || pendingError || commitmentsError || meetingError || cardsError || cardRecordsError || timersError || materialsError || progressError || previousMeetingError || classEventsError || studiedClassesError || !modularKnowledge) throw topicsError || recordsError || reviewError || inventoryError || contextError || sessionsError || pendingError || commitmentsError || meetingError || cardsError || cardRecordsError || timersError || materialsError || progressError || previousMeetingError || classEventsError || studiedClassesError || new Error('Conhecimento principal do Mentor ausente.')

    const policy = modularKnowledge.conteudo?.politica || {}
    const context = { ...menteeContext.dados, fase: menteeContext.fase, vigente_desde: menteeContext.vigente_desde, semana_inicio: menteeContext.semana_inicio }
    const currentCycle = ['adaptacao_teorica_1', 'base_teorica_adaptativa'].includes(context.fase)
    const practiceActive = context.rotina_pratica?.questoes === true || context.rotina_pratica?.question_cards === true || context.rotina_pratica?.revisao_pratica === true
    const topicMap = new Map()
    for (const topic of topics || []) {
      if (objetivoId && topic.materia?.objetivo?.id !== objetivoId) continue
      topicMap.set(topic.id, topic)
    }
    const recordsByTopic = new Map()
    for (const record of records || []) {
      if (objetivoId && record.questao?.topico?.materia?.objetivo_id !== objetivoId) continue
      const id = record.questao?.topico_id
      if (topicMap.has(id)) recordsByTopic.set(id, [...(recordsByTopic.get(id) || []), record])
    }
    const reviewsByTopic = new Map()
    const filteredReviews = []
    for (const item of reviewItems || []) {
      if (objetivoId && item.questao?.topico?.materia?.objetivo_id !== objetivoId) continue
      filteredReviews.push(item)
      const id = item.questao?.topico_id
      reviewsByTopic.set(id, (reviewsByTopic.get(id) || 0) + 1)
    }
    const inventoryByTopic = new Map((inventory || []).map((item) => [item.topico_id, item]))
    const cardsByTopic = new Map()
    for (const card of cards || []) cardsByTopic.set(card.topico_id, [...(cardsByTopic.get(card.topico_id) || []), card])
    const cardRecordsByTopic = new Map()
    for (const record of cardRecords || []) {
      const id = record.question_card?.topico_id
      if (id) cardRecordsByTopic.set(id, [...(cardRecordsByTopic.get(id) || []), record])
    }
    const timersByTopic = new Map()
    for (const timer of timers || []) if (timer.topico_id) timersByTopic.set(timer.topico_id, [...(timersByTopic.get(timer.topico_id) || []), timer])
    const diagnoses = [...topicMap.values()].map((topic) => {
      const topicRecords = classifyQuestionAttempts(recordsByTopic.get(topic.id) || [], policy.evidencia_individual?.intervalo_minimo_reteste_dias || 2)
      const stock = inventoryByTopic.get(topic.id) || {}
      const diagnosis = calculateTopicDiagnosis(topicRecords, policy)
      const cardRetention = calculateCardRetention(cardRecordsByTopic.get(topic.id) || [], cardsByTopic.get(topic.id) || [], policy)
      const studyEfficiency = calculateStudyEfficiency(timersByTopic.get(topic.id) || [], diagnosis, cardRetention, policy)
      const times = topicRecords.map((record) => Number(record.tempo) || 0).filter(Boolean)
      return {
        id: topic.id,
        nome: topic.nome,
        materia_id: topic.materia?.id,
        materia: topic.materia?.nome,
        objetivo_id: topic.materia?.objetivo?.id,
        objetivo: topic.materia?.objetivo?.nome,
        ...topicSignals({
          diagnosis,
          cardRetention,
          studyEfficiency,
          totalQuestions: stock.total_questoes || 0,
          unusedQuestions: stock.questoes_ineditas || 0,
          dueQuestions: stock.questoes_vencidas || 0,
          dueCards: stock.cards_vencidos || 0,
          lastSeenAt: topicRecords[0]?.criado_em,
          averageSeconds: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0,
          overdue: reviewsByTopic.get(topic.id) || 0,
          subjectWeight: topic.materia?.peso_prova,
          incidence: topic.incidencia,
          customPolicy: policy,
        }),
      }
    })
    const prioridades = diversifyPriorities(diagnoses
      .filter((item) => item.status === 'prioridade' || item.cards_vencidos || item.questoes_para_revisar || item.risco_esquecimento >= 60)
      .map((item) => ({ ...item, motivo: item.falsa_certeza >= 10 ? 'Falsa certeza exige correção imediata.' : item.questoes_para_revisar ? 'Há questões programadas para revisão espaçada.' : item.retencao_cards?.status === 'retencao_fraca' ? 'A recuperação nos Question Cards precisa de revisão.' : item.cards_vencidos ? 'Há Question Cards vencidos.' : 'Risco de esquecimento ou domínio insuficiente.' })), policy.decisao_semanal?.maximo_prioridades || 3, policy.prioridade_topico?.maximo_mesma_disciplina || 2)
    const revisaoImediata = practiceActive ? filteredReviews.map((item) => ({ id: item.id, questao_id: item.questao.id, topico_id: item.questao.topico_id, enunciado: item.questao.enunciado, motivo: item.motivo, prioridade: item.prioridade, agendada_para: item.agendada_para })) : []
    const coveredTopics = diagnoses.filter((item) => item.retencao_confirmada && item.amostra >= (policy.amostra_minima || 10) && ['estavel', 'melhorando'].includes(item.status)).length
    const projectedTarget = objective?.data_alvo || objective?.config?.planejar_ate || objective?.config?.janela_provavel_prova?.fim
    const hasTargetDate = Boolean(projectedTarget)
    const daysRemaining = hasTargetDate ? Math.max(1, Math.ceil((new Date(projectedTarget) - Date.now()) / 86_400_000)) : null
    const phasePreviousWeek = previousStart >= context.semana_inicio
    const activeMeeting = weeklyMeeting
    const scopedSessions = phasePreviousWeek ? (weeklySessions || []).filter((item) => item.data_planejada_original >= previousStart && !['cancelada'].includes(item.status) && (!objetivoId || item.objetivo_id === objetivoId)) : []
    const planned = scopedSessions.length
    const completedSessions = scopedSessions.filter((item) => item.status === 'feita' && item.concluida_em && brazilDate(item.concluida_em) <= previousEnd)
    const completed = completedSessions.length
    const completedMinutes = completedSessions.reduce((sum, item) => sum + (item.duracao_estimada || 0), 0)
    const cenarios = currentCycle ? [] : buildScenarios({ coveredTopics, totalTopics: diagnoses.length, daysRemaining, weeklyMinutes: completedMinutes })
    const adherence = planned ? completed / planned : 0
    const adjustment = currentCycle ? null : adherenceAdjustment(planned ? [{ inicio: previousStart, planejadas: planned, concluidas: completed }] : [], activeMeeting)
    const probable = cenarios.find((item) => item.cenario === 'provavel')
    const remainingTopics = Math.max(0, diagnoses.length - coveredTopics)
    const trajectory = { conteudo_restante: remainingTopics, topicos_totais: diagnoses.length, ritmo_atual: planned ? `${completed} de ${planned} demandas` : 'coletando dados', capacidade_projetada: hasTargetDate ? probable?.cobertura_estimada || 0 : null, risco_nao_concluir: hasTargetDate && probable ? Math.round(probable.risco_atraso * 100) : null, data_alvo_definida: hasTargetDate, data_provisoria: !objective?.data_alvo && Boolean(projectedTarget), data_referencia: projectedTarget || null }
    const weeklyClose = { semana_inicio: previousStart, semana_fim: previousEnd, planejado: planned, realizado: completed, minutos_realizados: completedMinutes, pendencias: Math.max(0, planned - completed), revisoes_pendentes: filteredReviews.length, aderencia: Math.round(adherence * 100), ajuste_proxima_semana: adjustment?.nivel || 'manter' }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    const scopedPending=(pendingSessions||[]).filter((item)=>(!objetivoId||item.objetivo_id===objetivoId) && item.data>=context.semana_inicio)
    const reportedCommitments = (previousMeeting?.fatos?.avaliacoes || []).filter((item) => item.data >= today).map((item) => ({ ...item, concluido: false, peso: item.tipo === 'prova' ? 5 : 4 }))
    const scopedCommitments=[...(commitments||[]), ...reportedCommitments].filter((item)=>!objetivoId||item.objetivo_id===objetivoId)
    const finishedMaterials = new Set((materialProgress || []).filter((item) => item.estado === 'concluido').map((item) => item.material_id))
    const bacenMaterials = (materials || []).filter((item) => item.objetivo?.tipo === 'concurso' && item.estado_extracao !== 'pendente_ocr')
    const decisionHistory = [addDays(previousStart, -7), previousStart].map((start) => {
      const end = addDays(start, 6)
      const items = (weeklySessions || []).filter((item) => item.status !== 'cancelada' && item.data_planejada_original >= start && item.data_planejada_original <= end)
      return { inicio: start, planejadas: items.length, concluidas: items.filter((item) => item.status === 'feita' && item.concluida_em && brazilDate(item.concluida_em) <= end).length }
    })
    const studyUnits = (materials || []).map((item) => ({ id: item.id, context: item.objetivo?.tipo, subjectId: item.materia_id,
      courseSubject: item.disciplina_curso, name: item.nome, order: item.ordem_curso, eligible: item.estado_extracao !== 'pendente_ocr' }))
    const studiedClassIds = (studiedClasses || []).map((item) => item.aula_origem_id)
    const specialistSignals = currentCycle ? calculateMentorSpecialistSignals({ date: today, context, history: decisionHistory,
      pendingCount: scopedPending.filter((item) => item.data < today).length, weeklyMeeting: previousMeeting,
      studyUnits, materialProgress: materialProgress || [], commitments: scopedCommitments,
      academicClasses: (classEvents || []).map((item) => ({ id: item.id, subjectId: item.materia_id, date: item.data, studied: studiedClassIds.includes(item.id) })),
      studiedClassIds, reviewItems: filteredReviews, answers: records || [], policy, modules: specialistModules }) : null
    if (specialistSignals) {
      trajectory.conteudo_restante = specialistSignals.trilha.restantes
      trajectory.topicos_totais = specialistSignals.trilha.total
      trajectory.unidade = 'materiais'
      trajectory.ritmo_atual = specialistSignals.previsao.ritmo_materiais_semana === null ? 'coletando dados' : `${specialistSignals.previsao.ritmo_materiais_semana} materiais por semana`
      trajectory.capacidade_projetada = specialistSignals.previsao.cobertura_projetada_percentual
      trajectory.risco_nao_concluir = specialistSignals.previsao.risco_nao_concluir === 'UNKNOWN' ? null : specialistSignals.previsao.risco_nao_concluir
      trajectory.data_alvo_definida = Boolean(specialistSignals.previsao.data_referencia)
      trajectory.data_provisoria = specialistSignals.previsao.tipo_data === 'PROVISORIA'
      trajectory.data_referencia = specialistSignals.previsao.data_referencia
    }
    const decision = decideMentorCycle({ date: today, cycleKey: currentWeek, context, history: decisionHistory, weeklyMeeting: previousMeeting, curriculum: { remaining: bacenMaterials.length - bacenMaterials.filter((item) => finishedMaterials.has(item.id)).length, baseComplete: bacenMaterials.length > 0 && bacenMaterials.every((item) => finishedMaterials.has(item.id)) }, commitments: scopedCommitments, pendingCount: scopedPending.filter((item) => item.data < today).length, policy, specialistSignals })
    if (decision) weeklyClose.ajuste_proxima_semana = decision.action
    const effectiveAdjustment = decision ? { nivel: decision.action, motivo: decision.reason_codes[0] } : adjustment
    const alerts=[]
    if(activeMeeting?.classificacoes?.includes('problema_material')) alerts.push({tipo:'material',gravidade:'alta',titulo:'Material precisa de verificação',mensagem:'O encontro semanal registrou um problema no material. Revise a fonte antes de avançar neste conteúdo.'})
    const cardsReleased = practiceActive && context.rotina_pratica?.question_cards !== false
    if(practiceActive && filteredReviews.length) alerts.push({tipo:'revisao',gravidade:'alta',titulo:`${filteredReviews.length} revisoes vencidas`,mensagem:'A central de revisao ordenou os itens mais urgentes.'})
    const overdue=scopedPending.filter((item)=>item.data<today); if(overdue.length) alerts.push({tipo:'pendencia',gravidade:'alta',titulo:`${overdue.length} demandas nao concluidas`,mensagem:'O conteúdo volta à fila sem criar dívida de horas.'})
    if(overdue.length>=8) alerts.push({tipo:'acumulo',gravidade:'media',titulo:'Risco de acumulo',mensagem:`Ha ${overdue.length} demandas vencidas para reavaliar.`})
    const falseCertainty = prioridades.find((item) => item.falsa_certeza >= 10)
    if(falseCertainty) alerts.push({tipo:'preparacao_prova',gravidade:'alta',titulo:`Falsa certeza em ${falseCertainty.materia}`,mensagem:`${falseCertainty.nome} precisa de correção e reteste antes de avançar.`})
    if(trajectory.risco_nao_concluir > 0) alerts.push({tipo:'trajetoria',gravidade:trajectory.risco_nao_concluir >= 35 ? 'alta' : 'media',titulo:'Risco na trajetória até a prova',mensagem:`No ritmo atual, o risco projetado é de ${trajectory.risco_nao_concluir}%.`})
    for(const item of scopedCommitments.slice(0,3)) alerts.push({tipo:'prazo',gravidade:'media',titulo:item.titulo,mensagem:`${item.tipo} em ${new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')}.`})
    if(planned && effectiveAdjustment) alerts.push({tipo:'carga',gravidade:'baixa',titulo:`Carga da proxima semana: ${effectiveAdjustment.nivel}`,mensagem:decision?.explanation || effectiveAdjustment.motivo})
    const body = {
      fase: mentorPhase(today, context), prioridades, cenarios,
      politica: { versao: modularKnowledge.versao }, decisao_mentor: decision,
      resumo: currentCycle ? { materiais_concluidos: specialistSignals.trilha.concluidos, materiais_totais: specialistSignals.trilha.total,
        revisoes_imediatas: 0, dominio: 'UNKNOWN' }
        : { topicos_cobertos: coveredTopics, topicos_totais: diagnoses.length, dias_restantes: hasTargetDate ? daysRemaining : null, revisoes_imediatas: revisaoImediata.length },
      trajetoria: trajectory,
      fechamento_semanal: phasePreviousWeek ? weeklyClose : null,
      alertas: alerts,
      semana_atual: currentWeek,
      encontro_semanal: activeMeeting,
      cards_liberados: cardsReleased,
    }
    if (!compact) Object.assign(body, { topicos: diagnoses, revisao_imediata: revisaoImediata, sinais_especialistas: specialistSignals })
    return res.status(200).json(body)
  } catch (error) {
    return fail(res, error, 'Nao foi possivel gerar o diagnostico.')
  }
}
