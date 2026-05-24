import { getSupabaseAdmin } from './_lib/supabase.js';

export default async function handler(req, res) {
  try {
    const supabase = getSupabaseAdmin();
    await supabase.from('services').select('id').limit(1);
    res.status(200).json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

export const config = {
  schedule: '0 0 * * *'
};
