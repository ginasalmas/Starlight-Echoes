import { sql, getOrCreateCanvas } from '../lib/db.js';
import { getAuthUser } from '../lib/auth.js';

/**
 * /api/canvas
 * GET  — returns user's canvas settings
 * PUT  — updates canvas settings
 */
export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    if (req.method === 'GET') {
      const canvas = await getOrCreateCanvas(user.id);
      return res.status(200).json(canvas);
    }

    if (req.method === 'PUT') {
      const { center_photo_url, center_name, title_text, pan_x, pan_y } = req.body;
      const canvas = await getOrCreateCanvas(user.id);

      const { rows } = await sql`
        UPDATE canvases SET
          center_photo_url = COALESCE(${center_photo_url ?? null}, center_photo_url),
          center_name = COALESCE(${center_name ?? null}, center_name),
          title_text = COALESCE(${title_text ?? null}, title_text),
          pan_x = COALESCE(${pan_x ?? null}, pan_x),
          pan_y = COALESCE(${pan_y ?? null}, pan_y),
          updated_at = NOW()
        WHERE id = ${canvas.id}
        RETURNING *
      `;

      return res.status(200).json(rows[0]);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Canvas API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
