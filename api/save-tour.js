export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { city, text, stops, source, title } = req.body;
  if (!city || !text) return res.status(400).json({ error: 'City and text required' });

  // Generate short 8-char ID
  const id = Math.random().toString(36).substring(2, 6) + Math.random().toString(36).substring(2, 6);
  const key = `share:${id}`;

  const payload = JSON.stringify({ city, text, stops, source, title, savedAt: new Date().toISOString() });

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  try {
    await fetch(`${redisUrl}/set/${key}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${redisToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        value: payload,
        ex: 60 * 60 * 24 * 90 // 90 days
      })
    });
    return res.status(200).json({ id, shortUrl: `/?t=${id}` });
  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
