import { calculateMentorV2LoadFacts } from './mentor-v2-load.js'
import { calculateMentorV2PriorityFacts } from './mentor-v2-priority.js'
import { allocateMentorWeekCapacity } from './mentor-v2-availability.js'
import { readInitialMentorCapacity } from './mentor-v2-capacity.js'
import { readOperationalCycle, isInitialCycleWeek, cycleDemandPrefix } from './mentor-v2-cycle.js'
import { allocateMentorReviews, validateReviewPlanSelection } from './mentor-v2-review-plan.js'

// Authoritative V2 boundary. Historical policy objects are never merged here.
export const MENTOR_V2_CONTRACT = 'mentor-v2/1'
export const MENTOR_V2_REASON_CATALOG = 'mentor-v2-reasons/7'
export const MENTOR_V2_ENGINE_VERSION = 'mentor-v2-engine/3.17-4.10'
export const MENTOR_V2_TYPES = Object.freeze([
  'CRIAR_DEMANDA', 'MANTER_DEMANDA', 'REDUZIR_CARGA', 'AUMENTAR_CARGA', 'REDISTRIBUIR_CARGA',
  'PRIORIZAR_MATERIA', 'PRIORIZAR_TOPICO', 'SOLICITAR_REVISAO', 'SOLICITAR_QUESTOES',
  'SOLICITAR_QUESTION_CARDS', 'RETORNO_PONTUAL_TEORIA', 'ADIAR_CONTEUDO',
  'ABANDONAR_PENDENCIA', 'REAGENDAR_SEMANA_FUTURA',
  'MANTER_PENDENCIA', 'SUBSTITUIR_PENDENCIA', 'REDISTRIBUIR_PENDENCIA',
])
export const MENTOR_V2_REASONS = Object.freeze([
  'INSUFFICIENT_EVIDENCE', 'UNKNOWN_MASTERY', 'DATA_INCONSISTENCY', 'DATA_UNAVAILABLE',
  'CONSERVATIVE_CONTINUITY', 'EXECUTION_PATTERN', 'AVAILABILITY_CONSTRAINT', 'CURRICULUM_GAP',
  'MATERIAL_IN_PROGRESS', 'PREREQUISITE', 'PENDING_CONTENT', 'CONFIRMED_DEADLINE',
  'EVIDENCED_INCIDENCE', 'QUESTION_PERFORMANCE', 'FALSE_CERTAINTY_PATTERN',
  'KNOWLEDGE_GAP_EVIDENCE', 'UNCERTAINTY_PATTERN', 'RETEST_EVIDENCE', 'REVIEW_NEED',
  'CARD_RETRIEVAL_EVIDENCE', 'TARGETED_THEORY_NEED', 'PRIORITY_TRADEOFF',
  'NO_LONGER_RELEVANT_PENDING', 'FUTURE_RESCHEDULING', 'UNRESOLVED_SIGNAL_CONFLICT',
  'LOAD_MAINTAINED', 'LOAD_CHANGE_POLICY_UNDEFINED', 'ISOLATED_WEEK_NOT_PROGRESSION', 'NO_HOUR_DEBT',
  'CURRICULUM_CONTINUITY', 'STRUCTURAL_CONTEST_PRIORITY', 'FACULTY_CONTINUITY', 'RECENCY_TIEBREAK', 'NO_ELIGIBLE_CURRICULUM',
  'APPROVED_WEEKLY_CAPACITY', 'WEEKLY_PLAN_SELECTION',
  'PENDING_CONTINUITY', 'PENDING_DEFERRED', 'PENDING_REPLACED', 'PENDING_REDISTRIBUTED',
  'INITIAL_CONTENT_BASE', 'CYCLE_NOT_STARTED',
])
const ACTIVITIES = Object.freeze(['ESTUDO', 'QUESTOES', 'QUESTION_CARDS', 'REVISAO'])
const ACTIVITY_BY_TYPE = Object.freeze({ estudo: 'ESTUDO', exercicio: 'QUESTOES', especial: 'QUESTION_CARDS', revisao: 'REVISAO' })
const RULE_ID = 'CONTINUIDADE_PLANO_EXISTENTE'
export const MENTOR_V2_PRIORITY_RULE = 'PRIORIZACAO_CURRICULAR_SEMANAL'
export const MENTOR_V2_PLAN_RULE = 'GERACAO_PLANO_SEMANAL'
export const MENTOR_V2_PENDING_RULE = 'TRATAMENTO_PENDENCIAS_SEMANAIS'
const PENDING_TYPES = ['MANTER_PENDENCIA', 'REAGENDAR_SEMANA_FUTURA', 'SUBSTITUIR_PENDENCIA', 'ABANDONAR_PENDENCIA', 'REDISTRIBUIR_PENDENCIA']
const TEXT = Object.freeze({
  INITIAL_CONTENT_BASE: 'Semana inicial dedicada à construção de base, dentro da disponibilidade factual.',
  CYCLE_NOT_STARTED: 'A semana antecede o início configurado do ciclo. Nenhuma demanda nova foi criada.',
  DATA_UNAVAILABLE: 'A policy V2 ou uma fonte factual necessária não está disponível. O plano foi preservado.',
  DATA_INCONSISTENCY: 'Há uma configuração ou referência factual inconsistente. O plano foi preservado.',
  CONSERVATIVE_CONTINUITY: 'Demanda existente preservada, sem ajuste automático de carga ou conteúdo.',
  UNKNOWN_MASTERY: 'Tempo e cobertura não comprovam domínio.',
  INSUFFICIENT_EVIDENCE: 'A evidência ainda não autoriza mudança estratégica. A continuidade foi preservada, sem inferir domínio ou fraqueza forte.',
  UNRESOLVED_SIGNAL_CONFLICT: 'Há sinais conflitantes sem regra aprovada de resolução. A estratégia foi mantida conservadora, sem desempate aleatório.',
  LOAD_MAINTAINED: 'Carga existente mantida, sem acrescentar ou substituir demandas.',
  LOAD_CHANGE_POLICY_UNDEFINED: 'Ainda não existe regra V2 aprovada para alterar a carga. A base não é um teto permanente.',
  ISOLATED_WEEK_NOT_PROGRESSION: 'Uma única semana observada não autoriza aumento automático.',
  NO_HOUR_DEBT: 'Pendências não viram dívida de minutos nem blocos extras.',
  CONFIRMED_DEADLINE: 'Compromisso confirmado considerado, sem aumento automático de carga.',
  CURRICULUM_CONTINUITY: 'Selecionado o primeiro material pendente válido, sem avançar por conclusão de bloco.',
  STRUCTURAL_CONTEST_PRIORITY: 'Concurso preservado como prioridade estrutural, dentro da carga disponível.',
  FACULTY_CONTINUITY: 'Capacidade acadêmica preservada sem transferi-la para o concurso.',
  RECENCY_TIEBREAK: 'Alternativas equivalentes ordenadas pela execução mais antiga, sem inferir esquecimento.',
  NO_ELIGIBLE_CURRICULUM: 'Não há material curricular elegível identificado para a capacidade disponível. Nenhum curso foi reiniciado.',
  APPROVED_WEEKLY_CAPACITY: 'Capacidade inicial explicitamente configurada no perfil, sem compensação de faltas.',
  WEEKLY_PLAN_SELECTION: 'Demanda selecionada para a semana, com origem e motivo estruturados.',
  AVAILABILITY_CONSTRAINT: 'Materialização limitada à disponibilidade factual, sem criar dívida ou aumentar blocos.',
  PENDING_CONTINUITY: 'Conteúdo pendente continua necessário e recebe nova demanda dentro da capacidade vigente.',
  PENDING_DEFERRED: 'Pendência preservada para avaliação futura, sem acrescentar dívida ou presumir uma data.',
  PENDING_REPLACED: 'Outra necessidade atual ocupa a capacidade da semana; o conteúdo pendente continua elegível.',
  PENDING_REDISTRIBUTED: 'Continuidade pendente distribuída nos dias válidos da nova semana, sem transportar a sessão antiga.',
  NO_LONGER_RELEVANT_PENDING: 'Obrigação antiga encerrada por evidência curricular atual; sua história foi preservada.',
  FUTURE_RESCHEDULING: 'Nova demanda vinculada à pendência anterior, com origem própria na semana alvo.',
})

export function explainMentorV2(codes) {
  return [...new Set(codes)].map((code) => TEXT[code] || code).join(' ')
}

export function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function mentorWeekTarget(start, data = null) {
  if (!isCalendarDate(start) || new Date(`${start}T12:00:00Z`).getUTCDay() !== 1) throw new Error('Semana alvo deve começar em uma segunda-feira válida.')
  const end = new Date(`${start}T12:00:00Z`)
  end.setUTCDate(end.getUTCDate() + 6)
  const target = { data, semana_inicio: start, semana_fim: end.toISOString().slice(0, 10) }
  if (data !== null && (!isCalendarDate(data) || data < start || data > target.semana_fim)) throw new Error('Data fora da semana alvo.')
  return target
}

export function stableMentorJSON(value) {
  if (Array.isArray(value)) return `[${value.map(stableMentorJSON).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableMentorJSON(value[key])}`).join(',')}}`
  return JSON.stringify(value)
}

// Signals are observations, never commands or self-authorized evidence. Until
// approved qualification rules exist, even a calculable percentage is insufficient.
function conservativeFallback(facts, referenceInstant) {
  const signals = facts.signals ?? []
  const declaredConflicts = facts.signalConflicts ?? []
  if (!Array.isArray(signals) || !Array.isArray(declaredConflicts)) throw new Error('SINAIS_INVALIDOS')
  const ids = new Set(signals.map((signal) => signal?.sinal_id))
  if (ids.size !== signals.length || signals.some((signal) => typeof signal?.sinal_id !== 'string' || !signal.sinal_id
    || typeof signal.fonte !== 'string' || !signal.fonte || typeof signal.nome !== 'string' || !signal.nome
    || !signal.escopo || typeof signal.escopo !== 'object' || Array.isArray(signal.escopo)
    || !signal.janela || typeof signal.janela !== 'object' || Array.isArray(signal.janela)
    || !Object.hasOwn(signal, 'valor'))) throw new Error('SINAIS_INVALIDOS')
  const conflicts = []
  for (const conflict of declaredConflicts) {
    if (typeof conflict?.id !== 'string' || !conflict.id || !Array.isArray(conflict.sinal_ids) || new Set(conflict.sinal_ids).size < 2
      || conflict.sinal_ids.some((id) => !ids.has(id))) throw new Error('CONFLITO_SEM_SINAIS_RASTREAVEIS')
    conflicts.push({ id: conflict.id, sinal_ids: [...new Set(conflict.sinal_ids)].sort(), origem: 'declarado' })
  }
  // Two observations claiming the same measure/scope/window but different values
  // require resolution. Do not select the first, newest or most convenient value.
  const groups = new Map()
  for (const signal of signals) {
    const key = stableMentorJSON({ nome: signal.nome, escopo: signal.escopo, janela: signal.janela,
      unidade: signal.unidade ?? null, versao_definicao: signal.versao_definicao ?? null, corte: signal.corte ?? referenceInstant })
    groups.set(key, [...(groups.get(key) || []), signal])
  }
  for (const group of groups.values()) {
    if (new Set(group.map((signal) => stableMentorJSON(signal.valor))).size > 1) {
      const members = group.map((signal) => signal.sinal_id).sort()
      conflicts.push({ id: `observacoes:${JSON.stringify(members)}`, sinal_ids: members, origem: 'valores_divergentes' })
    }
  }
  conflicts.sort((a, b) => a.id.localeCompare(b.id))
  const reasonCodes = ['CONSERVATIVE_CONTINUITY', 'INSUFFICIENT_EVIDENCE', 'UNKNOWN_MASTERY',
    ...(conflicts.length ? ['UNRESOLVED_SIGNAL_CONFLICT'] : [])]
  const observation = { sinais: [...signals].sort((a, b) => a.sinal_id.localeCompare(b.sinal_id)),
    conflitos: conflicts, qualificacao: 'SEM_REGRA_DE_SUFICIENCIA_APROVADA' }
  return { reasonCodes,
    evidence: { evidencia_id: 'fallback', natureza: 'SINAL', fonte: 'sinais_derivados',
      versao_definicao: 'fallback-v2/1', valor: observation, corte: referenceInstant },
    state: { ativo: true, estrategia: 'CONTINUIDADE_CONSERVADORA', dominio: 'UNKNOWN', fraqueza_forte: 'UNKNOWN',
      aumentar_carga: false, adicionar_modalidades: false, prioridade_estrutural: 'CONCURSO',
      faculdade: 'PRESERVAR_SEM_EXPANDIR', coleta_evidencia: 'EVENTOS_NORMAIS',
      conflitos: conflicts, qualificacao_evidencia: observation.qualificacao },
  }
}

// No arbitrary thresholds or initial load: only explicit continuity is executable
// in 3.4. New strategies must extend this single registry in an authorized phase.
export function resolveMentorV2Policy(record) {
  const policy = record?.conteudo?.politica
  if (!record || !policy || policy.modelo !== 'MENTOR_V2') return { ok: false, reason: 'DATA_UNAVAILABLE', issue: 'POLICY_V2_AUSENTE' }
  const allowedKeys = ['modelo', 'versao_contrato', 'modalidades_permitidas', 'regras']
  const valid = record.modulo === 'mentor' && record.ativo === true && typeof record.id === 'string' && record.id.length > 0
    && typeof record.versao === 'string' && record.versao.length > 0
    && policy.versao_contrato === MENTOR_V2_CONTRACT
    && Object.keys(policy).every((key) => allowedKeys.includes(key))
    && Array.isArray(policy.modalidades_permitidas) && policy.modalidades_permitidas.every((activity) => ACTIVITIES.includes(activity))
    && new Set(policy.modalidades_permitidas).size === policy.modalidades_permitidas.length
    && Array.isArray(policy.regras) && policy.regras.some((rule) => rule.id === RULE_ID)
    && new Set(policy.regras.map((rule) => rule.id)).size === policy.regras.length
    && policy.regras.every((rule) => [RULE_ID, MENTOR_V2_PRIORITY_RULE, MENTOR_V2_PLAN_RULE, MENTOR_V2_PENDING_RULE].includes(rule.id) && rule.habilitada === true
      && Object.keys(rule).every((key) => ['id', 'habilitada'].includes(key)))
  if (!valid) return { ok: false, reason: 'DATA_INCONSISTENCY', issue: 'POLICY_V2_INVALIDA' }
  const generating = policy.regras.some((rule) => rule.id === MENTOR_V2_PLAN_RULE)
  if (generating && !policy.regras.some((rule) => rule.id === MENTOR_V2_PRIORITY_RULE)) return { ok: false, reason: 'DATA_INCONSISTENCY', issue: 'POLICY_V2_INVALIDA' }
  if (policy.regras.some((rule) => rule.id === MENTOR_V2_PENDING_RULE) && !generating) return { ok: false, reason: 'DATA_INCONSISTENCY', issue: 'POLICY_V2_INVALIDA' }
  return { ok: true, policy: JSON.parse(JSON.stringify(policy)), ref: { fonte: 'conhecimento_modulo', id: record.id, versao: record.versao } }
}

export function validateMentorV2Decision(decision) {
  if (!decision || !MENTOR_V2_TYPES.includes(decision.tipo_decisao)) throw new Error('Tipo de decisão desconhecido.')
  if (PENDING_TYPES.includes(decision.tipo_decisao)) return validatePendingDecision(decision)
  // Reject unsupported strategies, rather than guessing how to execute them.
  const prioritizing = decision.tipo_decisao === 'PRIORIZAR_MATERIA'
  const creating = decision.tipo_decisao === 'CRIAR_DEMANDA'
  if (decision.tipo_decisao !== 'MANTER_DEMANDA' && !prioritizing && !creating) throw new Error('Tipo ainda não executável pela policy V2 desta subfase.')
  const required = ['decisao_id', 'versao_contrato', 'tipo_decisao', 'objetivo_id', 'materia_id', 'topico_id',
    'tipo_atividade', 'duracao_minutos', 'prioridade', 'alvo_temporal', 'demanda_id', 'alvos_relacionados',
    'parametros', 'reason_codes', 'fundamentacao', 'evidencias_utilizadas', 'instante_referencia',
    'registrada_em', 'policy_ref', 'contexto_ref', 'avaliacao_ref', 'decisao_substituida_id']
  if (required.some((key) => !Object.hasOwn(decision, key))) throw new Error('Envelope incompleto.')
  if (decision.versao_contrato !== MENTOR_V2_CONTRACT || !decision.decisao_id || !decision.avaliacao_ref
    || !decision.objetivo_id || (creating ? decision.demanda_id !== null : !decision.demanda_id) || !ACTIVITIES.includes(decision.tipo_atividade)
    || !Number.isFinite(decision.duracao_minutos) || decision.duracao_minutos <= 0
    || (!prioritizing && !creating && decision.prioridade !== null) || decision.decisao_substituida_id !== null
    || !Number.isFinite(Date.parse(decision.instante_referencia)) || !Number.isFinite(Date.parse(decision.registrada_em))
    || decision.policy_ref?.fonte !== 'conhecimento_modulo' || !decision.policy_ref.id || !decision.policy_ref.versao
    || !decision.contexto_ref?.snapshot || !Array.isArray(decision.alvos_relacionados)
    || (!creating && decision.parametros?.estado_observado?.id !== decision.demanda_id)) throw new Error('Envelope inválido.')
  const target = mentorWeekTarget(decision.alvo_temporal?.semana_inicio, decision.alvo_temporal?.data)
  if (!target.data || target.semana_fim !== decision.alvo_temporal.semana_fim) throw new Error('Alvo temporal inválido.')
  const observed = decision.parametros.estado_observado
  if (Object.keys(decision).some((key) => !required.includes(key))) throw new Error('Envelope inválido.')
  if (!creating && (
    Object.keys(decision.parametros).some((key) => !(prioritizing ? ['estado_observado', 'selecao', 'alternativas', 'aplicacao'] : ['estado_observado']).includes(key))
    || observed.status !== 'planejada' || observed.objetivo_id !== decision.objetivo_id
    || (!prioritizing && ((observed.materia_id || null) !== decision.materia_id || (observed.topico_id || null) !== decision.topico_id))
    || observed.duracao_estimada !== decision.duracao_minutos || observed.data !== target.data
    || ACTIVITY_BY_TYPE[observed.tipo] !== decision.tipo_atividade)) throw new Error('Decisão diverge da demanda observada.')
  if (creating && (!decision.materia_id || !decision.parametros?.titulo?.trim()
    || !Number.isInteger(decision.parametros.ordem) || decision.parametros.ordem < 0
    || !decision.parametros.chave_mentor?.startsWith(`v2:${target.semana_inicio}:`)
    || Object.keys(decision.parametros).some((key) => !['titulo', 'ordem', 'chave_mentor', 'capacidade_slot', 'data_alocada', 'capacidade_ref', 'revisao'].includes(key))
    || decision.duracao_minutos > 90 || !Number.isInteger(decision.duracao_minutos)
    || decision.prioridade?.ordem_relativa !== 1 || !decision.prioridade.conjunto_ref)) throw new Error('Criação de demanda inválida.')
  if (creating) {
    const slot = decision.parametros.capacidade_slot
    if (decision.parametros.capacidade_ref !== undefined && !decision.evidencias_utilizadas.some((row) =>
      row.evidencia_id === 'capacidade_aprovada' && row.fonte === 'mentor_contexto'
      && stableMentorJSON(row.referencia) === stableMentorJSON(decision.parametros.capacidade_ref)
      && row.referencia?.fonte === 'mentor_contexto' && row.referencia.id === decision.contexto_ref.id
      && row.referencia.campo === 'dados.capacidade_inicial'
      && row.referencia.revisao === decision.contexto_ref.snapshot.capacidade_inicial?.revisao
      && row.referencia.versao === decision.contexto_ref.snapshot.capacidade_inicial?.versao
      && stableMentorJSON(row.valor?.configuracao) === stableMentorJSON(decision.contexto_ref.snapshot.capacidade_inicial)
      && stableMentorJSON(row.valor?.slots?.[decision.parametros.ordem]) === stableMentorJSON(slot))) throw new Error('Capacidade sem referência canônica.')
    const date = new Date(`${target.semana_inicio}T12:00:00Z`)
    if (!Number.isInteger(slot?.dia) || slot.dia < 0 || slot.dia > 6) throw new Error('Capacidade inválida.')
    date.setUTCDate(date.getUTCDate() + slot.dia)
    const allocated = decision.parametros.data_alocada
    if (allocated !== undefined && (allocated !== target.data || !decision.evidencias_utilizadas?.some((row) =>
      row.evidencia_id === 'disponibilidade' && row.fonte === 'mentor_contexto/compromisso/sessao'
      && row.valor?.alocacoes?.some((item) => item.index === decision.parametros.ordem && item.data === allocated
        && item.data_original === date.toISOString().slice(0, 10) && item.minutos === decision.duracao_minutos)))) {
      throw new Error('Alocação sem evidência factual.')
    }
    if (slot.objetivo_id !== decision.objetivo_id || slot.atividade !== decision.tipo_atividade
      || slot.duracao_minutos !== decision.duracao_minutos || target.data !== (allocated ?? date.toISOString().slice(0, 10))
      || decision.parametros.chave_mentor !== `${cycleDemandPrefix(target.semana_inicio, readOperationalCycle(decision.contexto_ref.snapshot.ciclo_operacional))}${decision.parametros.ordem}`
      || (decision.tipo_atividade === 'ESTUDO' ? decision.topico_id !== null
        || !decision.alvos_relacionados.some((row) => row.entidade === 'material' && row.id)
        : !decision.topico_id || (decision.tipo_atividade === 'REVISAO'
          ? (slot.materia_id && slot.materia_id !== decision.materia_id) || (slot.topico_id && slot.topico_id !== decision.topico_id)
          : slot.materia_id !== decision.materia_id || slot.topico_id !== decision.topico_id))) throw new Error('Demanda diverge da capacidade aprovada.')
    if (decision.parametros.revisao) {
      if (decision.tipo_atividade !== 'REVISAO') throw new Error('Revisão fora de slot autorizado.')
      validateReviewPlanSelection(decision.parametros.revisao, { ...decision, corte: decision.instante_referencia })
      if (!decision.evidencias_utilizadas.some((row) => row.evidencia_id === 'revisao_planejada'
        && stableMentorJSON(row.valor) === stableMentorJSON(decision.parametros.revisao))
        || decision.parametros.revisao.fontes.some((source) => !decision.alvos_relacionados.some((row) =>
          row.entidade === source.entidade && row.id === source.id))) throw new Error('Revisão sem origem rastreável.')
    }
  }
  if (prioritizing) {
    const selection = decision.parametros.selecao, alternatives = decision.parametros.alternativas
    if (decision.tipo_atividade !== 'ESTUDO' || decision.topico_id !== null || !selection?.material_id
      || selection.materia_id !== decision.materia_id || selection.objetivo_id !== decision.objetivo_id
      || !decision.materia_id || !['nao_iniciado', 'em_andamento'].includes(selection.estado)
      || decision.parametros.aplicacao !== 'SELECAO_SEM_ALTERAR_PLANO'
      || decision.prioridade?.ordem_relativa !== 1 || !decision.prioridade.conjunto_ref
      || !Array.isArray(alternatives) || alternatives[0]?.material_id !== selection.material_id
      || new Set(alternatives.map((row) => row.material_id)).size !== alternatives.length
      || alternatives.some((row) => row.objetivo_id !== decision.objetivo_id || !row.materia_id || !row.material_id)
      || !decision.alvos_relacionados.some((row) => row.entidade === 'material' && row.id === selection.material_id)) throw new Error('Priorização inválida.')
  }
  if (!Array.isArray(decision.reason_codes) || !decision.reason_codes.length
    || decision.reason_codes.some((code) => !MENTOR_V2_REASONS.includes(code))
    || !Array.isArray(decision.evidencias_utilizadas) || !decision.evidencias_utilizadas.length
    || !Array.isArray(decision.fundamentacao)) throw new Error('Fundamentação ausente ou desconhecida.')
  const ids = new Set(decision.evidencias_utilizadas.map((item) => item.evidencia_id))
  if (ids.size !== decision.evidencias_utilizadas.length || ids.has(undefined) || ids.has(null) || ids.has('')
    || decision.evidencias_utilizadas.some((item) => !['FATO', 'CONTEXTO', 'SINAL'].includes(item.natureza) || !item.fonte || !Object.hasOwn(item, 'valor'))
    || decision.reason_codes.some((code) => !decision.fundamentacao.some((item) => item.codigo === code
      && item.regra_id === (creating ? MENTOR_V2_PLAN_RULE : prioritizing ? MENTOR_V2_PRIORITY_RULE : RULE_ID) && item.evidencia_ids?.length && item.evidencia_ids.every((id) => ids.has(id))))) throw new Error('Evidência não rastreável.')
  return true
}

function validatePendingDecision(decision) {
  const fields = 'decisao_id versao_contrato tipo_decisao objetivo_id materia_id topico_id tipo_atividade duracao_minutos prioridade alvo_temporal demanda_id alvos_relacionados parametros reason_codes fundamentacao evidencias_utilizadas instante_referencia registrada_em policy_ref contexto_ref avaliacao_ref decisao_substituida_id'.split(' ')
  const actions = { MANTER_PENDENCIA: 'MANTER', REAGENDAR_SEMANA_FUTURA: 'REAGENDAR', SUBSTITUIR_PENDENCIA: 'SUBSTITUIR', ABANDONAR_PENDENCIA: 'ABANDONAR', REDISTRIBUIR_PENDENCIA: 'REDISTRIBUIR' }
  const observed = decision.parametros?.pendencia
  const target = mentorWeekTarget(decision.alvo_temporal?.semana_inicio, decision.alvo_temporal?.data)
  const newDecisions = decision.parametros?.novas_decisoes
  if (fields.some((key) => !Object.hasOwn(decision, key)) || Object.keys(decision).some((key) => !fields.includes(key))
    || decision.versao_contrato !== MENTOR_V2_CONTRACT || !decision.decisao_id || !decision.avaliacao_ref
    || typeof decision.objetivo_id !== 'string' || !decision.objetivo_id
    || !observed?.id || !isCalendarDate(observed.data) || observed.data >= target.semana_inicio
    || !['planejada', 'parcial', 'remanejada', 'nao_concluida'].includes(observed.status)
    || observed.id !== decision.demanda_id || observed.objetivo_id !== decision.objetivo_id
    || (observed.materia_id || null) !== decision.materia_id || (observed.topico_id || null) !== decision.topico_id
    || ACTIVITY_BY_TYPE[observed.tipo] !== decision.tipo_atividade
    || decision.duracao_minutos !== null || decision.prioridade !== null || decision.decisao_substituida_id !== null
    || decision.parametros.acao !== actions[decision.tipo_decisao]
    || Object.keys(decision.parametros).some((key) => !['pendencia', 'acao', 'novas_decisoes'].includes(key))
    || !Array.isArray(newDecisions) || newDecisions.some((row) => !row.decisao_id || !row.chave_mentor?.startsWith(`v2:${target.semana_inicio}:`)
      || !isCalendarDate(row.data) || row.data < target.semana_inicio || row.data > target.semana_fim)
    || (['MANTER', 'ABANDONAR'].includes(decision.parametros.acao) ? newDecisions.length !== 0 : !newDecisions.length)
    || decision.policy_ref?.fonte !== 'conhecimento_modulo' || !decision.policy_ref.id || !decision.policy_ref.versao
    || !decision.contexto_ref?.snapshot || !Number.isFinite(Date.parse(decision.instante_referencia)) || !Number.isFinite(Date.parse(decision.registrada_em))
    || target.semana_fim !== decision.alvo_temporal.semana_fim
    || !Array.isArray(decision.alvos_relacionados) || !Array.isArray(decision.reason_codes) || !decision.reason_codes.length
    || decision.reason_codes.some((code) => !MENTOR_V2_REASONS.includes(code))
    || !Array.isArray(decision.evidencias_utilizadas) || !decision.evidencias_utilizadas.length || !Array.isArray(decision.fundamentacao)) throw new Error('Tratamento de pendência inválido.')
  const evidenceIds = new Set(decision.evidencias_utilizadas.map((row) => row.evidencia_id))
  if (evidenceIds.size !== decision.evidencias_utilizadas.length || !decision.evidencias_utilizadas.some((row) => row.fonte === 'sessao' && row.referencia === observed.id && stableMentorJSON(row.valor) === stableMentorJSON(observed))
    || decision.reason_codes.some((code) => !decision.fundamentacao.some((row) => row.codigo === code && row.regra_id === MENTOR_V2_PENDING_RULE
      && row.evidencia_ids?.length && row.evidencia_ids.every((id) => evidenceIds.has(id))))) throw new Error('Pendência sem evidência rastreável.')
  return true
}

// Decisions remain in this single engine. No extra capacity or historical mutation.
function assessPendingWeek({ facts, result, referenceInstant }) {
  const source = facts.loadSources.history
  const pending = source.filter((row) => ACTIVITY_BY_TYPE[row.tipo] && ['planejada', 'parcial', 'remanejada', 'nao_concluida'].includes(row.status)
    && row.data < result.alvo_temporal.semana_inicio).sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
  if (new Set(pending.map((row) => row.id)).size !== pending.length || pending.some((row) => !row.id || !isCalendarDate(row.data))) throw new Error('PENDENCIAS_SEM_IDENTIDADE_VALIDA')
  const generated = result.decisoes.filter((row) => row.tipo_decisao === 'CRIAR_DEMANDA')
  const decisions = []
  for (const old of pending) {
    if (!(facts.loadSources.objectives || []).some((row) => row.id === old.objetivo_id)
      || (old.materia_id && !facts.subjects.some((row) => row.id === old.materia_id && row.objetivo_id === old.objetivo_id))) throw new Error('VINCULO_PENDENCIA_INVALIDO')
    const material = facts.prioritySources.materials.find((row) => row.id === old.material_id)
    if (material && (material.objetivo_id !== old.objetivo_id || material.materia_id !== old.materia_id)) throw new Error('VINCULO_PENDENCIA_INVALIDO')
    const progress = facts.prioritySources.progress.find((row) => row.material_id === old.material_id)
    const candidate = result.priorizacao.sinais.candidatos.find((row) => row.material_id === old.material_id)
    const matches = old.tipo === 'estudo' && material && candidate ? generated.filter((row) => row.tipo_atividade === 'ESTUDO'
      && row.objetivo_id === old.objetivo_id && row.materia_id === old.materia_id
      && row.alvos_relacionados.some((item) => item.entidade === 'material' && item.id === old.material_id)) : []
    let type = 'MANTER_PENDENCIA', action = 'MANTER', codes = ['PENDING_DEFERRED', 'NO_HOUR_DEBT'], linked = []
    if (old.tipo === 'estudo' && material && progress?.estado === 'concluido') {
      type = 'ABANDONAR_PENDENCIA'; action = 'ABANDONAR'; codes = ['NO_LONGER_RELEVANT_PENDING', 'NO_HOUR_DEBT']
    } else if (matches.length) {
      linked = matches
      const weekday = new Date(`${old.data}T12:00:00Z`).getUTCDay()
      const redistributed = new Set(matches.map((row) => row.alvo_temporal.data)).size > 1
        || matches.some((row) => new Date(`${row.alvo_temporal.data}T12:00:00Z`).getUTCDay() !== weekday)
      type = redistributed ? 'REDISTRIBUIR_PENDENCIA' : 'REAGENDAR_SEMANA_FUTURA'
      action = redistributed ? 'REDISTRIBUIR' : 'REAGENDAR'
      codes = ['PENDING_CONTINUITY', 'FUTURE_RESCHEDULING', 'NO_HOUR_DEBT', ...(redistributed ? ['PENDING_REDISTRIBUTED'] : [])]
    } else if (material && old.tipo === 'estudo' && result.priorizacao.sinais.candidatos.some((row) => row.materia_id === old.materia_id)) {
      linked = generated.filter((row) => row.objetivo_id === old.objetivo_id && row.tipo_atividade === 'ESTUDO')
      if (linked.length) {
        type = 'SUBSTITUIR_PENDENCIA'; action = 'SUBSTITUIR'; codes = ['PENDING_REPLACED', 'PRIORITY_TRADEOFF', 'NO_HOUR_DEBT']
      }
    } else codes.push('INSUFFICIENT_EVIDENCE')
    const alreadyPlanned = candidate && old.tipo === 'estudo' ? facts.demands.filter((row) => row.status === 'planejada'
      && row.objetivo_id === old.objetivo_id && row.materia_id === old.materia_id && row.material_id === old.material_id) : []
    if (type === 'MANTER_PENDENCIA' && alreadyPlanned.length) codes.push('PENDING_CONTINUITY')
    if (candidate && progress?.estado === 'em_andamento') codes.push('MATERIAL_IN_PROGRESS')
    if (type === 'MANTER_PENDENCIA' && result.plano_semanal.disponibilidade?.slots_sem_capacidade?.length) codes.push('AVAILABILITY_CONSTRAINT')
    const evidence = [{ evidencia_id: `pendencia:${old.id}`, natureza: 'FATO', fonte: 'sessao', referencia: old.id, valor: old, corte: referenceInstant },
      ...result.evidencias_utilizadas]
    const decision = { decisao_id: `${result.avaliacao_ref}:pendencia:${old.id}`, versao_contrato: MENTOR_V2_CONTRACT,
      tipo_decisao: type, objetivo_id: old.objetivo_id, materia_id: old.materia_id || null, topico_id: old.topico_id || null,
      tipo_atividade: ACTIVITY_BY_TYPE[old.tipo], duracao_minutos: null, prioridade: null,
      alvo_temporal: mentorWeekTarget(result.alvo_temporal.semana_inicio), demanda_id: old.id,
      alvos_relacionados: [...(old.material_id ? [{ entidade: 'material', id: old.material_id }] : []), ...alreadyPlanned.map((row) => ({ entidade: 'sessao', id: row.id }))],
      parametros: { pendencia: structuredClone(old), acao: action, novas_decisoes: linked.map((row) => ({ decisao_id: row.decisao_id, chave_mentor: row.parametros.chave_mentor, data: row.alvo_temporal.data })) },
      reason_codes: [...new Set(codes)], evidencias_utilizadas: evidence,
      fundamentacao: [...new Set(codes)].map((codigo) => ({ codigo, regra_id: MENTOR_V2_PENDING_RULE, evidencia_ids: evidence.map((row) => row.evidencia_id) })),
      instante_referencia: referenceInstant, registrada_em: referenceInstant, policy_ref: result.policy_ref,
      contexto_ref: result.contexto_ref, avaliacao_ref: result.avaliacao_ref, decisao_substituida_id: null }
    validateMentorV2Decision(decision)
    decisions.push(decision)
    for (const row of matches) {
      row.alvos_relacionados.push({ entidade: 'sessao', id: old.id })
      row.evidencias_utilizadas.push(evidence[0])
      row.reason_codes = [...new Set([...row.reason_codes, 'PENDING_CONTINUITY'])]
      row.fundamentacao.push({ codigo: 'PENDING_CONTINUITY', regra_id: MENTOR_V2_PLAN_RULE, evidencia_ids: [evidence[0].evidencia_id] })
      validateMentorV2Decision(row)
    }
  }
  return decisions
}

// The only ranking rule. No numeric weights, historical dates or mastery scores.
function prioritizeWeek({ facts, signals, target, referenceInstant, maintained }) {
  const objectives = new Map((facts.loadSources?.objectives || []).map((row) => [row.id, row]))
  const main = facts.context.objetivo_principal_id
  if (main && objectives.get(main)?.tipo !== 'concurso') throw new Error('OBJETIVO_PRINCIPAL_INVALIDO')
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(referenceInstant))
  const orderGoal = (id) => id === main ? 0 : objectives.get(id)?.tipo === 'concurso' ? 1 : 2
  const slots = maintained.filter((decision) => decision.tipo_atividade === 'ESTUDO'
    && decision.alvo_temporal.data >= today
    && !decision.parametros.estado_observado.movida_em && !decision.parametros.estado_observado.ordenada_em)
    .sort((a, b) => orderGoal(a.objetivo_id) - orderGoal(b.objetivo_id)
      || a.alvo_temporal.data.localeCompare(b.alvo_temporal.data)
      || (a.parametros.estado_observado.ordem ?? 0) - (b.parametros.estado_observado.ordem ?? 0)
      || a.demanda_id.localeCompare(b.demanda_id))
  const selections = [], used = new Map(), usedToday = new Map()
  for (const base of slots) {
    const goal = objectives.get(base.objetivo_id)
    if (!goal || !['concurso', 'faculdade'].includes(goal.tipo)) throw new Error('OBJETIVO_PRIORIZACAO_INVALIDO')
    const alternatives = signals.candidatos.filter((row) => row.objetivo_id === base.objetivo_id).map((row) => {
      const deadlines = (facts.loadSources?.commitments || []).filter((commitment) => {
        if (commitment.concluido !== false || commitment.objetivo_id !== row.objetivo_id
          || !isCalendarDate(commitment.data) || commitment.data < today || commitment.data > target.semana_fim) return false
        return commitment.materia_id === row.materia_id || facts.prioritySources.commitmentTopics.some((link) =>
          link.compromisso_id === commitment.id && facts.topics.find((topic) => topic.id === link.topico_id)?.materia_id === row.materia_id)
      }).sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))
      return { ...row, prazo: deadlines[0]?.data || null, compromisso_ids: deadlines.map((entry) => entry.id),
        selecoes_no_dia: usedToday.get(`${base.alvo_temporal.data}:${row.materia_id}`) || 0,
        selecoes_nesta_avaliacao: used.get(row.materia_id) || 0 }
    }).sort((a, b) => (a.prazo || '9999-12-31').localeCompare(b.prazo || '9999-12-31')
      || a.selecoes_no_dia - b.selecoes_no_dia
      || a.selecoes_nesta_avaliacao - b.selecoes_nesta_avaliacao
      || Number(b.estado === 'em_andamento') - Number(a.estado === 'em_andamento')
      || (a.ultima_execucao ? Date.parse(a.ultima_execucao) : -Infinity) - (b.ultima_execucao ? Date.parse(b.ultima_execucao) : -Infinity)
      || a.materia_id.localeCompare(b.materia_id) || a.material_id.localeCompare(b.material_id))
    if (!alternatives.length) continue
    const selected = alternatives[0]
    const runnerUp = alternatives[1]
    const recencyBreaksTie = runnerUp && selected.prazo === runnerUp.prazo
      && (selected.estado === 'em_andamento') === (runnerUp.estado === 'em_andamento')
      && selected.selecoes_nesta_avaliacao === runnerUp.selecoes_nesta_avaliacao
      && selected.ultima_execucao !== runnerUp.ultima_execucao
    const codes = ['CURRICULUM_CONTINUITY', 'CURRICULUM_GAP', 'UNKNOWN_MASTERY', 'LOAD_MAINTAINED',
      goal.tipo === 'concurso' ? 'STRUCTURAL_CONTEST_PRIORITY' : 'FACULTY_CONTINUITY',
      ...(selected.estado === 'em_andamento' ? ['MATERIAL_IN_PROGRESS'] : []),
      ...(selected.prazo ? ['CONFIRMED_DEADLINE'] : []),
      ...(alternatives.length > 1 ? ['PRIORITY_TRADEOFF'] : []),
      ...(recencyBreaksTie ? ['RECENCY_TIEBREAK'] : []),
      ...(signals.observacoes_questoes.length || signals.necessidades_revisao.length ? ['INSUFFICIENT_EVIDENCE'] : [])]
    const priorityEvidence = { evidencia_id: 'priorizacao', natureza: 'SINAL',
      fonte: 'material/material_progresso/sessao/compromisso/revisao_item/registro',
      versao_definicao: 'priorizacao-v2/1', valor: { sinais: signals, alternativas: alternatives }, corte: referenceInstant }
    const evidence = [...base.evidencias_utilizadas, priorityEvidence]
    const decision = { ...base, decisao_id: `${base.decisao_id}:prioridade`, tipo_decisao: 'PRIORIZAR_MATERIA',
      materia_id: selected.materia_id, topico_id: null,
      prioridade: { ordem_relativa: 1, conjunto_ref: `${base.avaliacao_ref}:${base.demanda_id}:alternativas` },
      alvos_relacionados: [{ entidade: 'material', id: selected.material_id }],
      parametros: { estado_observado: base.parametros.estado_observado, selecao: selected,
        alternativas: alternatives, aplicacao: 'SELECAO_SEM_ALTERAR_PLANO' }, reason_codes: codes,
      evidencias_utilizadas: evidence,
      fundamentacao: codes.map((code) => ({ codigo: code, regra_id: MENTOR_V2_PRIORITY_RULE,
        evidencia_ids: evidence.map((entry) => entry.evidencia_id) })) }
    validateMentorV2Decision(decision)
    selections.push(decision)
    used.set(selected.materia_id, (used.get(selected.materia_id) || 0) + 1)
    usedToday.set(`${base.alvo_temporal.data}:${selected.materia_id}`, selected.selecoes_no_dia + 1)
  }
  return { selections, slots }
}

function generateWeek({ resolved, facts, result, referenceInstant, allowed }) {
  const cycle = readOperationalCycle(facts.context.ciclo_operacional)
  const initialWeek = isInitialCycleWeek(cycle, result.alvo_temporal.semana_inicio)
  const configured = readInitialMentorCapacity(facts.context.capacidade_inicial)
  const capacityRef = configured ? { fonte: 'mentor_contexto', id: facts.context.id, campo: 'dados.capacidade_inicial', revisao: configured.revisao, versao: configured.versao } : null
  const objectives = new Map((facts.loadSources?.objectives || []).map((row) => [row.id, row]))
  // Allocation of explicitly configured discretionary slots is decided here,
  // never inferred from spare availability or a successful execution week.
  const capacity = configured?.slots.map((slot) => {
    if (!slot.destino) return slot
    const contests = [...objectives.values()].filter((row) => row.tipo === 'concurso')
    const main = objectives.get(facts.context.objetivo_principal_id)
    const objective = main?.tipo === 'concurso' ? main : contests.length === 1 ? contests[0] : null
    if (!objective) throw new Error('CONCURSO_PRINCIPAL_CAPACIDADE_NAO_IDENTIFICADO')
    const { destino, ...base } = slot
    return { ...base, objetivo_id: objective.id }
  })
  if (!configured) return { decisions: [], issues: ['CAPACIDADE_SEMANAL_NAO_CONFIGURADA'] }
  const identities = [...facts.demands, ...(facts.planIdentities || [])]
  const prefix = cycleDemandPrefix(result.alvo_temporal.semana_inicio, cycle)
  // Never pile a base template on top of an existing, independently edited plan.
  if (facts.demands.some((row) => row.status !== 'cancelada' && ['estudo', 'exercicio', 'especial', 'revisao'].includes(row.tipo)
    && !row.chave_mentor?.startsWith(prefix))) return { decisions: [], issues: ['PLANO_EXISTENTE_PRESERVADO_SEM_SOBREPOSICAO'] }
  const occupied = new Set(identities.map((row) => row.chave_mentor?.split(':decision:')[0]).filter(Boolean))
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(referenceInstant))
  const subjects = new Map(facts.subjects.map((row) => [row.id, row]))
  const topics = new Map(facts.topics.map((row) => [row.id, row]))
  const evidence = [{ evidencia_id: 'capacidade_aprovada', natureza: 'CONTEXTO', fonte: 'mentor_contexto',
    referencia: capacityRef, valor: { configuracao: configured, slots: capacity }, corte: referenceInstant }, ...result.evidencias_utilizadas.filter((row) => row.evidencia_id !== 'priorizacao')]
  const slots = [], issues = [], decisions = [], requests = [], dailyCapacity = new Map()
  capacity.forEach((slot) => {
    const date = new Date(`${result.alvo_temporal.semana_inicio}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + slot.dia)
    const day = date.toISOString().slice(0, 10)
    dailyCapacity.set(day, (dailyCapacity.get(day) || 0) + slot.duracao_minutos)
  })
  capacity.forEach((slot, index) => {
    if (!objectives.has(slot.objetivo_id)) throw new Error('OBJETIVO_CAPACIDADE_INVALIDO')
    const date = new Date(`${result.alvo_temporal.semana_inicio}T12:00:00Z`)
    date.setUTCDate(date.getUTCDate() + slot.dia)
    const day = date.toISOString().slice(0, 10), key = `${prefix}${index}`
    if (day < today || occupied.has(key)) return
    if (initialWeek && (slot.atividade !== 'ESTUDO' || slot.duracao_minutos !== 50)) { issues.push('BASE_INICIAL_SOMENTE_ESTUDO_50'); return }
    if (!allowed(slot.atividade)) { issues.push('MODALIDADE_DE_CAPACIDADE_NAO_AUTORIZADA'); return }
    requests.push({ index, day, minutes: slot.duracao_minutos, objectiveId: slot.objetivo_id,
      faculty: objectives.get(slot.objetivo_id).tipo === 'faculdade' })
  })
  const packed = allocateMentorWeekCapacity({ availability: facts.context.disponibilidade,
    requests, demands: facts.demands, commitments: facts.loadSources?.commitments || [],
    weekStart: result.alvo_temporal.semana_inicio, weekEnd: result.alvo_temporal.semana_fim, today, initialWeek, dailyCapacity })
  issues.push(...packed.issues)
  const availabilityEvidence = { evidencia_id: 'disponibilidade', natureza: 'SINAL',
    fonte: 'mentor_contexto/compromisso/sessao', versao_definicao: 'disponibilidade-v2/1',
    valor: packed.signal, corte: referenceInstant }
  evidence.push(availabilityEvidence)
  for (const allocation of packed.allocations) {
    const index = allocation.index, slot = capacity[index], day = allocation.data, key = `${prefix}${index}`
    const observed = { id: key, objetivo_id: slot.objetivo_id, materia_id: slot.materia_id || null,
      topico_id: slot.topico_id || null, tipo: { ESTUDO: 'estudo', QUESTOES: 'exercicio', QUESTION_CARDS: 'especial', REVISAO: 'revisao' }[slot.atividade],
      data: day, status: 'planejada', duracao_estimada: slot.duracao_minutos, ordem: index }
    slots.push({ decisao_id: `${result.avaliacao_ref}:${key}`, versao_contrato: MENTOR_V2_CONTRACT,
      tipo_decisao: 'MANTER_DEMANDA', objetivo_id: slot.objetivo_id, materia_id: observed.materia_id,
      topico_id: observed.topico_id, tipo_atividade: slot.atividade, duracao_minutos: slot.duracao_minutos,
      prioridade: null, alvo_temporal: mentorWeekTarget(result.alvo_temporal.semana_inicio, day), demanda_id: key,
      alvos_relacionados: [], parametros: { estado_observado: observed }, reason_codes: [], fundamentacao: [],
      evidencias_utilizadas: evidence, instante_referencia: referenceInstant, registrada_em: referenceInstant,
      policy_ref: resolved.ref, contexto_ref: result.contexto_ref, avaliacao_ref: result.avaliacao_ref, decisao_substituida_id: null,
    })
  }
  // Internal capacity carriers are not persisted as observations of real sessions.
  const theoretical = prioritizeWeek({ facts, signals: result.priorizacao.sinais, target: result.alvo_temporal,
    referenceInstant, maintained: slots }).selections
  const reviewPlan = allocateMentorReviews({ itens: facts.reviewPlanning?.itens || [],
    demandas: facts.reviewPlanning?.demandas || [], corte: referenceInstant, policy_ref: resolved.ref, allowed,
    slots: slots.map((base) => ({ ...capacity[base.parametros.estado_observado.ordem],
      id: base.demanda_id, data: base.alvo_temporal.data })) })
  issues.push(...reviewPlan.issues)
  for (const base of slots) {
    const selection = theoretical.find((row) => row.demanda_id === base.demanda_id)
    const slot = capacity[base.parametros.estado_observado.ordem]
    let subjectId = base.materia_id, topicId = base.topico_id, related = [], title, codes = [], plannedReview = null
    if (base.tipo_atividade === 'REVISAO') {
      plannedReview = reviewPlan.allocations.find((row) => row.slot_id === base.demanda_id)?.revisao
      if (!plannedReview) continue
      subjectId = plannedReview.materia_id; topicId = plannedReview.topico_id
      const source = plannedReview.fontes[0]
      if (source.tipo === 'RETESTE_QUESTAO') {
        const canonical = facts.prioritySources.reviews.find((row) => row.id === source.id)
        const question = facts.prioritySources.questions.find((row) => row.id === source.alvo.id)
        if (!canonical || canonical.status !== 'pendente' || canonical.questao_id !== source.alvo.id
          || canonical.agendada_para !== plannedReview.item.agendada_para || question?.topico_id !== topicId) {
          throw new Error('ORIGEM_CANONICA_REVISAO_INVALIDA')
        }
      } else if (!(facts.prioritySources.cards || []).some((row) => row.id === source.alvo.id && row.topico_id === topicId)) {
        throw new Error('ORIGEM_CANONICA_REVISAO_INVALIDA')
      }
    }
    if (base.tipo_atividade === 'ESTUDO') {
      if (!selection) { issues.push('NO_ELIGIBLE_CURRICULUM'); continue }
      subjectId = selection.materia_id; topicId = null; related = selection.alvos_relacionados
      const material = facts.prioritySources.materials.find((row) => row.id === related[0].id)
      title = `Estudo: ${material.nome || `Material ${material.ordem_curso}`}`
      codes = selection.reason_codes.filter((code) => code !== 'LOAD_MAINTAINED')
    } else {
      if (subjects.get(subjectId)?.objetivo_id !== base.objetivo_id || topics.get(topicId)?.materia_id !== subjectId) throw new Error('CONTEUDO_CAPACIDADE_INVALIDO')
      if (base.tipo_atividade === 'QUESTOES' && !facts.prioritySources.questions.some((row) => row.topico_id === topicId)) {
        issues.push('QUESTOES_ELEGIVEIS_AUSENTES'); continue
      }
      if (base.tipo_atividade === 'QUESTION_CARDS' && !(facts.prioritySources.cards || []).some((row) => row.topico_id === topicId)) {
        issues.push('CARDS_ELEGIVEIS_AUSENTES'); continue
      }
      if (base.tipo_atividade === 'REVISAO') {
        related = plannedReview.fontes.map(({ entidade, id }) => ({ entidade, id }))
        codes.push('REVIEW_NEED')
      }
      title = `${{ QUESTOES: 'Questões', QUESTION_CARDS: 'Question Cards', REVISAO: 'Revisão' }[base.tipo_atividade]}: ${topics.get(topicId).nome || topicId}`
      if (plannedReview) {
        const label = { QUESTAO_INDIVIDUAL: 'questão', BATERIA_QUESTOES: 'questões',
          QUESTION_CARDS: 'Question Cards', RETORNO_PONTUAL_TEORIA: 'teoria pontual' }[plannedReview.metodo.metodo]
        title = `Revisão (${label}): ${topics.get(topicId).nome || topicId}`
      }
    }
    codes = [...new Set([...codes, 'APPROVED_WEEKLY_CAPACITY', 'WEEKLY_PLAN_SELECTION', 'NO_HOUR_DEBT',
      ...(packed.constrained ? ['AVAILABILITY_CONSTRAINT'] : []), ...(initialWeek ? ['INITIAL_CONTENT_BASE'] : [])])]
    const selectedEvidence = plannedReview ? [...evidence, { evidencia_id: 'revisao_planejada', natureza: 'SINAL',
      fonte: 'revisao_item/question_card/registro', valor: plannedReview, corte: referenceInstant }]
      : selection?.evidencias_utilizadas || evidence
    const decision = { ...base, decisao_id: `${base.decisao_id}:criar`, tipo_decisao: 'CRIAR_DEMANDA', demanda_id: null,
      materia_id: subjectId, topico_id: topicId, alvos_relacionados: related,
      prioridade: { ordem_relativa: 1, conjunto_ref: `${base.avaliacao_ref}:${base.demanda_id}:capacidade` },
      parametros: { titulo: title, ordem: base.parametros.estado_observado.ordem, chave_mentor: base.demanda_id,
        capacidade_slot: slot, capacidade_ref: capacityRef, data_alocada: base.alvo_temporal.data,
        ...(plannedReview ? { revisao: plannedReview } : {}) }, reason_codes: codes,
      evidencias_utilizadas: selectedEvidence,
      fundamentacao: codes.map((code) => ({ codigo: code, regra_id: MENTOR_V2_PLAN_RULE, evidencia_ids: selectedEvidence.map((row) => row.evidencia_id) })) }
    validateMentorV2Decision(decision)
    decisions.push(decision)
  }
  return { decisions, issues: [...new Set(issues)], capacityRef, configuredSlots: capacity.length, capacityEvidence: evidence[0], availability: packed.signal, availabilityEvidence,
    reasonCodes: packed.constrained ? ['AVAILABILITY_CONSTRAINT'] : [] }
}

export function evaluateMentorV2({ policyRecord, facts, weekStart, referenceInstant, evaluationId }) {
  const target = mentorWeekTarget(weekStart)
  if (!Number.isFinite(Date.parse(referenceInstant)) || !evaluationId) throw new Error('Referência explícita da avaliação obrigatória.')
  const resolved = resolveMentorV2Policy(policyRecord)
  const contextRef = facts?.context ? { fonte: 'mentor_contexto', id: facts.context.id, snapshot: facts.context } : null
  const result = { versao_contrato: MENTOR_V2_CONTRACT, avaliacao_ref: evaluationId,
    versao_motor: MENTOR_V2_ENGINE_VERSION,
    instante_referencia: referenceInstant, alvo_temporal: target, policy_ref: resolved.ref || null,
    contexto_ref: contextRef, resultado: 'NAO_AVALIAVEL', decisoes: [], reason_codes: [],
    evidencias_utilizadas: [], limitacoes: [], dominio: 'UNKNOWN' }
  function unavailable(code, issue, source) {
    result.decisoes = []
    result.reason_codes = [code]
    result.limitacoes = [issue]
    result.evidencias_utilizadas = [{ evidencia_id: 'limite', natureza: 'CONTEXTO', fonte: source, valor: issue, corte: referenceInstant }]
    return { ...result, explicacao: explainMentorV2(result.reason_codes) }
  }
  if (!resolved.ok) return unavailable(resolved.reason, resolved.issue, 'conhecimento_modulo')
  if (!facts?.context || !Array.isArray(facts.demands) || !Array.isArray(facts.subjects) || !Array.isArray(facts.topics)) return unavailable('DATA_UNAVAILABLE', 'FONTES_FACTUAIS_INCOMPLETAS', 'mentor_contexto/sessao')
  let cycle
  try { cycle = readOperationalCycle(facts.context.ciclo_operacional) }
  catch (error) { return unavailable('DATA_INCONSISTENCY', error.message, 'mentor_contexto') }
  if (cycle && weekStart < cycle.inicio) return unavailable('CYCLE_NOT_STARTED', 'SEMANA_ANTERIOR_AO_CICLO', 'mentor_contexto')
  let fallback
  try { fallback = conservativeFallback(facts, referenceInstant) }
  catch (error) { return unavailable('DATA_INCONSISTENCY', error.message, 'sinais_derivados') }
  const ids = new Set(facts.demands.map((item) => item.id))
  if (ids.size !== facts.demands.length || ids.has(undefined) || ids.has(null) || ids.has('')) return unavailable('DATA_INCONSISTENCY', 'DEMANDAS_SEM_IDENTIDADE_UNICA', 'sessao')
  let loadFacts
  try { loadFacts = calculateMentorV2LoadFacts({ facts, weekStart, weekEnd: target.semana_fim, referenceInstant }) }
  catch (error) { return unavailable('DATA_INCONSISTENCY', error.message, 'sessao/tempo_estudo/compromisso') }
  // All load changes remain gated by approved rules in this one policy registry.
  // No calendar escalation, percentage increment, subjective feedback or debt.
  const loadReasons = ['LOAD_MAINTAINED', 'LOAD_CHANGE_POLICY_UNDEFINED',
    ...(loadFacts.historico.filter((week) => week.janela_fechada && week.demandas_elegiveis > 0).length === 1 ? ['ISOLATED_WEEK_NOT_PROGRESSION'] : []),
    ...(loadFacts.pendencias.demandas ? ['NO_HOUR_DEBT'] : []),
    ...(loadFacts.compromissos.length ? ['CONFIRMED_DEADLINE'] : [])]
  fallback.reasonCodes = [...fallback.reasonCodes, ...loadReasons]
  const loadEvidence = { evidencia_id: 'carga_semanal', natureza: 'SINAL', fonte: 'sessao/tempo_estudo/objetivo/compromisso',
    versao_definicao: 'carga-v2/1', valor: loadFacts, corte: referenceInstant }
  const subjects = new Map(facts.subjects.map((item) => [item.id, item]))
  const topics = new Map(facts.topics.map((item) => [item.id, item]))
  const allowed = (activity) => resolved.policy.modalidades_permitidas.includes(activity)
    && (activity === 'ESTUDO' || facts.context.rotina_pratica?.[{
      QUESTOES: 'questoes', QUESTION_CARDS: 'question_cards', REVISAO: 'revisao_pratica',
    }[activity]] === true)
  const candidates = facts.demands.filter((item) => item.status === 'planejada' && item.data >= weekStart && item.data <= target.semana_fim)
    .sort((a, b) => a.data.localeCompare(b.data) || String(a.id).localeCompare(String(b.id)))
  for (const item of candidates) {
    const activity = ACTIVITY_BY_TYPE[item.tipo]
    if (!allowed(activity)) continue // Preserved fact, but not an authorized V2 activity.
    if (!item.objetivo_id || !isCalendarDate(item.data) || !Number.isFinite(item.duracao_estimada) || item.duracao_estimada <= 0
      || (item.materia_id && subjects.get(item.materia_id)?.objetivo_id !== item.objetivo_id)
      || (item.topico_id && (!item.materia_id || topics.get(item.topico_id)?.materia_id !== item.materia_id))) {
      return unavailable('DATA_INCONSISTENCY', 'VINCULO_OU_ESTIMATIVA_INVALIDA', 'sessao')
    }
    const evidence = [
      { evidencia_id: `sessao:${item.id}`, natureza: 'FATO', fonte: 'sessao', referencia: item.id, valor: item, corte: referenceInstant },
      { evidencia_id: 'contexto', natureza: 'CONTEXTO', fonte: 'mentor_contexto', referencia: facts.context.id, valor: facts.context, corte: referenceInstant },
      fallback.evidence,
      loadEvidence,
    ]
    const decision = { decisao_id: `${evaluationId}:${item.id}`, versao_contrato: MENTOR_V2_CONTRACT,
      tipo_decisao: 'MANTER_DEMANDA', objetivo_id: item.objetivo_id, materia_id: item.materia_id || null,
      topico_id: item.topico_id || null, tipo_atividade: activity, duracao_minutos: item.duracao_estimada,
      prioridade: null, alvo_temporal: mentorWeekTarget(weekStart, item.data), demanda_id: item.id,
      alvos_relacionados: item.material_id ? [{ entidade: 'material', id: item.material_id }] : [],
      parametros: { estado_observado: item }, reason_codes: fallback.reasonCodes,
      fundamentacao: fallback.reasonCodes.map((code) => ({ codigo: code, regra_id: RULE_ID, evidencia_ids: evidence.map((entry) => entry.evidencia_id) })),
      evidencias_utilizadas: evidence, instante_referencia: referenceInstant, registrada_em: referenceInstant,
      policy_ref: resolved.ref, contexto_ref: contextRef, avaliacao_ref: evaluationId, decisao_substituida_id: null }
    validateMentorV2Decision(decision)
    result.decisoes.push(decision)
  }
  result.reason_codes = fallback.reasonCodes
  result.catalogo_reason_codes = MENTOR_V2_REASON_CATALOG
  result.fallback = fallback.state
  // Derived projection of the same evaluation/maintained plan, not a second
  // decision maker or a new operational decision type outside the contract.
  result.carga_semanal = { acao: 'MANTER', situacao: loadFacts.carga_plano_efetivo.demandas ? 'BASE_EXISTENTE' : 'SEM_BASE_VIGENTE',
    carga_observada: loadFacts.carga_plano_efetivo,
    carga_proposta: loadFacts.carga_plano_efetivo.demandas ? loadFacts.carga_plano_efetivo : null,
    sinais: loadFacts, prioridade_capacidade_adicional: 'CONCURSO', faculdade: 'CONTINUIDADE',
    base_e_teto_permanente: false, alteracao_carga_autorizada: false,
    reason_codes: loadReasons, avaliacao_ref: evaluationId, policy_ref: resolved.ref, alvo_temporal: target }
  result.evidencias_utilizadas = [{ evidencia_id: 'plano', natureza: 'FATO', fonte: 'sessao', valor: facts.demands, corte: referenceInstant }, fallback.evidence, loadEvidence]
  if (resolved.policy.regras.some((rule) => rule.id === MENTOR_V2_PRIORITY_RULE)) {
    let signals, prioritized
    try {
      signals = calculateMentorV2PriorityFacts(facts, referenceInstant)
      prioritized = prioritizeWeek({ facts, signals, target, referenceInstant, maintained: result.decisoes })
    } catch (error) {
      return unavailable(error.message === 'FONTES_PRIORIZACAO_INCOMPLETAS' ? 'DATA_UNAVAILABLE' : 'DATA_INCONSISTENCY', error.message, 'curriculo/priorizacao')
    }
    result.priorizacao = { sinais: signals, selecoes: prioritized.selections.map((row) => row.decisao_id),
      capacidade_disponivel: prioritized.slots.map((row) => ({ demanda_id: row.demanda_id, objetivo_id: row.objetivo_id,
        data: row.alvo_temporal.data, minutos: row.duracao_minutos })),
      slots_sem_conteudo: prioritized.slots.filter((slot) => !prioritized.selections.some((row) => row.demanda_id === slot.demanda_id)).map((row) => row.demanda_id),
      aplicacao: 'SELECAO_SEM_ALTERAR_PLANO', desempenho: 'SEM_REGRA_DE_SUFICIENCIA_APROVADA',
      retorno_teoria: 'NAO_AUTORIZADO_SEM_EVIDENCIA_QUALIFICADA' }
    result.decisoes.push(...prioritized.selections)
    result.reason_codes = [...new Set([...result.reason_codes, ...prioritized.selections.flatMap((row) => row.reason_codes),
      ...(result.priorizacao.slots_sem_conteudo.length ? ['NO_ELIGIBLE_CURRICULUM'] : [])])]
    result.evidencias_utilizadas.push({ evidencia_id: 'priorizacao', natureza: 'SINAL', fonte: 'material/material_progresso',
      versao_definicao: 'priorizacao-v2/1', valor: signals, corte: referenceInstant })
    if (signals.lacunas.length) result.limitacoes.push('LACUNAS_DE_ORDEM_OU_EXTRACAO_CURRICULAR')
    if (signals.necessidades_revisao.length || signals.observacoes_questoes.length) result.limitacoes.push('SUFICIENCIA_DESEMPENHO_REVISAO_RETESTE_NAO_DEFINIDA')
  }
  if (resolved.policy.regras.some((rule) => rule.id === MENTOR_V2_PLAN_RULE)) {
    let generated
    try { generated = generateWeek({ resolved, facts, result, referenceInstant, allowed }) }
    catch (error) { return unavailable('DATA_INCONSISTENCY', error.message, 'geracao_plano') }
    result.decisoes.push(...generated.decisions)
    result.limitacoes.push(...generated.issues)
    result.reason_codes = [...new Set([...result.reason_codes, ...(generated.reasonCodes || []), ...generated.decisions.flatMap((row) => row.reason_codes)])]
    if (generated.availabilityEvidence) result.evidencias_utilizadas.push(generated.availabilityEvidence)
    if (generated.capacityEvidence) result.evidencias_utilizadas.push(generated.capacityEvidence)
    result.carga_semanal.capacidade_inicial = generated.capacityEvidence ? {
      referencia: generated.capacityRef, slots: generated.configuredSlots,
      minutos: generated.capacityEvidence.valor.slots.reduce((total, slot) => total + slot.duracao_minutos, 0),
      teto_permanente: false, progressao_automatica: false,
    } : null
    if (generated.reasonCodes?.length) result.carga_semanal.reason_codes = [...new Set([
      ...result.carga_semanal.reason_codes, ...generated.reasonCodes, 'NO_HOUR_DEBT'])]
    if (generated.decisions.length) {
      const projected = generated.decisions.map((row) => ({ id: row.parametros.chave_mentor, objetivo_id: row.objetivo_id,
        tipo: { ESTUDO: 'estudo', QUESTOES: 'exercicio', QUESTION_CARDS: 'especial', REVISAO: 'revisao' }[row.tipo_atividade],
        status: 'planejada', data: row.alvo_temporal.data, duracao_estimada: row.duracao_minutos }))
      result.carga_semanal.carga_proposta = calculateMentorV2LoadFacts({ facts: { ...facts, demands: [...facts.demands, ...projected] },
        weekStart, weekEnd: target.semana_fim, referenceInstant }).carga_plano_efetivo
      result.carga_semanal.acao = 'MATERIALIZAR_CAPACIDADE_CONFIGURADA'
      result.carga_semanal.situacao = 'BASE_CONFIGURADA'
      result.carga_semanal.reason_codes = ['APPROVED_WEEKLY_CAPACITY', 'NO_HOUR_DEBT', ...(generated.reasonCodes || [])]
      result.reason_codes = result.reason_codes.filter((code) => !['LOAD_MAINTAINED', 'CONSERVATIVE_CONTINUITY'].includes(code))
    }
    result.plano_semanal = { decisao_ids: generated.decisions.map((row) => row.decisao_id),
      politica_capacidade: resolved.ref, capacidade_ref: generated.capacityRef || null, pendente: generated.issues.length > 0, limitacoes: generated.issues,
      slots_configurados: generated.configuredSlots || 0,
      disponibilidade: generated.availability || null }
  }
  if (resolved.policy.regras.some((rule) => rule.id === MENTOR_V2_PENDING_RULE)) {
    let treatments
    try { treatments = assessPendingWeek({ facts, result, referenceInstant }) }
    catch (error) { return unavailable('DATA_INCONSISTENCY', error.message, 'pendencias/curriculo') }
    result.decisoes.push(...treatments)
    result.reason_codes = [...new Set([...result.reason_codes, ...treatments.flatMap((row) => row.reason_codes)])]
    result.pendencias = { decisao_ids: treatments.map((row) => row.decisao_id), divida_minutos: 0,
      altera_historico: false, aumenta_capacidade: false }
  }
  result.resultado = result.decisoes.length ? 'DECISOES_EMITIDAS' : 'SEM_ALTERACAO'
  return { ...result, explicacao: explainMentorV2(result.reason_codes) }
}
