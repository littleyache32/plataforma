import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'
import { cardTransition } from '../shared/cards.js'

const reportReasons = ['gabarito_incorreto', 'questao_ambigua', 'fonte_insuficiente', 'conteudo_desatualizado', 'erro_formatacao']
const cardReportReasons = ['card_ambiguo', 'card_incompleto', 'card_incorreto']
const newCardsDailyLimit = 10

function withCardFilters(query, { objetivoId, materiaId, topicoId }) {
  if (objetivoId) query = query.eq('objetivo_id', objetivoId)
  if (materiaId) query = query.eq('materia_id', materiaId)
  if (topicoId) query = query.eq('topico_id', topicoId)
  return query
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'PATCH']) || !requireAccess(req, res)) return
  try {
    const supabase = getSupabaseAdmin()
    if (queryParam(req, 'recurso') === 'cards') {
      if (req.method === 'GET') {
        const filters = { objetivoId: queryParam(req, 'objetivoId'), materiaId: queryParam(req, 'materiaId'), topicoId: queryParam(req, 'topicoId') }
        const fields = 'id,frente,verso,resposta_direta,explicacao_curta,dica_escopo,modelo_card,apoio_memoria,fonte,trecho_fonte,ocorrencias,repeticoes,intervalo_dias,fator_facilidade,lapsos,proxima_revisao,ultima_revisao,introduzido_em,criado_em,materia:materia_id(id,nome),topico:topico_id(id,nome),objetivo:objetivo_id(nome,tipo)'
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
        const tomorrow = new Date(`${today}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
        const introduced = await withCardFilters(supabase.from('question_card').select('id', { count: 'exact', head: true }).eq('ativa', true).gte('introduzido_em', `${today}T00:00:00-03:00`).lt('introduzido_em', `${tomorrow.toISOString().slice(0, 10)}T00:00:00-03:00`), { objetivoId: filters.objetivoId })
        if (introduced.error) throw introduced.error
        const remainingNew = Math.max(0, newCardsDailyLimit - (introduced.count || 0))
        const reviewedQuery = withCardFilters(supabase.from('question_card').select(fields).eq('ativa', true).not('ultima_revisao', 'is', null).lte('proxima_revisao', new Date().toISOString()).order('proxima_revisao').limit(60), filters)
        const newQuery = remainingNew > 0 ? withCardFilters(supabase.from('question_card').select(fields).eq('ativa', true).is('ultima_revisao', null).lte('proxima_revisao', new Date().toISOString()).order('criado_em').limit(remainingNew), filters) : Promise.resolve({ data: [], error: null })
        const countQuery = withCardFilters(supabase.from('question_card').select('id', { count: 'exact', head: true }).eq('ativa', true), filters)
        const [{ data: reviewed, error }, { data: fresh, error: newError }, { count: totalCount, error: countError }] = await Promise.all([reviewedQuery, newQuery, countQuery])
        if (error || newError || countError) throw error || newError || countError
        const cards = [...(reviewed || []), ...(fresh || [])].filter((item) => !(item.objetivo?.tipo === 'faculdade' && item.materia?.nome === 'Análise e Produção de Texto')).map((item) => ({ ...item, vencido: true }))
        return res.status(200).json({ cards, vencidos: reviewed?.length || 0, novos: fresh?.length || 0, novos_limite_diario: newCardsDailyLimit, novos_introduzidos_hoje: introduced.count || 0, total: totalCount || 0 })
      }
      if (req.method === 'POST') {
        const { id, motivo, detalhe } = req.body || {}
        if (!id || !cardReportReasons.includes(motivo)) return res.status(400).json({ error: 'Card e motivo validos sao obrigatorios.' })
        const { error } = await supabase.from('relato_card').insert({ question_card_id: id, motivo, detalhe: String(detalhe || '').slice(0, 1000) || null })
        if (error) throw error
        const archived = await supabase.from('question_card').update({ ativo: false }).eq('id', id)
        if (archived.error) throw archived.error
        return res.status(201).json({ ok: true, mensagem: 'Problema registrado e card retirado da fila.' })
      }
      const { id, resultado } = req.body || {}
      if (!id || !['novamente', 'dificil', 'bom', 'facil'].includes(resultado)) return res.status(400).json({ error: 'Card e avaliacao validos sao obrigatorios.' })
      const { data: card, error: cardError } = await supabase.from('question_card').select('id,repeticoes,intervalo_dias,fator_facilidade,lapsos,introduzido_em').eq('id', id).eq('ativa', true).single()
      if (cardError) throw cardError
      const transition = cardTransition({ resultado, repeticoes: card.repeticoes, intervaloDias: card.intervalo_dias, fatorFacilidade: card.fator_facilidade, lapsos: card.lapsos })
      const now = new Date().toISOString()
      const [{ error: updateError }, { error: recordError }] = await Promise.all([
        supabase.from('question_card').update({ repeticoes: transition.repeticoes, intervalo_dias: transition.intervaloDias, fator_facilidade: transition.fatorFacilidade, lapsos: transition.lapsos, proxima_revisao: transition.proximaRevisao, ultima_revisao: now, introduzido_em: card.introduzido_em || now }).eq('id', id),
        supabase.from('question_card_registro').insert({ question_card_id: id, resultado }),
      ])
      if (updateError || recordError) throw updateError || recordError
      return res.status(200).json({ ok: true, proxima_revisao: transition.proximaRevisao })
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Metodo nao permitido para questoes.' })
    const { id, motivo, detalhe } = req.body || {}
    if (!id || !reportReasons.includes(motivo)) return res.status(400).json({ error: 'Questao e motivo validos sao obrigatorios.' })
    const { error: reportError } = await supabase.from('relato_questao').insert({ questao_id: id, motivo, detalhe: String(detalhe || '').slice(0, 1000) || null })
    if (reportError) throw reportError
    const { error } = await supabase.from('questao').update({ marcada_errada: true, estado: 'arquivada' }).eq('id', id)
    if (error) throw error
    return res.status(201).json({ ok: true, mensagem: 'Problema registrado e questao retirada do baralho.' })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel processar o item.')
  }
}
