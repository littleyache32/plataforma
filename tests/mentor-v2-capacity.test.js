import { describe, expect, it } from 'vitest'
import { evaluateMentorWeekV2 } from '../api/_lib/mentor-v2.js'
import { materializeMentorWeek } from '../api/_lib/mentor-v2-plan.js'
import { validateMentorV2Decision } from '../shared/mentor-v2-policy.js'
import { meetingDatabase } from './helpers/mentor-meeting-db.js'

function database() {
  const db = meetingDatabase()
  db.tables.materia.push({ id: 'contest-subject', objetivo_id: 'contest' })
  db.tables.material.push({ id: 'contest-pdf', materia_id: 'contest-subject', objetivo_id: 'contest', status: 'aceito', ordem_curso: 1, nome: 'Conteúdo real' })
  db.tables.mentor_contexto[0].dados.capacidade_inicial = { versao: 'capacidade-inicial-v2/1', revisao: 'perfil-sintetico-1', slots: [
    { dia: 0, objetivo_id: 'contest', atividade: 'ESTUDO', duracao_minutos: 50 },
    { dia: 0, objetivo_id: 'faculty', atividade: 'ESTUDO', duracao_minutos: 50 },
  ] }
  return db
}
const run = (db) => evaluateMentorWeekV2({ supabase: db, inicio: '2030-03-04', instanteReferencia: '2030-03-04T15:00:00Z' })
const profile = (db) => db.tables.mentor_contexto[0].dados

describe('contrato de capacidade inicial V2, Fase 3.14', () => {
  it('capacidade configurada no perfil chega ao motor e à origem auditável das demandas', async () => {
    const db = database(), result = await run(db)
    expect(materializeMentorWeek(result)).toHaveLength(2)
    expect(result.carga_semanal.capacidade_inicial).toMatchObject({ slots: 2, minutos: 100, teto_permanente: false, progressao_automatica: false,
      referencia: { fonte: 'mentor_contexto', campo: 'dados.capacidade_inicial', revisao: 'perfil-sintetico-1' } })
    expect(result.carga_semanal.carga_proposta.minutos).toBe(100)
    expect(result.decisoes[0].parametros.capacidade_ref).toEqual(result.plano_semanal.capacidade_ref)
    expect(db.writes).toEqual([])
  })
  it('capacidade maior que disponibilidade materializa somente o que cabe, sem dívida', async () => {
    const db = database(); profile(db).disponibilidade.dias = [{ data: '2030-03-04', minutos: 70 }]
    const result = await run(db), rows = materializeMentorWeek(result)
    expect(rows).toHaveLength(1)
    expect(rows[0].duracao_estimada).toBe(50)
    expect(result.carga_semanal.capacidade_inicial.minutos).toBe(100)
    expect(result.carga_semanal.carga_proposta.minutos).toBe(50)
    expect(result.reason_codes).toContain('AVAILABILITY_CONSTRAINT')
    expect(result.plano_semanal.disponibilidade.divida_minutos).toBe(0)
  })
  it('disponibilidade maior que capacidade não inventa blocos adicionais', async () => {
    const db = database(); profile(db).disponibilidade.dias.forEach((row) => { row.minutos = 500 })
    const result = await run(db)
    expect(materializeMentorWeek(result)).toHaveLength(2)
    expect(result.carga_semanal.carga_proposta.minutos).toBe(100)
    expect(result.fallback.aumentar_carga).toBe(false)
  })
  it('ausência de parâmetro não usa disponibilidade ou rotina V1 como capacidade inicial', async () => {
    const db = database(); delete profile(db).capacidade_inicial
    profile(db).carga_atual = { concurso: 5, faculdade: 1 }
    const result = await run(db)
    expect(materializeMentorWeek(result)).toEqual([])
    expect(result.plano_semanal.limitacoes).toContain('CAPACIDADE_SEMANAL_NAO_CONFIGURADA')
    expect(result.carga_semanal.acao).toBe('MANTER')
    expect(result.carga_semanal.capacidade_inicial).toBeNull()
  })
  it('boa semana isolada e faltas não alteram a capacidade nem acrescentam compensação', async () => {
    for (const status of ['feita', 'nao_concluida']) {
      const db = database(), before = structuredClone(profile(db).capacidade_inicial)
      db.tables.sessao = [{ id: 'past', objetivo_id: 'contest', materia_id: 'contest-subject', tipo: 'estudo', status,
        data: '2030-02-25', duracao_estimada: 50, concluida_em: status === 'feita' ? '2030-02-25T15:00:00Z' : null }]
      const result = await run(db)
      expect(materializeMentorWeek(result)).toHaveLength(2)
      expect(result.reason_codes).toContain('LOAD_CHANGE_POLICY_UNDEFINED')
      expect(result.carga_semanal.alteracao_carga_autorizada).toBe(false)
      expect(result.fallback.aumentar_carga).toBe(false)
      expect(profile(db).capacidade_inicial).toEqual(before)
      expect(result.carga_semanal.sinais.pendencias.divida_minutos).toBe(0)
    }
  })
  it('slot adicional explícito favorece concurso sem substituir ou zerar Faculdade', async () => {
    const db = database()
    profile(db).capacidade_inicial.slots.push({ dia: 1, destino: 'PRIORIDADE_ESTRUTURAL', atividade: 'ESTUDO', duracao_minutos: 50 })
    const result = await run(db), rows = materializeMentorWeek(result)
    expect(rows.filter((row) => row.objetivo_id === 'contest')).toHaveLength(2)
    expect(rows.filter((row) => row.objetivo_id === 'faculty')).toHaveLength(1)
    expect(result.fallback.aumentar_carga).toBe(false)
    expect(result.carga_semanal.capacidade_inicial.teto_permanente).toBe(false)
    expect(result.evidencias_utilizadas.find((row) => row.evidencia_id === 'capacidade_aprovada').valor.configuracao.slots[2].destino).toBe('PRIORIDADE_ESTRUTURAL')
  })
  it('capacidade não usa outro objetivo como concurso principal silenciosamente', async () => {
    const db = database(); profile(db).objetivo_principal_id = 'faculty'
    db.tables.objetivo.push({ id: 'second-contest', tipo: 'concurso' })
    profile(db).capacidade_inicial.slots.push({ dia: 1, destino: 'PRIORIDADE_ESTRUTURAL', atividade: 'ESTUDO', duracao_minutos: 50 })
    expect((await run(db)).resultado).toBe('NAO_AVALIAVEL')
  })
  it('bloco de 30 requer justificativa; 50 não exige justificativa adicional', async () => {
    const db = database(); profile(db).capacidade_inicial.slots[0].duracao_minutos = 30
    expect((await run(db)).resultado).toBe('NAO_AVALIAVEL')
    profile(db).capacidade_inicial.slots[0].justificativa_30 = 'Continuidade curta do conteúdo'
    expect(materializeMentorWeek(await run(db)).map((row) => row.duracao_estimada)).toEqual([30, 50])
  })
  it.each([60, 90, 100, 45])('capacidade normal não aceita bloco de %s minutos', async (minutes) => {
    const db = database(); profile(db).capacidade_inicial.slots[0].duracao_minutos = minutes
    expect((await run(db)).resultado).toBe('NAO_AVALIAVEL')
    expect(db.writes).toEqual([])
  })
  it('capacidade antiga na policy é recusada, não fallback concorrente', async () => {
    const db = database()
    db.tables.conhecimento_modulo[0].conteudo.politica.capacidade_semanal = profile(db).capacidade_inicial.slots
    const result = await run(db)
    expect(result.resultado).toBe('NAO_AVALIAVEL')
    expect(result.limitacoes).toContain('POLICY_V2_INVALIDA')
  })
  it('capacidade explicitamente zero é diferente de configuração ausente', async () => {
    const db = database(); profile(db).capacidade_inicial.slots = []
    const result = await run(db)
    expect(result.plano_semanal.pendente).toBe(false)
    expect(result.plano_semanal.slots_configurados).toBe(0)
    expect(result.carga_semanal.capacidade_inicial.minutos).toBe(0)
  })
  it('demanda adulterada não pode alegar outra revisão de capacidade', async () => {
    const result = await run(database()), decision = structuredClone(result.decisoes[0])
    decision.parametros.capacidade_ref.revisao = 'nao-configurada'
    expect(() => validateMentorV2Decision(decision)).toThrow('Capacidade sem referência canônica')
  })
})
