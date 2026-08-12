import { queryParam } from './_lib/http.js'
import objetivosHandler from './_lib/objetivos-handler.js'
import sessoesHandler from './_lib/sessoes-handler.js'

const handlers = { objetivos: objetivosHandler, sessoes: sessoesHandler }

export default function handler(req, res) {
  const selected = handlers[queryParam(req, 'modulo')]
  if (!selected) return res.status(404).json({ error: 'Modulo de planejamento nao encontrado.' })
  return selected(req, res)
}
