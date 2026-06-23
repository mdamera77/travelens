export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { city } = req.body;
  if (!city) return res.status(400).json({ error: 'City required' });

  const prompt = `You are a travel expert who knows all the free walking tours available worldwide.

For the city "${city}", generate a list of 5-6 realistic free or low-cost walking tours that COULD be found on GuruWalk, FreeTour.com, GetYourGuide, or FreeToursByFoot.

Make them feel like real tours with authentic names, realistic details, and genuine highlights for that city.

Respond ONLY with valid JSON, no markdown, no explanation:

{
  "tours": [
    {
      "title": "Prague Old Town & Jewish Quarter Free Tour",
      "source": "GuruWalk",
      "duration": "2.5 hours",
      "price": "Free (tips welcome)",
      "rating": "4.9",
      "description": "Explore the medieval heart of Prague with a passionate local guide. From the Astronomical Clock to the haunting Jewish Quarter, discover stories most tourists never hear.",
      "highlights": ["Old Town Square", "Astronomical Clock", "Jewish Quarter", "Charles Bridge"],
      "url": "https://www.guruwalk.com/walks/prague"
    }
  ]
}

Sources to use: GuruWalk, FreeTour, GetYourGuide, FreeToursByFoot (mix them up).
Prices: mostly "Free (tips welcome)" or "From $12" for GetYourGuide.
Make highlights specific to ${city} — real landmarks and neighbourhoods.
Vary the tour themes: history, food, dark history, hidden gems, neighbourhood walks.`;

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
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    let text = data.content?.[0]?.text || '{}';
    // Strip markdown code fences if present
    text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const parsed = JSON.parse(text);
    res.status(200).json(parsed);

  } catch(err) {
    res.status(500).json({ error: err.message });
  }
}
