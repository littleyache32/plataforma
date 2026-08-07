export function allowMethods(req, res, methods) {
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '))
    res.status(405).json({ error: 'Metodo nao permitido.' })
    return false
  }
  return true
}

export function requireAccess(req, res) {
  const expected = process.env.APP_ACCESS_KEY
  if (!expected) {
    res.status(503).json({ error: 'APP_ACCESS_KEY nao configurada.' })
    return false
  }

  if (req.headers['x-app-key'] !== expected) {
    res.status(401).json({ error: 'Chave de acesso invalida.' })
    return false
  }
  return true
}

export function fail(res, error, fallback = 'Erro interno.') {
  console.error(error)
  return res.status(500).json({ error: fallback })
}

