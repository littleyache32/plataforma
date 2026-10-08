import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomeSummary } from '../src/components/Home.jsx'
import { MentorOverview } from '../src/components/MentorWidget.jsx'
import { summarizeHome } from '../src/home-summary.js'

describe('Ajustes finos UI V2', () => {
  it('separa métricas e seções mantendo registros factuais da Home', () => {
    const summary = summarizeHome([{ status: 'concluido', iniciado_em: '2026-10-07T09:00:00-03:00', segundos: 3000, materia: { nome: 'Direito Administrativo' } }], [], '2026-10-07')
    const html = renderToStaticMarkup(<HomeSummary summary={summary} onNavigate={() => {}} />)
    expect(html.match(/class="panel home-metric"/g)).toHaveLength(4)
    expect(html.match(/class="panel home-panel"/g)).toHaveLength(3)
    expect(html).toContain('<strong>0h50min</strong>')
    for (const title of ['ESTUDO DE HOJE', 'ESTA SEMANA', 'DEMANDAS DE HOJE', 'PLANO SEMANAL', 'Estudo da semana', 'Próximas demandas', 'Tempo registrado por disciplina']) expect(html).toContain(title)
    expect(html).toContain('Direito Administrativo')
  })
  it('Mentor ausente não fabrica domínio nem direção', () => {
    const html = renderToStaticMarkup(<MentorOverview mentor={{}} />)
    expect(html).toContain('Evidência ainda insuficiente')
    expect(html).toContain('quando houver uma decisão registrada')
    expect(html).not.toContain('<form')
  })
  it('Mentor mostra direção e sinais existentes sem questionário', () => {
    const html = renderToStaticMarkup(<MentorOverview mentor={{ avaliacao_mentor_v2: { explicacao: 'Continuidade curricular.' }, alertas: [{ titulo: 'Material em andamento', mensagem: 'Preservar continuidade.' }] }} />)
    expect(html).toContain('Continuidade curricular.')
    expect(html).toContain('Material em andamento')
    expect(html).not.toMatch(/encontro|<input|<select|<textarea/)
  })
  it('Mentor exibe carga e execução da avaliação V2, sem uma fonte paralela', () => {
    const html = renderToStaticMarkup(<MentorOverview mentor={{ avaliacao_mentor_v2: { carga_semanal: { carga_observada: { demandas: 21, minutos: 1050 }, sinais: { execucao: { demandas_concluidas: 5 } } } } }} />)
    expect(html).toContain('21 demandas · 1050 min')
    expect(html).toContain('5 demandas concluídas')
    expect(html).toContain('Evidência ainda insuficiente')
  })
})
