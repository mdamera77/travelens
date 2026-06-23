export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url, city } = req.body;
  if (!url) return res.status(400).json({ error: 'URL required' });

  // Try to fetch the page
  let pageContent = '';
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
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
        .substring(0, 6000);
    }
  } catch(e) {
    pageContent = '';
  }

  const source = url.includes('guruwalk') ? 'GuruWalk' :
                 url.includes('freetour') ? 'FreeTour' :
                 url.includes('getyourguide') ? 'GetYourGuide' :
                 url.includes('freetoursbyfoot') ? 'FreeToursByFoot' :
                 url.includes('viator') ? 'Viator' : 'Tour Site';

  const prompt = `You are a travel expert extracting tour information from a webpage.

Source: ${source}
URL: ${url}
City: ${city || 'unknown'}

${pageContent ? `Page content:
${pageContent}` : `Could not fetch page. Use your knowledge of ${source} tours in ${city}.`}

Extract the walking tour details. 

CRITICAL RULES for highlights/stops:
1. Extract stops in the EXACT ORDER they appear on the page — do NOT reorder for walking efficiency
2. Use the EXACT names as written on the page — do not paraphrase or rename
3. The first stop listed on the page must be highlights[0]
4. Include ALL stops mentioned, even minor ones
5. The meeting point (if mentioned) should be highlights[0]

Respond ONLY with valid JSON, no markdown:

{
  "title": "exact tour name from page",
  "source": "${source}",
  "duration": "X hours",
  "price": "Free (tips welcome)",
  "meeting_point": "exact meeting point location if mentioned",
  "description": "2-3 sentence description",
  "highlights": ["First stop exactly as listed", "Second stop exactly as listed", "Third stop", "...all stops in page order"],
  "url": "${url}"
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
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    let text = data.content?.[0]?.text || '{}';
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(text);
    res.status(200).json({ tour: parsed });

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
