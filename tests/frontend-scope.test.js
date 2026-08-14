import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('experiencia pessoal sem modo administrador', () => {
  it('nao oferece alternancia nem modulos administrativos no frontend', () => {
    const app = readFileSync('src/App.jsx', 'utf8')
    const layout = readFileSync('src/components/Layout.jsx', 'utf8')
    expect(`${app}\n${layout}`).not.toMatch(/Modo Administrador|Administrador|adminAreas|onModeChange/)
    expect(app).not.toMatch(/AdminPanel|EdictComparator|Objectives|Materials|Deadlines/)
  })

  it('nao mostra timer ao abrir uma demanda da semana', () => {
    const week = readFileSync('src/components/Week.jsx', 'utf8')
    expect(week).not.toMatch(/FocusTimer/)
  })
})
