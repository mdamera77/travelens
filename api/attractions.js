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
  const prompt = `You are a travel expert. For "${city}", list major attractions worth visiting.

Return ONLY valid JSON, no markdown, no trailing commas:
{
  "city": "${city}",
  "categories": [
    {
      "id": "historical",
      "label": "Historical",
      "emoji": "🏛️",
      "attractions": [
        {
          "id": "unique-slug",
          "name": "Attraction Name",
          "description": "One short sentence — what makes it special",
          "duration_mins": 60,
          "entry_fee": "Free or €12",
          "hours": "9am–6pm",
          "free": false,
          "must_see": true,
          "tip": "One short insider tip"
        }
      ]
    }
  ]
}

Include these categories (only if relevant for ${city}):
- historical · art_museums · culinary · nature · religious · quirky

Rules:
- MAX 6 attractions per category
- MAX 5 categories
- description: ONE sentence only, under 15 words
- tip: ONE sentence only, under 15 words  
- hours: short format only e.g. "9am–6pm daily"
- entry_fee: price only e.g. "Free" or "€12" or "€8–18"
- must_see: true for top 6 attractions total across all categories
- Total attractions: 20-30 maximum
- Keep ALL strings SHORT to avoid response truncation`;

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
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    let text = data.content[0].text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    // Safety net — if JSON is truncated, try to recover by closing it
    let attractions;
    try {
      attractions = JSON.parse(text);
    } catch(parseErr) {
      // Try to salvage truncated JSON by finding last complete attraction
      const lastComplete = text.lastIndexOf('},');
      if (lastComplete > 0) {
        const truncated = text.substring(0, lastComplete + 1) + ']}]}';
        try {
          attractions = JSON.parse(truncated);
          console.log('Recovered truncated JSON');
        } catch(e2) {
          throw new Error('JSON truncated and unrecoverable — try again');
        }
      } else {
        throw parseErr;
      }
    }

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
