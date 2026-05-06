export default async (req) => {
  if (req.method !== 'POST') {
    return { statusCode: 405, body: 'Method not allowed' }
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
      body: JSON.stringify(JSON.parse(req.body)),
    })

    const data = await res.json()
    return {
      statusCode: res.status,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message }),
    }
  }
}
