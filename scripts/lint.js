import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.cwd()
const files = []
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (['node_modules', 'dist', '.git', '.vercel'].includes(entry.name)) continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) await walk(path)
    else if (['.js', '.jsx'].includes(extname(entry.name))) files.push(path)
  }
}
await walk(root)

const failures = []
for (const file of files) {
  const content = await readFile(file, 'utf8')
  const name = relative(root, file)
  if (!name.endsWith('scripts\\lint.js') && !name.endsWith('scripts/lint.js')) {
    if (/sessionStorage|localStorage/.test(content)) failures.push(`${name}: credencial ou estado nao deve depender de storage do navegador`)
    if (/x-app-key/i.test(content)) failures.push(`${name}: cabecalho legado de senha encontrado`)
    if (/VITE_.*(?:KEY|SECRET|TOKEN)/.test(content)) failures.push(`${name}: possivel segredo exposto ao bundle Vite`)
  }
  if (extname(file) === '.js' && !name.startsWith(`src${String.fromCharCode(92)}`)) {
    try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }) }
    catch { failures.push(`${name}: sintaxe JavaScript invalida`) }
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}
console.log(`${files.length} arquivos verificados; nenhum problema estrutural encontrado.`)
