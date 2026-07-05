// GET /api/seed-daytrips?secret=travelens2026&city=Prague
// Seeds daytrips-db:{city} from the curated data in _daytrips-seed-data.js
// Run once per city, like seed-cities.js. Overwrites existing entry for that city.

import { Redis } from "@upstash/redis";
import { daytripsSeedData } from "./_daytrips-seed-data.js";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

export default async function handler(req, res) {
  const { secret, city } = req.query;

  if (secret !== "travelens2026") {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!city) {
    return res.status(400).json({ error: "city query param required" });
  }

  const cityKey = city.toLowerCase();
  const trips = daytripsSeedData[cityKey];

  if (!trips) {
    return res.status(404).json({
      error: `no curated day trips defined for "${city}" yet`,
      hint: "add an entry to _daytrips-seed-data.js first"
    });
  }

  const key = `daytrips-db:${cityKey}`;
  await redis.set(key, JSON.stringify(trips));

  return res.status(200).json({
    status: "seeded",
    city: cityKey,
    key,
    count: trips.length,
    trips: trips.map(t => ({ id: t.id, name: t.name, duration: t.duration }))
  });
}
