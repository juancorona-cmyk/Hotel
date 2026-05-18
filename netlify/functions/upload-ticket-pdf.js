const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS })

  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey    = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) {
    return new Response(JSON.stringify({ error: 'Cloudinary no configurado' }), { status: 500, headers: CORS })
  }

  let body
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'JSON inválido' }), { status: 400, headers: CORS })
  }

  const { pdfBase64, registrationId, eventName } = body
  if (!pdfBase64) return new Response(JSON.stringify({ error: 'Sin PDF' }), { status: 400, headers: CORS })

  try {
    const slug = (eventName ?? 'general')
      .toLowerCase()
      .replace(/[áàäâã]/g, 'a').replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i').replace(/[óòöôõ]/g, 'o')
      .replace(/[úùüû]/g, 'u').replace(/ñ/g, 'n')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general'

    const folder    = `hotel/tickets/${slug}`
    const publicId  = `ticket_${registrationId ?? 'x'}_${Math.round(Date.now() / 1000)}`
    const timestamp = String(Math.round(Date.now() / 1000))

    const { createHash } = await import('crypto')
    const toSign    = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`
    const signature = createHash('sha256').update(toSign).digest('hex')

    const params = new URLSearchParams()
    params.set('file',      pdfBase64)
    params.set('api_key',   apiKey)
    params.set('timestamp', timestamp)
    params.set('signature', signature)
    params.set('folder',    folder)
    params.set('public_id', publicId)

    // raw/upload para archivos no-imagen (PDF)
    const cdnRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/raw/upload`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    params.toString(),
      }
    )

    const data = await cdnRes.json()
    if (!data.secure_url) {
      return new Response(JSON.stringify({ error: data.error?.message ?? JSON.stringify(data) }), { status: 500, headers: CORS })
    }

    return new Response(
      JSON.stringify({ url: data.secure_url }),
      { status: 200, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: CORS })
  }
}
