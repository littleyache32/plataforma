import { getSupabaseAdmin } from '../api/_lib/supabase.js'
import { auditCard } from '../shared/card-quality.js'
import { normalizeContent } from '../shared/question-quality.js'

const supabase = getSupabaseAdmin()
const dryRun = process.argv.includes('--dry-run')
const pageSize = 750
const cards = []
for (let from = 0; ; from += pageSize) {
  const { data, error } = await supabase.from('question_card').select('id,topico_id,frente,verso,fonte,trecho_fonte,repeticoes,criado_em,ativa').eq('ativa', true).range(from, from + pageSize - 1)
  if (error) throw error
  cards.push(...(data || []))
  if ((data || []).length < pageSize) break
}

const sorted = [...cards].sort((a, b) => (b.repeticoes || 0) - (a.repeticoes || 0) || new Date(a.criado_em) - new Date(b.criado_em))
const seen = new Set()
const audits = []
for (const card of sorted) {
  const key = `${card.topico_id}|${normalizeContent(card.frente)}`
  const audit = auditCard(card, seen.has(key))
  seen.add(key)
  audits.push({ id: card.id, question_card_id: card.id, status: audit.approved ? 'aprovado' : 'arquivado', criterios: { recuperacao_ativa: !audit.warnings.includes('frente_pouco_interrogativa'), resposta_suficiente: !audit.warnings.includes('resposta_sem_fundamento'), alertas: audit.warnings }, motivos: audit.reasons, tipo_card: audit.tipoCard, auditado_em: new Date().toISOString() })
}

if (!dryRun) {
  for (let index = 0; index < audits.length; index += 400) {
    const batch = audits.slice(index, index + 400)
    const auditResult = await supabase.from('question_card_auditoria').upsert(batch.map(({ id, tipo_card, ...item }) => item), { onConflict: 'question_card_id' })
    if (auditResult.error) throw auditResult.error
    const updates = await Promise.all(batch.map((item) => supabase.from('question_card').update({ tipo_card: item.tipo_card, ...(item.status === 'arquivado' ? { ativa: false, ativo: false } : {}) }).eq('id', item.id)))
    const error = updates.find((item) => item.error)?.error
    if (error) throw error
  }
}

const archived = audits.filter((item) => item.status === 'arquivado')
const warnings = audits.flatMap((item) => item.criterios.alertas).reduce((map, reason) => ({ ...map, [reason]: (map[reason] || 0) + 1 }), {})
process.stdout.write(`${JSON.stringify({ modo: dryRun ? 'simulacao' : 'aplicado', auditados: audits.length, aprovados: audits.length - archived.length, arquivados: archived.length, alertas: warnings }, null, 2)}\n`)
