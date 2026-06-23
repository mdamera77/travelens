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
      // Strip HTML tags and extract readable text
      pageContent = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .substring(0, 4000);
    }
  } catch(e) {
    // Page fetch failed — use URL + city context only
    pageContent = '';
  }

  // Detect source from URL
  const source = url.includes('guruwalk') ? 'GuruWalk' :
                 url.includes('freetour') ? 'FreeTour' :
                 url.includes('getyourguide') ? 'GetYourGuide' :
                 url.includes('freetoursbyfoot') ? 'FreeToursByFoot' :
                 url.includes('viator') ? 'Viator' : 'Tour Site';

  const prompt = `You are a travel expert extracting tour information.

Source: ${source}
URL: ${url}
City context: ${city || 'unknown'}

${pageContent ? `Page content extracted from the URL:
${pageContent}` : `Could not fetch page content. Use your knowledge of ${source} tours in ${city} to extract realistic information.`}

Based on the above, extract the walking tour details and respond ONLY with valid JSON:

{
  "title": "tour name",
  "source": "${source}",
  "duration": "2.5 hours",
  "price": "Free (tips welcome)",
  "meeting_point": "exact meeting point if mentioned",
  "description": "2-3 sentence description of what this tour covers",
  "highlights": ["Stop 1", "Stop 2", "Stop 3", "Stop 4", "Stop 5", "Stop 6", "Stop 7", "Stop 8"],
  "url": "${url}"
}

For highlights, extract the ACTUAL stops mentioned on the page in ORDER. If stops aren't explicitly listed but the tour area is clear, suggest the most logical stops for a walking tour of that area. Return at least 6 stops. No markdown, just JSON.`;

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
        max_tokens: 800,
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
