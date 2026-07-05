// POST /api/save-trip
// Body: the trip object (see schema below). Saves to Upstash, returns tripId.
// 90-day TTL, same as your shared tours.
//
// Trip schema (locked):
// {
//   baseCity: "Prague",
//   arrival: { date: "2026-09-10", time: "14:30" },
//   departure: { date: "2026-09-13", time: "14:00" },
//   days: [
//     {
//       date: "2026-09-10",
//       dayType: "arrival" | "full" | "departure",
//       segments: [
//         {
//           type: "open-city" | "day-trip" | "external-booked",
//           start: "17:00", end: "21:00",
//           // day-trip only:
//           destinationId: "kutna-hora",
//           duration: "half" | "full",
//           mode: "self-guided" | "guided",
//           bookingSource: "viator" | "guruwalk" | null,
//           // external-booked only:
//           note: "Bohemian Switzerland via Viator"
//         }
//       ]
//     }
//   ]
// }

import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN
});

const TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days, matches your shared tours

function generateTripId(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function validateTrip(trip) {
  if (!trip.baseCity) return "baseCity is required";
  if (!trip.arrival || !trip.arrival.date || !trip.arrival.time) return "arrival date/time required";
  if (!trip.departure || !trip.departure.date || !trip.departure.time) return "departure date/time required";
  if (!Array.isArray(trip.days) || trip.days.length === 0) return "days array required";

  const validSegmentTypes = ["open-city", "day-trip", "external-booked"];
  for (const day of trip.days) {
    if (!day.date || !day.dayType || !Array.isArray(day.segments)) {
      return `malformed day entry: ${JSON.stringify(day)}`;
    }
    for (const seg of day.segments) {
      if (!validSegmentTypes.includes(seg.type)) {
        return `invalid segment type: ${seg.type}`;
      }
    }
  }
  return null;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const trip = req.body;
  const validationError = validateTrip(trip);
  if (validationError) {
    return res.status(400).json({ error: validationError });
  }

  const tripId = generateTripId();
  const key = `trip:${tripId}`;

  await redis.set(key, JSON.stringify(trip), { ex: TTL_SECONDS });

  return res.status(200).json({ tripId, key });
}
