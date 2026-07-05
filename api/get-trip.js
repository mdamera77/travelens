// GET /api/get-trip?id={tripId}
// Loads a saved multi-day trip by its short ID.

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: "id query param required" });
  }

  const key = `trip:${id}`;
  const data = await redis.get(key);

  if (!data) {
    return res.status(404).json({ error: "trip not found or expired" });
  }

  const trip = typeof data === "string" ? JSON.parse(data) : data;

  return res.status(200).json({ tripId: id, trip });
}
