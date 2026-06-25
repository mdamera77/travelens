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

  // Build the stop list instruction
  const stopInstruction = tourContext?.highlights?.length
    ? `CRITICAL — You MUST follow EXACTLY these stops in EXACTLY this order. Do NOT add, remove, skip, rename, or reorder any stop:
${tourContext.highlights.map((s, i) => `STOP ${i + 1}: ${s}`).join('\n')}

Total stops: ${tourContext.highlights.length}. Cover every single one.`
    : `Build 5 interesting stops for ${city} starting near ${hotel || 'city centre'}.`;

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

STOP 1: [Exact stop name from list above] | [Time e.g. 09:00]
[2-3 sentence description — what they see, feel, experience at THIS specific place]
TIDBITS
- [Surprising specific fact with real names, dates, human stories about THIS stop]
- [Something sensory or visual most visitors miss at THIS stop]
- [Local secret or moving anecdote about THIS specific place]
WALK: [Specific walking direction and time to the NEXT stop on the list]

STOP 2: [Exact stop name] | [Time]
[Description]
TIDBITS
- [Tidbit]
- [Tidbit]
- [Tidbit]
WALK: [Direction to next stop]

[Continue for ALL stops listed above — every stop must appear]

TIP: [Practical tip about this specific tour — opening times, what to bring, where to eat nearby]
TIP: [One local secret that transforms the experience of this tour]

Rules:
- Use the EXACT stop names as given — do not rename or combine them
- Follow the EXACT order given — do not reorder
- Cover EVERY stop — do not skip any
- Tidbits must be genuinely surprising — specific, human, unexpected
- Make people say "I had no idea"`;

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
        max_tokens: 6000,
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
