export const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre']

export function fmtFecha(s, withYear = false) {
  if (!s) return ''
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return s
  const base = `${parseInt(m[3])} de ${MESES[parseInt(m[2]) - 1]}`
  return withYear ? `${base} ${m[1]}` : base
}

export function fmtHora(s) {
  if (!s) return ''
  const m = s.match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return s
  const h = parseInt(m[1])
  return `${h % 12 || 12}:${m[2]} ${h >= 12 ? 'pm' : 'am'}`
}

export function isValidPhone(raw) {
  const digits = raw.replace(/[\s\-().+]/g, '')
  if (raw.trim().startsWith('+')) return /^\+\d{7,15}$/.test(raw.trim().replace(/[\s\-().]/g, ''))
  if (/^[2-9]\d{9}$/.test(digits)) return true
  if (/^\d{7}$/.test(digits)) return true
  return false
}
