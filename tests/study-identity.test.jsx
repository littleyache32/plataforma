import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import DemandIdentity, { ActivityLabel, ContextLabel, subjectAccent, demandContent, demandSubject } from '../src/components/StudyIdentity.jsx'

describe('Identidade visual funcional', () => {
  it('aula acadêmica regular exibe disciplina e ação sem depender de PDF', () => {
    const item = { objetivo: { tipo: 'faculdade' }, materia: { id: 'f1', nome: 'Teoria do Crime' }, tipo: 'estudo', reason_codes: ['ACADEMIC_CLASS_SAME_DAY'], titulo: 'uuid-de-pdf', material: { disciplina_curso: 'Arquivo legado' } }
    expect(demandContent(item)).toBe('Aula dada, aula estudada')
    expect(demandContent({ ...item, material: undefined })).toBe('Aula dada, aula estudada')
    expect(demandSubject(item)).toBe('Teoria do Crime')
    const html = renderToStaticMarkup(<DemandIdentity item={item}/> )
    expect(html).toContain('Teoria do Crime')
    expect(html).not.toContain('Arquivo legado')
    expect(item.titulo).toBe('uuid-de-pdf')
  })
  it('reconhece aula pelo tipo ou título e preserva revisões, provas e concurso', () => {
    const item = { objetivo: { tipo: 'faculdade' }, tipo: 'aula', titulo: 'PDF' }
    expect(demandContent(item)).toBe('Aula dada, aula estudada')
    expect(demandContent({ ...item, tipo: 'estudo', titulo: 'Teoria do Crime · Aula dada, aula estudada' })).toBe('Aula dada, aula estudada')
    for (const tipo of ['revisao', 'prova']) expect(demandContent({ ...item, tipo, titulo: 'Preparação pontual' })).toBe('Preparação pontual')
    expect(demandContent({ ...item, objetivo: { tipo: 'concurso' } })).toBe('PDF')
  })
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
