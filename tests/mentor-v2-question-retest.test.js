import { describe, expect, it } from 'vitest'
import { selectQuestionRetest } from '../shared/mentor-v2-question-retest.js'
import { questionReviewEvidence } from '../shared/review-v2-evidence.js'
import { evaluateReviewEligibility } from '../shared/review-v2-eligibility.js'

const qualified = (extra = {}) => ({ confirmada: true, regra_ref: { id: 'test', versao: '1' },
  fontes: [{ entidade: 'registro', id: 'r' }], ...extra })
function input() {
  const corte = '2026-10-07T15:00:00Z'
  const registro = { id: 'r', questao_id: 'q', conceito_id: 'concept', resultado: 'erro', classificacao: 'certeza', criado_em: '2026-09-01T15:00:00Z' }
  const evidencia = questionReviewEvidence({ registro, questao: { id: 'q', topico_id: 't' }, corte, erroAlvo: registro })
  const elegibilidade = evaluateReviewEligibility({ evidencia, qualificacoes: [{ criterio: 'FALSA_CERTEZA', estado: 'CONFIRMADO', regra_ref: { id: 'test', versao: '1' }, fontes: [{ entidade: 'registro', id: 'r' }] }] })
  return { evidencia, elegibilidade, conceito_id: 'concept', policy_ref: { id: 'mentor', versao: 'test' },
    fontes: [...evidencia.fontes, { entidade: 'questao', id: 'alt' }], historico: [registro], historico_completo: true,
    questoes: [{ id: 'q', conceito_id: 'concept', angulo_id: 'a', ativo: true, elegivel: true },
      { id: 'alt', conceito_id: 'concept', angulo_id: 'b', ativo: true, elegivel: true,
        equivalencia: qualified({ conceito_id: 'concept', questao_original_id: 'q', angulo_original_id: 'a', angulo_alternativa_id: 'b',
          fontes: [{ entidade: 'questao', id: 'q' }, { entidade: 'questao', id: 'alt' }] }) }] }
}
function addQuestion(args, id, angle = 'a') {
  const q = structuredClone(args.questoes[1]); q.id = id; q.angulo_id = angle
  q.equivalencia.angulo_alternativa_id = angle
  q.equivalencia.fontes[1].id = id
  args.questoes.push(q); args.fontes.push({ entidade: 'questao', id })
}
function addAttempt(args, id, question, date, outcome = 'acerto') {
  args.historico.push({ id, questao_id: question, conceito_id: 'concept', resultado: outcome, classificacao: 'duvida', criado_em: date })
  args.fontes.push({ entidade: 'registro', id })
}

describe('Fase 4.6, reteste de questões separado de FSRS', () => {
  it('prefere outra questão equivalente e ângulo diferente, conservando erro-alvo e confiança', () => {
    const result = selectQuestionRetest(input())
    expect(result.questao_id).toBe('alt')
    expect(result.reason_codes).toContain('QUESTION_DIFFERENT_ANGLE')
    expect(result.observacoes.anterior).toMatchObject({ resultado: 'erro', confianca: 'certeza', falsa_certeza: true, erro_alvo: { id: 'r' } })
  })
  it('mesmo tópico ou conceito sem equivalência comprovada não autoriza alternativa', () => {
    const args = input(); args.questoes[1].equivalencia = null
    expect(selectQuestionRetest(args).questao_id).toBeNull()
  })
  it.each(['outro-conceito', null])('não usa equivalência de outro conceito %s', (concept) => {
    const args = input(); args.questoes[1].conceito_id = concept
    expect(selectQuestionRetest(args).questao_id).toBeNull()
  })
  it.each(['ativo', 'elegivel'])('não seleciona alternativa sem %s', (field) => {
    const args = input(); args.questoes[1][field] = false
    expect(selectQuestionRetest(args).questao_id).toBeNull()
  })
  it('não usa recurso sem referência canônica ou prova versionada', () => {
    const args = input(); args.fontes = args.evidencia.fontes
    expect(selectQuestionRetest(args).questao_id).toBeNull()
    const other = input(); delete other.questoes[1].equivalencia.regra_ref
    expect(selectQuestionRetest(other).questao_id).toBeNull()
  })
  it('prefere menor exposição com histórico completo e não deduz domínio', () => {
    const args = input(); addQuestion(args, 'other', 'b')
    addAttempt(args, 'r2', 'alt', '2026-09-02T12:00:00Z')
    const result = selectQuestionRetest(args)
    expect(result.questao_id).toBe('other'); expect(result.infere_dominio).toBe(false)
  })
  it('recência desempata exposições iguais sem intervalo fixo', () => {
    const args = input(); addQuestion(args, 'other', 'b')
    addAttempt(args, 'r2', 'alt', '2026-10-01T12:00:00Z')
    addAttempt(args, 'r3', 'other', '2026-09-02T12:00:00Z')
    expect(selectQuestionRetest(args).questao_id).toBe('other')
  })
  it('histórico parcial não transforma ausência em zero exposições', () => {
    const args = input(); args.historico_completo = false
    addQuestion(args, 'aaa', 'b'); addAttempt(args, 'r2', 'aaa', '2026-10-01T12:00:00Z')
    const result = selectQuestionRetest(args)
    expect(result.questao_id).toBe('aaa')
    expect(result.observacoes.exposicoes.every((row) => row.quantidade_total === null)).toBe(true)
  })
  it('acerto posterior isolado é observado, mas não cancela reteste nem infere domínio', () => {
    const args = input(); addAttempt(args, 'later', 'alt', '2026-10-02T12:00:00Z')
    const result = selectQuestionRetest(args)
    expect(result.questao_id).toBe('alt'); expect(result.observacoes.desempenho_posterior).toHaveLength(1)
  })
  it('evidência posterior qualificada pode superar necessidade sem apagar história', () => {
    const args = input(); addAttempt(args, 'later', 'alt', '2026-10-02T12:00:00Z')
    args.desempenho_posterior = qualified({ conceito_id: 'concept', estado: 'NECESSIDADE_SUPERADA', fontes: [{ entidade: 'registro', id: 'later' }] })
    const result = selectQuestionRetest(args)
    expect(result.questao_id).toBeNull(); expect(result.reason_codes).toContain('QUESTION_RETEST_SUPERSEDED_BY_LATER_EVIDENCE')
    expect(result.altera_historico).toBe(false)
  })
  it('performance antiga ou de outro conceito não comprova superação posterior', () => {
    const args = input(); args.desempenho_posterior = qualified({ conceito_id: 'concept', estado: 'NECESSIDADE_SUPERADA' })
    expect(selectQuestionRetest(args).reason_codes).toContain('QUESTION_LATER_PERFORMANCE_NOT_PROVEN')
  })
  it('importância comprovada gera motivo sem significar exclusão de baixa importância', () => {
    const args = input(); args.importancia = qualified({ valor: 'LOW' })
    const result = selectQuestionRetest(args)
    expect(result.questao_id).toBe('alt'); expect(result.reason_codes).toContain('QUESTION_IMPORTANCE_LOW')
  })
  it('sem alternativas não repete automaticamente nem inventa questão', () => {
    const args = input(); args.questoes = args.questoes.slice(0, 1)
    const result = selectQuestionRetest(args)
    expect(result.resultado).toBe('RETESTE_PENDENTE'); expect(result.gera_questao).toBe(false)
  })
  it('mesma questão pode voltar posteriormente mediante autorização temporal versionada', () => {
    const args = input(); args.questoes = args.questoes.slice(0, 1)
    args.repeticao_original = qualified({ questao_id: 'q', nao_antes_de: '2026-10-07T15:00:00Z' })
    expect(selectQuestionRetest(args).questao_id).toBe('q')
    args.repeticao_original.nao_antes_de = '2027-04-01T15:00:00Z'
    expect(selectQuestionRetest(args).questao_id).toBeNull()
  })
  it('mesmo com autorização para original, prefere alternativa comprovada', () => {
    const args = input(); args.repeticao_original = qualified({ questao_id: 'q', nao_antes_de: '2026-10-01T12:00:00Z' })
    expect(selectQuestionRetest(args).questao_id).toBe('alt')
  })
  it('autorização não pode repetir original no instante da exposição anterior', () => {
    const args = input(); args.questoes = args.questoes.slice(0, 1)
    args.repeticao_original = qualified({ questao_id: 'q', nao_antes_de: args.historico[0].criado_em })
    expect(selectQuestionRetest(args).questao_id).toBeNull()
  })
  it('necessidade persistente comprovada conserva reteste', () => {
    const args = input(); addAttempt(args, 'later', 'alt', '2026-10-02T12:00:00Z', 'erro')
    args.desempenho_posterior = qualified({ conceito_id: 'concept', estado: 'NECESSIDADE_PERSISTE', fontes: [{ entidade: 'registro', id: 'later' }] })
    expect(selectQuestionRetest(args).reason_codes).toContain('QUESTION_RETEST_NEED_PERSISTS')
  })
  it('ângulo sem prova não recebe preferência só por rótulo', () => {
    const args = input(); addQuestion(args, 'aaa', 'a')
    delete args.questoes[1].equivalencia.angulo_alternativa_id
    expect(selectQuestionRetest(args).questao_id).toBe('aaa')
  })
  it('não seleciona necessidade inelegível', () => {
    const args = input(); args.elegibilidade.elegivel = false
    expect(selectQuestionRetest(args).reason_codes).toContain('QUESTION_RETEST_REQUIRES_ELIGIBILITY')
  })
  it('retry deduplica exposição, mas rejeita fatos divergentes', () => {
    const args = input(); args.historico.push(structuredClone(args.historico[0]))
    expect(selectQuestionRetest(args).observacoes.exposicoes[0].quantidade_total).toBe(1)
    args.historico[1].resultado = 'acerto'
    expect(() => selectQuestionRetest(args)).toThrow('divergentes')
  })
  it('recusa observações futuras e timestamp sem fuso', () => {
    const args = input(); args.historico[0].criado_em = '2027-01-01T12:00:00Z'
    expect(() => selectQuestionRetest(args)).toThrow('Histórico')
    args.historico[0].criado_em = '2026-09-01T12:00:00'
    expect(() => selectQuestionRetest(args)).toThrow('fuso')
  })
  it('mesmos inputs e ordem permutada produzem mesma seleção, sem mutações', () => {
    const args = input(); addQuestion(args, 'other', 'b')
    const original = structuredClone(args), result = selectQuestionRetest(args)
    expect(args).toEqual(original)
    args.questoes.reverse(); args.historico.reverse()
    expect(selectQuestionRetest(args).questao_id).toBe(result.questao_id)
    expect(result).toMatchObject({ cria_demanda: false, altera_historico: false, gera_questao: false })
  })
})
