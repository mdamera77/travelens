// GET /api/get-trip?id={tripId}
// Loads a saved multi-day trip by its short ID.

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id query param required' });

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  const key = `trip:${id}`;

  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const cacheRes = await fetch(`${redisUrl}/get/${key}`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });
    const data = await cacheRes.json();

    if (!data.result) {
      return res.status(404).json({ error: 'trip not found or expired' });
    }

    const trip = JSON.parse(data.result);
    return res.status(200).json({ tripId: id, trip });

  } catch (err) {
    console.log('get-trip failed:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to load trip' });
  }
}
