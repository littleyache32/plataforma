import { REVIEW_ELIGIBILITY_CONTRACT } from './review-v2-eligibility.js'

export const QUESTION_RETEST_CONTRACT = 'reteste-questao-v2/1'
const nonempty = (value) => typeof value === 'string' && value.trim().length > 0
const key = (row) => `${row.entidade}:${row.id}`
const instant = (value) => {
  if (!nonempty(value) || !/(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('Reteste exige timestamp com fuso explícito.')
  }
  return Date.parse(value)
}

// Question-domain selection for the single Mentor, not an independent scheduler.
// No FSRS, fixed error interval, question generation or database mutation.
export function selectQuestionRetest({ elegibilidade, evidencia, conceito_id, questoes, historico,
  historico_completo = false, fontes, policy_ref, importancia = null,
  desempenho_posterior = null, repeticao_original = null }) {
  if (elegibilidade?.versao !== REVIEW_ELIGIBILITY_CONTRACT || elegibilidade.alvo?.entidade !== 'questao'
    || !nonempty(elegibilidade.alvo.id) || evidencia?.tipo !== 'QUESTAO'
    || evidencia.alvo?.id !== elegibilidade.alvo.id || evidencia.corte !== elegibilidade.corte
    || !nonempty(conceito_id) || !Array.isArray(questoes) || !Array.isArray(historico)
    || !Array.isArray(fontes) || fontes.some((row) => !nonempty(row.entidade) || !nonempty(row.id))
    || !nonempty(policy_ref?.id) || !nonempty(policy_ref?.versao)
    || typeof historico_completo !== 'boolean') throw new Error('Entradas de reteste inválidas.')
  const cutoff = instant(elegibilidade.corte), original = elegibilidade.alvo.id
  const sources = new Set(fontes.map(key))
  if (!evidencia.fontes?.every((row) => sources.has(key(row)))) throw new Error('Fontes da evidência ausentes.')
  const qualified = (value) => value?.confirmada === true && nonempty(value.regra_ref?.id)
    && nonempty(value.regra_ref?.versao) && Array.isArray(value.fontes) && value.fontes.length > 0
    && value.fontes.every((row) => sources.has(key(row)))
  if (questoes.some((row) => !nonempty(row.id)) || new Set(questoes.map((row) => row.id)).size !== questoes.length) {
    throw new Error('Questões inválidas ou duplicadas.')
  }
  // Exact duplicates from retry are one exposure; divergent duplicates are rejected.
  const records = new Map()
  for (const row of historico) {
    if (!nonempty(row.id) || !nonempty(row.questao_id) || !sources.has(`registro:${row.id}`)
      || !['acerto', 'erro'].includes(row.resultado)
      || ![null, undefined, 'certeza', 'duvida', 'eliminacao', 'sem_conhecimento'].includes(row.classificacao)
      || instant(row.criado_em) > cutoff) throw new Error('Histórico de reteste inválido.')
    const normalized = { id: row.id, questao_id: row.questao_id, conceito_id: row.conceito_id ?? null,
      resultado: row.resultado, classificacao: row.classificacao ?? null, criado_em: row.criado_em }
    if (records.has(row.id) && JSON.stringify(records.get(row.id)) !== JSON.stringify(normalized)) {
      throw new Error('Registro duplicado com fatos divergentes.')
    }
    records.set(row.id, normalized)
  }
  const attempts = [...records.values()].sort((a, b) => instant(a.criado_em) - instant(b.criado_em) || a.id.localeCompare(b.id))
  const previousAt = evidencia.observacoes.recencia?.observado_em
  const later = previousAt ? attempts.filter((row) => row.conceito_id === conceito_id && instant(row.criado_em) > instant(previousAt)) : []
  const codes = [...elegibilidade.reason_codes]
  const result = (selected, reason) => ({ versao: QUESTION_RETEST_CONTRACT,
    resultado: selected ? 'RETESTE_SELECIONADO' : 'RETESTE_PENDENTE',
    questao_id: selected?.id ?? null, questao_original_id: original, conceito_id,
    reason_codes: [...new Set([...codes, reason])], corte: elegibilidade.corte,
    policy_ref: structuredClone(policy_ref), fontes: structuredClone(fontes),
    observacoes: { anterior: structuredClone(evidencia.observacoes),
      historico_completo, exposicoes: questoes.map((q) => {
        const rows = attempts.filter((row) => row.questao_id === q.id)
        return { questao_id: q.id, quantidade_observada: rows.length,
          quantidade_total: historico_completo ? rows.length : null, ultima_exposicao: rows.at(-1)?.criado_em ?? null }
      }), desempenho_posterior: structuredClone(later), importancia: qualified(importancia) ? structuredClone(importancia) : null },
    qualificacoes_utilizadas: structuredClone({ desempenho_posterior, repeticao_original }),
    gera_questao: false, cria_demanda: false, altera_historico: false, infere_dominio: false })
  if (!elegibilidade.elegivel || elegibilidade.resultado !== 'ELEGIVEL') return result(null, 'QUESTION_RETEST_REQUIRES_ELIGIBILITY')
  if (qualified(importancia) && ['LOW', 'MEDIUM', 'HIGH'].includes(importancia.valor)) codes.push(`QUESTION_IMPORTANCE_${importancia.valor}`)
  if (later.length) codes.push('QUESTION_LATER_CONCEPT_EVIDENCE')
  if (desempenho_posterior?.confirmada === true) {
    const laterIds = new Set(later.map((row) => `registro:${row.id}`))
    if (!qualified(desempenho_posterior) || desempenho_posterior.conceito_id !== conceito_id
      || !desempenho_posterior.fontes.every((row) => laterIds.has(key(row)))
      || !['NECESSIDADE_SUPERADA', 'NECESSIDADE_PERSISTE'].includes(desempenho_posterior.estado)) {
      return result(null, 'QUESTION_LATER_PERFORMANCE_NOT_PROVEN')
    }
    if (desempenho_posterior.estado === 'NECESSIDADE_SUPERADA') return result(null, 'QUESTION_RETEST_SUPERSEDED_BY_LATER_EVIDENCE')
    codes.push('QUESTION_RETEST_NEED_PERSISTS')
  }
  const valid = questoes.filter((q) => q.ativo === true && q.elegivel === true && sources.has(`questao:${q.id}`))
  const originalRow = valid.find((q) => q.id === original)
  const alternatives = valid.filter((q) => q.id !== original && q.conceito_id === conceito_id
    && qualified(q.equivalencia) && q.equivalencia.conceito_id === conceito_id
    && q.equivalencia.questao_original_id === original
    && q.equivalencia.fontes.some((row) => row.entidade === 'questao' && row.id === q.id)
    && q.equivalencia.fontes.some((row) => row.entidade === 'questao' && row.id === original))
  const exposure = (q) => attempts.filter((row) => row.questao_id === q.id)
  // Within proven equivalence: known different angle, fewer exposures only
  // with complete history, older known exposure. Missing history is UNKNOWN.
  const differentAngle = (q) => nonempty(originalRow?.angulo_id) && nonempty(q.angulo_id)
    && q.equivalencia.angulo_original_id === originalRow.angulo_id
    && q.equivalencia.angulo_alternativa_id === q.angulo_id
    && q.angulo_id !== originalRow.angulo_id ? 1 : 0
  alternatives.sort((a, b) => differentAngle(b) - differentAngle(a)
    || (historico_completo ? exposure(a).length - exposure(b).length : 0)
    || (exposure(a).length && exposure(b).length
      ? instant(exposure(a).at(-1).criado_em) - instant(exposure(b).at(-1).criado_em) : 0)
    || a.id.localeCompare(b.id))
  if (alternatives.length) {
    codes.push('QUESTION_AVOID_MECHANICAL_RECOGNITION')
    if (differentAngle(alternatives[0])) codes.push('QUESTION_DIFFERENT_ANGLE')
    return result(alternatives[0], 'QUESTION_EQUIVALENT_ALTERNATIVE')
  }
  // No arbitrary error + X days: reuse needs a versioned, explicitly timed
  // authorization from policy, grounded in an attempt/retest source.
  if (originalRow && qualified(repeticao_original) && repeticao_original.questao_id === original
    && repeticao_original.fontes.some((row) => ['registro', 'revisao_item'].includes(row.entidade))
    && previousAt && repeticao_original.nao_antes_de
    && instant(repeticao_original.nao_antes_de) > instant(previousAt)
    && instant(repeticao_original.nao_antes_de) <= cutoff) {
    return result(originalRow, 'QUESTION_ORIGINAL_RETEST_AUTHORIZED')
  }
  return result(null, 'QUESTION_ALTERNATIVES_OR_REUSE_AUTHORIZATION_MISSING')
}
