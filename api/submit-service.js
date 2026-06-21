import { getSupabaseAdmin } from './_lib/supabase.js';
import { sendTelegramNotification } from './_lib/telegram.js';
import { getAllSubcategories } from '../src/data/categories.js';

const VALID_CATEGORIES = new Set(getAllSubcategories());

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    category,
    businessName,
    descriptionEn,
    descriptionUa,
    phone,
    email,
    address,
    website,
    instagram,
    facebook,
    linkedin,
    imageUrls,
    honeypot,
  } = req.body || {};

  // Honeypot — silent reject
  if (honeypot) {
    return res.status(200).json({ success: true });
  }

  // Required fields
  if (!category || !businessName?.trim() || !descriptionEn?.trim() || !descriptionUa?.trim() || !email?.trim()) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Category allowlist
  if (!VALID_CATEGORIES.has(category)) {
    return res.status(400).json({ error: 'Invalid category' });
  }

  // Format validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (phone?.trim() && !/^[\d\s+\-()]+$/.test(phone.trim())) {
    return res.status(400).json({ error: 'Invalid phone' });
  }
  if (website?.trim() && !/^https?:\/\//i.test(website.trim())) {
    return res.status(400).json({ error: 'Invalid website URL' });
  }
  if (instagram?.trim() && !/instagram\.com\//i.test(instagram.trim())) {
    return res.status(400).json({ error: 'Invalid Instagram URL' });
  }
  if (facebook?.trim() && !/facebook\.com\//i.test(facebook.trim())) {
    return res.status(400).json({ error: 'Invalid Facebook URL' });
  }
  if (linkedin?.trim() && !/linkedin\.com\//i.test(linkedin.trim())) {
    return res.status(400).json({ error: 'Invalid LinkedIn URL' });
  }

  // Length limits
  if (businessName.trim().length > 100) return res.status(400).json({ error: 'Business name too long' });
  if (descriptionEn.trim().length > 600) return res.status(400).json({ error: 'Description too long' });
  if (descriptionUa.trim().length > 600) return res.status(400).json({ error: 'Description too long' });
  if (phone?.trim() && phone.trim().length > 30) return res.status(400).json({ error: 'Phone too long' });
  if (email.trim().length > 200) return res.status(400).json({ error: 'Email too long' });
  if (address?.trim().length > 200) return res.status(400).json({ error: 'Address too long' });
  if (website?.trim().length > 300) return res.status(400).json({ error: 'Website URL too long' });
  if (instagram?.trim().length > 300) return res.status(400).json({ error: 'Instagram URL too long' });
  if (facebook?.trim().length > 300) return res.status(400).json({ error: 'Facebook URL too long' });
  if (linkedin?.trim().length > 300) return res.status(400).json({ error: 'LinkedIn URL too long' });

  const record = {
    title: businessName.trim(),
    description_en: descriptionEn.trim(),
    description_ua: descriptionUa.trim(),
    category,
    phone: phone.trim(),
    email: email.trim(),
    approved: false,
  };

  if (address?.trim()) record.address = address.trim();
  if (website?.trim()) record.website = website.trim();
  if (instagram?.trim()) record.instagram = instagram.trim();
  if (facebook?.trim()) record.facebook = facebook.trim();
  if (linkedin?.trim()) record.linkedin = linkedin.trim();

  const validImageUrls = Array.isArray(imageUrls)
    ? imageUrls
        .filter((u) => typeof u === 'string' && u.startsWith('https://res.cloudinary.com/'))
        .slice(0, 5)
    : [];
  if (validImageUrls.length > 0) record.images = validImageUrls.join(',');

  try {
    const supabase = getSupabaseAdmin();

    // Rate limit: max 3 submissions per email in 24 hours
    const normalizedEmail = email.trim().toLowerCase();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true })
      .ilike('email', normalizedEmail)
      .gte('submitted_at', cutoff);
    if (countError) {
      console.error('Rate limit check failed:', countError);
      return res.status(500).json({ error: 'Unable to process submission. Please try again.' });
    }
    if (count >= 3) {
      return res.status(429).json({ error: 'Too many submissions. Please try again later.' });
    }

    const { data: inserted, error } = await supabase
      .from('services')
      .insert(record)
      .select('id')
      .single();
    if (error) throw error;

    await sendTelegramNotification(record, inserted?.id)
      .then(() => console.log('Telegram notification sent'))
      .catch((err) => console.error('Telegram notification failed:', err));

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Submit error:', error);
    return res.status(500).json({ error: 'Failed to submit' });
  }
}

