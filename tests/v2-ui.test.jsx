import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Layout from '../src/components/Layout.jsx'
import FocusTimer from '../src/components/FocusTimer.jsx'

const read = (path) => readFileSync(path, 'utf8')
describe('UX V2', () => {
  it('renderiza shell com controle recolhivel e navegacao mobile sem submenu antigo', () => {
    const html = renderToStaticMarkup(<Layout area="semana" catalog={[]}><h1>Plano</h1></Layout>)
    expect(html).toContain('Recolher sidebar')
    expect(html).toContain('Navegação mobile')
    expect(html).toContain('aria-current="page"')
    expect(html).not.toContain('Objetivas')
  })
  it('timer abre parado e oferece presets e personalizado em minutos', () => {
    const html = renderToStaticMarkup(<FocusTimer suggestedMinutes={50}/>)
    expect(html).toContain('30 min')
    expect(html).toContain('50 min')
    expect(html).toContain('Personalizado')
    expect(html).toContain('Iniciar foco')
    expect(html).not.toContain('Pausar')
  })
  it('plano permanece inicial e alvo transmite sessaoId sem concluir demanda', () => {
    expect(read('src/App.jsx')).toContain("useState('semana')")
    expect(read('src/components/StudyTime.jsx')).toContain('sessaoId={demand?.id}')
    expect(read('src/components/StudyTime.jsx')).toContain("contexto={demand ? 'demanda'")
    expect(read('src/components/FocusTimer.jsx')).not.toContain('/api/sessoes')
  })
  it('confiança e cards preservam valores canônicos na ordem 1-4', () => {
    const questions = read('src/components/Questions.jsx')
    expect(questions.indexOf("['sem_conhecimento'")).toBeLessThan(questions.indexOf("['eliminacao'"))
    expect(questions.indexOf("['eliminacao'")).toBeLessThan(questions.indexOf("['duvida'"))
    expect(questions.indexOf("['duvida'")).toBeLessThan(questions.indexOf("['certeza'"))
    const cards = read('src/components/QuestionCards.jsx')
    expect(cards).toContain("['novamente', 'Novamente'")
    expect(cards).toContain("window.addEventListener('keydown'")
    expect(cards).not.toMatch(/'10 min'|'intervalo longo'/)
  })
  it('não apresenta mascote e não inventa domínio real por confiança', () => {
    expect(read('src/components/MentorWidget.jsx')).not.toContain('<img src={avatar}')
    expect(read('src/components/Performance.jsx')).not.toContain('label="Domínio real"')
  })
  it('comentários após resposta não são suprimidos por confiança', () => {
    const handler = read('api/_lib/pratica-handler.js')
    expect(handler).toContain('comentarios_alternativas: question.comentarios_alternativas')
    expect(read('src/components/Questions.jsx')).toContain('{result.explicacao ?')
  })
  it('modal permite ordenação sem depender de drag e preserva escape e foco', () => {
    const week = read('src/components/Week.jsx')
    expect(week).toContain('Mover acima')
    expect(week).toContain('Mover abaixo')
    expect(week).toContain("event.key === 'Escape'")
    expect(week).toContain('previousFocus?.focus()')
  })
  it('responsividade não esconde sidebar desktop nem labels mobile quando recolhida', () => {
    const theme = read('src/product-theme.css')
    expect(theme).toContain('.sidebar{display:flex;')
    expect(theme).toContain('.sidebar-collapsed .sidebar nav button span')
    expect(theme).not.toContain('.sidebar-collapsed nav button span')
    expect(theme).toContain('grid-template-columns:repeat(7,minmax(0,1fr))')
  })
})
