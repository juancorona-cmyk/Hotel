export default async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const BASE = process.env.VITE_TURSO_URL
  const TOKEN = process.env.VITE_TURSO_TOKEN

  try {
    const res = await fetch(`${BASE}/v2/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: req.body,
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Turso proxy error:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
