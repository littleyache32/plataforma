import { REVIEW_ELIGIBILITY_CONTRACT } from './review-v2-eligibility.js'
import { REVIEW_V2_CONTRACT, createReviewSourceReference } from './review-v2-model.js'

export const REVIEW_QUEUE_CONTRACT = 'fila-revisao-v2/1'
export const REVIEW_CATEGORIES = Object.freeze(['Hoje', 'Atenção', 'Depois'])
function instant(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) throw new Error('Data da fila inválida ou sem fuso.')
  return Date.parse(value)
}
const day = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant(value)))
const key = (source) => `${source.tipo}:${source.id}`
const nonempty = (value) => typeof value === 'string' && value.trim()

export function reviewCategory(agendadaPara, corte) {
  const today = day(corte)
  if (agendadaPara == null) return 'Depois'
  const scheduled = day(agendadaPara)
  return scheduled < today ? 'Atenção' : scheduled === today ? 'Hoje' : 'Depois'
}

// Lexicographic comparison, no hidden weighted score or sufficiency threshold.
const SIGNALS = Object.freeze({
  urgencia: { values: ['IMEDIATA', 'PROXIMA', 'NORMAL'], rank: { IMEDIATA: 2, PROXIMA: 1, NORMAL: 0 } },
  importancia: { values: ['HIGH', 'MEDIUM', 'LOW'], rank: { HIGH: 2, MEDIUM: 1, LOW: 0 } },
  persistencia_erro: { numeric: true }, retestes_anteriores: { numeric: true }, volume_evidencia: { numeric: true },
  cobertura: { boolean: true }, recencia_segundos: { numeric: true },
})
function signal(item, name) {
  const input = item.sinais?.[name]
  if (!input || input.valor == null || input.valor === 'UNKNOWN') return { rank: 0, known: false }
  const definition = SIGNALS[name]
  const valid = definition.numeric ? Number.isFinite(input.valor) && input.valor >= 0
    : definition.boolean ? typeof input.valor === 'boolean' : definition.values.includes(input.valor)
  const sources = new Set(item.evidencia.fontes.map((row) => `${row.entidade}:${row.id}`))
  if (!valid || !nonempty(input.regra_ref?.id) || !nonempty(input.regra_ref?.versao)
    || !Array.isArray(input.fontes) || !input.fontes.length
    || input.fontes.some((row) => !sources.has(`${row.entidade}:${row.id}`))) throw new Error('Sinal de ordenação sem qualificação/proveniência válida.')
  return { rank: definition.numeric ? input.valor : definition.boolean ? Number(input.valor) : definition.rank[input.valor], known: true }
}

function planCoverage(item, demands, corte) {
  const today = day(corte), dueDay = item.agendada_para ? day(item.agendada_para) : today
  // Already due needs are only deferred to a demand TODAY, not an arbitrary future week.
  const latest = dueDay < today ? today : dueDay
  return demands.filter((demand) => {
    if (!['planejada', 'parcial'].includes(demand.status) || demand.data < today || demand.data > latest) return false
    const link = demand.revisao_ref
    if (!link || link.versao !== REVIEW_V2_CONTRACT || link.sessao_id !== demand.id
      || !nonempty(link.decisao_id) || demand.cobertura_adequada !== true || demand.prioritaria !== true
      || !nonempty(demand.regra_ref?.id) || !nonempty(demand.regra_ref?.versao) || !Array.isArray(link.fontes)) return false
    return link.fontes.some((source) => {
      const canonical = createReviewSourceReference(source)
      return key(canonical) === key(item.fonte) && canonical.alvo.id === item.fonte.alvo.id
    })
  }).sort((a, b) => a.data.localeCompare(b.data) || a.id.localeCompare(b.id))[0] || null
}

// Only eligible projections enter the actionable Central. Covered entries remain
// auditable, without a second "review now" action or deletion of canonical needs.
export function orderReviewQueue({ itens, demandas = [], corte }) {
  instant(corte)
  if (!Array.isArray(itens) || !Array.isArray(demandas)) throw new Error('Fila ou plano inválido.')
  const entries = [], covered = [], rejected = [], seen = new Set()
  for (const input of itens) {
    const item = structuredClone(input), source = createReviewSourceReference(item.fonte), itemKey = key(source)
    if (seen.has(itemKey)) throw new Error('Ocorrência duplicada na Central.')
    seen.add(itemKey)
    item.fonte = source
    const eligibility = item.elegibilidade
    if (eligibility?.versao !== REVIEW_ELIGIBILITY_CONTRACT || eligibility.corte !== corte
      || eligibility.alvo?.id !== source.alvo.id || eligibility.alvo?.entidade !== source.alvo.entidade) throw new Error('Elegibilidade incompatível com a fila.')
    if (!eligibility.elegivel || eligibility.resultado !== 'ELEGIVEL') { rejected.push({ chave: itemKey, reason_codes: eligibility.reason_codes }); continue }
    if (!item.evidencia || item.evidencia.corte !== corte || item.evidencia.alvo?.id !== source.alvo.id
      || item.evidencia.alvo?.entidade !== source.alvo.entidade
      || !Array.isArray(item.evidencia.fontes)) throw new Error('Evidência incompatível com a fila.')
    if (item.agendada_para != null) instant(item.agendada_para)
    const demand = planCoverage(item, demandas, corte)
    if (demand) {
      covered.push({ chave: itemKey, fonte: source, sessao_id: demand.id, decisao_id: demand.revisao_ref.decisao_id,
        regra_ref: structuredClone(demand.regra_ref), reason_codes: ['REVIEW_COVERED_BY_PRIORITY_PLAN'] })
      continue
    }
    const signals = Object.fromEntries(Object.keys(SIGNALS).map((name) => [name, signal(item, name)]))
    const codes = eligibility.reason_codes || []
    const overdue = item.agendada_para != null && instant(item.agendada_para) < instant(corte)
    const vector = [signals.urgencia.rank, Number(overdue), signals.importancia.rank,
      Number(codes.includes('REVIEW_FALSE_CERTAINTY')), Number(codes.includes('REVIEW_KNOWLEDGE_GAP')),
      signals.persistencia_erro.rank, signals.retestes_anteriores.rank, signals.volume_evidencia.rank,
      signals.cobertura.rank, signals.recencia_segundos.rank]
    entries.push({ ...item, chave: itemKey, categoria: reviewCategory(item.agendada_para, corte), sinais_utilizados: signals,
      reason_codes_ordenacao: ['REVIEW_RELATIVE_ORDER', ...(overdue ? ['REVIEW_OVERDUE'] : []),
        ...(Object.values(signals).some((row) => !row.known) ? ['REVIEW_PARTIAL_ORDERING_EVIDENCE'] : [])], vector })
  }
  entries.sort((a, b) => {
    for (let i = 0; i < a.vector.length; i++) if (a.vector[i] !== b.vector[i]) return b.vector[i] - a.vector[i]
    return a.chave.localeCompare(b.chave)
  })
  const ordered = entries.map(({ vector: _vector, ...item }, index) => ({ ...item, prioridade_relativa: index + 1 }))
  return { versao: REVIEW_QUEUE_CONTRACT, corte, itens: ordered,
    categorias: REVIEW_CATEGORIES.map((nome) => ({ nome, itens: ordered.filter((item) => item.categoria === nome) })),
    cobertos_no_plano: covered.sort((a, b) => a.chave.localeCompare(b.chave)), nao_elegiveis: rejected.sort((a, b) => a.chave.localeCompare(b.chave)) }
}
