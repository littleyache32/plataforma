import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const sql = readFileSync('supabase/migrations/0069_tempo_sessao_duracao_atomica.sql', 'utf8')
const connectionString = process.env.TIMER_TEST_DATABASE_URL

describe('contratos locais da reconciliação no banco', () => {
  it('serializa antes da mutação e soma depois, com locks ordenados compatíveis com FK', () => {
    expect(sql).toMatch(/before insert or update or delete/)
    expect(sql).toMatch(/after insert or update or delete/)
    expect(sql).toMatch(/order by s\.id for no key update/)
    expect(sql).toMatch(/round\(coalesce\(sum\(t\.segundos_acumulados\), 0\)::numeric \/ 60\)/)
    expect(sql).toContain("t.status = 'concluido'")
    expect(sql).toContain('array[old_session, new_session]')
    expect(sql).not.toMatch(/exception when/i)
  })
  it('handlers não recalculam nem sobrescrevem duração derivada', () => {
    const timer = readFileSync('api/_lib/tempo-handler.js', 'utf8')
    const sessions = readFileSync('api/_lib/sessoes-handler.js', 'utf8')
    expect(timer).not.toMatch(/syncSessionDuration|duracao_realizada/)
    expect(sessions).not.toMatch(/sessionDurationMinutes|update\.duracao_realizada|duracao_realizada:/)
  })
})

// Optional real PostgreSQL proof, never aimed at Supabase or any remote host.
// Set TIMER_TEST_DATABASE_URL to a local disposable database to run these cases.
describe.skipIf(!connectionString)('PostgreSQL real: transação e concorrência da migration 0069', () => {
  const schema = `phase73b_${randomUUID().replaceAll('-', '')}`
  const sessionId = randomUUID()
  const otherId = randomUUID()
  const objectiveId = randomUUID()
  let client
  let created = false
  const duration = async (id = sessionId) => Number((await client.query(`select duracao_realizada from ${schema}.sessao where id=$1`, [id])).rows[0].duracao_realizada)
  const insert = (seconds, status = 'concluido', id = sessionId, db = client) => db.query(`insert into ${schema}.tempo_estudo(id,sessao_id,status,segundos_acumulados,titulo,contexto) values ($1,$2,$3,$4,'Tempo sintético CI','demanda') returning id`, [randomUUID(), id, status, seconds])

  beforeAll(async () => {
    const url = new URL(connectionString)
    if (!['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Tests require a local PostgreSQL host; remote databases are forbidden.')
    client = new pg.Client({ connectionString })
    await client.connect()
    await client.query(`create schema ${schema}`)
    created = true
    await client.query(`set search_path to ${schema}, pg_catalog`)
    const tables = [
      ['0001_init.sql', 'materia'], ['0001_init.sql', 'topico'],
      ['0002_plataforma_pessoal.sql', 'objetivo'], ['0002_plataforma_pessoal.sql', 'sessao'],
      ['0034_foco_offline_edital_backup.sql', 'tempo_estudo'],
    ]
    for (const [file, table] of tables) {
      const source = readFileSync(`supabase/migrations/${file}`, 'utf8')
      const ddl = source.match(new RegExp(`create table if not exists ${table} \\([\\s\\S]*?\\n\\);`))?.[0]
      if (!ddl) throw new Error(`Real table DDL missing: ${file}/${table}`)
      await client.query(ddl)
    }
    // Namespace substitution isolates the unchanged trigger logic from existing tables.
    await client.query(sql.replaceAll('public.', `${schema}.`))
  })
  afterAll(async () => {
    if (created && /^phase73b_[a-f0-9]{32}$/.test(schema)) await client.query(`drop schema ${schema} cascade`)
    await client?.end()
  })
  beforeEach(async () => {
    await client.query(`delete from ${schema}.tempo_estudo; delete from ${schema}.sessao`)
    await client.query(`insert into ${schema}.objetivo(id,tipo,nome) values ($1,'concurso','Objetivo sintético CI') on conflict(id) do nothing`, [objectiveId])
    await client.query(`insert into ${schema}.sessao(id,objetivo_id,titulo,data) values ($1,$3,'Demanda sintética CI',current_date),($2,$3,'Outra demanda CI',current_date)`, [sessionId, otherId, objectiveId])
  })

  it('primeiro tempo registra 30 e o segundo totaliza 50', async () => {
    await insert(1800); expect(await duration()).toBe(30)
    await insert(1200); expect(await duration()).toBe(50)
  })
  it('delete recalcula o restante e o último registro deixa zero', async () => {
    const a = await insert(1800); const b = await insert(1200)
    await client.query(`delete from ${schema}.tempo_estudo where id=$1`, [a.rows[0].id])
    expect(await duration()).toBe(20)
    await client.query(`delete from ${schema}.tempo_estudo where id=$1`, [b.rows[0].id])
    expect(await duration()).toBe(0)
  })
  it('alterar segundos concluídos recalcula e arredonda apenas o total', async () => {
    const a = await insert(31); await insert(31)
    expect(await duration()).toBe(1)
    await client.query(`update ${schema}.tempo_estudo set segundos_acumulados=1200 where id=$1`, [a.rows[0].id])
    expect(await duration()).toBe(21)
  })
  it('rodando/pausado não contam e somente a conclusão entra no total', async () => {
    const a = await insert(1800, 'rodando')
    expect(await duration()).toBe(0)
    await client.query(`update ${schema}.tempo_estudo set status='pausado' where id=$1`, [a.rows[0].id])
    expect(await duration()).toBe(0)
    await client.query(`update ${schema}.tempo_estudo set status='concluido' where id=$1`, [a.rows[0].id])
    expect(await duration()).toBe(30)
  })
  it('ignora outra sessão e tempo sem vínculo', async () => {
    await insert(1800); await insert(5000, 'pausado'); await insert(1200, 'concluido', otherId); await insert(9000, 'concluido', null)
    expect(await duration()).toBe(30)
    expect(await duration(otherId)).toBe(20)
  })
  it('mudança de vínculo reconcilia a sessão antiga e a nova', async () => {
    const a = await insert(1800)
    await client.query(`update ${schema}.tempo_estudo set sessao_id=$1 where id=$2`, [otherId, a.rows[0].id])
    expect(await duration()).toBe(0)
    expect(await duration(otherId)).toBe(30)
  })
  it('falha da atualização derivada desfaz também a mutação de tempo', async () => {
    await client.query(`alter table ${schema}.sessao add constraint duration_test_limit check(duracao_realizada < 60)`)
    try {
      await expect(insert(6000)).rejects.toThrow()
      expect(await duration()).toBe(0)
      expect(Number((await client.query(`select count(*) from ${schema}.tempo_estudo`)).rows[0].count)).toBe(0)
    } finally { await client.query(`alter table ${schema}.sessao drop constraint duration_test_limit`) }
  })
  it('duas conclusões simultâneas serializam pela sessão e terminam em 50 minutos', async () => {
    const a = new pg.Client({ connectionString }); const b = new pg.Client({ connectionString })
    await a.connect(); await b.connect()
    let pending
    try {
      await a.query('begin'); await b.query('begin')
      await insert(1800, 'concluido', sessionId, a)
      pending = insert(1200, 'concluido', sessionId, b)
      pending.catch(() => {})
      let blocked = false
      for (let i = 0; i < 40; i++) {
        const activity = await client.query("select wait_event_type from pg_stat_activity where pid=$1", [b.processID])
        if (activity.rows[0]?.wait_event_type === 'Lock') { blocked = true; break }
        await new Promise((resolve) => setTimeout(resolve, 25))
      }
      expect(blocked).toBe(true)
      await a.query('commit'); await pending; await b.query('commit')
      expect(await duration()).toBe(50)
    } finally {
      await a.query('rollback'); await b.query('rollback'); await pending?.catch(() => {})
      await a.end(); await b.end()
    }
  })
  it('reprocessar/reler não duplica duração nem conclui a demanda', async () => {
    const a = await insert(1800); await insert(1200)
    await client.query(`update ${schema}.tempo_estudo set status='concluido', segundos_acumulados=1800 where id=$1`, [a.rows[0].id])
    expect(await duration()).toBe(50); expect(await duration()).toBe(50)
    await client.query(`update ${schema}.sessao set status='feita' where id=$1`, [sessionId])
    await client.query(`update ${schema}.sessao set status='planejada' where id=$1`, [sessionId])
    expect(await duration()).toBe(50)
  })
})
