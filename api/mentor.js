import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'
import { loadModuleKnowledge } from './_lib/module-knowledge.js'
import { buildScenarios, calculateTopicDiagnosis, mentorPhase, topicSignals } from '../shared/mentor.js'
import { adherenceAdjustment } from '../shared/planner.js'

function monday(date = new Date()) {
  const value = new Date(date); const day = value.getUTCDay() || 7
  value.setUTCDate(value.getUTCDate() - day + 1); return value.toISOString().slice(0, 10)
}

function addDays(date, days) {
  const value = new Date(`${date}T12:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10)
}
const brazilDate = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value))

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin()
    const objetivoId = queryParam(req, 'objetivoId')
    const compact = queryParam(req, 'compacto') === '1'
    const currentWeek = monday()
    const previousStart = addDays(currentWeek, -7)
    const previousEnd = addDays(currentWeek, -1)
    const [{ data: topics, error: topicsError }, { data: records, error: recordsError }, { data: reviewItems, error: reviewError }, { data: inventory, error: inventoryError }, modularKnowledge, { data: legacyPolicy }, { data: objective }, { data: weeklySessions, error: sessionsError }, { data: pendingSessions, error: pendingError }, { data: commitments, error: commitmentsError }] = await Promise.all([
      supabase.from('topico').select('id,nome,materia:materia_id(id,nome,objetivo:objetivo_id(id,nome))'),
      supabase.from('registro').select('resultado,classificacao,tempo,criado_em,questao!inner(topico_id,topico:topico_id(materia:materia_id(objetivo_id)))').order('criado_em', { ascending: false }),
      supabase.from('revisao_item').select('id,motivo,prioridade,agendada_para,questao:questao_id(id,enunciado,topico_id,topico:topico_id(materia:materia_id(objetivo_id)))').eq('status', 'pendente').order('prioridade').order('agendada_para').limit(20),
      supabase.from('mentor_acervo_topico').select('*'),
      loadModuleKnowledge(supabase, 'mentor').catch(() => null),
      supabase.from('mentor_conhecimento').select('versao,politica').eq('ativo', true).order('criado_em', { ascending: false }).limit(1).maybeSingle(),
      objetivoId ? supabase.from('objetivo').select('id,data_alvo').eq('id', objetivoId).maybeSingle() : Promise.resolve({ data: null }),
      supabase.from('sessao').select('id,status,data,data_planejada_original,duracao_estimada,topico_id,objetivo_id,concluida_em').eq('origem', 'mentor').gte('data_planejada_original', previousStart).lte('data_planejada_original', previousEnd),
      supabase.from('sessao').select('id,titulo,data,prioridade,objetivo_id').neq('status','feita').lte('data',addDays(currentWeek,6)).order('data').limit(30),
      supabase.from('compromisso').select('id,titulo,data,tipo,objetivo_id').eq('concluido',false).gte('data',new Date().toISOString().slice(0,10)).lte('data',addDays(new Date().toISOString().slice(0,10),14)).order('data').limit(20),
    ])
    if (topicsError || recordsError || reviewError || inventoryError || sessionsError || pendingError || commitmentsError) throw topicsError || recordsError || reviewError || inventoryError || sessionsError || pendingError || commitmentsError

    const policy = modularKnowledge?.conteudo?.politica || legacyPolicy?.politica || {}
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
    const diagnoses = [...topicMap.values()].map((topic) => {
      const topicRecords = recordsByTopic.get(topic.id) || []
      const stock = inventoryByTopic.get(topic.id) || {}
      const diagnosis = calculateTopicDiagnosis(topicRecords, policy)
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
          totalQuestions: stock.total_questoes || 0,
          unusedQuestions: stock.questoes_ineditas || 0,
          dueQuestions: stock.questoes_vencidas || 0,
          dueCards: stock.cards_vencidos || 0,
          lastSeenAt: topicRecords[0]?.criado_em,
          averageSeconds: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : 0,
          overdue: reviewsByTopic.get(topic.id) || 0,
        }),
      }
    })
    const prioridades = diagnoses
      .filter((item) => item.status === 'prioridade' || item.cards_vencidos || item.questoes_para_revisar || item.risco_esquecimento >= 60)
      .sort((a, b) => b.prioridade_calculada - a.prioridade_calculada)
      .slice(0, 3)
      .map((item) => ({ ...item, motivo: item.falsa_certeza >= 10 ? 'Falsa certeza exige correção imediata.' : item.questoes_para_revisar ? 'Há questões programadas para revisão espaçada.' : item.cards_vencidos ? 'Há Question Cards vencidos.' : 'Risco de esquecimento ou domínio insuficiente.' }))
    const revisaoImediata = filteredReviews.map((item) => ({ id: item.id, questao_id: item.questao.id, topico_id: item.questao.topico_id, enunciado: item.questao.enunciado, motivo: item.motivo, prioridade: item.prioridade, agendada_para: item.agendada_para }))
    const coveredTopics = diagnoses.filter((item) => item.amostra >= 20 && (item.dominio || 0) >= 68).length
    const hasTargetDate = Boolean(objective?.data_alvo)
    const daysRemaining = hasTargetDate ? Math.max(1, Math.ceil((new Date(objective.data_alvo) - Date.now()) / 86_400_000)) : 180
    const cenarios = buildScenarios({ coveredTopics, totalTopics: diagnoses.length, daysRemaining })
    const scopedSessions = (weeklySessions || []).filter((item) => !objetivoId || item.objetivo_id === objetivoId)
    const planned = scopedSessions.length
    const completedSessions = scopedSessions.filter((item) => item.status === 'feita' && item.concluida_em && brazilDate(item.concluida_em) <= previousEnd)
    const completed = completedSessions.length
    const completedMinutes = completedSessions.reduce((sum, item) => sum + (item.duracao_estimada || 0), 0)
    const adherence = planned ? completed / planned : 0
    const adjustment = adherenceAdjustment(planned ? [{ inicio: previousStart, planejadas: planned, concluidas: completed }] : [])
    const probable = cenarios.find((item) => item.cenario === 'provavel')
    const remainingTopics = Math.max(0, diagnoses.length - coveredTopics)
    const trajectory = { conteudo_restante: remainingTopics, topicos_totais: diagnoses.length, ritmo_atual: planned ? `${completed} de ${planned} demandas` : 'coletando dados', capacidade_projetada: hasTargetDate ? probable?.cobertura_estimada || 0 : null, risco_nao_concluir: hasTargetDate && probable ? Math.round(probable.risco_atraso * 100) : null, data_alvo_definida: hasTargetDate }
    const weeklyClose = { semana_inicio: previousStart, semana_fim: previousEnd, planejado: planned, realizado: completed, minutos_realizados: completedMinutes, pendencias: Math.max(0, planned - completed), revisoes_pendentes: filteredReviews.length, aderencia: Math.round(adherence * 100), ajuste_proxima_semana: adjustment.nivel }
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
    const scopedPending=(pendingSessions||[]).filter((item)=>!objetivoId||item.objetivo_id===objetivoId)
    const scopedCommitments=(commitments||[]).filter((item)=>!objetivoId||item.objetivo_id===objetivoId)
    const alerts=[]
    if(filteredReviews.length) alerts.push({tipo:'revisao',gravidade:'alta',titulo:`${filteredReviews.length} revisoes vencidas`,mensagem:'A central de revisao ordenou os itens mais urgentes.'})
    const overdue=scopedPending.filter((item)=>item.data<today); if(overdue.length) alerts.push({tipo:'pendencia',gravidade:'alta',titulo:`${overdue.length} demandas nao concluidas`,mensagem:'O mentor vai redistribuir no fechamento sem ultrapassar o limite.'})
    if(scopedPending.length>=8) alerts.push({tipo:'acumulo',gravidade:'media',titulo:'Risco de acumulo',mensagem:`Ha ${scopedPending.length} demandas abertas na semana.`})
    for(const item of scopedCommitments.slice(0,3)) alerts.push({tipo:'prazo',gravidade:'media',titulo:item.titulo,mensagem:`${item.tipo} em ${new Date(`${item.data}T12:00:00`).toLocaleDateString('pt-BR')}.`})
    if(planned) alerts.push({tipo:'carga',gravidade:'baixa',titulo:`Carga da proxima semana: ${adjustment.nivel}`,mensagem:adjustment.motivo})
    const body = {
      fase: mentorPhase(), prioridades, cenarios,
      politica: { versao: modularKnowledge?.versao || legacyPolicy?.versao || '2026.08.2' },
      resumo: { topicos_cobertos: coveredTopics, topicos_totais: diagnoses.length, dias_restantes: hasTargetDate ? daysRemaining : null, revisoes_imediatas: revisaoImediata.length },
      trajetoria: trajectory,
      fechamento_semanal: weeklyClose,
      alertas: alerts,
    }
    if (!compact) Object.assign(body, { topicos: diagnoses, revisao_imediata: revisaoImediata })
    return res.status(200).json(body)
  } catch (error) {
    return fail(res, error, 'Nao foi possivel gerar o diagnostico.')
  }
}
