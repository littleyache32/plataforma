import { queryParam } from './_lib/http.js'
import materiaisHandler from './_lib/materiais-handler.js'
import panelHandler from './_lib/painel-handler.js'
import seedHandler from './_lib/seed-handler.js'

const handlers = { materiais: materiaisHandler, painel: panelHandler, seed: seedHandler }

export default function handler(req, res) {
  const selected = handlers[queryParam(req, 'modulo')]
  if (!selected) return res.status(404).json({ error: 'Modulo administrativo nao encontrado.' })
  return selected(req, res)
}
