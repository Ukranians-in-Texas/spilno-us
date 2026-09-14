import { fetchApprovedServices } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { category, limit, lang } = req.query;
    const services = await fetchApprovedServices({
      category,
      limit: limit ? parseInt(limit, 10) : undefined,
      lang: lang === 'ua' ? 'ua' : 'en',
    });

    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(services);
  } catch (error) {
    console.error('Error fetching services:', {
      message: error?.message,
      code: error?.code,
      status: error?.status,
    });
    return res.status(500).json({ error: 'Failed to fetch services' });
  }
}
