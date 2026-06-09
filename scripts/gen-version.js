import { writeFileSync, readFileSync } from 'fs'
import { execSync } from 'child_process'

// Version legible (v1.0.N) para mostrar + hash de commit para comparar.
// El hash es identico en local y en Netlify para el mismo commit -> deteccion fiable.
let commit = 'nogit'
let count = 0
try { commit = execSync('git rev-parse --short HEAD').toString().trim() } catch {}
try { count = parseInt(execSync('git rev-list --count HEAD').toString().trim(), 10) || 0 } catch {}

// Base major.minor desde package.json (ej "1.0"); patch = numero de commits
let base = '1.0'
try {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
  const parts = String(pkg.version || '1.0.0').split('.')
  base = `${parts[0] || 1}.${parts[1] || 0}`
} catch {}

const label = `v${base}.${count}`

const payload = JSON.stringify({
  version: commit,   // clave de comparacion (hash)
  label,             // texto a mostrar (v1.0.N)
  commit,
  builtAt: new Date().toISOString(),
}, null, 2)

writeFileSync('public/version.json', payload)
console.log(`✅ version.json → ${label} (${commit})`)
