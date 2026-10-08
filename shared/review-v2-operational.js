// Versioned conservative local qualification. No subject-wide decisions,
// fixed calendar, fabricated mastery or independently generated demands.
export const REVIEW_LOCAL_POLICY = Object.freeze({ versao: 'review-local-v2/1', erros_minimos: 3,
  questoes_distintas_minimas: 2, dias_distintos_minimos: 2, recuperacao_positivos_minimos: 2 })
const day = (instant) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant))
const nonempty = (value) => typeof value === 'string' && value.trim()
const target = (q) => q?.erro_alvo || q?.conceito_id || null
export function questionEquivalence(original, candidate) {
  if (!original || !candidate) return null
  if (target(original) && target(candidate)) return target(original) === target(candidate) ? 'ERRO_ALVO_CONCEITO' : null
  if (nonempty(original.topico_id) && original.topico_id === candidate.topico_id) return 'TOPICO_CURRICULAR'
  if (nonempty(original.objetivo_pedagogico) && original.objetivo_pedagogico === candidate.objetivo_pedagogico
    && Array.isArray(original.tags) && Array.isArray(candidate.tags)
    && original.tags.some((tag) => candidate.tags.includes(tag))) return 'OBJETIVO_E_CONCEITO'
  return null
}

export function operationalReviewSignals({ questao, revisao, registros, questoes, corte }) {
  const questions = new Map(questoes.map((row) => [row.id, row]))
  const history = [...new Map(registros.filter((row) => Number.isFinite(Date.parse(row.criado_em))
    && Date.parse(row.criado_em) <= Date.parse(corte) && questionEquivalence(questao, questions.get(row.questao_id)))
    .map((row) => [row.id, row])).values()].sort((a, b) => Date.parse(a.criado_em) - Date.parse(b.criado_em) || String(a.id).localeCompare(String(b.id)))
  const linked = history.filter((row) => row.revisao_item_id === revisao.id)
  const errors = history.filter((row) => row.resultado === 'erro')
  const lastError = errors.at(-1)
  const positives = linked.filter((row) => row.resultado === 'acerto' && row.classificacao === 'certeza'
    && (!lastError || Date.parse(row.criado_em) > Date.parse(lastError.criado_em)))
  const recovered = positives.length >= REVIEW_LOCAL_POLICY.recuperacao_positivos_minimos
    && new Set(positives.map((row) => row.questao_id)).size >= REVIEW_LOCAL_POLICY.questoes_distintas_minimas
    && new Set(positives.map((row) => day(row.criado_em))).size >= REVIEW_LOCAL_POLICY.dias_distintos_minimos
  const missing = errors.filter((row) => row.classificacao === 'sem_conhecimento')
  const persistent = !recovered && missing.length >= REVIEW_LOCAL_POLICY.erros_minimos
    && new Set(missing.map((row) => row.questao_id)).size >= REVIEW_LOCAL_POLICY.questoes_distintas_minimas
    && new Set(missing.map((row) => day(row.criado_em))).size >= REVIEW_LOCAL_POLICY.dias_distintos_minimos
  return { history, linked, recovered, persistent, lastError,
    fontes: [{ entidade: 'questao', id: questao.id }, { entidade: 'revisao_item', id: revisao.id },
      ...history.map((row) => ({ entidade: 'registro', id: row.id })),
      ...[...new Set(history.map((row) => row.questao_id))].filter((id) => id !== questao.id).map((id) => ({ entidade: 'questao', id }))],
    observacoes: { persistencia: persistent ? 'CONFIRMADA_LOCALMENTE' : 'INSUFFICIENT_EVIDENCE',
      exposicoes: history.length, volume_evidencia: history.length, dias_distintos: new Set(history.map((row) => day(row.criado_em))).size,
      retestes: linked.length, recencia: history.at(-1)?.criado_em || null,
      importancia: questao.importancia || 'UNKNOWN', incidencia: questao.incidencia || 'UNKNOWN', cobertura: 'UNKNOWN',
      desempenho_posterior: recovered ? 'RECUPERACAO_LOCAL' : linked.length ? 'NECESSIDADE_REAVALIADA' : 'UNKNOWN',
      atendimento: recovered ? 'ATENDIDA' : linked.length ? 'PARCIAL_OU_PERSISTENTE' : 'NAO_EXECUTADA' },
    reason_codes: [recovered ? 'REVIEW_FACTUAL_RECOVERY' : persistent ? 'REVIEW_PERSISTENT_CONCEPT_GAP' : 'REVIEW_INSUFFICIENT_EVIDENCE'],
    policy_ref: { id: 'QUALIFICACAO_LOCAL_REVISAO', versao: REVIEW_LOCAL_POLICY.versao }, autoriza_decisao_ampla: false }
}
