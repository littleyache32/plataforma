import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods } from './_lib/http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET'])) return

  try {
    const supabase = getSupabaseAdmin()
    const { error } = await supabase.from('materia').select('id', { head: true, count: 'exact' })

    if (error && error.code !== '42P01' && !error.message?.includes('schema cache')) throw error

    return res.status(200).json({
      ok: true,
      service: 'mentor-de-estudos-api',
      database: error ? 'connected-schema-pending' : 'connected',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error(error)
    return res.status(503).json({ ok: false, database: 'unavailable' })
  }
}
