import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../supabase/migrations/0045_expansao_quinzenal_questoes.sql', import.meta.url)
const cronPath = new URL('../api/cron/mentor.js', import.meta.url)

describe('histórico da expansão quinzenal de questões', () => {
  it('preserva a migration antiga como histórico, sem a promover a regra vigente', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).toContain("meta_minima',2000")
    expect(sql).toContain("meta_maxima',2500")
    expect(sql).toContain("alvo_inicial',2250")
    expect(sql).toContain("'distribuicao_por_topico_igual',false")
    expect(sql).toContain("'exigir_final_0_ou_5',false")
  })

  it('não executa a regra antiga no cron e mantém Gemini desautorizado', async () => {
    const [sql, cron] = await Promise.all([readFile(migrationPath, 'utf8'), readFile(cronPath, 'utf8')])
    expect(sql).toContain("'frequencia_dias',14")
    expect(sql).toContain("'gemini_desautorizado',true")
    expect(cron).not.toContain('expansionDays % 14 === 0')
    expect(cron).not.toContain("planejar_expansao_questoes_bacen")
  })
})
