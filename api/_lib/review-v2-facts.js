// Canonical factual adapter shared by the Central and practice. Transport only.
export async function readReviewRows(supabase, table, select, configure = (q) => q, orderKey = 'id') {
    const rows = []
    for (let offset = 0; ; offset += 500) {
      const result = await configure(supabase.from(table).select(select)).order(orderKey).range(offset, offset + 499)
      if (result.error) throw result.error
      if (!Array.isArray(result.data)) throw new Error(`Fonte de revisão indisponível: ${table}`)
      rows.push(...result.data)
      if (result.data.length < 500) return rows
    }
}
export async function readQuestionReviewFacts(supabase, corte) {
  const all = (table, select, configure, orderKey) => readReviewRows(supabase, table, select, configure, orderKey)
  const [catalogo, registros, needs] = await Promise.all([
    all('questao', 'id,topico_id,ativa,marcada_errada,estado,metadados_revisao,topico:topico_id(nome,materia:materia_id(id,nome,objetivo_id))'),
    all('registro', 'id,questao_id,resultado,classificacao,criado_em,revisao_item_id,sessao_id,erro_alvo_id', (q) => q.lte('criado_em', corte)),
    all('revisao_item', 'id,questao_id,motivo,status,agendada_para', (q) => q.eq('status', 'pendente')),
  ])
  const questoes = needs.map((n) => ({ ...n, questao: catalogo.find((q) => q.id === n.questao_id) }))
  let unidades = [], progressos = []
  if (needs.length && catalogo.some((q) => q.metadados_revisao?.conceito_id)) {
    unidades = await all('material_unidade_curricular', 'id,material_id,topico_id,conceito_id,titulo,pagina_inicial,pagina_final')
    progressos = await all('material_progresso', 'material_id,estado,concluido_em', (q) => q, 'material_id')
  }
  return { questoes, catalogo, registros, unidades, progressos }
}
