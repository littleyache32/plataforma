import { REVIEW_EVIDENCE_CONTRACT } from './review-v2-evidence.js'

export const REVIEW_ELIGIBILITY_CONTRACT = 'elegibilidade-revisao-v2/1'
export const REVIEW_ELIGIBILITY_REASONS = Object.freeze({
  ERRO_RELEVANTE: 'REVIEW_RELEVANT_ERROR', FALSA_CERTEZA: 'REVIEW_FALSE_CERTAINTY',
  FALTA_CONHECIMENTO: 'REVIEW_KNOWLEDGE_GAP', DUVIDA_PERSISTENTE: 'REVIEW_PERSISTENT_DOUBT',
  RETESTE_DEVIDO: 'REVIEW_RETEST_DUE', SEM_EXPOSICAO: 'REVIEW_LONG_EXPOSURE_GAP',
  IMPORTANCIA_CONTEUDO: 'REVIEW_CONTENT_IMPORTANCE', COBERTURA: 'REVIEW_COVERAGE_NEED',
})
const text = (value) => typeof value === 'string' && value.trim().length > 0
function instant(value) {
  if (!text(value) || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) throw new Error('Instante de elegibilidade inválido.')
  return Date.parse(value)
}
const refKey = (row) => `${row.entidade}:${row.id}`

// Qualified context comes from the single Mentor policy, not subjective commands.
// Eligibility is a signal, never a priority, load decision or a scheduled demand.
export function evaluateReviewEligibility({ evidencia, qualificacoes = [], fsrs = null }) {
  if (evidencia?.versao !== REVIEW_EVIDENCE_CONTRACT || !['QUESTAO', 'QUESTION_CARD'].includes(evidencia.tipo)
    || !text(evidencia.alvo?.id) || !Array.isArray(evidencia.fontes) || !evidencia.observacoes) throw new Error('Evidência de revisão incompatível.')
  const cutoff = instant(evidencia.corte)
  if (!Array.isArray(qualificacoes)) throw new Error('Qualificações de revisão inválidas.')
  const codes = [], pending = [], assessed = [], used = []
  const result = () => ({ versao: REVIEW_ELIGIBILITY_CONTRACT, alvo: structuredClone(evidencia.alvo), corte: evidencia.corte,
    resultado: codes.length ? 'ELEGIVEL' : pending.length ? 'EVIDENCIA_INSUFICIENTE' : 'NAO_ELEGIVEL',
    elegivel: codes.length > 0, reason_codes: codes.length ? [...new Set(codes)].sort() : [pending.length ? 'REVIEW_INSUFFICIENT_EVIDENCE' : 'REVIEW_NOT_ELIGIBLE'],
    criterios_avaliados: assessed, pendencias: [...new Set(pending)].sort(), evidencias_utilizadas: used,
    cria_demanda: false, define_prioridade: false })

  if (evidencia.tipo === 'QUESTION_CARD') {
    if (qualificacoes.length) throw new Error('Critérios de questões não se aplicam ao SRS de cards.')
    if (!fsrs) { pending.push('FSRS_NAO_DISPONIVEL'); return result() }
    if (fsrs.algoritmo !== 'FSRS' || fsrs.card_id !== evidencia.alvo.id || !text(fsrs.versao_algoritmo)
      || !text(fsrs.versao_configuracao) || fsrs.referencia?.entidade !== 'question_card' || fsrs.referencia?.id !== evidencia.alvo.id
      || instant(fsrs.calculado_em) > cutoff) throw new Error('Resultado FSRS incompatível ou não auditável.')
    const due = instant(fsrs.proxima_revisao) <= cutoff
    assessed.push({ criterio: 'VENCIMENTO_FSRS', estado: due ? 'CONFIRMADO' : 'DESCARTADO' })
    used.push({ fonte: structuredClone(fsrs.referencia), versao_algoritmo: fsrs.versao_algoritmo,
      versao_configuracao: fsrs.versao_configuracao, calculado_em: fsrs.calculado_em, proxima_revisao: fsrs.proxima_revisao })
    if (due) codes.push('REVIEW_FSRS_DUE')
    return result()
  }
  if (fsrs) throw new Error('FSRS não governa reteste de questões.')
  const seen = new Set()
  const sources = new Set(evidencia.fontes.map(refKey))
  for (const row of [...qualificacoes].sort((a, b) => String(a?.criterio).localeCompare(String(b?.criterio)))) {
    if (!row || !Object.hasOwn(REVIEW_ELIGIBILITY_REASONS, row.criterio) || seen.has(row.criterio)
      || !['CONFIRMADO', 'DESCARTADO', 'UNKNOWN'].includes(row.estado)) throw new Error('Critério de elegibilidade inválido ou duplicado.')
    seen.add(row.criterio)
    if (row.estado === 'UNKNOWN') {
      assessed.push({ criterio: row.criterio, estado: 'UNKNOWN' }); pending.push(row.criterio); continue
    }
    if (!text(row.regra_ref?.id) || !text(row.regra_ref?.versao) || !Array.isArray(row.fontes) || !row.fontes.length
      || row.fontes.some((source) => !text(source.entidade) || !text(source.id) || !sources.has(refKey(source)))) {
      throw new Error('Qualificação exige regra versionada e fontes presentes na evidência.')
    }
    if (new Set(row.fontes.map(refKey)).size !== row.fontes.length) throw new Error('Fonte duplicada na qualificação.')
    const observation = evidencia.observacoes
    if (row.estado === 'CONFIRMADO' && ((row.criterio === 'ERRO_RELEVANTE' && observation.resultado !== 'erro')
      || (row.criterio === 'FALSA_CERTEZA' && observation.falsa_certeza !== true)
      || (row.criterio === 'FALTA_CONHECIMENTO' && observation.confianca !== 'sem_conhecimento')
      || (row.criterio === 'DUVIDA_PERSISTENTE' && observation.confianca !== 'duvida')
      || (row.criterio === 'SEM_EXPOSICAO' && !observation.recencia))) throw new Error('Qualificação contradiz ou excede a observação disponível.')
    if (row.criterio === 'RETESTE_DEVIDO' && !row.fontes.some((source) => source.entidade === 'revisao_item')) {
      throw new Error('Reteste devido exige referência à ocorrência canônica.')
    }
    if (row.criterio === 'RETESTE_DEVIDO' && !row.nao_antes_de) throw new Error('Reteste devido exige data canônica explícita.')
    const future = row.nao_antes_de ? instant(row.nao_antes_de) > cutoff : false
    assessed.push({ criterio: row.criterio, estado: row.estado, temporalmente_permitido: !future })
    used.push({ criterio: row.criterio, regra_ref: structuredClone(row.regra_ref), fontes: structuredClone(row.fontes), nao_antes_de: row.nao_antes_de ?? null })
    if (row.estado === 'CONFIRMADO') {
      if (future) continue
      codes.push(REVIEW_ELIGIBILITY_REASONS[row.criterio])
    }
  }
  if (!qualificacoes.length) pending.push('CRITERIOS_NAO_QUALIFICADOS')
  const evaluated = result()
  if (!evaluated.elegivel && assessed.some((row) => row.estado === 'CONFIRMADO' && row.temporalmente_permitido === false)) {
    evaluated.reason_codes.push('REVIEW_NOT_YET_ELIGIBLE')
  }
  return evaluated
}
