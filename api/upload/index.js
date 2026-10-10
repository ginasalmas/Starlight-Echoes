import { put } from '@vercel/blob';
import { getAuthUser } from '../lib/auth.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * POST /api/upload
 * Uploads an image to Vercel Blob storage.
 * Expects raw binary body with Content-Type header.
 * Query param: ?filename=image.jpg
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const filename = req.query.filename || `image-${Date.now()}.jpg`;
    const contentType = req.headers['content-type'] || 'image/jpeg';

    // Read raw body
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return res.status(400).json({ error: 'No file data received' });
    }

    if (buffer.length > 4.5 * 1024 * 1024) {
      return res.status(413).json({ error: 'File too large. Maximum 4.5MB.' });
    }

    // Check if token exists (check standard name and any prefixed name)
    let token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) {
      for (const [key, val] of Object.entries(process.env)) {
        if ((key.endsWith('READ_WRITE_TOKEN') || key.endsWith('BLOB_TOKEN')) && val) {
          token = val;
          break;
        }
      }
    }

    if (token) {
      token = token.trim().replace(/^["']|["']$/g, '');
    }

    if (!token) {
      console.error('BLOB_READ_WRITE_TOKEN is not set!');
      return res.status(500).json({
        error: 'Blob storage not configured. BLOB_READ_WRITE_TOKEN is missing. If you just added it in Vercel, please redeploy.',
      });
    }

    // Upload to Vercel Blob
    const blob = await put(`starlight-echoes/${user.id}/${filename}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: true,
      token, // explicitly pass the token
    });

    return res.status(200).json({ url: blob.url });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({ error: `Upload failed: ${error.message}` });
  }
}
