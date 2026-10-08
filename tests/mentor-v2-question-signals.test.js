import { describe, expect, it } from 'vitest'
import { assessQuestionCorrectionSignal } from '../shared/mentor-v2-question-signals.js'
import { questionReviewEvidence, cardReviewEvidence } from '../shared/review-v2-evidence.js'
import { orderReviewQueue } from '../shared/review-v2-queue.js'
import { selectQuestionRetest } from '../shared/mentor-v2-question-retest.js'
import { selectMentorReviewMethod } from '../shared/mentor-v2-review-method.js'

const corte = '2026-10-07T15:00:00Z'
const policy_ref = { id: 'mentor', versao: 'test/4.7' }
function input(resultado, classificacao, id = 'q') {
  return { policy_ref, evidencia: questionReviewEvidence({ corte,
    registro: { id: `r-${id}`, questao_id: id, resultado, classificacao, criado_em: corte },
    questao: { id, topico_id: 'topic' } }) }
}
const run = (outcome, confidence) => assessQuestionCorrectionSignal(input(outcome, confidence))
function queueItem(args) {
  return { fonte: { tipo: 'RETESTE_QUESTAO', entidade: 'revisao_item', id: `need-${args.evidencia.alvo.id}`,
    alvo: args.evidencia.alvo }, evidencia: args.evidencia,
    elegibilidade: assessQuestionCorrectionSignal(args).elegibilidade, agendada_para: corte }
}

describe('Fase 4.7, sinais fortes locais e limite de decisões amplas', () => {
  it.each([
    ['erro', 'certeza', 'FALSA_CERTEZA', 'CORRETIVA_FORTE', true],
    ['erro', 'sem_conhecimento', 'PROVAVEL_LACUNA_BASE', 'CORRETIVA', true],
    ['acerto', 'duvida', 'CONHECIMENTO_INSTAVEL', 'POSITIVA_INSTAVEL', false],
    ['acerto', 'eliminacao', 'CONHECIMENTO_INSTAVEL', 'POSITIVA_INSTAVEL', false],
    ['acerto', 'certeza', 'EVIDENCIA_POSITIVA_FORTE', 'POSITIVA_MAIS_FORTE', false],
    ['acerto', 'sem_conhecimento', 'ACERTO_FRACO_POSSIVEL_ACASO', 'POSITIVA_FRACA', false],
    ['erro', 'duvida', 'ERRO_COM_INCERTEZA', 'OBSERVACIONAL', false],
    ['erro', 'eliminacao', 'ERRO_COM_INCERTEZA', 'OBSERVACIONAL', false],
  ])('%s + %s produz %s sem extrapolar', (outcome, confidence, signal, strength, eligible) => {
    const result = run(outcome, confidence)
    expect(result).toMatchObject({ sinal: signal, forca: strength, autoriza_decisao_ampla: false,
      requer_amostra_para_decisao_ampla: true, altera_prioridade_materia: false, altera_carga: false,
      infere_dominio: false, autoriza_retorno_teoria: false, cria_demanda: false })
    expect(result.elegibilidade.elegivel).toBe(eligible)
  })
  it('falsa certeza qualifica correção local, não fraqueza da matéria', () => {
    const result = run('erro', 'certeza')
    expect(result.prioridade_local).toBe('CORRETIVA_FORTE')
    expect(result.qualificacoes[0].criterio).toBe('FALSA_CERTEZA')
    expect(result.elegibilidade.reason_codes).toContain('REVIEW_FALSE_CERTAINTY')
  })
  it('erro sem conhecimento indica possibilidade, não prova de lacuna conceitual', () => {
    const result = run('erro', 'sem_conhecimento')
    expect(result.confirma_lacuna_base).toBe(false)
    expect(result.elegibilidade.reason_codes).toContain('REVIEW_KNOWLEDGE_GAP')
    expect(result.reason_codes).toContain('QUESTION_THEORY_REQUIRES_CONFIRMED_GAP')
  })
  it('acerto sem conhecimento não vira falta de conhecimento confirmada ou domínio', () => {
    const result = run('acerto', 'sem_conhecimento')
    expect(result.qualificacoes).toEqual([])
    expect(result.elegibilidade.reason_codes).not.toContain('REVIEW_KNOWLEDGE_GAP')
    expect(result.forca).toBe('POSITIVA_FRACA')
  })
  it.each([[null, 'certeza'], ['erro', null], [null, null]])('ausência %s/%s permanece UNKNOWN', (outcome, confidence) => {
    expect(run(outcome, confidence)).toMatchObject({ sinal: 'UNKNOWN', qualificacoes: [], prioridade_local: null })
  })
  it('sem conceito comprovado mantém escopo na questão, não estende ao tópico/matéria', () => {
    expect(run('erro', 'certeza').escopo).toEqual({ tipo: 'QUESTAO', id: 'q' })
  })
  it('vínculo canônico qualificado delimita conceito específico', () => {
    const args = input('erro', 'certeza')
    args.conceito = { id: 'concept', questao_id: 'q', confirmada: true,
      regra_ref: { id: 'mapping', versao: '1' }, fontes: [{ entidade: 'questao', id: 'q' }] }
    expect(assessQuestionCorrectionSignal(args).escopo).toEqual({ tipo: 'CONCEITO', id: 'concept', questao_origem_id: 'q' })
    args.conceito.questao_id = 'other'
    expect(() => assessQuestionCorrectionSignal(args)).toThrow('Vínculo')
  })
  it('não usa erro-alvo antigo para qualificar tentativa atual', () => {
    const args = input('acerto', 'certeza')
    args.evidencia.fontes.push({ entidade: 'registro', id: 'old-error' })
    args.evidencia.observacoes.erro_alvo = { entidade: 'registro', id: 'old-error', questao_id: 'q' }
    expect(assessQuestionCorrectionSignal(args).qualificacoes).toEqual([])
  })
  it('integra elegibilidade e prioridade relativa da Central sem inventar datas/carga', () => {
    const falseCertainty = queueItem(input('erro', 'certeza', 'z'))
    const gap = queueItem(input('erro', 'sem_conhecimento', 'a'))
    const queue = orderReviewQueue({ itens: [gap, falseCertainty], corte })
    expect(queue.itens.map((item) => item.fonte.alvo.id)).toEqual(['z', 'a'])
    expect(queue.itens[0].agendada_para).toBe(corte)
  })
  it('correção forte ainda respeita cobertura prioritária pelo Plano', () => {
    const item = queueItem(input('erro', 'certeza'))
    const result = orderReviewQueue({ itens: [item], corte, demandas: [{ id: 's', status: 'planejada', data: '2026-10-07',
      prioritaria: true, cobertura_adequada: true, regra_ref: { id: 'coverage', versao: '1' },
      revisao_ref: { versao: 'revisao-v2/1', sessao_id: 's', decisao_id: 'd', fontes: [item.fonte] } }] })
    expect(result.itens).toEqual([]); expect(result.cobertos_no_plano).toHaveLength(1)
  })
  it('sinal corretivo alimenta reteste de alternativa equivalente, não repetição obrigatória', () => {
    const args = input('erro', 'certeza'), signal = assessQuestionCorrectionSignal(args)
    const fontes = [...args.evidencia.fontes, { entidade: 'questao', id: 'alternative' }]
    const result = selectQuestionRetest({ evidencia: args.evidencia, elegibilidade: signal.elegibilidade,
      conceito_id: 'concept', policy_ref, fontes, historico: [], questoes: [
        { id: 'q', ativo: true, elegivel: true },
        { id: 'alternative', conceito_id: 'concept', ativo: true, elegivel: true,
          equivalencia: { confirmada: true, conceito_id: 'concept', questao_original_id: 'q',
            regra_ref: { id: 'mapping', versao: '1' }, fontes: fontes.filter((row) => row.entidade === 'questao') } },
      ] })
    expect(result.questao_id).toBe('alternative'); expect(result.infere_dominio).toBe(false)
  })
  it('provável lacuna alimenta questões, sem transformar sinal em retorno à teoria', () => {
    const args = input('erro', 'sem_conhecimento'), signal = assessQuestionCorrectionSignal(args)
    const method = selectMentorReviewMethod({ elegibilidade: signal.elegibilidade, policy_ref,
      fontes: args.evidencia.fontes, modalidades: ['QUESTOES', 'ESTUDO'],
      slots: [{ id: 'slot', atividade: 'QUESTOES', duracao_minutos: 50 }, { id: 'theory', atividade: 'ESTUDO', duracao_minutos: 50 }],
      recursos: { questoes: [{ id: 'q', ativo: true, elegivel: true }] } })
    expect(method.metodo).toBe('QUESTAO_INDIVIDUAL')
    expect(method.reason_codes).not.toContain('REVIEW_CONCEPTUAL_GAP_CONFIRMED')
  })
  it('contradições e contratos de card não são sinais de questão', () => {
    const args = input('erro', 'certeza'); args.evidencia.observacoes.falsa_certeza = false
    expect(() => assessQuestionCorrectionSignal(args)).toThrow('contradiz')
    args.evidencia = cardReviewEvidence({ card: { id: 'c' }, corte })
    expect(() => assessQuestionCorrectionSignal(args)).toThrow('inválida')
  })
  it('mesmos fatos geram mesmos sinais e nunca modificam origem ou amostra', () => {
    const args = input('erro', 'certeza'), copy = structuredClone(args)
    expect(assessQuestionCorrectionSignal(args)).toEqual(assessQuestionCorrectionSignal(copy))
    expect(args).toEqual(copy)
  })
})
