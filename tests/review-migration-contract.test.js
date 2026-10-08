import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const sql = readFileSync(new URL('../supabase/migrations/0069_revisao_v2_fatos_sem_intervalo.sql', import.meta.url), 'utf8')
const runner = readFileSync(new URL('../scripts/migrate.js', import.meta.url), 'utf8')
const statements = sql.replace(/--[^\n]*/g, '').split(';').map((s) => s.trim()).filter(Boolean)

// Structural checks only. These do NOT prove PostgreSQL rollback or concurrency.
describe('0069: contrato transacional estrutural', () => {
  it('delega a transação ao executor, sem COMMIT/ROLLBACK próprios', () => {
    expect(statements.some((s) => /^(begin|commit|rollback|start\s+transaction)\b/i.test(s))).toBe(false)
  })
  it('não reescreve nem remove histórico', () => {
    expect(statements.every((s) => /^(alter table|create index)\b/i.test(s))).toBe(true)
    expect(statements.some((s) => /^(delete|update|truncate|drop)\b/i.test(s))).toBe(false)
  })
  it('novas necessidades não recebem data fixa/default', () => {
    expect(sql).toContain('alter column agendada_para drop not null')
    expect(sql).toContain('alter column agendada_para drop default')
  })
  it('executor reconsulta ledger depois do lock e antes de executar SQL', () => {
    const begin = runner.indexOf("await client.query('begin')")
    const lock = runner.indexOf('pg_advisory_xact_lock', begin)
    const check = runner.indexOf('select nome from schema_migration where nome = $1', lock)
    const execute = runner.indexOf('await client.query(sql)', check)
    const ledger = runner.indexOf('insert into schema_migration', execute)
    const commit = runner.indexOf("await client.query('commit')", ledger)
    expect(begin).toBeGreaterThan(-1)
    expect(lock).toBeGreaterThan(begin)
    expect(check).toBeGreaterThan(lock)
    expect(execute).toBeGreaterThan(check)
    expect(ledger).toBeGreaterThan(execute)
    expect(commit).toBeGreaterThan(ledger)
    expect(runner).toContain("await client.query('rollback')")
  })
})
