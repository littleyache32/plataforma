import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import DemandReason, { loadDemandReason } from '../src/components/DemandReason.jsx'

describe('motivo discreto da demanda', () => {
  it('renderiza uma frase acessível sem controles ou painel técnico', () => {
    const html = renderToStaticMarkup(<DemandReason text="Continuidade curricular da disciplina."/>)
    expect(html).toContain('role="status"')
    expect(html).toContain('Continuidade curricular da disciplina.')
    expect(html).not.toMatch(/button|policy|reason_codes|inputs|details/)
    expect(renderToStaticMarkup(<DemandReason text=""/>)).toBe('')
  })
  it('consulta somente resumo, sem flag de auditoria', async () => {
    const request = vi.fn(async () => ({ estado: 'RASTREAVEL', explicacao: 'Continuidade curricular da disciplina.', inputs_relevantes: ['internal'] }))
    expect(await loadDemandReason('id', request)).toBe('Continuidade curricular da disciplina.')
    expect(request).toHaveBeenCalledWith('/api/mentor?recurso=demanda&id=id')
  })
  it('falha não expõe erro técnico nem bloqueia ações da demanda', async () => {
    const request = async () => { throw new Error('internal DB/policy failure') }
    expect(await loadDemandReason('id', request)).toBe('Não foi possível consultar o motivo.')
  })
  it('ignora resposta sem explicação ou texto excessivo', async () => {
    expect(await loadDemandReason('id', async () => ({ reason_codes: ['TECHNICAL'] }))).toBe('')
    expect(await loadDemandReason('id', async () => ({ explicacao: 'x'.repeat(200) }))).toBe('')
  })
  it('Week carrega sob demanda e protege fechamento/troca da modal contra resposta tardia', () => {
    const week = readFileSync('src/components/Week.jsx', 'utf8')
    expect(week).toContain('if (id) loadDemandReason(id)')
    expect(week).toContain('if (!cancelled) setReason({ id, text })')
    expect(week).toContain('cancelled = true')
    expect(week).toContain("reason?.id === selected.id ? reason.text : ''")
    expect(week).not.toContain('auditoria=1')
  })
})
