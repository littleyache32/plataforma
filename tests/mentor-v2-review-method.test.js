import { describe, expect, it } from 'vitest'
import { selectMentorReviewMethod } from '../shared/mentor-v2-review-method.js'
import { questionReviewEvidence, cardReviewEvidence } from '../shared/review-v2-evidence.js'
import { evaluateReviewEligibility } from '../shared/review-v2-eligibility.js'

const corte = '2026-10-07T15:00:00Z'
function input() {
  const evidencia = questionReviewEvidence({ registro: { id: 'r', questao_id: 'q', resultado: 'erro', classificacao: 'certeza', criado_em: corte }, questao: { id: 'q', topico_id: 't' }, corte })
  const elegibilidade = evaluateReviewEligibility({ evidencia, qualificacoes: [{ criterio: 'FALSA_CERTEZA', estado: 'CONFIRMADO', regra_ref: { id: 'test', versao: '1' }, fontes: [{ entidade: 'registro', id: 'r' }] }] })
  return { elegibilidade, topico_id: 't', fontes: [...evidencia.fontes, { entidade: 'question_card', id: 'c' }],
    policy_ref: { id: 'mentor', versao: 'test/1' }, modalidades: ['QUESTOES', 'QUESTION_CARDS', 'ESTUDO'],
    slots: [{ id: 'q-slot', atividade: 'QUESTOES', duracao_minutos: 50 }, { id: 'c-slot', atividade: 'QUESTION_CARDS', duracao_minutos: 30 }],
    recursos: { questoes: [{ id: 'q', topico_id: 't', ativo: true, elegivel: true }], cards: [{ id: 'c', topico_id: 't', ativo: true, elegivel: true }] } }
}
const qualified = (data) => ({ confirmada: true, regra_ref: { id: 'test-qualified', versao: '1' }, fontes: [{ entidade: 'registro', id: 'r' }], ...data })

describe('Fase 4.5, método interno de revisão do único Mentor', () => {
  it('questão individual usa slot de 50 sem incluir card disponível automaticamente', () => {
    const result = selectMentorReviewMethod(input())
    expect(result.metodo).toBe('QUESTAO_INDIVIDUAL')
    expect(result.componentes).toHaveLength(1)
    expect(result.componentes[0].duracao_minutos).toBe(50)
    expect(result.reason_codes).toContain('REVIEW_TARGETED_SINGLE_QUESTION')
  })
  it('bateria contém só questões elegíveis do tópico e não significa retorno ao curso', () => {
    const args = input(); args.fontes.push({ entidade: 'questao', id: 'q2' }, { entidade: 'questao', id: 'other' })
    args.recursos.questoes.push({ id: 'q2', topico_id: 't', ativo: true, elegivel: true }, { id: 'other', topico_id: 'other-topic', ativo: true, elegivel: true })
    const result = selectMentorReviewMethod(args)
    expect(result.metodo).toBe('BATERIA_QUESTOES')
    expect(result.componentes[0].referencias.map((row) => row.id)).toEqual(['q', 'q2'])
    expect(result.reinicia_curso).toBe(false)
  })
  it('30 minutos de cards preservam o SRS sem exigir questão', () => {
    const args = input(), evidencia = cardReviewEvidence({ card: { id: 'c', topico_id: 't' }, corte })
    args.elegibilidade = evaluateReviewEligibility({ evidencia, fsrs: { algoritmo: 'FSRS', card_id: 'c', versao_algoritmo: 'test', versao_configuracao: 'test', referencia: { entidade: 'question_card', id: 'c' }, calculado_em: corte, proxima_revisao: corte } })
    const result = selectMentorReviewMethod(args)
    expect(result.metodo).toBe('QUESTION_CARDS')
    expect(result.componentes[0].duracao_minutos).toBe(30)
    expect(result.componentes).toHaveLength(1)
  })
  it('combinação exige objetivos complementares e slots separados previamente disponíveis', () => {
    const args = input(); args.combinacao = qualified({ fontes: [{ entidade: 'questao', id: 'q' }, { entidade: 'question_card', id: 'c' }], finalidade_cards: 'RECUPERACAO_ATIVA', finalidade_questoes: 'APLICACAO_DO_CONCEITO' })
    const result = selectMentorReviewMethod(args)
    expect(result.metodo).toBe('COMBINACAO')
    expect(result.componentes.map((row) => row.duracao_minutos)).toEqual([30, 50])
    expect(result.componentes.map((row) => row.slot_id)).toEqual(['c-slot', 'q-slot'])
    expect(result.reason_codes).toContain('REVIEW_COMPLEMENTARY_METHODS_JUSTIFIED')
    expect(result).not.toHaveProperty('duracao_minutos')
  })
  it('combinação genérica, sem prova ou capacidade não é criada', () => {
    const args = input(); args.combinacao = qualified({ finalidade_cards: 'revisar', finalidade_questoes: 'revisar' })
    expect(selectMentorReviewMethod(args).metodo).toBeNull()
    args.combinacao = qualified({ fontes: [{ entidade: 'questao', id: 'q' }, { entidade: 'question_card', id: 'c' }], finalidade_cards: 'RECUPERACAO_ATIVA', finalidade_questoes: 'APLICACAO_DO_CONCEITO' })
    args.slots = args.slots.slice(0, 1)
    expect(selectMentorReviewMethod(args).reason_codes).toContain('REVIEW_COMBINATION_RESOURCES_UNAVAILABLE')
  })
  it.each([false, null])('lacuna não confirmada %s não causa retorno à teoria', (confirmada) => {
    const args = input(); args.lacuna = { confirmada }
    expect(selectMentorReviewMethod(args).metodo).toBe('QUESTAO_INDIVIDUAL')
  })
  it('falsa certeza/erro não comprovam lacuna conceitual real', () => {
    const args = input(); args.lacuna = qualified({ topico_id: 't' })
    expect(selectMentorReviewMethod(args).reason_codes).toContain('REVIEW_CONCEPTUAL_GAP_NOT_PROVEN')
  })
  it('teoria pontual exige unidade, cobertura prévia e evento factual de prática', () => {
    const args = input(); args.slots.push({ id: 'theory', atividade: 'ESTUDO', duracao_minutos: 30 })
    args.fontes.push({ entidade: 'material_unidade_curricular', id: 'unit' }, { entidade: 'material_progresso', id: 'material' })
    args.lacuna = qualified({ topico_id: 't', conteudo_previamente_estudado: true, unidade: { id: 'unit', material_id: 'material' } })
    const result = selectMentorReviewMethod(args)
    expect(result.metodo).toBe('RETORNO_PONTUAL_TEORIA')
    expect(result.componentes[0].referencias).toEqual([{ entidade: 'material_unidade_curricular', id: 'unit' }])
    expect(result).toMatchObject({ altera_progresso: false, reinicia_curso: false })
    args.lacuna.conteudo_previamente_estudado = false
    expect(selectMentorReviewMethod(args).metodo).toBeNull()
  })
  it('ausência de recursos/carga não produz aula/PDF de fallback', () => {
    const args = input(); args.recursos.questoes = []
    expect(selectMentorReviewMethod(args).reason_codes).toContain('REVIEW_NO_AUTOMATIC_THEORY_FALLBACK')
    args.recursos = input().recursos; args.slots = []
    expect(selectMentorReviewMethod(args).metodo).toBeNull()
  })
  it('gates bloqueados e recursos inativos/não elegíveis são respeitados', () => {
    const args = input(); args.modalidades = ['QUESTION_CARDS']
    expect(selectMentorReviewMethod(args).metodo).toBeNull()
    args.modalidades = ['QUESTOES']; args.recursos.questoes[0].ativo = false
    expect(selectMentorReviewMethod(args).metodo).toBeNull()
    args.recursos.questoes[0].ativo = true; args.recursos.questoes[0].elegivel = false
    expect(selectMentorReviewMethod(args).metodo).toBeNull()
  })
  it('sem tópico não amplia escopo além do alvo exato', () => {
    const args = input(); args.topico_id = null
    args.recursos.questoes.push({ id: 'q2', ativo: true, elegivel: true }); args.fontes.push({ entidade: 'questao', id: 'q2' })
    expect(selectMentorReviewMethod(args).componentes[0].referencias).toEqual([{ entidade: 'questao', id: 'q' }])
  })
  it('sem elegibilidade não seleciona método e não gera demanda', () => {
    const args = input(); args.elegibilidade.elegivel = false
    const result = selectMentorReviewMethod(args)
    expect(result.metodo).toBeNull()
    expect(result.cria_demanda).toBe(false)
  })
  it('recusa slot duplicado/100 minutos e policy sem versão', () => {
    const args = input()
    expect(() => selectMentorReviewMethod({ ...args, slots: [args.slots[0], args.slots[0]] })).toThrow('duplicado')
    expect(() => selectMentorReviewMethod({ ...args, slots: [{ ...args.slots[0], duracao_minutos: 100 }] })).toThrow('inválido')
    expect(() => selectMentorReviewMethod({ ...args, policy_ref: { id: 'mentor' } })).toThrow('inválidas')
  })
  it('escolha é determinística, motivo estruturado e inputs intactos', () => {
    const args = input(), before = structuredClone(args)
    expect(selectMentorReviewMethod(args)).toEqual(selectMentorReviewMethod(args))
    expect(args).toEqual(before)
  })
})
