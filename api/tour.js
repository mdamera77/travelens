export const config = { runtime: 'edge' };

export default async function handler(req) {
  const body = await req.text();
  console.log('Raw body received:', body);
  
  let city, hotel, dates, vibes, stamina;
  try {
    const parsed = JSON.parse(body);
    city = parsed.city;
    hotel = parsed.hotel;
    dates = parsed.dates;
    vibes = parsed.vibes;
    stamina = parsed.stamina;
  } catch(e) {
    return new Response(JSON.stringify({ error: 'Bad request: ' + e.message }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  console.log('API key present:', !!apiKey, 'starts with:', apiKey?.substring(0, 10));

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1200,
      messages: [{ role: 'user', content: `Build a 5-stop walking tour for ${city || 'Paris'}. Starting from ${hotel || 'city centre'}. Interests: ${vibes || 'history'}. Format each stop as: STOP 1: Name | Time, description, TIDBITS, - tidbit, WALK: direction` }]
    })
  });

  const text = await response.text();
  console.log('Anthropic response status:', response.status);
  console.log('Anthropic response:', text.substring(0, 200));

  try {
    const data = JSON.parse(text);
    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json',
