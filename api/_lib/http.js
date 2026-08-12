import { createHmac, timingSafeEqual } from 'node:crypto'
import { getSupabaseAdmin } from './supabase.js'

const COOKIE_NAME = 'mentor_session'
const SESSION_SECONDS = 60 * 60 * 12

export function allowMethods(req, res, methods) {
  if (!methods.includes(req.method)) {
    res.setHeader('Allow', methods.join(', '))
    res.status(405).json({ error: 'Metodo nao permitido.' })
    return false
  }
  return true
}

export function queryParam(req, name) {
  return new URL(req.url, 'https://mentor-estudos.local').searchParams.get(name) || ''
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''))
  const b = Buffer.from(String(right || ''))
  return a.length === b.length && timingSafeEqual(a, b)
}

function signature(payload, secret) {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function createSessionToken(secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(now / 1000) + SESSION_SECONDS })).toString('base64url')
  return `${payload}.${signature(payload, secret)}`
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (!token || !secret) return false
  const [payload, receivedSignature] = String(token).split('.')
  if (!payload || !receivedSignature || !safeEqual(receivedSignature, signature(payload, secret))) return false
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return Number(data.exp) > Math.floor(now / 1000)
  } catch {
    return false
  }
}

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || '').split(';')
  const item = cookies.find((cookie) => cookie.trim().startsWith(`${name}=`))
  return item ? decodeURIComponent(item.trim().slice(name.length + 1)) : ''
}

export function authenticate(password) {
  return safeEqual(password, process.env.APP_ACCESS_KEY)
}

export function setSessionCookie(res) {
  const secret = process.env.APP_ACCESS_KEY
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${createSessionToken(secret)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_SECONDS}${secure}`)
}

export function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`)
}

export function requireAccess(req, res) {
  const secret = process.env.APP_ACCESS_KEY
  if (!secret) {
    res.status(503).json({ error: 'APP_ACCESS_KEY nao configurada.' })
    return false
  }
  if (!verifySessionToken(cookieValue(req, COOKIE_NAME), secret)) {
    res.status(401).json({ error: 'Sessao ausente ou expirada.' })
    return false
  }
  return true
}

export async function enforceRateLimit(supabase, action, limit, windowMinutes) {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString()
  const { count, error } = await supabase.from('uso_api').select('id', { count: 'exact', head: true }).eq('acao', action).gte('criado_em', since)
  if (error) throw error
  if ((count || 0) >= limit) {
    const error = new Error(`Limite de ${limit} chamadas em ${windowMinutes} minutos atingido.`)
    error.statusCode = 429
    throw error
  }
  const { error: insertError } = await supabase.from('uso_api').insert({ acao: action })
  if (insertError) throw insertError
}

export async function fail(res, error, fallback = 'Erro interno.') {
  console.error(error)
  try {
    await getSupabaseAdmin().from('sistema_falha').insert({ origem: fallback, mensagem: String(error?.message || fallback).slice(0, 500), detalhe: String(error?.stack || '').slice(0, 4000) || null })
  } catch { /* o monitoramento nao pode ocultar a falha original */ }
  return res.status(error?.statusCode || 500).json({ error: error?.statusCode ? error.message : fallback })
}
