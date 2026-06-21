export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { city, hotel, dates, vibes, stamina } = req.body;

  if (!city) return res.status(400).json({ error: 'City is required' });

  const prompt = `You are Travelens, a brilliant local guide AI. Build a personalised walking tour.

City: ${city}
Starting point: ${hotel || 'city centre'}
Dates: ${dates || 'upcoming trip'}
Interests: ${vibes || 'history, food, hidden gems'}
Stamina: ${stamina || 'half-day'}

RETURN EXACTLY THIS FORMAT — no markdown, no asterisks for bold, no extra commentary:

STOP 1: [Name] | [Time e.g. 09:00]
[2-3 sentence description — what they see, feel, experience]
TIDBITS
- [Surprising specific fact with real names, dates, human stories]
- [Something sensory or visual most visitors miss]
- [Local secret or funny/moving anecdote]
WALK: [Direction and walking time to next stop]

STOP 2: [Name] | [Time]
[Description]
TIDBITS
- [Tidbit]
- [Tidbit]
- [Tidbit]
WALK: [Direction]

[Continue for 5 stops total]

TIP: [Practical tip — opening times, what to wear, where to eat]
TIP: [One local secret that transforms the experience]

Tidbits must be genuinely surprising — specific, human, unexpected. Make people say "I had no idea."`;

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
        max_tokens: 1200,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ tour: data.content?.[0]?.text || '' });

  } catch (err) {
    res.status(500).json({ error: err.message || 'Tour generation failed' });
  }
}
