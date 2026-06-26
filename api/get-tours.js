export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { city } = req.body;
  if (!city) return res.status(400).json({ error: 'City required' });

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const cityKey = city.toLowerCase().replace(/[^a-z0-9]/g, '-');

  // Theme names must match seed-cities.js key format exactly
  // "Art & Architecture" → "art---architecture" (replace(/[^a-z0-9]/g,'-'))
  const THEMES = [
    'Classic Highlights',
    'Hidden Gems & Local Life',
    'Art & Architecture',
    'Food & Markets',
    'History & Culture'
  ];

  // ── CHECK THEMED KEYS (from seed-cities) ─────────────────────────
  if (redisUrl && redisToken) {
    const tours = [];
    for (const theme of THEMES) {
      const themeKey = theme.toLowerCase().replace(/[^a-z0-9]/g, '-');
      try {
        const r = await fetch(`${redisUrl}/get/tours-db:${cityKey}:${themeKey}`, {
          headers: { Authorization: `Bearer ${redisToken}` }
        });
        const d = await r.json();
        if (d.result) tours.push(JSON.parse(d.result));
      } catch(e) {}
    }
    if (tours.length > 0) {
      return res.status(200).json({ tours, cached: true });
    }

    // ── CHECK OLD tours: KEY ────────────────────────────────────────
    try {
      const r = await fetch(`${redisUrl}/get/tours:${cityKey}`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      });
      const d = await r.json();
      if (d.result) {
        const oldTours = JSON.parse(d.result);
        if (oldTours?.length) return res.status(200).json({ tours: oldTours, cached: true });
      }
    } catch(e) {}
  }

  // ── GENERATE FRESH ────────────────────────────────────────────────
  const prompt = `You are a travel expert. For "${city}", provide 5 popular free walking tours — one per theme: Classic Highlights, Hidden Gems & Local Life, Art & Architecture, Food & Markets, History & Culture.

Respond ONLY with a valid JSON array, no markdown:
[
  {
    "title": "specific tour name",
    "source": "GuruWalk",
    "sourceColor": "#FF6B35",
    "duration": "2.5 hours",
    "price": "Free (tips welcome)",
    "rating": "4.8",
    "reviews": "134",
    "meeting_point": "specific real location with address",
    "description": "2-3 sentences about this tour",
    "highlights": ["Stop 1", "Stop 2", "Stop 3", "Stop 4", "Stop 5", "Stop 6", "Stop 7", "Stop 8"],
    "themes": ["classic-highlights"],
    "url": "https://www.guruwalk.com/walks/${cityKey}"
  }
]

One tour per theme. Use themes array values: classic-highlights, hidden-gems-&-local-life, art-&-architecture, food-&-markets, history-&-culture.
Sources: GuruWalk (#FF6B35), FreeTour (#2196F3), FreeToursByFoot (#4CAF50), GetYourGuide (#FF5722). Real landmarks only.`;

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
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await resp.json();
    if (data.error) throw new Error(data.error.message);

    let text = data.content[0].text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
    const freshTours = JSON.parse(text).map(t => ({ ...t, city }));

    // Save each tour under its themed key
    if (redisUrl && redisToken) {
      for (const tour of freshTours) {
        const theme = tour.themes?.[0] || 'classic-highlights';
        const themeKey = theme.toLowerCase().replace(/[^a-z0-9]/g, '-');
        const key = `tours-db:${cityKey}:${themeKey}`;
        try {
          await fetch(`${redisUrl}/set/${key}/${encodeURIComponent(JSON.stringify(tour))}/ex/7776000`, {
            headers: { Authorization: `Bearer ${redisToken}` }
          });
        } catch(e) {}
      }
    }

    return res.status(200).json({ tours: freshTours, cached: false });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
