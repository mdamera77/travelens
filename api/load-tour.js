export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'ID required' });

  const key = `share:${id}`;
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  try {
    const cacheRes = await fetch(`${redisUrl}/get/${key}`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });
    const data = await cacheRes.json();
    if (!data.result) return res.status(404).json({ error: 'Tour not found or expired' });
    return res.status(200).json(JSON.parse(data.result));
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
