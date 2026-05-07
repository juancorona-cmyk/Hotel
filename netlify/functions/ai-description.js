const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const KEY = process.env.OPENAI_API_KEY
  if (!KEY) return new Response(JSON.stringify({ error: 'No API key' }), { status: 500, headers: CORS })

  try {
    const { name, price, date, maxLen = 200 } = await req.json()

    const detalles = [
      name  && `Actividad/Evento: ${name}`,
      price > 0 && `Precio: $${price}`,
      date  && `Fecha: ${date}`,
    ].filter(Boolean).join('. ')

    const prompt = `Eres el redactor oficial de Hotel Punta Galería, hotel boutique ubicado en Morelia, Michoacán, México. Tu único trabajo es escribir una frase corta (máximo ${maxLen} caracteres) que INVITE a la gente a registrarse al evento del hotel. Reglas estrictas:
- Habla siempre del hotel (no de otra ciudad, lugar ni establecimiento)
- El hotel está en Morelia, Michoacán — NUNCA menciones mar, playa, costa ni océano
- Tono cálido, entusiasta y personal — como si hablaras directamente al huésped
- Usa verbos de invitación: "únete", "ven", "vívelo", "no te lo pierdas", "reserva tu lugar"
- Menciona el hotel o el ambiente del hotel si encaja
- NO uses comillas, hashtags ni emojis
- Solo responde con la descripción, nada más

Datos del evento: ${detalles}`

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 120,
        temperature: 0.85,
      }),
    })

    const data = await res.json()
    const description = (data.choices?.[0]?.message?.content ?? '').trim().slice(0, maxLen)
    return new Response(JSON.stringify({ description }), { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS })
  }
}
