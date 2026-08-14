import { describe, expect, it } from 'vitest'
import { createSessionToken, requestFingerprint, verifySessionToken } from '../api/_lib/http.js'

describe('sessao assinada', () => {
  it('aceita token autentico dentro da validade', () => {
    const token = createSessionToken('segredo-forte', 1_000_000)
    expect(verifySessionToken(token, 'segredo-forte', 1_000_001)).toBe(true)
  })
  it('rejeita token alterado, segredo diferente e expiracao', () => {
    const token = createSessionToken('segredo-forte', 1_000_000)
    expect(verifySessionToken(`${token}x`, 'segredo-forte', 1_000_001)).toBe(false)
    expect(verifySessionToken(token, 'outro-segredo', 1_000_001)).toBe(false)
    expect(verifySessionToken(token, 'segredo-forte', 1_000_000 + 13 * 60 * 60 * 1000)).toBe(false)
  })

  it('anonimiza o endereco usado no limite de tentativas de login', () => {
    const req = { headers: { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' } }
    expect(requestFingerprint(req)).toMatch(/^[a-f0-9]{16}$/)
    expect(requestFingerprint(req)).toBe(requestFingerprint(req))
    expect(requestFingerprint(req)).not.toContain('203.0.113.10')
  })
})
