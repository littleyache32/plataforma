import { describe, expect, it } from 'vitest'
import { allowedStudiedTopics, canAccessBacenItem, isBacenPracticeOpen } from '../shared/study-access.js'

describe('liberação progressiva da prática BACEN', () => {
  it('mantém questões e cards bloqueados durante a construção de base', () => {
    expect(isBacenPracticeOpen('2026-08-30')).toBe(false)
    expect(canAccessBacenItem({ today: '2026-08-30', topicId: 'a', completedTopicIds: ['a'] })).toBe(false)
  })

  it('libera somente tópicos com estudo concluído a partir da terceira semana', () => {
    expect(allowedStudiedTopics(['a', 'b', 'c'], ['b', 'c', 'x'])).toEqual(['b', 'c'])
    expect(canAccessBacenItem({ today: '2026-08-31', topicId: 'b', completedTopicIds: ['b'] })).toBe(true)
    expect(canAccessBacenItem({ today: '2026-08-31', topicId: 'a', completedTopicIds: ['b'] })).toBe(false)
  })

  it('preserva a revisão de item já respondido depois da fase inicial', () => {
    expect(canAccessBacenItem({ today: '2026-09-01', topicId: 'a', completedTopicIds: [], previouslyAttempted: true })).toBe(true)
  })
})
