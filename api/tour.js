export const config = { runtime: 'edge' };

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  const { city, hotel, dates, vibes, stamina } = await req.json();

  if (!city) return new Response(JSON.stringify({ error: 'City is required' }), { status: 400 });

  const prompt = `You are Travelens, a brilliant local guide AI. Build a personalised walking tour.

City: ${city}
Starting point: ${hotel || 'city centre'}
Dates: ${dates || 'upcoming trip'}
Interests: ${vibes || 'history, food, hidden gems'}
Stamina: ${stamina || 'half-day'}

RETURN EXACTLY THIS FORMAT — no markdown, no asterisks for bold, no extra commentary:

STOP 1: [Name] | [Time e.g. 09:00]
[2-3 sentence description]
TIDBITS
- [Surprising specific fact]
- [Something most visitors miss]
- [Local secret or anecdote]
WALK: [Direction and walking time to next stop]

Continue for 5 stops total.

TIP: [Practical tip]
TIP: [One local secret]

Tidbits must be genuinely surprising — specific, human, unexpected.`;

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

    return new Response(JSON.stringify({ tour: data.content?.[0]?.text || '' }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
