import { getSupabaseAdmin } from './_lib/supabase.js';
import { sendTelegramAlert } from './_lib/telegram.js';

// Dead-man's-switch: ping healthchecks.io on each successful run. If this ping
// stops arriving (e.g. the cron silently stops firing), healthchecks alerts us.
// No-op until HEALTHCHECK_URL is set, so it's safe in dev / before setup.
async function pingHealthcheck() {
  const url = process.env.HEALTHCHECK_URL;
  if (!url) return;
  await fetch(url).catch(() => {});
}

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).end();
  }

  try {
    const supabase = getSupabaseAdmin();
    // supabase-js returns { error } on a failed query rather than throwing,
    // so check it explicitly — otherwise a paused/unreachable DB slips past the catch.
    const { error } = await supabase.from('services').select('id').limit(1);
    if (error) throw error;
    await pingHealthcheck();
    res.status(200).json({ ok: true });
  } catch (error) {
    const message = error?.message || String(error);
    await sendTelegramAlert(
      `🔴 <b>keep-alive failed</b>\nDB ping error — Supabase may be paused or unreachable.\n<code>${message}</code>`,
    ).catch(() => {});
    res.status(500).json({ error: message });
  }
}
