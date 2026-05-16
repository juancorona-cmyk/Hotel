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

export function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const reader = new FileReader()
    reader.onload = (e) => {
      img.onload = () => {
        const MAX = 1400
        let w = img.width, h = img.height
        if (w > MAX) { h = Math.round(h * MAX / w); w = MAX }
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}
