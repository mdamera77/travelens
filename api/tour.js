export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { city, hotel, dates, vibes, stamina } = req.body;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: `Build a 5-stop walking tour for ${city}. Starting from ${hotel || 'city centre'}. Interests: ${vibes || 'history, hidden gems'}. Stamina: ${stamina || 'half day'}.

Format EXACTLY like this:
STOP 1: Name | 09:00
Description of what to see and experience here.
TIDBITS
- Surprising fact
- Local secret
- Human story
WALK: 10 min walk north to next stop

STOP 2: Name | 10:00
Description.
TIDBITS
- Fact
- Secret
- Story
WALK: direction

Continue for 5 stops then add:
TIP: practical advice
TIP: local secret` }]
    })
  });

  const data = await response.json();
  res.status(200).json({ tour: data.content?.[0]?.text || '' });
}
