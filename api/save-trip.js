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
//           destinationId: "kutna-hora",       // day-trip only
//           duration: "half" | "full",          // day-trip only
//           mode: "self-guided" | "guided",      // day-trip only
//           bookingSource: "viator" | "guruwalk" | null,  // day-trip only
//           note: "Bohemian Switzerland via Viator"        // external-booked only
//         }
//       ]
//     }
//   ]
// }

function generateTripId(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = '';
  for (let i = 0; i < length; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function validateTrip(trip) {
  if (!trip.baseCity) return 'baseCity is required';
  if (!trip.arrival || !trip.arrival.date || !trip.arrival.time) return 'arrival date/time required';
  if (!trip.departure || !trip.departure.date || !trip.departure.time) return 'departure date/time required';
  if (!Array.isArray(trip.days) || trip.days.length === 0) return 'days array required';

  const validSegmentTypes = ['open-city', 'day-trip', 'external-booked'];
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
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const trip = req.body;
  const validationError = validateTrip(trip);
  if (validationError) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(400).json({ error: validationError });
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  const tripId = generateTripId();
  const key = `trip:${tripId}`;
  const payload = JSON.stringify(trip);

  try {
    await fetch(`${redisUrl}/set/${key}/${encodeURIComponent(payload)}/ex/7776000`, {
      headers: { Authorization: `Bearer ${redisToken}` }
    });

    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(200).json({ tripId, key });

  } catch (err) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.status(500).json({ error: err.message || 'Failed to save trip' });
  }
}
