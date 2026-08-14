import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const migrationPath = new URL('../supabase/migrations/0045_expansao_quinzenal_questoes.sql', import.meta.url)
const cronPath = new URL('../api/cron/mentor.js', import.meta.url)

describe('expansão quinzenal de questões', () => {
  it('mantém a meta entre 2000 e 2500 sem impor divisão uniforme', async () => {
    const sql = await readFile(migrationPath, 'utf8')
    expect(sql).toContain("meta_minima',2000")
    expect(sql).toContain("meta_maxima',2500")
    expect(sql).toContain("alvo_inicial',2250")
    expect(sql).toContain("'distribuicao_por_topico_igual',false")
    expect(sql).toContain("'exigir_final_0_ou_5',false")
  })

  it('planeja a cada 14 dias e não autoriza Gemini', async () => {
    const [sql, cron] = await Promise.all([readFile(migrationPath, 'utf8'), readFile(cronPath, 'utf8')])
    expect(sql).toContain("'frequencia_dias',14")
    expect(sql).toContain("'gemini_desautorizado',true")
    expect(cron).toContain('expansionDays % 14 === 0')
    expect(cron).toContain("planejar_expansao_questoes_bacen")
  })
})
