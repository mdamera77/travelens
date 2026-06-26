export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, city } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  const source = url.includes('guruwalk') ? 'GuruWalk' :
                 url.includes('freetour') ? 'FreeTour' :
                 url.includes('getyourguide') ? 'GetYourGuide' :
                 url.includes('freetoursbyfoot') ? 'FreeToursByFoot' :
                 url.includes('viator') ? 'Viator' : 'Tour Site';

  // Try to fetch the page — some sites block this
  let pageContent = '';
  let fetchBlocked = false;
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.google.com/'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (response.ok) {
      const html = await response.text();
      pageContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .substring(0, 8000);
    } else {
      fetchBlocked = true;
    }
  } catch(e) {
    fetchBlocked = true;
  }

  // Build context — use page content if available, otherwise use URL + Claude knowledge
  const contextSection = pageContent
    ? `Page content extracted:\n${pageContent}`
    : `The page could not be fetched (site blocks server requests). 
Use your knowledge of this specific ${source} tour URL to identify the tour and its stops.
URL: ${url}
City: ${city}

For GuruWalk tours, extract the numbered itinerary stops (1-15+) in order.
For FreeTour tours, extract the bullet-pointed highlights in order.
Use your training knowledge of these specific tours if you know them.
If you don't know this specific tour, create a realistic list of stops based on the URL slug and city.`;

  const prompt = `You are a travel expert extracting tour information.

Source: ${source}
URL: ${url}
City: ${city || 'unknown'}

${contextSection}

CRITICAL RULES:
1. Extract or infer stops in the correct touring ORDER
2. Use exact landmark/location names
3. Include ALL stops — GuruWalk tours typically have 10-15 stops
4. The meeting point is highlights[0]
5. If page was blocked, use the URL slug to identify the tour theme and generate realistic stops for that area of ${city}
6. Return at least 8 stops, up to 15+

Respond ONLY with valid JSON, no markdown, no code fences:

{
  "title": "tour name",
  "source": "${source}",
  "duration": "2-3 hours",
  "price": "Free (tips welcome)",
  "meeting_point": "meeting point location",
  "description": "2-3 sentence description of what this tour covers",
  "highlights": ["Stop 1", "Stop 2", "Stop 3", "Stop 4", "Stop 5", "Stop 6", "Stop 7", "Stop 8", "...all stops"],
  "url": "${url}",
  "note": "stops extracted"
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    let text = data.content?.[0]?.text || '{}';
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(text);

    // Add a note to UI if stops were inferred
    if (fetchBlocked) {
      parsed.fetchBlocked = true;
    }

    seedPastedTour(parsed, city || 'unknown'); // Auto-save to DB
    res.status(200).json({ tour: parsed });

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}

// Auto-seed: save user-pasted tours to the database
async function seedPastedTour(tour, city) {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!redisUrl || !redisToken || !tour?.highlights?.length) return;

  const cityKey = city.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const source = (tour.source || 'user').toLowerCase().replace(/[^a-z0-9]/g, '-');
  const key = `tours-db:${cityKey}:user-${source}-${Date.now()}`;

  try {
    await fetch(`${redisUrl}/set/${key}/${encodeURIComponent(JSON.stringify({ ...tour, city }))}/ex/7776000`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });
    console.log(`Auto-seeded user tour for ${city}: ${tour.title}`);
  } catch(e) {
    console.log('Auto-seed failed (non-critical):', e.message);
  }
}
