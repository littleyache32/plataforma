const baseUrl = process.env.PLATFORM_URL || 'https://plataforma-three-virid.vercel.app'
if (!process.env.APP_ACCESS_KEY) throw new Error('APP_ACCESS_KEY não configurada.')

const login = await fetch(`${baseUrl}/api/auth`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ password: process.env.APP_ACCESS_KEY }),
})
if (!login.ok) throw new Error(`Login falhou com HTTP ${login.status}.`)
const cookie = login.headers.get('set-cookie')?.split(';')[0]

for (const path of ['/api/catalogo', '/api/sessoes?inicio=2026-08-10&fim=2026-08-16', '/api/mentor', '/api/placar']) {
  const start = performance.now()
  const response = await fetch(`${baseUrl}${path}`, { headers: { cookie } })
  const body = await response.text()
  process.stdout.write(`${JSON.stringify({ path, status: response.status, ms: Math.round(performance.now() - start), bytes: body.length })}\n`)
}
