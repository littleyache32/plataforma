import { describe, expect, it } from 'vitest'
import { buildTopicItems, extractLearningUnits } from '../shared/offline-content.js'

const material = Array.from({ length: 40 }, (_, index) => `- O conceito ${index + 1} representa uma regra própria e exige a observância do requisito específico ${index + 1} para produzir seus efeitos jurídicos.`).join('\n')

describe('geração local do acervo', () => {
  it('extrai unidades distintas e rastreáveis', () => {
    const units = extractLearningUnits(`# Tema\n${material}`)
    expect(units).toHaveLength(40)
    expect(units.every((item) => item.evidence.length >= 40)).toBe(true)
  })

  it('completa metas sem Gemini e aprova os itens', () => {
    const result = buildTopicItems({
      topic: { id: 'topico', name: 'Tema', subjectId: 'materia', subject: 'Disciplina', objectiveId: 'objetivo' },
      knowledge: { text: material, source: 'Apostila completa da disciplina' },
      existingQuestions: Array.from({ length: 20 }, (_, index) => ({ enunciado: `Questão existente ${index}` })),
      existingCards: Array.from({ length: 20 }, (_, index) => ({ frente: `Card existente ${index}` })),
    })
    expect(result.questions).toHaveLength(10)
    expect(result.cards).toHaveLength(30)
    expect(result.questions.every((item) => item.audit.approved)).toBe(true)
    expect(result.cards.every((item) => item.audit.approved)).toBe(true)
    expect(result.questions.some((item) => item.gabarito === 'E' && /não (?:é|representa|exige)/i.test(item.enunciado))).toBe(true)
    expect(result.questions.every((item) => !/\b(?:é|representa|exige) não\b/i.test(item.enunciado))).toBe(true)
  })
})
