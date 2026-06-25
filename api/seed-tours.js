// One-time seed endpoint — call once to pre-load Prague, Vienna, Budapest
// GET /api/seed-tours?secret=travelens2026

export default async function handler(req, res) {
  // Simple secret protection
  if (req.query.secret !== 'travelens2026') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const cities = ['Prague', 'Vienna', 'Budapest'];
  const results = [];

  for (const city of cities) {
    try {
      // Call our own get-tours endpoint
      const protocol = req.headers['x-forwarded-proto'] || 'https';
      const host = req.headers.host;
      const tourRes = await fetch(`${protocol}://${host}/api/get-tours`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city })
      });
      const data = await tourRes.json();
      results.push({
        city,
        status: 'success',
        tours: data.tours?.length || 0,
        cached: data.cached
      });
      // Small delay between cities
      await new Promise(r => setTimeout(r, 2000));
    } catch(e) {
      results.push({ city, status: 'error', error: e.message });
    }
  }

  return res.status(200).json({
    message: 'Seeding complete',
    results
  });
}
