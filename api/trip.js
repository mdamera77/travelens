// GET  /api/trip?id={tripId}          — load a saved trip
// POST /api/trip                      — save a trip, returns { tripId }
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  // ── GET: load a trip ────────────────────────────────────────────
  if (req.method === 'GET') {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'id query param required' });

    const key = `trip:${id}`;

    try {
      const cacheRes = await fetch(`${redisUrl}/get/${key}`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      });
      const data = await cacheRes.json();

      if (!data.result) {
        return res.status(404).json({ error: 'trip not found or expired' });
      }

      const trip = JSON.parse(data.result);
      return res.status(200).json({ tripId: id, trip });

    } catch (err) {
      console.log('load trip failed:', err.message);
      return res.status(500).json({ error: err.message || 'Failed to load trip' });
    }
  }

  // ── POST: save a trip ───────────────────────────────────────────
  if (req.method === 'POST') {
    const trip = req.body;
    const validationError = validateTrip(trip);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const tripId = generateTripId();
    const key = `trip:${tripId}`;
    const payload = JSON.stringify(trip);

    try {
      await fetch(`${redisUrl}/set/${key}/${encodeURIComponent(payload)}/ex/7776000`, {
        headers: { Authorization: `Bearer ${redisToken}` }
      });

      return res.status(200).json({ tripId, key });

    } catch (err) {
      console.log('save trip failed:', err.message);
      return res.status(500).json({ error: err.message || 'Failed to save trip' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
