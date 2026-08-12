import { getSupabaseAdmin } from './supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './http.js'

function nextCron() {
  const now = new Date()
  const next = new Date(now)
  const days = (8 - now.getUTCDay()) % 7 || 7
  next.setUTCDate(now.getUTCDate() + days)
  next.setUTCHours(2, 30, 0, 0)
  return next.toISOString()
}

async function exportData(supabase) {
  const tables = ['objetivo', 'materia', 'topico', 'registro', 'question_card_registro', 'sessao', 'compromisso', 'revisao_item', 'mentor_execucao', 'mentor_decisao', 'mentor_conhecimento', 'acervo_meta']
  const results = await Promise.all(tables.map(async (table) => {
    const { data, error } = await supabase.from(table).select('*')
    if (error) throw error
    return [table, data || []]
  }))
  return { exportado_em: new Date().toISOString(), versao: 1, dados: Object.fromEntries(results) }
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'PATCH']) || !requireAccess(req, res)) return
  const supabase = getSupabaseAdmin()
  try {
    const resource = queryParam(req, 'recurso')
    if (req.method === 'GET' && resource === 'exportar') return res.status(200).json(await exportData(supabase))
    if (req.method === 'PATCH') {
      const { tipo, id, acao } = req.body || {}
      if (!id) return res.status(400).json({ error: 'Item obrigatorio.' })
      if (tipo === 'falha') {
        if (acao !== 'resolver') return res.status(400).json({ error: 'Acao invalida.' })
        const result = await supabase.from('sistema_falha').update({ status: 'resolvida', resolvida_em: new Date().toISOString() }).eq('id', id)
        if (result.error) throw result.error
      } else if (tipo === 'questao') {
        if (!['reativar', 'descartar'].includes(acao)) return res.status(400).json({ error: 'Acao invalida.' })
        const report = await supabase.from('relato_questao').select('questao_id').eq('id', id).single()
        if (report.error) throw report.error
        if (acao === 'reativar') {
          const reactivation = await supabase.from('questao').update({ ativa: true, marcada_errada: false, estado: 'revisao', ...(req.body?.conteudo ? { enunciado: String(req.body.conteudo).trim() } : {}) }).eq('id', report.data.questao_id)
          if (reactivation.error) throw reactivation.error
        }
        const result = await supabase.from('relato_questao').update({ status: acao === 'descartar' ? 'descartado' : 'resolvido' }).eq('id', id)
        if (result.error) throw result.error
      } else if (tipo === 'card') {
        if (!['reativar', 'descartar'].includes(acao)) return res.status(400).json({ error: 'Acao invalida.' })
        const report = await supabase.from('relato_card').select('question_card_id').eq('id', id).single()
        if (report.error) throw report.error
        if (acao === 'reativar') {
          const reactivation = await supabase.from('question_card').update({ ativo: true, ...(req.body?.conteudo ? { frente: String(req.body.conteudo).trim() } : {}) }).eq('id', report.data.question_card_id)
          if (reactivation.error) throw reactivation.error
        }
        const result = await supabase.from('relato_card').update({ status: acao === 'descartar' ? 'descartado' : 'resolvido' }).eq('id', id)
        if (result.error) throw result.error
      } else return res.status(400).json({ error: 'Tipo de item invalido.' })
      return res.status(200).json({ ok: true })
    }

    const [runs, failures, questionReports, cardReports, metas, inventory, knowledge, sessions] = await Promise.all([
      supabase.from('mentor_execucao').select('id,tipo,semana_inicio,status,data_execucao,politica_versao,erro,iniciado_em,concluido_em,resultado').order('iniciado_em', { ascending: false }).limit(10),
      supabase.from('sistema_falha').select('id,origem,mensagem,detalhe,status,criado_em').eq('status', 'aberta').order('criado_em', { ascending: false }).limit(30),
      supabase.from('relato_questao').select('id,motivo,detalhe,status,criado_em,questao:questao_id(id,enunciado,fonte,ativa,topico:topico_id(nome,materia:materia_id(nome)))').eq('status', 'aberto').order('criado_em', { ascending: false }),
      supabase.from('relato_card').select('id,motivo,detalhe,status,criado_em,card:question_card_id(id,frente,fonte,ativo,topico:topico_id(nome,materia:materia_id(nome)))').eq('status', 'aberto').order('criado_em', { ascending: false }),
      supabase.from('acervo_meta').select('topico_id,expansao_bloqueada,motivo_bloqueio,topico:topico_id(nome,materia:materia_id(nome,objetivo:objetivo_id(nome,tipo)))'),
      supabase.from('mentor_acervo_topico').select('topico_id,total_questoes,total_cards'),
      supabase.from('mentor_conhecimento').select('versao').eq('ativo', true).order('criado_em', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('sessao').select('data,status,duracao_estimada').eq('origem', 'mentor').order('data', { ascending: false }).limit(300),
    ])
    const error = [runs, failures, questionReports, cardReports, metas, inventory, knowledge, sessions].find((item) => item.error)?.error
    if (error) throw error
    const stock = new Map((inventory.data || []).map((item) => [item.topico_id, item]))
    const coverage = (metas.data || []).map((item) => ({ ...item, questoes: stock.get(item.topico_id)?.total_questoes || 0, cards: stock.get(item.topico_id)?.total_cards || 0 }))
    const lastRun = runs.data?.[0] || null
    return res.status(200).json({
      saude: { ultima_execucao: lastRun, proxima_execucao: nextCron(), falhas_abertas: (failures.data || []).length, semana_gerada: lastRun?.semana_inicio || null, politica: lastRun?.politica_versao || knowledge.data?.versao || null },
      execucoes: runs.data || [], falhas: failures.data || [], relatos_questoes: questionReports.data || [], relatos_cards: cardReports.data || [], cobertura: coverage,
      protecoes: { limite_diario_minutos: 480, limite_pendencias_transferidas: 3, topicos_bloqueados: coverage.filter((item) => item.expansao_bloqueada).length, chave_unica_demandas: true },
    })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel carregar o controle operacional.')
  }
}
