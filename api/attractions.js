export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { city, duration, stamina } = req.body;
  if (!city) return res.status(400).json({ error: 'City required' });

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const cityKey = city.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const cacheKey = `attractions:${cityKey}`;

  // ── CHECK CACHE ───────────────────────────────────────────────────
  if (redisUrl && redisToken) {
    try {
      const r = await fetch(`${redisUrl}/get/${cacheKey}`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      });
      const d = await r.json();
      if (d.result) {
        console.log(`Cache HIT: ${cacheKey}`);
        return res.status(200).json({ attractions: JSON.parse(d.result), cached: true });
      }
    } catch(e) { console.log('Cache miss:', e.message); }
  }

  // ── GENERATE WITH AI ─────────────────────────────────────────────
  const prompt = `You are a travel expert. For "${city}", list all major attractions worth visiting.

Return ONLY valid JSON, no markdown:
{
  "city": "${city}",
  "categories": [
    {
      "id": "historical",
      "label": "Historical",
      "emoji": "🏛️",
      "attractions": [
        {
          "id": "prague-castle",
          "name": "Prague Castle",
          "description": "One sentence — what makes it special and unmissable",
          "duration_mins": 90,
          "entry_fee": "Free (grounds) / €14 (full circuit)",
          "hours": "6am–10pm daily",
          "free": false,
          "must_see": true,
          "lat": 50.0909,
          "lng": 14.4005,
          "tip": "One insider tip — best time, secret entrance, what to look for"
        }
      ]
    }
  ]
}

Categories to include (only if city has relevant attractions):
- historical (castles, monuments, historic sites)
- art_museums (galleries, art museums)
- culture (theatres, opera, cultural centres)  
- culinary (markets, food halls, famous restaurants, street food)
- nature (parks, gardens, viewpoints, rivers)
- religious (churches, cathedrals, synagogues, mosques)
- quirky (unusual, hidden gems, only-in-this-city experiences)
- shopping (markets, shopping districts — NOT malls)

Rules:
- 5-12 attractions per category, only ones genuinely worth visiting
- duration_mins: realistic time including queues
- entry_fee: specific real prices or "Free"
- free: true only if completely free
- must_see: true for top 5-8 attractions in the entire city
- lat/lng: accurate coordinates
- tip: genuinely useful insider knowledge
- Total attractions: 30-60 depending on city size`;

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    let text = data.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const attractions = JSON.parse(text);

    // Cache for 90 days — attraction data is stable
    if (redisUrl && redisToken) {
      try {
        await fetch(`${redisUrl}/set/${cacheKey}/${encodeURIComponent(JSON.stringify(attractions))}/ex/7776000`, {
          headers: { Authorization: `Bearer ${redisToken}` }
        });
        console.log(`Cached attractions: ${cacheKey}`);
      } catch(e) { console.log('Cache save failed:', e.message); }
    }

    return res.status(200).json({ attractions, cached: false });

  } catch(err) {
    console.error('Attractions error:', err);
    return res.status(500).json({ error: err.message || 'Failed to load attractions' });
  }
}
