import { REVIEW_CATEGORIES, orderReviewQueue, reviewCategory } from './review-v2-queue.js'
import { qualifyQuestionReview } from './review-v2-pipeline.js'
import { questionReviewObservations, chooseOperationalRetest } from './review-v2-operational.js'

export const REVIEW_CENTER_CONTRACT = 'central-revisao-v2/1'
const timestamp = (value) => typeof value === 'string' && Number.isFinite(Date.parse(value))

// Calendar observations remain visible without inventing strategic evidence.
// Only qualified needs enter intelligent ordering; card dates are not FSRS.
export function projectReviewCenter({ questoes, cards, registros, corte, policy_ref = null, flags, objetivoId = null, catalogo = null, unidades = [], progressos = [] }) {
  const cutoff = Date.parse(corte), views = new Map(), candidates = []
  if (!timestamp(corte)) throw new Error('Corte da Central inválido.')
  const latest = new Map()
  for (const record of registros) {
    if (!timestamp(record.criado_em) || Date.parse(record.criado_em) > cutoff) continue
    const previous = latest.get(record.questao_id)
    if (!previous || Date.parse(record.criado_em) > Date.parse(previous.criado_em)
      || (record.criado_em === previous.criado_em && String(record.id).localeCompare(String(previous.id)) > 0)) latest.set(record.questao_id, record)
  }
  for (const row of questoes) {
    const question = row.questao, topic = question?.topico, subject = topic?.materia
    if (!question || !subject || question.ativa === false || question.marcada_errada === true || question.estado === 'arquivada'
      || (objetivoId && subject.objetivo_id !== objetivoId)) continue
    const schedule = timestamp(row.agendada_para) ? row.agendada_para : null
    const record = latest.get(question.id)
    const local = questionReviewObservations({ questao: question, revisao: row,
      questoes: catalogo || questoes.map((r) => r.questao).filter(Boolean), registros, corte, unidades, progressos })
    if (local.atendimento === 'ATENDIDA') continue
    let selected = question.id, eligible = false
    let reason = { erro: 'Reteste de uma questão errada.', falsa_certeza: 'Corrigir uma resposta com falsa certeza.',
      checagem: 'Verificar aprendizagem em uma nova tentativa.' }[row.motivo] || 'Revisão agendada.'
    if (record && policy_ref) {
      const base = local.execucoes.length ? local.historico.filter((r) => r.questao_id === question.id && r.resultado === 'erro').at(-1) || record : record
      const qualified = qualifyQuestionReview({ registro: base,
        questao: question, revisao: { ...row, agendada_para: schedule }, corte, policy_ref, observacoes: local })
      const { evidencia: evidence, sinal: signal, elegibilidade: eligibility } = qualified
      const retest = chooseOperationalRetest({ qualified, observations: local, policy_ref })
      selected = retest.questao_id || question.id
      eligible = eligibility.elegivel && retest.resultado === 'RETESTE_SELECIONADO'
      if (signal.sinal === 'FALSA_CERTEZA') reason = 'Corrigir uma resposta com falsa certeza.'
      if (signal.sinal === 'PROVAVEL_LACUNA_BASE') reason = 'Retestar um conteúdo ainda sem conhecimento.'
      if (eligibility.elegivel) candidates.push({ fonte: { tipo: 'RETESTE_QUESTAO', entidade: 'revisao_item', id: row.id,
        alvo: { entidade: 'questao', id: question.id } }, evidencia: evidence, elegibilidade: eligibility,
        sinais: local.sinais, agendada_para: null })
    }
    views.set(`RETESTE_QUESTAO:${row.id}`, { tipo: 'questao', id: row.id, item_id: selected, questao_original_id: question.id,
      materia_id: subject.id, topico_id: question.topico_id, materia: subject.nome, topico: topic.nome,
      motivo: reason, data_legada: schedule, agendada_para: eligible ? null : schedule, categoria: reviewCategory(schedule, corte),
      atendimento: local.atendimento, ultima_interacao: local.ultima_tentativa?.criado_em ?? null,
      pode_revisar: eligible && flags.revisao_pratica === true && flags.questoes === true })
  }
  for (const card of cards) {
    const subject = card.topico?.materia
    if (!subject || !timestamp(card.proxima_revisao) || (objetivoId && subject.objetivo_id !== objetivoId)) continue
    views.set(`SRS_QUESTION_CARD:${card.id}`, { tipo: 'card', id: card.id, item_id: card.id,
      materia_id: subject.id, topico_id: card.topico_id, materia: subject.nome, topico: card.topico.nome,
      motivo: 'Revisão programada do card.', agendada_para: card.proxima_revisao,
      categoria: reviewCategory(card.proxima_revisao, corte),
      ultima_interacao: timestamp(card.ultima_revisao) && Date.parse(card.ultima_revisao) <= cutoff ? card.ultima_revisao : null,
      pode_revisar: flags.question_cards === true })
  }
  const ordered = orderReviewQueue({ itens: candidates, corte })
  const qualifiedKeys = new Set(ordered.itens.map((item) => item.chave))
  const neutral = [...views.entries()].filter(([key]) => !qualifiedKeys.has(key))
    .sort(([a, left], [b, right]) => (left.agendada_para ?? '9999').localeCompare(right.agendada_para ?? '9999') || a.localeCompare(b))
  const itens = [...ordered.itens.map((item) => ({ ...views.get(item.chave),
    categoria: item.agendada_para ? item.categoria : item.elegibilidade.reason_codes.includes('REVIEW_FALSE_CERTAINTY') ? 'Hoje' : 'Atenção' })), ...neutral.map(([, item]) => item)]
  return { versao: REVIEW_CENTER_CONTRACT, corte, itens,
    categorias: REVIEW_CATEGORIES.map((nome) => ({ nome, itens: itens.filter((item) => item.categoria === nome) })) }
}
