import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import DemandIdentity, { ActivityLabel, ContextLabel, subjectAccent } from '../src/components/StudyIdentity.jsx'

describe('Identidade visual funcional', () => {
  it('mantém marcador estável pelo ID, independente do material e nome exibido', () => {
    expect(subjectAccent({ id: 'materia-a', nome: 'Direito' }, 'PDF 1')).toBe(subjectAccent({ id: 'materia-a', nome: 'Direito' }, 'PDF 2'))
    expect(subjectAccent(null, 'Português')).toBe(subjectAccent(null, '  PORTUGUÊS  '))
  })
  it('contextos usam texto e formas, não apenas cor', () => {
    for (const [type, label] of [['concurso', 'BACEN'], ['faculdade', 'Faculdade']]) {
      const html = renderToStaticMarkup(<ContextLabel type={type}/>)
      expect(html).toContain(label)
      expect(html).toContain(`context-identity ${type}`)
      expect(html).toContain('aria-hidden="true"')
    }
  })
  it('atividades têm ícone decorativo e rótulo explícito, sem confundir Especial com cards', () => {
    for (const [type, label] of [['estudo', 'Estudo'], ['revisao', 'Revisão'], ['exercicio', 'Exercício'], ['cards', 'Question Cards'], ['especial', 'Especial'], ['simulado', 'Simulado']]) {
      const html = renderToStaticMarkup(<ActivityLabel type={type}/>)
      expect(html).toContain(label)
      expect(html).toContain('<svg')
    }
  })
  it('identidade da demanda preserva a ordem matéria, contexto e atividade', () => {
    const html = renderToStaticMarkup(<DemandIdentity item={{ materia: { id: 'm1', nome: 'Direito' }, objetivo: { tipo: 'faculdade' }, tipo: 'revisao' }}/>)
    expect(html.indexOf('Direito')).toBeLessThan(html.indexOf('Faculdade'))
    expect(html.indexOf('Faculdade')).toBeLessThan(html.indexOf('Revisão'))
  })
})
