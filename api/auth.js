import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { getSupabaseAdmin } from './_lib/supabase.js'
import { allowMethods, clearSessionCookie, enforceRateLimit, fail, readSession, requestFingerprint, setSessionCookie } from './_lib/http.js'

const scrypt = promisify(scryptCallback)
const normalizeHandle = (value) => `@${String(value || '').trim().toLowerCase().replace(/^@+/, '')}`
const validHandle = (value) => /^@[a-z0-9._]{3,30}$/.test(value)

async function passwordHash(password, salt = randomBytes(16).toString('hex')) {
  const derived = await scrypt(String(password), salt, 64)
  return `${salt}:${Buffer.from(derived).toString('hex')}`
}

async function passwordMatches(password, stored) {
  const [salt, expectedHex] = String(stored || '').split(':')
  if (!salt || !expectedHex) return false
  const candidate = Buffer.from((await passwordHash(password, salt)).split(':')[1], 'hex')
  const expected = Buffer.from(expectedHex, 'hex')
  return candidate.length === expected.length && timingSafeEqual(candidate, expected)
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['GET', 'POST', 'DELETE'])) return

  const supabase = getSupabaseAdmin()
  if (req.method === 'POST') {
    if (!process.env.APP_ACCESS_KEY) return res.status(503).json({ error: 'Acesso ainda nao configurado.' })
    const action = req.body?.acao === 'criar_conta' ? 'criar_conta' : 'entrar'
    const handle = normalizeHandle(req.body?.handle)
    const password = String(req.body?.password || '')
    if (!validHandle(handle)) return res.status(400).json({ error: 'Use um @ com 3 a 30 letras, numeros, ponto ou sublinhado.' })
    if (password.length < 8) return res.status(400).json({ error: 'A senha precisa ter pelo menos 8 caracteres.' })

    if (action === 'criar_conta') {
      const existing = await supabase.from('app_usuario').select('id', { count: 'exact', head: true })
      if (existing.error) return fail(res, existing.error, 'Nao foi possivel verificar a conta.')
      if ((existing.count || 0) > 0) return res.status(409).json({ error: 'A conta pessoal ja foi criada. Use Entrar.' })
      const hash = await passwordHash(password)
      const created = await supabase.from('app_usuario').insert({ handle, senha_hash: hash }).select('id,handle').single()
      if (created.error) return fail(res, created.error, 'Nao foi possivel criar a conta.')
      setSessionCookie(res, created.data.id)
      return res.status(201).json({ ok: true, usuario: { handle: created.data.handle } })
    }

    const account = await supabase.from('app_usuario').select('id,handle,senha_hash,ativo').eq('handle', handle).maybeSingle()
    if (account.error) return fail(res, account.error, 'Nao foi possivel validar o acesso.')
    if (!account.data?.ativo || !(await passwordMatches(password, account.data?.senha_hash))) {
      try {
        await enforceRateLimit(supabase, `login:${requestFingerprint(req)}`, 10, 15)
      } catch (error) {
        return fail(res, error, 'Nao foi possivel validar o acesso.')
      }
      return res.status(401).json({ error: 'Arroba ou senha invalidos.' })
    }
    setSessionCookie(res, account.data.id)
    return res.status(200).json({ ok: true, usuario: { handle: account.data.handle } })
  }

  if (req.method === 'DELETE') {
    clearSessionCookie(res)
    return res.status(200).json({ ok: true })
  }

  const session = readSession(req)
  if (!session?.sub) {
    const existing = await supabase.from('app_usuario').select('id', { count: 'exact', head: true })
    if (existing.error) return fail(res, existing.error, 'Nao foi possivel verificar a sessao.')
    return res.status(200).json({ authenticated: false, cadastroDisponivel: (existing.count || 0) === 0 })
  }
  const account = await supabase.from('app_usuario').select('handle,ativo').eq('id', session.sub).maybeSingle()
  if (account.error) return fail(res, account.error, 'Nao foi possivel verificar a sessao.')
  if (!account.data?.ativo) return res.status(200).json({ authenticated: false, cadastroDisponivel: false })
  setSessionCookie(res, session.sub)
  return res.status(200).json({ authenticated: true, usuario: { handle: account.data.handle } })
}

