import { describe, expect, it } from 'vitest'
import { prepareMentorWeek } from '../api/_lib/plano-handler.js'
import { reconcileMeetingFacts } from '../api/_lib/mentor-v2-meeting.js'
import { readMentorDemandTrace } from '../api/_lib/mentor-v2-trace.js'
import { meetingDatabase } from './helpers/mentor-meeting-db.js'

const week = '2030-03-04'
function fixture() {
  const db = meetingDatabase()
  db.tables.conhecimento_modulo[0].conteudo.politica.regras.push({ id: 'TRATAMENTO_PENDENCIAS_SEMANAIS', habilitada: true })
  db.tables.materia.push({ id: 'c', objetivo_id: 'contest' })
  db.tables.material.push({ id: 'pdf-c', objetivo_id: 'contest', materia_id: 'c', status: 'aceito', ordem_curso: 1, estado_extracao: 'texto' })
  db.tables.mentor_contexto[0].dados.capacidade_inicial.slots = Array.from({ length: 7 }, (_, dia) => ['contest', 'faculty'].map((objetivo_id) => ({ dia, objetivo_id, atividade: 'ESTUDO', duracao_minutos: 50 }))).flat()
  return db
}
const context = (db) => db.tables.mentor_contexto[0].dados
async function meeting(db, body = {}) {
  const fatos = await reconcileMeetingFacts({ supabase: db, body, week: '2030-02-25', nextWeek: week, today: '2030-03-03', now: '2030-03-03T15:00:00Z' })
  db.tables.mentor_encontro_semanal.push({ semana_inicio: '2030-02-25', fatos })
}
async function run(db) {
  const result = await prepareMentorWeek({ supabase: db, inicio: week, today: week, instanteReferencia: `${week}T15:00:00Z` })
  const evaluation = result.body.avaliacao_mentor_v2
  const rows = db.tables.sessao.filter((row) => row.data_planejada_original >= week)
  for (const row of rows) {
    const trace = await readMentorDemandTrace({ supabase: db, id: row.id, audit: true })
    expect(trace.estado).toBe('RASTREAVEL')
    expect(trace.reason_codes.length).toBeGreaterThan(0)
    expect(trace.inputs_relevantes.length).toBeGreaterThan(0)
    expect(row.duracao_estimada).toBe(50)
  }
  expect(evaluation.dominio).toBe('UNKNOWN')
  expect(db.tables.material_progresso).toEqual([])
  expect(evaluation.plano_semanal?.disponibilidade?.divida_minutos ?? 0).toBe(0)
  return { result, evaluation, rows }
}
const old = (id = 'old') => ({ id, objetivo_id: 'contest', materia_id: 'c', material_id: 'pdf-c', tipo: 'estudo', status: 'nao_concluida', data: '2030-02-25', data_planejada_original: '2030-02-25', duracao_estimada: 50, origem: 'mentor' })

describe('Fase 3.16, pipeline real V2 com persistência sintética isolada', () => {
  it('1 semana normal aplica demandas auditáveis e reaplicar não duplica', async () => {
    const db = fixture(), first = await run(db)
    expect(first.result.status).toBe(200)
    expect(first.rows).toHaveLength(14)
    const snapshot = structuredClone(db.tables.sessao)
    await run(db)
    expect(db.tables.sessao).toEqual(snapshot)
  })
  it('2 indisponibilidade factual impede demanda no dia, sem compensação', async () => {
    const db = fixture(); await meeting(db, { fatos: { indisponivel_em: ['2030-03-05'] } })
    const { rows, evaluation } = await run(db)
    expect(rows).toHaveLength(12)
    expect(rows.every((row) => row.data !== '2030-03-05')).toBe(true)
    expect(evaluation.reason_codes).toContain('AVAILABILITY_CONSTRAINT')
  })
  it('3 prova do encontro chega à prioridade e origem da demanda', async () => {
    const db = fixture(); await meeting(db, { fatos: { avaliacoes: [{ tipo: 'prova', titulo: 'Prova sintética', materia_id: 'b', data: '2030-03-07' }] } })
    const { rows, evaluation } = await run(db)
    expect(rows.find((row) => row.objetivo_id === 'faculty').materia_id).toBe('b')
    expect(evaluation.reason_codes).toContain('CONFIRMED_DEADLINE')
    expect(JSON.stringify(evaluation.evidencias_utilizadas)).toContain(db.tables.compromisso[0].id)
  })
  it('4 compromisso novo bloqueante altera disponibilidade sem duplicar agenda', async () => {
    const db = fixture(), body = { fatos: { avaliacoes: [{ tipo: 'entrega', titulo: 'Entrega sintética', materia_id: 'b', data: week, bloqueante: true }] } }
    await meeting(db, body); await meeting(db, body)
    expect(db.tables.compromisso).toHaveLength(1)
    expect((await run(db)).rows.every((row) => row.data !== week)).toBe(true)
  })
  it('5 capacidade maior que disponibilidade limita a materialização', async () => {
    const db = fixture(); context(db).disponibilidade.dias = [{ data: week, minutos: 70 }]
    const { rows, evaluation } = await run(db)
    expect(rows).toHaveLength(1)
    expect(evaluation.carga_semanal.carga_proposta.minutos).toBe(50)
  })
  it('6 falta anterior mantém história e produz continuidade com nova origem', async () => {
    const db = fixture(), original = old(); db.tables.sessao.push(structuredClone(original))
    const { evaluation, rows } = await run(db)
    expect(db.tables.sessao[0]).toEqual(original)
    expect(rows).toHaveLength(14)
    expect(evaluation.decisoes.some((row) => row.parametros.acao)).toBe(true)
    expect(evaluation.pendencias.divida_minutos).toBe(0)
  })
  it('7 várias pendências não adicionam carga nem duplicam demandas', async () => {
    const db = fixture(); db.tables.sessao = Array.from({ length: 20 }, (_, i) => old(`old-${i}`))
    const history = structuredClone(db.tables.sessao), { rows, evaluation } = await run(db)
    expect(rows).toHaveLength(14)
    expect(db.tables.sessao.slice(0, 20)).toEqual(history)
    expect(evaluation.decisoes.filter((row) => row.parametros.acao)).toHaveLength(20)
    expect(new Set(rows.map((row) => row.id)).size).toBe(14)
  })
  it('8 histórico insuficiente não significa desempenho ruim ou aumento', async () => {
    const { evaluation } = await run(fixture())
    expect(evaluation.fallback.aumentar_carga).toBe(false)
    expect(evaluation.carga_semanal.acao).toBe('MATERIALIZAR_CAPACIDADE_CONFIGURADA')
    expect(evaluation.carga_semanal.carga_proposta.minutos).toBe(700)
    expect(evaluation.decisoes.some((row) => ['AUMENTAR_CARGA', 'REDUZIR_CARGA'].includes(row.tipo_decisao))).toBe(false)
    expect(evaluation.reason_codes).toContain('INSUFFICIENT_EVIDENCE')
  })
  it('9 Faculdade mantém continuidade junto ao concurso', async () => {
    const { rows } = await run(fixture())
    expect(rows.filter((row) => row.objetivo_id === 'faculty')).toHaveLength(7)
    expect(rows.filter((row) => row.objetivo_id === 'contest')).toHaveLength(7)
  })
  it('10 capacidade adicional configurada favorece concurso sem zerar Faculdade', async () => {
    const db = fixture(); context(db).disponibilidade.dias[0].minutos = 150
    context(db).capacidade_inicial.slots.push({ dia: 0, destino: 'PRIORIDADE_ESTRUTURAL', atividade: 'ESTUDO', duracao_minutos: 50 })
    const { rows } = await run(db)
    expect(rows.filter((row) => row.objetivo_id === 'contest')).toHaveLength(8)
    expect(rows.filter((row) => row.objetivo_id === 'faculty')).toHaveLength(7)
  })
  it('11 semana sem encontro continua planejável', async () => {
    const db = fixture()
    expect((await run(db)).rows).toHaveLength(14)
    expect(db.tables.mentor_encontro_semanal).toEqual([])
  })
  it('12 encontro sem fatos não altera estratégia', async () => {
    const first = await run(fixture()), db = fixture(); await meeting(db)
    const second = await run(db)
    expect(second.evaluation.decisoes).toEqual(first.evaluation.decisoes)
  })
  it('13 feedback histórico não participa da decisão V2', async () => {
    const baseline = (await run(fixture())).evaluation
    for (const value of ['leve', 'adequada', 'pesada']) {
      const db = fixture(); await meeting(db, { cargaPercebida: value })
      context(db).carga_percebida = value
      db.tables.mentor_encontro_semanal[0].carga_percebida = value
      expect((await run(db)).evaluation.decisoes).toEqual(baseline.decisoes)
    }
  })
  it('14 movimento manual e conclusão da demanda preservam origem e não concluem material', async () => {
    const db = fixture(), { rows } = await run(db), row = db.tables.sessao.find((item) => item.id === rows[0].id)
    const original = await readMentorDemandTrace({ supabase: db, id: row.id, audit: true })
    row.data = '2030-03-10'; row.status = 'feita'; row.ordem = 99
    const moved = await readMentorDemandTrace({ supabase: db, id: row.id, audit: true })
    expect(moved.estado).toBe('RASTREAVEL')
    expect(moved.decisao).toEqual(original.decisao)
    expect(moved.data_original).toBe(original.data_original)
    expect(moved.data_atual).toBe('2030-03-10')
    await run(db)
    expect(row.status).toBe('feita')
  })
  it('policy V1 ativa não fornece fallback silencioso', async () => {
    const db = fixture(); db.tables.conhecimento_modulo[0].conteudo.politica = { fase: 'adaptacao_1', capacidade_semanal: 500 }
    const { result, rows, evaluation } = await run(db)
    expect(result.status).toBe(503)
    expect(evaluation.resultado).toBe('NAO_AVALIAVEL')
    expect(rows).toEqual([])
  })
})
