import { allowMethods, authenticate, clearSessionCookie, requireAccess, setSessionCookie } from './_lib/http.js'

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'DELETE'])) return

  if (req.method === 'POST') {
    if (!process.env.APP_ACCESS_KEY) return res.status(503).json({ error: 'Acesso ainda nao configurado.' })
    if (!authenticate(req.body?.password)) return res.status(401).json({ error: 'Senha invalida.' })
    setSessionCookie(res)
    return res.status(200).json({ ok: true })
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(res)
    return res.status(200).json({ ok: true })
  }

  if (!requireAccess(req, res)) return
  return res.status(200).json({ authenticated: true })
}

