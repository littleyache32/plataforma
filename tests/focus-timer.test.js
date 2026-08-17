import { describe, expect, it } from 'vitest'
import { timerDisplay } from '../src/components/FocusTimer.jsx'

describe('Timer de foco', () => {
  it('faz contagem progressiva quando a duracao esta zerada', () => {
    expect(timerDisplay(62, 0)).toBe('00:01:02')
  })

  it('faz contagem regressiva ate o alvo', () => {
    expect(timerDisplay(30, 60)).toBe('00:00:30')
    expect(timerDisplay(60, 60)).toBe('00:00:00')
  })

  it('mostra o excedente com sinal positivo sem parar o timer', () => {
    expect(timerDisplay(61, 60)).toBe('+00:00:01')
    expect(timerDisplay(125, 60)).toBe('+00:01:05')
  })
})
