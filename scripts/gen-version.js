import { writeFileSync } from 'fs'
import { execSync } from 'child_process'

// Version unica por build: hash corto de git + fecha. Se sirve en /version.json
let commit = 'nogit'
try {
  commit = execSync('git rev-parse --short HEAD').toString().trim()
} catch {}

const now = new Date()
const pad = n => String(n).padStart(2, '0')
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}.${pad(now.getHours())}${pad(now.getMinutes())}`
const version = `${stamp}-${commit}`

const payload = JSON.stringify({ version, commit, builtAt: now.toISOString() }, null, 2)
writeFileSync('public/version.json', payload)
console.log(`✅ version.json → ${version}`)
