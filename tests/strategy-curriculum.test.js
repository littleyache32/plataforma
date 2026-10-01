import { describe, expect, it } from 'vitest'
import { STRATEGY_COURSE_SUBJECT, courseSubjectForStrategyDocument, subjectForStrategyDocument } from '../scripts/strategy-source-map.js'

describe('currículo do Estratégia', () => {
  it('representa os onze conjuntos atuais sem usar sua quantidade como constante do produto', () => {
    expect(Object.keys(STRATEGY_COURSE_SUBJECT)).toHaveLength(11)
    expect(courseSubjectForStrategyDocument('pdf-files_build_ldi_documents_zip_8a3ddcb7/aula.pdf')).toBe('Gestão de Pessoas')
    expect(courseSubjectForStrategyDocument('outro-pacote/aula.pdf')).toBeNull()
  })
  it('preserva o conjunto original mesmo quando o catálogo histórico divide uma aula', () => {
    const file = 'pdf-files_build_ldi_documents_zip_8a3ddcb7/1. Modelos Teóricos de Administração Pública.pdf'
    expect(courseSubjectForStrategyDocument(file)).toBe('Gestão de Pessoas')
    expect(subjectForStrategyDocument(file)).toBe('Administração Pública')
  })
})
