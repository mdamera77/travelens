// GET /api/get-daytrips?city=Prague
// Returns the curated day-trip list for a base city, or an empty array
// if none are seeded yet (wizard should show "not available yet" gracefully).

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

export default async function handler(req, res) {
  const { city } = req.query;

  if (!city) {
    return res.status(400).json({ error: "city query param required" });
  }

  const cityKey = city.toLowerCase();
  const key = `daytrips-db:${cityKey}`;
  const data = await redis.get(key);

  const trips = data ? (typeof data === "string" ? JSON.parse(data) : data) : [];

  return res.status(200).json({ city: cityKey, trips });
}
