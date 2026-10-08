import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './http.js'
import { currentPracticeFlags } from '../../shared/study-access.js'
import { readMentorReviewCoverage, separateCoveredCentralItems } from './mentor-v2-review-coverage.js'
import { projectReviewCenter } from '../../shared/review-v2-center.js'
import { REVIEW_CATEGORIES } from '../../shared/review-v2-queue.js'
import { resolveMentorV2Policy } from '../../shared/mentor-v2-policy.js'
import { readQuestionReviewFacts } from './review-v2-facts.js'

async function readPages(factory) {
  const rows = []
  for (let offset = 0; ; offset += 500) {
    const result = await factory().order('id').range(offset, offset + 499)
    if (result.error) throw result.error
    if (!Array.isArray(result.data)) throw new Error('Fonte da Central indisponível.')
    rows.push(...result.data)
    if (result.data.length < 500) return rows
  }
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin(), objectiveId = queryParam(req, 'objetivoId'), now = new Date().toISOString()
    const flags = await currentPracticeFlags(supabase)
    const [facts, c, policies] = await Promise.all([
      flags.revisao_pratica ? readQuestionReviewFacts(supabase, now) : { questoes: [], registros: [], catalogo: [], unidades: [], progressos: [] },
      flags.question_cards ? readPages(() => supabase.from('question_card').select('id,proxima_revisao,ultima_revisao,topico_id,topico:topico_id(nome,materia:materia_id(id,nome,objetivo_id))').eq('ativa', true).not('proxima_revisao', 'is', null)) : [],
      supabase.from('conhecimento_modulo').select('id,modulo,versao,conteudo,ativo').eq('modulo', 'mentor').eq('ativo', true),
    ])
    if (policies.error) throw policies.error
    const resolved = resolveMentorV2Policy(policies.data?.length === 1 ? policies.data[0] : null)
    const center = projectReviewCenter({ ...facts, cards: c, corte: now,
      policy_ref: resolved.ok ? resolved.ref : null, flags, objetivoId: objectiveId })
    const coverage = await readMentorReviewCoverage({ supabase, corte: now })
    const projected = separateCoveredCentralItems({ itens: center.itens, demandas: coverage, corte: now })
    return res.status(200).json({ versao: center.versao, corte: now, itens: projected.itens,
      categorias: REVIEW_CATEGORIES.map((nome) => ({ nome, itens: projected.itens.filter((item) => item.categoria === nome) })),
      cobertos_no_plano: projected.cobertos_no_plano,
      questoes: projected.itens.filter((row) => row.tipo === 'questao').length,
      cards: projected.itens.filter((row) => row.tipo === 'card').length })
  } catch (error) { return fail(res, error, 'Nao foi possivel montar a central de revisao.') }
}
