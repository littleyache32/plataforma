import { queryParam } from './_lib/http.js'
import placarHandler from './_lib/placar-handler.js'
import simuladosHandler from './_lib/simulados-handler.js'

const handlers = { placar: placarHandler, simulados: simuladosHandler }

export default function handler(req, res) {
  const selected = handlers[queryParam(req, 'modulo')]
  if (!selected) return res.status(404).json({ error: 'Modulo de desempenho nao encontrado.' })
  return selected(req, res)
}
