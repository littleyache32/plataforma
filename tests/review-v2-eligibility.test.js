import { describe, expect, it } from 'vitest'
import { questionReviewEvidence, cardReviewEvidence } from '../shared/review-v2-evidence.js'
import { evaluateReviewEligibility, REVIEW_ELIGIBILITY_REASONS } from '../shared/review-v2-eligibility.js'

const corte = '2026-10-07T15:00:00Z'
const attempt = { id: 'r', questao_id: 'q', resultado: 'erro', classificacao: 'certeza', criado_em: '2026-10-06T15:00:00Z' }
function evidence(registro = attempt, instant = corte) {
  return questionReviewEvidence({ registro, questao: { id: 'q', topico_id: 't' }, corte: instant,
    contexto: { tipo: 'RETESTE', referencia: { entidade: 'revisao_item', id: 'need' } } })
}
function qualification(criterio, extra = {}) {
  return { criterio, estado: 'CONFIRMADO', regra_ref: { id: 'synthetic-qualified-rule', versao: 'test/1' },
    fontes: [{ entidade: criterio === 'RETESTE_DEVIDO' ? 'revisao_item' : 'registro', id: criterio === 'RETESTE_DEVIDO' ? 'need' : 'r' }],
    ...(criterio === 'RETESTE_DEVIDO' ? { nao_antes_de: corte } : {}), ...extra }
}
const run = (criterio, registro = attempt) => evaluateReviewEligibility({ evidencia: evidence(registro), qualificacoes: [qualification(criterio)] })

describe('Fase 4.3, elegibilidade sem ranking ou calendário fixo', () => {
  it.each(Object.keys(REVIEW_ELIGIBILITY_REASONS))('%s qualificado torna questão elegível com motivo', (criterio) => {
    const registro = { ...attempt, classificacao: criterio === 'FALTA_CONHECIMENTO' ? 'sem_conhecimento' : criterio === 'DUVIDA_PERSISTENTE' ? 'duvida' : 'certeza' }
    const result = run(criterio, registro)
    expect(result.elegivel).toBe(true)
    expect(result.reason_codes).toContain(REVIEW_ELIGIBILITY_REASONS[criterio])
    expect(result).toMatchObject({ cria_demanda: false, define_prioridade: false })
    expect(result).not.toHaveProperty('agendada_para')
  })
  it('erro/falsa certeza isolados sem qualificação não criam calendário ou elegibilidade', () => {
    const result = evaluateReviewEligibility({ evidencia: evidence() })
    expect(result.resultado).toBe('EVIDENCIA_INSUFICIENTE')
    expect(result.elegivel).toBe(false)
  })
  it('erro pode ficar elegível meses depois sem erro + X dias', () => {
    const qualifications = [qualification('ERRO_RELEVANTE', { nao_antes_de: '2027-03-01T15:00:00Z' })]
    const first = evaluateReviewEligibility({ evidencia: evidence(), qualificacoes: qualifications })
    expect(first.elegivel).toBe(false)
    expect(first.reason_codes).toContain('REVIEW_NOT_YET_ELIGIBLE')
    expect(evaluateReviewEligibility({ evidencia: evidence(attempt, '2027-03-02T15:00:00Z'), qualificacoes: qualifications }).elegivel).toBe(true)
  })
  it('reteste futuro não está devido; tempo não cria dívida', () => {
    const result = evaluateReviewEligibility({ evidencia: evidence(), qualificacoes: [qualification('RETESTE_DEVIDO', { nao_antes_de: '2030-03-01T15:00:00Z' })] })
    expect(result.elegivel).toBe(false)
    expect(result).not.toHaveProperty('divida_minutos')
  })
  it('dúvida única não vira persistência sem qualificação', () => {
    expect(evaluateReviewEligibility({ evidencia: evidence({ ...attempt, classificacao: 'duvida' }), qualificacoes: [{ criterio: 'DUVIDA_PERSISTENTE', estado: 'UNKNOWN' }] }).elegivel).toBe(false)
  })
  it('critério descartado permanece não elegível', () => {
    expect(evaluateReviewEligibility({ evidencia: evidence(), qualificacoes: [qualification('ERRO_RELEVANTE', { estado: 'DESCARTADO' })] }).resultado).toBe('NAO_ELEGIVEL')
  })
  it('acerto pode voltar por cobertura/importância, sem retornar à teoria inteira', () => {
    expect(run('COBERTURA', { ...attempt, resultado: 'acerto' }).elegivel).toBe(true)
    expect(run('IMPORTANCIA_CONTEUDO', { ...attempt, resultado: 'acerto' }).elegivel).toBe(true)
  })
  it('recusa qualificação sem regra, fonte desconhecida, duplicação ou observação contraditória', () => {
    for (const extra of [{ regra_ref: null }, { fontes: [{ entidade: 'registro', id: 'missing' }] }]) {
      expect(() => evaluateReviewEligibility({ evidencia: evidence(), qualificacoes: [qualification('ERRO_RELEVANTE', extra)] })).toThrow('Qualificação')
    }
    expect(() => evaluateReviewEligibility({ evidencia: evidence(), qualificacoes: [qualification('ERRO_RELEVANTE'), qualification('ERRO_RELEVANTE')] })).toThrow('duplicado')
    expect(() => run('FALTA_CONHECIMENTO')).toThrow('contradiz')
    expect(() => run('ERRO_RELEVANTE', { ...attempt, resultado: 'acerto' })).toThrow('contradiz')
  })
  it('reteste exige ocorrência e data, não default legado', () => {
    expect(() => evaluateReviewEligibility({ evidencia: evidence(), qualificacoes: [qualification('RETESTE_DEVIDO', { nao_antes_de: null })] })).toThrow('data canônica')
    expect(() => evaluateReviewEligibility({ evidencia: evidence(), qualificacoes: [qualification('RETESTE_DEVIDO', { fontes: [{ entidade: 'registro', id: 'r' }] })] })).toThrow('ocorrência')
  })
  it('card vencido no legado não é considerado FSRS calculado', () => {
    const card = cardReviewEvidence({ card: { id: 'c', proxima_revisao: corte }, corte })
    const result = evaluateReviewEligibility({ evidencia: card })
    expect(result.resultado).toBe('EVIDENCIA_INSUFICIENTE')
    expect(result.pendencias).toContain('FSRS_NAO_DISPONIVEL')
  })
  it.each([true, false])('resultado externo FSRS %s é apenas entrada futura de vencimento', (due) => {
    const result = evaluateReviewEligibility({ evidencia: cardReviewEvidence({ card: { id: 'c' }, corte }),
      fsrs: { algoritmo: 'FSRS', card_id: 'c', versao_algoritmo: 'future/test', versao_configuracao: 'synthetic/1',
        referencia: { entidade: 'question_card', id: 'c' }, calculado_em: corte,
        proxima_revisao: due ? corte : '2030-01-01T15:00:00Z' } })
    expect(result.elegivel).toBe(due)
    if (due) expect(result.reason_codes).toEqual(['REVIEW_FSRS_DUE'])
  })
  it('recusa FSRS em questão e mistura de critério de questão em card', () => {
    expect(() => evaluateReviewEligibility({ evidencia: evidence(), fsrs: {} })).toThrow('FSRS não governa')
    expect(() => evaluateReviewEligibility({ evidencia: cardReviewEvidence({ card: { id: 'c' }, corte }), qualificacoes: [qualification('COBERTURA')] })).toThrow('não se aplicam')
    expect(() => evaluateReviewEligibility({ evidencia: cardReviewEvidence({ card: { id: 'c' }, corte }),
      fsrs: { algoritmo: 'FSRS', card_id: 'c', versao_algoritmo: 'test', versao_configuracao: 'test', referencia: { entidade: 'question_card', id: 'other' }, calculado_em: corte, proxima_revisao: corte } })).toThrow('incompatível')
  })
  it('permuta de critérios preserva resultado determinístico e inputs', () => {
    const input = { evidencia: evidence(), qualificacoes: [qualification('COBERTURA'), qualification('FALSA_CERTEZA')] }
    const snapshot = structuredClone(input), first = evaluateReviewEligibility(input)
    expect(evaluateReviewEligibility({ ...input, qualificacoes: [...input.qualificacoes].reverse() })).toEqual(first)
    expect(input).toEqual(snapshot)
  })
})
