export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { city, text, stops, source, title } = req.body;
    if (!city || !text) return res.status(400).json({ error: 'City and text required' });

    const id = Math.random().toString(36).substring(2, 6) + Math.random().toString(36).substring(2, 6);
    const key = `share:${id}`;
    const payload = JSON.stringify({
      city,
      text,
      stops: stops || [],
      source: source || 'AI Tour',
      title: title || `${city} Walking Tour`,
      savedAt: new Date().toISOString()
    });

    const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

    if (!redisUrl || !redisToken) {
      return res.status(500).json({ error: 'Redis not configured' });
    }

    // Upstash REST API: SET key value EX seconds
    const saveRes = await fetch(`${redisUrl}/set/${key}/${encodeURIComponent(payload)}/ex/7776000`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${redisToken}` }
    });

    if (!saveRes.ok) {
      const errText = await saveRes.text();
      return res.status(500).json({ error: 'Failed to save: ' + errText });
    }

    return res.status(200).json({ id, shortUrl: `/?t=${id}` });

  } catch(err) {
    console.error('save-tour error:', err);
    return res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
