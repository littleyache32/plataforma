// Observations only. These projections neither schedule nor authorize a decision.
export const REVIEW_EVIDENCE_CONTRACT = 'evidencia-revisao-v2/1'
function id(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Evidência sem ID verificável.')
  return value
}
function timestamp(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value)
    || !Number.isFinite(Date.parse(value))) throw new Error('Timestamp de evidência inválido ou sem fuso.')
  return Date.parse(value)
}
function recency(value, corte) {
  if (value == null) return null
  const elapsed = timestamp(corte) - timestamp(value)
  if (elapsed < 0) throw new Error('Observação posterior ao corte da evidência.')
  return { observado_em: value, segundos_desde_observacao: elapsed / 1000 }
}
function envelope(tipo, alvo, corte, fontes, observacoes) {
  timestamp(corte)
  return { versao: REVIEW_EVIDENCE_CONTRACT, tipo, alvo, corte, fontes, observacoes,
    qualificacao: 'NAO_AVALIADA', autoriza_decisao: false }
}
function optionalEnum(value, allowed) {
  if (value == null) return null
  if (!allowed.includes(value)) throw new Error('Valor de observação inválido.')
  return value
}

export function questionReviewEvidence({ registro, questao, corte, contexto = null, erroAlvo = null }) {
  if (registro.questao_id !== questao.id) throw new Error('Tentativa e questão incompatíveis.')
  const resultado = optionalEnum(registro.resultado, ['erro', 'acerto'])
  const confianca = optionalEnum(registro.classificacao, ['sem_conhecimento', 'eliminacao', 'duvida', 'certeza'])
  const tipo = optionalEnum(contexto?.tipo, ['INEDITA', 'REPETICAO', 'RETESTE'])
  if (tipo && !contexto.referencia) throw new Error('Repetição/reteste exige proveniência explícita.')
  if (contexto && !tipo) throw new Error('Contexto de tentativa inválido.')
  const contextReference = tipo ? { entidade: id(contexto.referencia.entidade), id: id(contexto.referencia.id) } : null
  if (contextReference && !['registro', 'revisao_item', 'sessao'].includes(contextReference.entidade)) throw new Error('Origem do contexto de tentativa inválida.')
  if (erroAlvo && erroAlvo.resultado !== 'erro') throw new Error('Erro-alvo exige registro de erro factual.')
  const errorReference = erroAlvo ? { entidade: 'registro', id: id(erroAlvo.id), questao_id: id(erroAlvo.questao_id) } : null
  if (erroAlvo) recency(erroAlvo.criado_em, corte)
  return envelope('QUESTAO', { entidade: 'questao', id: id(questao.id), topico_id: questao.topico_id ?? null }, corte,
    [{ entidade: 'registro', id: id(registro.id) }, { entidade: 'questao', id: questao.id },
      ...(contextReference ? [contextReference] : []), ...(errorReference ? [errorReference] : [])], {
      resultado, confianca, falsa_certeza: resultado === null || confianca === null ? null : resultado === 'erro' && confianca === 'certeza',
      recencia: recency(registro.criado_em, corte), tipo_tentativa: tipo ?? 'UNKNOWN', erro_alvo: errorReference,
    })
}

export function cardReviewEvidence({ card, avaliacoes = null, corte }) {
  if (avaliacoes !== null && !Array.isArray(avaliacoes)) throw new Error('Histórico de avaliações inválido.')
  const history = avaliacoes?.map((row) => {
    if (row.question_card_id !== card.id) throw new Error('Avaliação pertence a outro card.')
    return { referencia: { entidade: 'question_card_registro', id: id(row.id) },
      resultado: optionalEnum(row.resultado, ['novamente', 'dificil', 'bom', 'facil', 'lembrei', 'revisar']),
      recencia: recency(row.criado_em, corte) }
  }) ?? null
  if (history && new Set(history.map((row) => row.referencia.id)).size !== history.length) throw new Error('Avaliação duplicada.')
  const scheduled = card.proxima_revisao ?? null
  return envelope('QUESTION_CARD', { entidade: 'question_card', id: id(card.id), topico_id: card.topico_id ?? null }, corte,
    [{ entidade: 'question_card', id: card.id }, ...(history?.map((row) => row.referencia) ?? [])], {
      estado_fsrs: { disponibilidade: 'NAO_IMPLEMENTADO', valor: null },
      agendada_para: scheduled, vencido: scheduled === null ? null : timestamp(scheduled) <= timestamp(corte),
      historico_avaliacoes: history, completude_historico: 'NAO_COMPROVADA',
      recencia: recency(card.ultima_revisao, corte),
    })
}

// Events must already carry a verified material association from their adapter.
// Temporal proximity or a subject name is not a curricular link.
export function contentReviewEvidence({ material, progresso = null, estudos = null, exposicoes = null, praticas = null, corte }) {
  const materialId = id(material.id)
  if (progresso && progresso.material_id !== materialId) throw new Error('Progresso pertence a outro material.')
  const events = (rows, allowed) => {
    if (rows === null) return null
    if (!Array.isArray(rows)) throw new Error('Eventos de conteúdo inválidos.')
    const result = rows.map((row) => {
      if (row.material_id !== materialId || !allowed.includes(row.referencia?.entidade)) throw new Error('Evento sem vínculo válido ao material.')
      return { referencia: { entidade: row.referencia.entidade, id: id(row.referencia.id) }, recencia: recency(row.observado_em, corte) }
    })
    if (new Set(result.map((row) => `${row.referencia.entidade}:${row.referencia.id}`)).size !== result.length) throw new Error('Evento duplicado.')
    return result
  }
  const studyEvents = events(estudos, ['sessao', 'tempo_estudo'])
  const exposureEvents = events(exposicoes, ['sessao', 'tempo_estudo'])
  const practiceEvents = events(praticas, ['registro', 'question_card_registro'])
  const latestStudy = studyEvents?.reduce((latest, row) => row.recencia && (!latest || timestamp(row.recencia.observado_em) > timestamp(latest)) ? row.recencia.observado_em : latest, null) ?? null
  const subsequent = (rows) => rows?.map((row) => ({ ...row, posterior_ao_ultimo_estudo: latestStudy && row.recencia ? timestamp(row.recencia.observado_em) > timestamp(latestStudy) : null })) ?? null
  const progress = progresso ? { estado: optionalEnum(progresso.estado, ['em_andamento', 'concluido']),
    iniciado_em: recency(progresso.iniciado_em, corte), concluido_em: recency(progresso.concluido_em, corte),
    atualizado_em: recency(progresso.atualizado_em, corte) } : null
  return envelope('CONTEUDO', { entidade: 'material', id: materialId }, corte,
    [{ entidade: 'material', id: materialId }, ...(progresso ? [{ entidade: 'material_progresso', id: materialId }] : []),
      ...[studyEvents, exposureEvents, practiceEvents].flatMap((rows) => rows?.map((row) => row.referencia) ?? [])], {
      progresso: progress, estudos: studyEvents, ultimo_estudo_em: latestStudy,
      exposicoes_posteriores: subsequent(exposureEvents), praticas_posteriores: subsequent(practiceEvents),
      completude_historico: 'NAO_COMPROVADA',
    })
}
