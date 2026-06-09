// Politica de contraseña: minimo 8, con letra Y numero (no solo numeros, no solo letras),
// sin espacios. Devuelve { ok, message, score } (score 0-4 para medidor).
export function checkPasswordStrength(pwd = '') {
  const p = String(pwd)
  if (p.length < 8) return { ok: false, message: 'Mínimo 8 caracteres', score: 0 }
  if (/\s/.test(p)) return { ok: false, message: 'Sin espacios', score: 0 }
  if (/^\d+$/.test(p)) return { ok: false, message: 'No puede ser solo números', score: 1 }
  if (/^[a-zA-Z]+$/.test(p)) return { ok: false, message: 'Agrega al menos un número', score: 1 }
  if (!/[a-zA-Z]/.test(p) || !/\d/.test(p)) return { ok: false, message: 'Combina letras y números', score: 1 }

  let score = 2
  if (p.length >= 12) score++
  if (/[^a-zA-Z0-9]/.test(p)) score++ // simbolo
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score = Math.min(4, score + 1)

  const label = score >= 4 ? 'Muy fuerte' : score === 3 ? 'Fuerte' : 'Aceptable'
  return { ok: true, message: label, score: Math.min(4, score) }
}
