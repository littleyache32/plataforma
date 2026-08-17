import { describe, expect, it } from 'vitest'
import { buildQuestionCard, cardKey, cardTransition, shouldCreateQuestionCard } from '../shared/cards.js'

describe('Question Cards', () => {
  it('agenda uma revisao curta quando o card precisa ser revisto', () => {
    expect(cardTransition({ resultado: 'novamente', repeticoes: 4, now: 0 })).toMatchObject({ repeticoes: 0, lapsos: 1, proximaRevisao: new Date(600_000).toISOString() })
  })

  it('aumenta o espacamento quando o conceito foi lembrado', () => {
    expect(cardTransition({ resultado: 'bom', repeticoes: 1, intervaloDias: 1, now: 0 })).toMatchObject({ repeticoes: 2, intervaloDias: 3, proximaRevisao: new Date(3 * 86_400_000).toISOString() })
  })

  it('antecipa cards dificeis e amplia cards faceis', () => {
    expect(cardTransition({ resultado: 'dificil', repeticoes: 2, intervaloDias: 5, now: 0 })).toMatchObject({ intervaloDias: 6, fatorFacilidade: 2.35 })
    expect(cardTransition({ resultado: 'facil', repeticoes: 2, intervaloDias: 5, now: 0 })).toMatchObject({ intervaloDias: 16, fatorFacilidade: 2.65 })
  })

  it('gera a mesma chave para espacos equivalentes do mesmo topico', () => {
    expect(cardKey({ topicoId: 't1', explicacao: 'Regra   aplicavel' })).toBe(cardKey({ topicoId: 't1', explicacao: 'regra aplicavel' }))
  })

  it('cria card corretivo somente quando a resposta revela lacuna', () => {
    expect(shouldCreateQuestionCard({ resultado: 'erro', classificacao: 'certeza' })).toBe(true)
    expect(shouldCreateQuestionCard({ resultado: 'acerto', classificacao: 'duvida' })).toBe(true)
    expect(shouldCreateQuestionCard({ resultado: 'acerto', classificacao: 'sem_conhecimento' })).toBe(true)
    expect(shouldCreateQuestionCard({ resultado: 'acerto', classificacao: 'certeza' })).toBe(false)
    expect(shouldCreateQuestionCard({ resultado: 'acerto', classificacao: 'eliminacao' })).toBe(false)
  })

  it('monta card atomico com resposta direta e explicacao curta', () => {
    const card = buildQuestionCard({
      topicName: 'Administração de estoques',
      question: {
        tipo: 'CE',
        gabarito: 'E',
        enunciado: 'O estoque de segurança elimina toda possibilidade de ruptura.',
        explicacao: 'O item está errado. O estoque de segurança reduz o risco de ruptura, mas não o elimina. Uma terceira frase não deve entrar.',
      },
    })
    expect(card.frente).toContain('[Administração de estoques]')
    expect(card.respostaDireta).toBe('Errado. O item está errado.')
    expect(card.explicacaoCurta).toContain('reduz o risco')
    expect(card.tipoCard).toBe('correcao')
  })
})
