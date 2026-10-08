import { orderReviewQueue } from './review-v2-queue.js'
import { REVIEW_METHOD_CONTRACT } from './mentor-v2-review-method.js'
import { createReviewSourceReference } from './review-v2-model.js'

export const REVIEW_PLAN_CONTRACT = 'revisao-plano-v2/1'
const methods = ['QUESTAO_INDIVIDUAL', 'BATERIA_QUESTOES', 'QUESTION_CARDS', 'RETORNO_PONTUAL_TEORIA']
const sourceKey = (source) => `${source.tipo}:${source.id}`

export function validateReviewPlanSelection(selection, { materia_id, topico_id, duracao_minutos, policy_ref, corte }) {
  if (selection?.versao !== REVIEW_PLAN_CONTRACT || selection.corte !== corte
    || selection.materia_id !== materia_id || selection.topico_id !== topico_id
    || selection.item?.materia_id !== materia_id || selection.item?.topico_id !== topico_id
    || selection.cobertura_adequada !== true || !Array.isArray(selection.fontes) || selection.fontes.length !== 1
    || selection.policy_ref?.id !== policy_ref.id || selection.policy_ref?.versao !== policy_ref.versao) {
    throw new Error('Origem de revisão planejada inválida.')
  }
  const source = createReviewSourceReference(selection.fontes[0]), method = selection.metodo
  if (method?.versao !== REVIEW_METHOD_CONTRACT || method.resultado !== 'METODO_SELECIONADO'
    || !methods.includes(method.metodo) || method.corte !== corte || method.alvo?.id !== source.alvo.id
    || method.alvo?.entidade !== source.alvo.entidade || method.policy_ref?.id !== policy_ref.id
    || method.policy_ref?.versao !== policy_ref.versao || method.componentes?.length !== 1
    || method.componentes[0].duracao_minutos !== duracao_minutos
    || method.componentes[0].metodo !== method.metodo
    || !['QUESTOES', 'QUESTION_CARDS', 'ESTUDO'].includes(method.componentes[0].tipo_atividade)
    || !Array.isArray(method.componentes[0].referencias) || !method.componentes[0].referencias.length
    || !Array.isArray(method.fontes) || !Array.isArray(method.reason_codes) || !method.reason_codes.length
    || method.componentes[0].referencias.some((ref) => !method.fontes.some((row) => row.entidade === ref.entidade && row.id === ref.id))) {
    throw new Error('Método de revisão planejada inválido.')
  }
  const activity = { QUESTAO_INDIVIDUAL: 'QUESTOES', BATERIA_QUESTOES: 'QUESTOES',
    QUESTION_CARDS: 'QUESTION_CARDS', RETORNO_PONTUAL_TEORIA: 'ESTUDO' }[method.metodo]
  if (method.componentes[0].tipo_atividade !== activity) throw new Error('Modalidade diverge do método de revisão.')
  const ranked = orderReviewQueue({ itens: [selection.item], corte }).itens
  if (ranked.length !== 1 || sourceKey(ranked[0].fonte) !== sourceKey(source)
    || ranked[0].fonte.alvo.id !== source.alvo.id) throw new Error('Revisão planejada sem elegibilidade comprovada.')
  return true
}

// Reconstruct coverage from the immutable original decision and actual demand.
// Caller validates the decision and its persisted linkage before this projection.
export function projectPlannedReviewCoverage({ demanda, decisao }) {
  const selection = decisao.parametros?.revisao
  if (!selection || decisao.tipo_atividade !== 'REVISAO' || demanda.origem !== 'mentor'
    || !['planejada', 'parcial'].includes(demanda.status)
    || !demanda.chave_mentor?.endsWith(`:decision:${decisao.decisao_id}`)) return null
  validateReviewPlanSelection(selection, { ...decisao, corte: decisao.instante_referencia })
  return { id: demanda.id, data: demanda.data, status: demanda.status, prioritaria: true,
    cobertura_adequada: true, regra_ref: { id: 'GERACAO_PLANO_SEMANAL', versao: selection.policy_ref.versao },
    revisao_ref: { versao: 'revisao-v2/1', sessao_id: demanda.id, decisao_id: decisao.decisao_id,
      fontes: structuredClone(selection.fontes) } }
}

// Only reserved review slots compete here. Curriculum slots never enter this
// allocation and no overflow becomes additional load or a debt of minutes.
export function allocateMentorReviews({ itens = [], slots, demandas = [], corte, policy_ref, allowed }) {
  const queue = orderReviewQueue({ itens, demandas, corte })
  const used = new Set(), allocations = [], issues = []
  for (const slot of slots) {
    if (slot.atividade !== 'REVISAO') continue
    let found = null
    for (const item of queue.itens) {
      const key = sourceKey(item.fonte)
      if (used.has(key) || item.objetivo_id !== slot.objetivo_id
        || (slot.materia_id && item.materia_id !== slot.materia_id)
        || (slot.topico_id && item.topico_id !== slot.topico_id)
        || (slot.revisao_id && item.fonte.id !== slot.revisao_id)) continue
      // Do not create a premature demand for a canonically future review.
      if (item.agendada_para && Date.parse(item.agendada_para) > Date.parse(`${slot.data}T23:59:59-03:00`)) continue
      const method = item.metodos_por_duracao?.find((row) => row.componentes?.[0]?.duracao_minutos === slot.duracao_minutos) || item.metodo
      const component = method?.componentes?.[0]
      if (method?.resultado !== 'METODO_SELECIONADO' || !component || method.componentes.length !== 1 || !allowed(component.tipo_atividade)
        || component.duracao_minutos !== slot.duracao_minutos) continue
      const selection = { versao: REVIEW_PLAN_CONTRACT, materia_id: item.materia_id, topico_id: item.topico_id,
        corte, policy_ref: structuredClone(policy_ref), fontes: [item.fonte], metodo: method,
        item: { ...item, metodo: method }, cobertura_adequada: true }
      validateReviewPlanSelection(selection, { ...item, duracao_minutos: slot.duracao_minutos, policy_ref, corte })
      found = selection; used.add(key); break
    }
    if (found) allocations.push({ slot_id: slot.id, revisao: structuredClone(found) })
    else issues.push('REVISAO_V2_SEM_ITEM_METODO_OU_CAPACIDADE_COMPATIVEL')
  }
  return { allocations, issues: [...new Set(issues)], cobertos_no_plano: queue.cobertos_no_plano,
    restantes: queue.itens.filter((item) => !used.has(sourceKey(item.fonte))).map((item) => item.chave),
    aumenta_carga: false, substitui_estudo: false, divida_minutos: 0 }
}
