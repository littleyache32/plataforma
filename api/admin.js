import { fail, queryParam } from './_lib/http.js'

const handlers = {
  materiais: () => import('./_lib/materiais-handler.js'),
  painel: () => import('./_lib/painel-handler.js'),
  seed: () => import('./_lib/seed-handler.js'),
  edital: () => import('./_lib/edital-handler.js'),
}

export default async function handler(req, res) {
  const load = handlers[queryParam(req, 'modulo')]
  if (!load) return res.status(404).json({ error: 'Modulo administrativo nao encontrado.' })
  try {
    const selected = await load()
    return selected.default(req, res)
  } catch (error) {
    return fail(res, error, 'Nao foi possivel carregar o modulo administrativo.')
  }
}
