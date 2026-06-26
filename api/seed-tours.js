// One-time seeder for top 50 cities
// Call: GET /api/seed-cities?secret=travelens2026&city=Paris (one city at a time)
// Or: GET /api/seed-cities?secret=travelens2026&all=true (all cities, slower)

const TOP_50_CITIES = [
  'Paris', 'London', 'Rome', 'Barcelona', 'Amsterdam',
  'Prague', 'Vienna', 'Budapest', 'Berlin', 'Athens',
  'Istanbul', 'Lisbon', 'Madrid', 'Florence', 'Venice',
  'Dubrovnik', 'Edinburgh', 'Dublin', 'Copenhagen', 'Stockholm',
  'Tokyo', 'Kyoto', 'Bangkok', 'Singapore', 'Hong Kong',
  'New York', 'Chicago', 'New Orleans', 'San Francisco', 'Washington DC',
  'Mexico City', 'Oaxaca', 'Cartagena', 'Buenos Aires', 'Rio de Janeiro',
  'Marrakech', 'Cairo', 'Cape Town', 'Nairobi', 'Petra',
  'Sydney', 'Melbourne', 'Auckland', 'Bali', 'Hanoi',
  'Havana', 'Cusco', 'Bruges', 'Seville', 'Porto'
];

const TOUR_THEMES = [
  {
    theme: 'Classic Highlights',
    description: 'The essential tour covering the most iconic sights and landmarks',
    vibes: 'history, architecture, iconic landmarks'
  },
  {
    theme: 'Hidden Gems & Local Life',
    description: 'Off the tourist trail — neighbourhoods, markets, and local secrets',
    vibes: 'hidden gems, local life, neighbourhood walks'
  },
  {
    theme: 'Art & Architecture',
    description: 'Art, design, and architectural wonders across the centuries',
    vibes: 'art, architecture, museums, design'
  },
  {
    theme: 'Food & Markets',
    description: 'Street food, markets, cafés and the city\'s culinary identity',
    vibes: 'food, markets, cafes, local cuisine'
  },
  {
    theme: 'History & Culture',
    description: 'Deep history, cultural stories and the people who shaped this city',
    vibes: 'history, culture, stories, heritage'
  }
];

async function generateToursForCity(city, redisUrl, redisToken, anthropicKey) {
  const results = [];

  for (const themeObj of TOUR_THEMES) {
    const cacheKey = `tours-db:${city.toLowerCase().replace(/[^a-z0-9]/g,'-')}:${themeObj.theme.toLowerCase().replace(/[^a-z0-9]/g,'-')}`;

    // Check if already cached
    try {
      const check = await fetch(`${redisUrl}/get/${cacheKey}`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      });
      const data = await check.json();
      if (data.result) {
        results.push({ theme: themeObj.theme, status: 'already cached' });
        continue;
      }
    } catch(e) {}

    // Generate with Claude Haiku
    const prompt = `You are a travel expert. For ${city}, create a realistic free walking tour focused on: ${themeObj.theme}.

Theme: ${themeObj.description}
Interests: ${themeObj.vibes}

Respond ONLY with valid JSON, no markdown:
{
  "title": "specific tour name for ${city}",
  "source": "GuruWalk",
  "sourceColor": "#FF6B35",
  "duration": "2.5 hours",
  "price": "Free (tips welcome)",
  "rating": "4.8",
  "reviews": "156",
  "meeting_point": "specific real location with address in ${city}",
  "description": "2-3 sentences about what makes this tour special",
  "highlights": ["Stop 1", "Stop 2", "Stop 3", "Stop 4", "Stop 5", "Stop 6", "Stop 7", "Stop 8"],
  "themes": ["${themeObj.theme.toLowerCase().replace(' & ','-').replace(' ','-')}"],
  "url": "https://www.guruwalk.com/walks/${city.toLowerCase().replace(' ','-')}"
}

Make highlights REAL landmarks in ${city} in logical walking order. 8-12 stops.`;

    try {
      const resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          messages: [{ role: 'user', content: prompt }]
        })
      });

      const aiData = await resp.json();
      if (aiData.error) throw new Error(aiData.error.message);

      let text = aiData.content[0].text.replace(/```json\n?/g,'').replace(/```\n?/g,'').trim();
      const tour = JSON.parse(text);
      tour.city = city;

      // Save to Upstash
      await fetch(`${redisUrl}/set/${cacheKey}/${encodeURIComponent(JSON.stringify(tour))}/ex/7776000`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      });

      results.push({ theme: themeObj.theme, status: 'generated', title: tour.title });
      await new Promise(r => setTimeout(r, 500)); // small delay

    } catch(e) {
      results.push({ theme: themeObj.theme, status: 'error', error: e.message });
    }
  }
  return results;
}

export default async function handler(req, res) {
  if (req.query.secret !== 'travelens2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // Seed a single city
  if (req.query.city) {
    const city = req.query.city;
    const results = await generateToursForCity(city, redisUrl, redisToken, anthropicKey);
    return res.status(200).json({ city, results });
  }

  // List all available cities
  return res.status(200).json({
    message: 'Travelens City Seeder',
    usage: 'Add ?city=Paris to seed one city, or ?city=Paris&... for each city',
    cities: TOP_50_CITIES,
    themes: TOUR_THEMES.map(t => t.theme)
  });
}
