// Profile configuration, not observed availability or a progression policy.
export function readInitialMentorCapacity(configuration) {
  if (configuration === undefined || configuration === null) return null
  if (!configuration || configuration.versao !== 'capacidade-inicial-v2/1'
    || typeof configuration.revisao !== 'string' || !configuration.revisao.trim()
    || Object.keys(configuration).some((key) => !['versao', 'revisao', 'slots'].includes(key))
    || !Array.isArray(configuration.slots)) throw new Error('CAPACIDADE_INICIAL_INVALIDA')
  for (const slot of configuration.slots) {
    if (!slot || Object.keys(slot).some((key) => !['dia', 'objetivo_id', 'destino', 'atividade', 'duracao_minutos', 'justificativa_30', 'materia_id', 'topico_id', 'revisao_id'].includes(key))
      || !Number.isInteger(slot.dia) || slot.dia < 0 || slot.dia > 6
      || !['ESTUDO', 'QUESTOES', 'QUESTION_CARDS', 'REVISAO'].includes(slot.atividade)
      || ![30, 50].includes(slot.duracao_minutos)
      || (slot.duracao_minutos === 30 && (typeof slot.justificativa_30 !== 'string' || !slot.justificativa_30.trim()))
      || (slot.destino === undefined ? typeof slot.objetivo_id !== 'string' || !slot.objetivo_id
        : slot.destino !== 'PRIORIDADE_ESTRUTURAL' || slot.objetivo_id !== undefined)
      || (slot.atividade === 'ESTUDO' && (slot.materia_id || slot.topico_id || slot.revisao_id))
      || (['QUESTOES', 'QUESTION_CARDS'].includes(slot.atividade) && (!slot.materia_id || !slot.topico_id))
      || (slot.atividade === 'REVISAO' && Boolean(slot.materia_id) !== Boolean(slot.topico_id))) throw new Error('CAPACIDADE_INICIAL_INVALIDA')
  }
  return structuredClone(configuration)
}
