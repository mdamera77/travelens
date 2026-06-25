export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { city } = req.body;
  if (!city) return res.status(400).json({ error: 'City required' });

  const cacheKey = `tours:${city.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;

  // ── STEP 1: Check Upstash cache first ─────────────────────────
  try {
    const cacheRes = await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/get/${cacheKey}`, {
      headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}` }
    });
    const cacheData = await cacheRes.json();
    if (cacheData.result) {
      const tours = JSON.parse(cacheData.result);
      console.log(`Cache HIT for ${city} — ${tours.length} tours`);
      return res.status(200).json({ tours, cached: true });
    }
    console.log(`Cache MISS for ${city} — generating...`);
  } catch(e) {
    console.log('Cache check failed, generating fresh:', e.message);
  }

  // ── STEP 2: Generate tours with Claude ────────────────────────
  const prompt = `You are a travel expert. For the city "${city}", provide the 5 most popular and highly-rated free or low-cost walking tours available on GuruWalk, FreeTour.com, FreeToursByFoot, and GetYourGuide.

Provide REAL, accurate information about tours that genuinely exist on these platforms.

Respond ONLY with a valid JSON array, no markdown, no code fences:

[
  {
    "title": "exact tour name as it appears on the site",
    "source": "GuruWalk",
    "sourceColor": "#FF6B35",
    "duration": "2.5 hours",
    "price": "Free (tips welcome)",
    "rating": "4.9",
    "reviews": "234",
    "meeting_point": "exact meeting point with street address",
    "description": "2-3 sentences describing what makes this tour special and what you will see",
    "highlights": ["Stop 1", "Stop 2", "Stop 3", "Stop 4", "Stop 5", "Stop 6", "Stop 7", "Stop 8", "Stop 9", "Stop 10"],
    "themes": ["history", "architecture"],
    "url": "realistic URL to the tour page"
  }
]

Rules:
- Use sources: GuruWalk (#FF6B35), FreeTour (#2196F3), FreeToursByFoot (#4CAF50), GetYourGuide (#FF5722)
- Include tours from at least 3 different sources
- highlights must be ACTUAL stops in ACTUAL walking order — 8 to 15 real landmarks
- meeting_point must be a specific real location with address
- themes: choose from history, architecture, food, hidden-gems, dark-history, jewish-quarter, communism, art, nature, royal
- rating between 4.5 and 5.0, reviews between 50 and 500
- Vary the tour themes — history, food, dark history, hidden gems, etc.
- Return exactly 5 tours`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const claudeData = await claudeRes.json();
    if (claudeData.error) throw new Error(claudeData.error.message);

    let text = claudeData.content[0].text;
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const tours = JSON.parse(text);

    // Add city to each tour
    const toursWithCity = tours.map(t => ({ ...t, city }));

    // ── STEP 3: Save to Upstash (cache for 30 days) ─────────────
    try {
      await fetch(`${process.env.UPSTASH_REDIS_REST_URL}/set/${cacheKey}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: JSON.stringify(toursWithCity),
          ex: 60 * 60 * 24 * 30 // 30 days in seconds
        })
      });
      console.log(`Saved ${toursWithCity.length} tours for ${city} to cache`);
    } catch(e) {
      console.log('Cache save failed (non-critical):', e.message);
    }

    return res.status(200).json({ tours: toursWithCity, cached: false });

  } catch(err) {
    console.error('Tour generation failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
