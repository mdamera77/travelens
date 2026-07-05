// GET /api/seed-daytrips?secret=travelens2026&city=Prague
// Seeds daytrips-db:{city} from the curated data below. Run once per city.

import { daytripsSeedData } from './_daytrips-seed-data.js';

export default async function handler(req, res) {
  const { secret, city } = req.query;

  if (secret !== 'travelens2026') {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!city) {
    return res.status(400).json({ error: 'city query param required' });
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  const cityKey = city.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const trips = daytripsSeedData[cityKey];

  if (!trips) {
    return res.status(404).json({
      error: `no curated day trips defined for "${city}" yet`,
      hint: 'add an entry to _daytrips-seed-data.js first'
    });
  }

  const key = `daytrips-db:${cityKey}`;
  const payload = JSON.stringify(trips);

  try {
    await fetch(`${redisUrl}/set/${key}/${encodeURIComponent(payload)}`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });

    return res.status(200).json({
      status: 'seeded',
      city: cityKey,
      key,
      count: trips.length,
      trips: trips.map(t => ({ id: t.id, name: t.name, duration: t.duration }))
    });

  } catch (err) {
    return res.status(500).json({ error: err.message || 'Seeding failed' });
  }
}
