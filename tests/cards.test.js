import { describe, expect, it } from 'vitest'
import { cardKey, cardTransition } from '../shared/cards.js'

describe('Question Cards', () => {
  it('agenda uma revisao curta quando o card precisa ser revisto', () => {
    expect(cardTransition({ resultado: 'revisar', repeticoes: 4, now: 0 })).toMatchObject({ repeticoes: 0, proximaRevisao: new Date(86_400_000).toISOString() })
  })

  it('aumenta o espacamento quando o conceito foi lembrado', () => {
    expect(cardTransition({ resultado: 'lembrei', repeticoes: 1, now: 0 })).toMatchObject({ repeticoes: 2, proximaRevisao: new Date(7 * 86_400_000).toISOString() })
  })

  it('gera a mesma chave para espacos equivalentes do mesmo topico', () => {
    expect(cardKey({ topicoId: 't1', explicacao: 'Regra   aplicavel' })).toBe(cardKey({ topicoId: 't1', explicacao: 'regra aplicavel' }))
  })
})
