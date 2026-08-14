import { describe, expect, it } from 'vitest'
import { allocateDisciplineQuestions } from '../shared/question-distribution.js'

const topics = [
  { id: 'baixo', nome: 'Baixo', incidencia: 0.1 },
  { id: 'alto', nome: 'Alto', incidencia: 0.8 },
  { id: 'medio', nome: 'Medio', incidencia: 0.4 },
]

describe('allocateDisciplineQuestions', () => {
  it('distribui o lote inteiro entre os topicos da disciplina', () => {
    const result = allocateDisciplineQuestions({ topics, total: 20 })
    expect(result.reduce((sum, item) => sum + item.quantidade, 0)).toBe(20)
    expect(result.find((item) => item.id === 'alto').quantidade).toBeGreaterThan(result.find((item) => item.id === 'baixo').quantidade)
  })

  it('compensa topico com estoque menor sem criar quantidade extra', () => {
    const result = allocateDisciplineQuestions({ topics, total: 6, currentCounts: { baixo: 0, medio: 50, alto: 100 } })
    expect(result.reduce((sum, item) => sum + item.quantidade, 0)).toBe(6)
    expect(result.find((item) => item.id === 'baixo')?.quantidade).toBe(6)
  })

  it('e deterministico para a mesma entrada', () => {
    expect(allocateDisciplineQuestions({ topics, total: 12 })).toEqual(allocateDisciplineQuestions({ topics, total: 12 }))
  })
})
