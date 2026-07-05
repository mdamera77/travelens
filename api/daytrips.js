// GET /api/daytrips?city=Prague                          — read day trips for a city
// GET /api/daytrips?city=Prague&seed=true&secret=...      — admin: seed curated data

import { daytripsSeedData } from './_daytrips-seed-data.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const { city, seed, secret } = req.query;
  if (!city) return res.status(400).json({ error: 'city query param required' });

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  const cityKey = city.toLowerCase().replace(/[^a-z0-9]/g, '-');
  const key = `daytrips-db:${cityKey}`;

  // ── ADMIN: seed curated data ────────────────────────────────────
  if (seed === 'true') {
    if (secret !== 'travelens2026') {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const trips = daytripsSeedData[cityKey];
    if (!trips) {
      return res.status(404).json({
        error: `no curated day trips defined for "${city}" yet`,
        hint: 'add an entry to _daytrips-seed-data.js first'
      });
    }

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

  // ── NORMAL: read day trips ───────────────────────────────────────
  try {
    const cacheRes = await fetch(`${redisUrl}/get/${key}`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });
    const data = await cacheRes.json();

    if (!data.result) {
      return res.status(200).json({ city: cityKey, trips: [] });
    }

    const trips = JSON.parse(data.result);
    return res.status(200).json({ city: cityKey, trips });

  } catch (err) {
    console.log('get daytrips failed:', err.message);
    return res.status(500).json({ error: err.message || 'Failed to load day trips' });
  }
}
