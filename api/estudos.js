import { queryParam } from './_lib/http.js'
import catalogoHandler from './_lib/catalogo-handler.js'
import praticaHandler from './_lib/pratica-handler.js'
import questoesHandler from './_lib/questoes-handler.js'
import revisoesHandler from './_lib/revisoes-handler.js'

const handlers = { catalogo: catalogoHandler, pratica: praticaHandler, questoes: questoesHandler, revisoes: revisoesHandler }

export default function handler(req, res) {
  const selected = handlers[queryParam(req, 'modulo')]
  if (!selected) return res.status(404).json({ error: 'Modulo de estudos nao encontrado.' })
  return selected(req, res)
}
