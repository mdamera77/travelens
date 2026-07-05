export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  const { city } = req.query;
  if (!city) return res.status(400).json({ error: 'city query param required' });

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  const cityKey = city.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const key = `daytrips-db:${cityKey}`;

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (!redisUrl || !redisToken) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  try {
    const cacheRes = await fetch(`${redisUrl}/get/${key}`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });
    const data = await cacheRes.json();

    if (!data.result) {
      return res.status(200).json({ city: cityKey, trips: [] });
    }

    const trips = JSON.parse(data.result);
    return res.status(200).json({ city: cityKey, trips });

  } catch (err) {
    console.log('get-daytrips failed:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to load day trips' });
  }
}
