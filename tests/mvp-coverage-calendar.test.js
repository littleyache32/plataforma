import { describe, it, expect } from 'vitest'
import definition from '../config/mentor-ciclo-atual.json'
import { prepareCycleContext } from '../shared/mentor-v2-cycle.js'
import { evaluateMentorWeekV2 } from '../api/_lib/mentor-v2.js'
import { applyMentorWeekV2, materializeMentorWeek } from '../api/_lib/mentor-v2-plan.js'
import { meetingDatabase } from './helpers/mentor-meeting-db.js'

function setup(count = 12) {
  const db = meetingDatabase(), context = db.tables.mentor_contexto[0]
  context.dados = prepareCycleContext({ definition, objectives: db.tables.objetivo, current: context.dados })
  const names = ['Direito das Pessoas e dos Negócios Jurídicos', 'Teoria do Crime', 'Teoria da Justiça', 'Teoria da Constituição e Direitos Fundamentais']
  db.tables.materia = names.map((nome, dia) => ({ id: `faculty-${dia}`, nome, objetivo_id: 'faculty' }))
  context.dados.calendario_academico = { versao: 'calendario-academico-v2/1', aulas: names.map((_, dia) => ({ dia, objetivo_id: 'faculty', materia_id: `faculty-${dia}` })) }
  context.dados.disponibilidade.dias = Array.from({ length: 11 }, (_, index) => ({ data: `2026-10-${String(8 + index).padStart(2, '0')}`, minutos: 150 }))
  db.tables.material = [] // Academic classes need no material catalog at all.
  for (let index = 0; index < count; index++) {
    const id = `contest-${String(index).padStart(2, '0')}`
    db.tables.materia.push({ id, nome: id, objetivo_id: 'contest' })
    db.tables.material.push({ id: `pdf-${id}`, materia_id: id, objetivo_id: 'contest', nome: `${id}.pdf`, status: 'aceito', ordem_curso: 1 })
  }
  db.tables.material_progresso.push({ material_id: 'pdf-contest-00', estado: 'em_andamento', concluido_em: null })
  return db
}
const run = (db, inicio = '2026-10-12', instant = '2026-10-12T15:00:00Z') => evaluateMentorWeekV2({ supabase: db, inicio, instanteReferencia: instant })

describe('Correção mínima do MVP: cobertura inicial e calendário factual', () => {
  it('4.17: sinais fortes de revisão não inserem prática na primeira semana de base', async () => {
    const db = setup()
    db.tables.topico = [{ id: 'topic', materia_id: 'contest-00', nome: 'Conceito' }]
    db.tables.questao = [{ id: 'q', topico_id: 'topic', ativa: true, marcada_errada: false, estado: 'revisao' }]
    db.tables.registro = [{ id: 'error', questao_id: 'q', resultado: 'erro', classificacao: 'certeza', criado_em: '2026-10-01T15:00:00Z' }]
    db.tables.revisao_item = [{ id: 'need', questao_id: 'q', status: 'pendente', motivo: 'falsa_certeza', agendada_para: null }]
    const before = structuredClone(db.tables)
    const result = await run(db), rows = materializeMentorWeek(result)
    expect(rows).toHaveLength(18); expect(rows.every((r) => r.tipo === 'estudo' && r.duracao_estimada === 50)).toBe(true)
    expect(result.plano_semanal.disponibilidade.divida_minutos).toBe(0)
    expect(db.tables).toEqual(before)
  })
  it('08 a 11 não geram demandas, ausências ou dívida; histórico fica intacto', async () => {
    const db = setup(), before = structuredClone(db.tables)
    const result = await run(db, '2026-10-05', '2026-10-08T15:00:00Z')
    expect(result.decisoes).toEqual([])
    expect(() => materializeMentorWeek(result)).toThrow('Avaliação não aplicável ao plano.')
    expect(result.reason_codes).toContain('CYCLE_NOT_STARTED')
    expect(db.writes).toEqual([])
    expect(db.tables).toEqual(before)
  })
  it.each([11, 12])('usa catálogo elegível de %i disciplinas sem constante de quantidade', async (count) => {
    const db = setup(count)
    const before = structuredClone(db.tables)
    const contests = materializeMentorWeek(await run(db)).filter((row) => row.objetivo_id === 'contest')
    expect(contests).toHaveLength(14)
    expect(new Set(contests.slice(0, count).map((row) => row.materia_id)).size).toBe(count)
    expect(contests.slice(0, count).every((row) => row.reason_codes.includes('INITIAL_SUBJECT_COVERAGE'))).toBe(true)
    for (const day of [...new Set(contests.map((row) => row.data))]) {
      expect(new Set(contests.filter((row) => row.data === day).map((row) => row.materia_id)).size).toBe(2)
    }
    for (let index = 2; index < contests.length; index += 2) {
      expect(contests.slice(index, index + 2).every((row) => !contests.slice(index - 2, index).some((prior) => prior.materia_id === row.materia_id))).toBe(true)
    }
    expect(db.tables).toEqual(before)
  })
  it('12/10 em diante segue exatamente as quatro disciplinas de segunda a quinta', async () => {
    const rows = materializeMentorWeek(await run(setup(), '2026-10-12', '2026-10-12T15:00:00Z'))
    const faculty = rows.filter((row) => row.objetivo_id === 'faculty')
    expect(faculty.map((row) => [row.data, row.materia_id, row.material_id])).toEqual([
      ['2026-10-12', 'faculty-0', null], ['2026-10-13', 'faculty-1', null],
      ['2026-10-14', 'faculty-2', null], ['2026-10-15', 'faculty-3', null],
    ])
    expect(rows.filter((row) => row.data >= '2026-10-16').every((row) => row.objetivo_id === 'contest')).toBe(true)
    expect(faculty.map((row) => row.titulo)).toEqual([
      'Direito das Pessoas e dos Negócios Jurídicos · Aula dada, aula estudada',
      'Teoria do Crime · Aula dada, aula estudada',
      'Teoria da Justiça · Aula dada, aula estudada',
      'Teoria da Constituição e Direitos Fundamentais · Aula dada, aula estudada',
    ])
  })
  it('material concluído avança; ausência de material elegível bloqueia sem inventar', async () => {
    const db = setup(11)
    db.tables.material_progresso = [{ material_id: 'pdf-contest-00', estado: 'concluido', concluido_em: '2026-10-01T15:00:00Z' }]
    db.tables.material.push({ id: 'next-00', materia_id: 'contest-00', objetivo_id: 'contest', nome: 'Próxima aula', status: 'aceito', ordem_curso: 2 })
    const result = await run(db)
    const rows = materializeMentorWeek(result)
    expect(rows.some((row) => row.materia_id === 'contest-00')).toBe(true)
    expect(rows.filter((row) => row.materia_id === 'contest-00').every((row) => row.material_id === 'next-00')).toBe(true)
    expect(rows.some((row) => row.material_id === 'pdf-contest-00')).toBe(false)
    db.tables.material = []
    db.tables.material_progresso = []
    const blocked = await run(db)
    expect(blocked.limitacoes).toContain('NO_ELIGIBLE_CURRICULUM')
    expect(materializeMentorWeek(blocked).every((row) => row.objetivo_id === 'faculty')).toBe(true)
  })
  it('recálculo parcial considera seleções preservadas antes de repetir disciplina', async () => {
    const db = setup(12)
    const first = materializeMentorWeek(await run(db))
    db.tables.sessao.push(...first.filter((row) => row.data === '2026-10-12'))
    const before = structuredClone(db.tables.sessao)
    const remaining = materializeMentorWeek(await run(db)).filter((row) => row.objetivo_id === 'contest')
    const preserved = new Set(before.filter((row) => row.objetivo_id === 'contest').map((row) => row.materia_id))
    expect(remaining.slice(0, 10).every((row) => !preserved.has(row.materia_id))).toBe(true)
    expect(new Set([...preserved, ...remaining.slice(0, 10).map((row) => row.materia_id)]).size).toBe(12)
    expect(db.tables.sessao).toEqual(before)
  })
  it('disponibilidade parcial limita o próprio dia; bootstrap cancelado não cria pendência', async () => {
    const db = setup(12)
    db.tables.mentor_contexto[0].dados.disponibilidade.dias.find((row) => row.data === '2026-10-12').minutos = 75
    db.tables.sessao.push(...[8, 9, 10, 11].map((dia) => ({ id: `inactive-${dia}`, data: `2026-10-${String(dia).padStart(2, '0')}`, tipo: 'estudo', status: 'cancelada', cancelamento_origem: 'mentor', objetivo_id: 'contest', materia_id: 'contest-00', duracao_estimada: 50 })))
    const before = structuredClone(db.tables.sessao)
    const result = await run(db), rows = materializeMentorWeek(result)
    expect(rows.filter((row) => row.data === '2026-10-12')).toHaveLength(1)
    expect(rows).toHaveLength(16)
    expect(result.carga_semanal.sinais.pendencias).toMatchObject({ demandas: 0, divida_minutos: 0 })
    expect(result.carga_semanal.sinais.historico.every((row) => row.aderencia === null && row.demandas_elegiveis === 0)).toBe(true)
    expect(db.tables.sessao).toEqual(before)
    expect(db.writes).toEqual([])
  })
  it('impedimento curricular real exclui disciplina sem pular seu primeiro material', async () => {
    const db = setup(11)
    db.tables.material.find((row) => row.materia_id === 'contest-01').estado_extracao = 'pendente_ocr'
    db.tables.material.push({ id: 'second-01', materia_id: 'contest-01', objetivo_id: 'contest', nome: 'second.pdf', status: 'aceito', ordem_curso: 2 })
    const rows = materializeMentorWeek(await run(db)).filter((row) => row.objetivo_id === 'contest')
    expect(new Set(rows.map((row) => row.materia_id)).size).toBe(10)
    expect(rows.some((row) => row.materia_id === 'contest-01')).toBe(false)
    expect(rows.some((row) => row.material_id === 'second-01')).toBe(false)
  })
  it('ausência de calendário não ressuscita seleção acadêmica por PDF', async () => {
    const db = setup(); delete db.tables.mentor_contexto[0].dados.calendario_academico
    const result = await run(db)
    expect(materializeMentorWeek(result).filter((row) => row.objetivo_id === 'faculty')).toEqual([])
    expect(result.limitacoes).toContain('CALENDARIO_ACADEMICO_AUSENTE')
  })
  it('indisponibilidade não gera dívida e recálculo preserva execução e exclusão manual', async () => {
    const db = setup(); db.tables.mentor_contexto[0].dados.disponibilidade.dias.find((row) => row.data === '2026-10-13').minutos = 0
    const result = await run(db)
    expect(result.plano_semanal.disponibilidade.divida_minutos).toBe(0)
    expect(materializeMentorWeek(result).some((row) => row.data === '2026-10-13')).toBe(false)
    await applyMentorWeekV2({ supabase: db, evaluation: result })
    db.tables.sessao[0].status = 'feita'; db.tables.sessao[0].concluida_em = '2026-10-12T16:00:00Z'
    db.tables.sessao[1].status = 'cancelada'; db.tables.sessao[1].cancelamento_origem = 'usuario'
    const original = structuredClone(db.tables.sessao)
    await applyMentorWeekV2({ supabase: db, evaluation: await run(db) })
    expect(db.tables.sessao).toEqual(original)
  })
})
