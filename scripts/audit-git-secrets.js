import { execFileSync } from 'node:child_process'

const history = execFileSync('git', ['log', '-p', '--all', '--full-history', '--', '.'], {
  encoding: 'utf8',
  maxBuffer: 512 * 1024 * 1024,
})

const rules = [
  ['google_api_key', /AIza[0-9A-Za-z_-]{35}/],
  ['jwt', /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],
  ['secret_assignment', /(GEMINI_API_KEY|SUPABASE_SERVICE_ROLE_KEY|APP_ACCESS_KEY)\s*=\s*([^\s'"<>]{8,})/],
]
const ignoredValues = /(sua_|exemplo|placeholder|test|segredo|change-me|xxx)/i
const findings = []
let commit = ''
let file = ''

for (const line of history.split(/\r?\n/)) {
  if (line.startsWith('commit ')) commit = line.slice(7, 19)
  else if (line.startsWith('+++ b/')) file = line.slice(6)
  else if (line.startsWith('+') && !line.startsWith('+++')) {
    for (const [rule, pattern] of rules) {
      const match = line.match(pattern)
      if (!match) continue
      const value = match[2] || match[0]
      if (!ignoredValues.test(value)) findings.push({ rule, commit, file })
    }
  }
}

const uniqueFindings = [...new Map(findings.map((finding) => [JSON.stringify(finding), finding])).values()]
if (uniqueFindings.length) {
  console.error(JSON.stringify({ findings: uniqueFindings }, null, 2))
  process.exitCode = 1
} else {
  const commits = execFileSync('git', ['rev-list', '--all', '--count'], { encoding: 'utf8' }).trim()
  console.log(`${commits} commits verificados; nenhum segredo reconhecivel encontrado.`)
}
