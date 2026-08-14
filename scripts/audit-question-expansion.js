import { getSupabaseAdmin } from '../api/_lib/supabase.js'

const supabase = getSupabaseAdmin()

async function allRows(table, columns) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + 999)
    if (error) throw error
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

const { data: cycle, error: cycleError } = await supabase.from('acervo_ciclo_expansao').select('*').order('inicio', { ascending: false }).limit(1).maybeSingle()
if (cycleError) throw cycleError
if (!cycle) throw new Error('Nenhum ciclo quinzenal de expansão foi planejado.')

const [items, questions] = await Promise.all([
  allRows('acervo_ciclo_item', 'ciclo_id,topico_id,estoque_inicial,quantidade_planejada,quantidade_inserida,peso_calculado,materia:materia_id(nome),topico:topico_id(nome)'),
  allRows('questao', 'id,topico_id,ativa,marcada_errada,estado,dificuldade,tipo'),
])
const cycleItems = items.filter((item) => item.ciclo_id === cycle.id)
const active = questions.filter((item) => item.ativa !== false && !item.marcada_errada && item.estado !== 'arquivada')
const currentByTopic = active.reduce((map, item) => map.set(item.topico_id, (map.get(item.topico_id) || 0) + 1), new Map())
const rows = cycleItems.map((item) => {
  const current = currentByTopic.get(item.topico_id) || 0
  const inserted = Math.max(0, current - item.estoque_inicial)
  return {
    materia: item.materia?.nome,
    topico: item.topico?.nome,
    estoque_inicial: item.estoque_inicial,
    planejadas: item.quantidade_planejada,
    inseridas: inserted,
    faltantes: Math.max(0, item.quantidade_planejada - inserted),
  }
})
const bySubject = [...rows.reduce((map, item) => {
  const current = map.get(item.materia) || { materia: item.materia, topicos: 0, planejadas: 0, inseridas: 0, faltantes: 0 }
  current.topicos += 1; current.planejadas += item.planejadas; current.inseridas += item.inseridas; current.faltantes += item.faltantes
  map.set(item.materia, current); return map
}, new Map()).values()].sort((left, right) => right.planejadas - left.planejadas)
const difficulty = {
  faceis: active.filter((item) => Number(item.dificuldade) <= 2).length,
  medias: active.filter((item) => Number(item.dificuldade) === 3).length,
  dificeis: active.filter((item) => Number(item.dificuldade) >= 4).length,
}

process.stdout.write(`${JSON.stringify({
  ciclo: { id: cycle.id, inicio: cycle.inicio, fim: cycle.fim, meta_minima: cycle.meta_minima, meta_maxima: cycle.meta_maxima, alvo: cycle.alvo, status: cycle.status },
  acervo_atual: active.length,
  topicos_planejados: rows.length,
  topicos_zerados: rows.filter((item) => item.estoque_inicial === 0).length,
  planejadas: rows.reduce((sum, item) => sum + item.planejadas, 0),
  inseridas: rows.reduce((sum, item) => sum + item.inseridas, 0),
  faltantes: rows.reduce((sum, item) => sum + item.faltantes, 0),
  dificuldade: difficulty,
  por_disciplina: bySubject,
  menor_lote_topico: Math.min(...rows.map((item) => item.planejadas)),
  maior_lote_topico: Math.max(...rows.map((item) => item.planejadas)),
}, null, 2)}\n`)
