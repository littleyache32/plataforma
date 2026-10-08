import { REVIEW_EVIDENCE_CONTRACT } from './review-v2-evidence.js'
import { evaluateReviewEligibility } from './review-v2-eligibility.js'

export const QUESTION_SIGNAL_CONTRACT = 'sinais-locais-questao-v2/1'
const text = (value) => typeof value === 'string' && value.trim().length > 0
const key = (row) => `${row.entidade}:${row.id}`

// User-approved local interpretation, inside the ONE Mentor. This is not an
// estimator of mastery, a subject-level strategy or a new scheduling engine.
export function assessQuestionCorrectionSignal({ evidencia, policy_ref, conceito = null }) {
  if (evidencia?.versao !== REVIEW_EVIDENCE_CONTRACT || evidencia.tipo !== 'QUESTAO'
    || evidencia.alvo?.entidade !== 'questao' || !text(evidencia.alvo.id)
    || !Array.isArray(evidencia.fontes) || !evidencia.observacoes
    || !text(policy_ref?.id) || !text(policy_ref?.versao)) throw new Error('Evidência/policy de sinais locais inválida.')
  const observation = evidencia.observacoes
  const outcome = observation.resultado ?? null, confidence = observation.confianca ?? null
  if (![null, 'erro', 'acerto'].includes(outcome)
    || ![null, 'sem_conhecimento', 'eliminacao', 'duvida', 'certeza'].includes(confidence)) {
    throw new Error('Resultado/confiança de questão inválido.')
  }
  const falseCertainty = outcome === null || confidence === null ? null : outcome === 'erro' && confidence === 'certeza'
  if (observation.falsa_certeza !== falseCertainty) throw new Error('Falsa certeza contradiz resultado/confiança.')
  // The evidence contract puts the observed attempt first, before error-target
  // and context references. Never qualify using a different historical error.
  const attempt = evidencia.fontes[0]
  const question = { entidade: 'questao', id: evidencia.alvo.id }
  if (attempt?.entidade !== 'registro' || !text(attempt.id)
    || evidencia.fontes.some((row) => !text(row.entidade) || !text(row.id))
    || !evidencia.fontes.some((row) => key(row) === key(question))) throw new Error('Proveniência da tentativa ausente.')
  const sources = new Set(evidencia.fontes.map(key))
  if (conceito !== null && (!text(conceito.id) || conceito.questao_id !== question.id
    || conceito.confirmada !== true || !text(conceito.regra_ref?.id) || !text(conceito.regra_ref?.versao)
    || !Array.isArray(conceito.fontes) || !conceito.fontes.length
    || !conceito.fontes.some((row) => key(row) === key(question))
    || conceito.fontes.some((row) => !sources.has(key(row))))) throw new Error('Vínculo questão/conceito não comprovado.')

  let signal = 'UNKNOWN', strength = 'INDETERMINADA', criterion = null
  const codes = ['QUESTION_LOCAL_SCOPE_ONLY', 'QUESTION_BROAD_DECISION_REQUIRES_SAMPLE']
  if (outcome === 'erro' && confidence === 'certeza') {
    signal = 'FALSA_CERTEZA'; strength = 'CORRETIVA_FORTE'; criterion = 'FALSA_CERTEZA'
    codes.push('QUESTION_FALSE_CERTAINTY_LOCAL_CORRECTION')
  } else if (outcome === 'erro' && confidence === 'sem_conhecimento') {
    signal = 'PROVAVEL_LACUNA_BASE'; strength = 'CORRETIVA'; criterion = 'FALTA_CONHECIMENTO'
    codes.push('QUESTION_POSSIBLE_BASE_GAP', 'QUESTION_THEORY_REQUIRES_CONFIRMED_GAP')
  } else if (outcome === 'acerto' && ['duvida', 'eliminacao'].includes(confidence)) {
    signal = 'CONHECIMENTO_INSTAVEL'; strength = 'POSITIVA_INSTAVEL'
    codes.push('QUESTION_UNSTABLE_CORRECT_ANSWER')
  } else if (outcome === 'acerto' && confidence === 'certeza') {
    signal = 'EVIDENCIA_POSITIVA_FORTE'; strength = 'POSITIVA_MAIS_FORTE'
    codes.push('QUESTION_STRONGER_POSITIVE_EVIDENCE', 'QUESTION_CORRECT_ANSWER_NOT_MASTERY')
  } else if (outcome === 'acerto' && confidence === 'sem_conhecimento') {
    signal = 'ACERTO_FRACO_POSSIVEL_ACASO'; strength = 'POSITIVA_FRACA'
    codes.push('QUESTION_WEAK_CORRECT_POSSIBLE_GUESS')
  } else if (outcome === 'erro' && ['duvida', 'eliminacao'].includes(confidence)) {
    signal = 'ERRO_COM_INCERTEZA'; strength = 'OBSERVACIONAL'
    codes.push('QUESTION_UNCERTAIN_ERROR_OBSERVATION')
  } else codes.push('QUESTION_RESULT_OR_CONFIDENCE_UNKNOWN')

  // Only the two explicitly approved corrective combinations qualify locally.
  // No persistence/sample threshold or theory-gap proof is fabricated here.
  const qualifications = criterion ? [{ criterio: criterion, estado: 'CONFIRMADO',
    regra_ref: { id: 'TRATAMENTO_LOCAL_SINAIS_QUESTAO', versao: QUESTION_SIGNAL_CONTRACT },
    fontes: [structuredClone(attempt), question] }] : []
  return { versao: QUESTION_SIGNAL_CONTRACT, sinal: signal, forca: strength,
    escopo: conceito ? { tipo: 'CONCEITO', id: conceito.id, questao_origem_id: question.id }
      : { tipo: 'QUESTAO', id: question.id },
    prioridade_local: strength === 'CORRETIVA_FORTE' ? 'CORRETIVA_FORTE' : null,
    necessidade_local: criterion ? 'REVISAO_OU_RETESTE' : null,
    qualificacoes: qualifications,
    elegibilidade: evaluateReviewEligibility({ evidencia, qualificacoes: qualifications }),
    reason_codes: codes, corte: evidencia.corte, policy_ref: structuredClone(policy_ref),
    fontes: structuredClone(evidencia.fontes), observacoes: structuredClone(observation),
    vinculo_conceito: structuredClone(conceito),
    autoriza_decisao_ampla: false, requer_amostra_para_decisao_ampla: true,
    infere_dominio: false, confirma_lacuna_base: false, autoriza_retorno_teoria: false,
    altera_prioridade_materia: false, altera_carga: false, cria_demanda: false }
}
