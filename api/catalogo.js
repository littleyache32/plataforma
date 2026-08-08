import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, fail, queryParam, requireAccess } from './_lib/http.js'
import studyHandler from './_lib/estudo-handler.js'

export default async function handler(req, res) {
  if (queryParam(req, 'recurso') === 'health') {
    if (!allowMethods(req, res, ['GET'])) return
    try {
      const { error } = await getSupabaseAdmin().from('materia').select('id', { head: true, count: 'exact' })
      if (error && error.code !== '42P01' && !error.message?.includes('schema cache')) throw error
      return res.status(200).json({ ok: true, service: 'mentor-de-estudos-api', database: error ? 'connected-schema-pending' : 'connected', timestamp: new Date().toISOString() })
    } catch (error) {
      console.error(error)
      return res.status(503).json({ ok: false, database: 'unavailable' })
    }
  }
  if (queryParam(req, 'recurso') === 'estudo') return studyHandler(req, res)
  if (!allowMethods(req, res, ['GET']) || !requireAccess(req, res)) return
  try {
    const { data, error } = await getSupabaseAdmin().from('objetivo')
      .select('id,tipo,nome,banca,situacao,data_alvo,materias:materia(id,nome,topicos:topico(id,nome))')
      .eq('ativo', true).order('criado_em')
    if (error) throw error
    data.forEach((objective) => {
      objective.materias?.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      objective.materias?.forEach((subject) => subject.topicos?.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
    })
    return res.status(200).json({ objetivos: data })
  } catch (error) {
    return fail(res, error, 'Nao foi possivel carregar os objetivos.')
  }
}
