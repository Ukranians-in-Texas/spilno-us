import { deleteCloudinaryImageById } from './_lib/cloudinary.js';
import { getSupabaseAdmin } from './_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    const token = authHeader.slice(7);
    const supabase = getSupabaseAdmin();
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { publicId } = req.body || {};
  if (!publicId || typeof publicId !== 'string') {
    return res.status(400).json({ error: 'Missing publicId' });
  }

  // Defense-in-depth: restrict deletion to this app's own Cloudinary folder, on top of
  // the admin-auth check above. Opt-in via CLOUDINARY_UPLOAD_FOLDER — no-op if unset, so
  // this can't break existing deletes if the value isn't (yet) configured in Vercel.
  const uploadFolder = process.env.CLOUDINARY_UPLOAD_FOLDER;
  if (uploadFolder && !publicId.startsWith(`${uploadFolder}/`)) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    return res.status(500).json({ error: 'Server configuration error' });
  }

  try {
    await deleteCloudinaryImageById(publicId);
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return res.status(500).json({ error: 'Failed to delete image' });
  }
}
