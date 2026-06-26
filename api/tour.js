export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { city, hotel, dates, vibes, stamina, tourContext } = req.body;
  if (!city) return res.status(400).json({ error: 'City is required' });

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  // Build cache key from tour parameters
  const cacheKey = `tour:${city.toLowerCase().replace(/[^a-z0-9]/g,'-')}:${
    tourContext?.title ? tourContext.title.toLowerCase().replace(/[^a-z0-9]/g,'-').substring(0,30) : 
    `${(vibes||'').substring(0,20)}-${stamina||'half'}-${hotel||'centre'}`.toLowerCase().replace(/[^a-z0-9]/g,'-')
  }`;

  // ── CHECK CACHE FIRST ────────────────────────────────────────────
  if (redisUrl && redisToken) {
    try {
      const cacheRes = await fetch(`${redisUrl}/get/${cacheKey}`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      });
      const cached = await cacheRes.json();
      if (cached.result) {
        console.log(`Cache HIT for tour: ${cacheKey}`);
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).json({ tour: cached.result, cached: true });
      }
    } catch(e) {
      console.log('Cache check failed, generating fresh:', e.message);
    }
  }

  // ── GENERATE WITH AI ─────────────────────────────────────────────
  const stopInstruction = tourContext?.highlights?.length
    ? `CRITICAL — You MUST follow EXACTLY these stops in EXACTLY this order. Do NOT add, remove, skip, rename, or reorder any stop:
${tourContext.highlights.map((s, i) => `STOP ${i + 1}: ${s}`).join('\n')}

Total stops: ${tourContext.highlights.length}. Cover every single one.`
    : `Build 6-8 interesting stops for ${city} starting near ${hotel || 'city centre'}.`;

  const tourInfo = tourContext
    ? `Real tour selected: "${tourContext.title}" from ${tourContext.source}`
    : `AI-generated tour for ${city}`;

  const prompt = `You are Travelens, a brilliant local guide AI.

${tourInfo}
City: ${city}
Starting point: ${hotel || 'city centre'}
Dates: ${dates || 'upcoming trip'}
Interests: ${vibes || 'history, food, hidden gems'}
Stamina: ${stamina || 'half-day'}

${stopInstruction}

RETURN EXACTLY THIS FORMAT — no markdown, no asterisks, no extra commentary:

STOP 1: [Stop name] | [Time e.g. 09:00]
[2-3 sentence description — what they see, feel, experience]
TIDBITS
- [Surprising specific fact with real names, dates, human stories]
- [Something sensory or visual most visitors miss]
- [Local secret or moving anecdote]
WALK: [Specific walking direction and time to next stop]

STOP 2: [Stop name] | [Time]
[Description]
TIDBITS
- [Tidbit]
- [Tidbit]
- [Tidbit]
WALK: [Direction]

[Continue for ALL stops]

TIP: [Practical tip — opening times, what to bring, where to eat]
TIP: [One local secret that transforms the experience]

Rules:
- Tidbits must be genuinely surprising — specific, human, unexpected
- Make people say "I had no idea"
- Walk directions must be specific with street names and minutes`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 6000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    const tourText = data.content?.[0]?.text || '';

    // ── SAVE TO CACHE (90 days) ──────────────────────────────────
    if (redisUrl && redisToken && tourText) {
      try {
        await fetch(`${redisUrl}/set/${cacheKey}/${encodeURIComponent(tourText)}/ex/7776000`, {
          headers: { Authorization: `Bearer ${redisToken}` }
        });
        console.log(`Cached tour: ${cacheKey}`);
      } catch(e) {
        console.log('Cache save failed (non-critical):', e.message);
      }
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ tour: tourText, cached: false });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Tour generation failed' });
  }
}
