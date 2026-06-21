export function getPublicIdFromUrl(url) {
  const match = url.match(/\/upload\/(?:v\d+\/)?(.+)\.[^/.]+$/);
  return match ? match[1] : null;
}

export async function deleteCloudinaryImageById(publicId) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary credentials not configured');
  const credentials = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/resources/image/upload?public_ids[]=${encodeURIComponent(publicId)}`,
    { method: 'DELETE', headers: { Authorization: `Basic ${credentials}` } },
  );
  if (!response.ok) throw new Error(await response.text());
}

export async function deleteCloudinaryImages(imagesCsv) {
  if (!imagesCsv) return;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return;

  const urls = imagesCsv
    .split(',')
    .map((u) => u.trim())
    .filter((u) => u.startsWith('https://res.cloudinary.com/'));

  await Promise.allSettled(
    urls.map(async (url) => {
      const publicId = getPublicIdFromUrl(url);
      if (!publicId) return;
      try {
        await deleteCloudinaryImageById(publicId);
      } catch (err) {
        console.error('Cloudinary delete failed for', publicId, err);
      }
    }),
  );
}
