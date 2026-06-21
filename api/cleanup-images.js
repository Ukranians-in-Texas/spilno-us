import { getSupabaseAdmin } from './_lib/supabase.js';
import { getPublicIdFromUrl, deleteCloudinaryImageById } from './_lib/cloudinary.js';
import { sendTelegramAlert } from './_lib/telegram.js';

const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;

async function fetchAllCloudinaryResources() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary credentials not configured');

  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const resources = [];
  let nextCursor = null;

  do {
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?max_results=500${nextCursor ? `&next_cursor=${nextCursor}` : ''}`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${credentials}` },
    });
    if (!response.ok) throw new Error(`Cloudinary API error: ${response.status}`);
    const data = await response.json();
    resources.push(...(data.resources || []));
    nextCursor = data.next_cursor || null;
  } while (nextCursor);

  return resources;
}

export default async function handler(req, res) {
  try {
    const resources = await fetchAllCloudinaryResources();

    const cutoff = Date.now() - GRACE_PERIOD_MS;
    const candidates = resources.filter(
      (r) => new Date(r.created_at).getTime() < cutoff,
    );

    const supabase = getSupabaseAdmin();
    const { data: services, error } = await supabase
      .from('services')
      .select('images')
      .not('images', 'is', null);

    if (error || services === null) {
      console.error('Supabase query failed:', error);
      await sendTelegramAlert('⚠️ <b>Image cleanup failed</b>\nSupabase query error — no images were deleted.').catch(() => {});
      return res.status(500).json({ error: 'Failed to query services' });
    }

    const referencedIds = new Set();
    for (const svc of services) {
      for (const url of svc.images.split(',')) {
        const id = getPublicIdFromUrl(url.trim());
        if (id) referencedIds.add(id);
      }
    }

    const orphans = candidates.filter((r) => !referencedIds.has(r.public_id));

    const results = await Promise.allSettled(
      orphans.map((r) => deleteCloudinaryImageById(r.public_id)),
    );

    const failed = results.filter((r) => r.status === 'rejected').length;
    const deleted = orphans.length - failed;

    if (failed > 0) {
      console.error(`Failed to delete ${failed} orphaned images`);
      await sendTelegramAlert(`⚠️ <b>Image cleanup partial failure</b>\nDeleted ${deleted}, failed ${failed}.`).catch(() => {});
    } else if (deleted > 0) {
      await sendTelegramAlert(`🧹 <b>Image cleanup</b>\nDeleted ${deleted} orphaned image${deleted === 1 ? '' : 's'}.`).catch(() => {});
    }

    return res.status(200).json({ deleted, failed });
  } catch (err) {
    console.error('Cleanup failed:', err);
    await sendTelegramAlert('⚠️ <b>Image cleanup failed</b>\n' + err.message).catch(() => {});
    return res.status(500).json({ error: 'Cleanup failed' });
  }
}

export const config = {
  schedule: '0 3 * * 0',
};
