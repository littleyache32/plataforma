import { getSupabaseAdmin } from '../api/_lib/supabase.js'
import { auditQuestion, normalizeContent } from '../shared/question-quality.js'

const supabase = getSupabaseAdmin()
const dryRun = process.argv.includes('--dry-run')
const includeDetails = process.argv.includes('--details')
const pageSize = 750
const questions = []
for (let from = 0; ; from += pageSize) {
  const { data, error } = await supabase.from('questao').select('id,topico_id,tipo,enunciado,alternativas,gabarito,explicacao,fonte,trecho_fonte,dificuldade,quantidade_tentativas,criado_em,ativa').eq('ativa', true).range(from, from + pageSize - 1)
  if (error) throw error
  questions.push(...(data || []))
  if ((data || []).length < pageSize) break
}

const sorted = [...questions].sort((a, b) => (b.quantidade_tentativas || 0) - (a.quantidade_tentativas || 0) || new Date(a.criado_em) - new Date(b.criado_em))
const seen = new Set()
const audits = []
const archiveIds = []
for (const question of sorted) {
  const key = `${question.topico_id}|${normalizeContent(question.enunciado)}`
  const duplicate = seen.has(key)
  seen.add(key)
  const audit = auditQuestion(question, duplicate)
  audits.push({ questao_id: question.id, status: audit.approved ? 'aprovada' : 'arquivada', criterios: { ...audit.checks, alertas: audit.warnings }, motivos: audit.reasons, auditado_em: new Date().toISOString() })
  if (!audit.approved) archiveIds.push(question.id)
}

if (!dryRun) {
  for (let index = 0; index < audits.length; index += 500) {
    const result = await supabase.from('questao_auditoria').upsert(audits.slice(index, index + 500), { onConflict: 'questao_id' })
    if (result.error) throw result.error
  }
  for (let index = 0; index < archiveIds.length; index += 250) {
    const ids = archiveIds.slice(index, index + 250)
    const result = await supabase.from('questao').update({ ativa: false, estado: 'arquivada' }).in('id', ids)
    if (result.error) throw result.error
  }
}

const reasons = audits.filter((item) => item.status === 'arquivada').flatMap((item) => item.motivos).reduce((map, reason) => ({ ...map, [reason]: (map[reason] || 0) + 1 }), {})
const archivedDetails = includeDetails ? audits.filter((item) => item.status === 'arquivada').map((audit) => {
  const question = questions.find((item) => item.id === audit.questao_id)
  return { id: audit.questao_id, topico_id: question?.topico_id, enunciado: question?.enunciado, motivos: audit.motivos }
}) : undefined
process.stdout.write(`${JSON.stringify({ modo: dryRun ? 'simulacao' : 'aplicado', auditadas: audits.length, aprovadas: audits.length - archiveIds.length, arquivadas: archiveIds.length, motivos: reasons, ...(archivedDetails ? { detalhes: archivedDetails } : {}) }, null, 2)}\n`)
