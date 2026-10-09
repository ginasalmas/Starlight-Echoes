import { sql } from '../lib/db.js';
import { getAuthUser } from '../lib/auth.js';

/**
 * /api/profile
 * GET  — returns user profile
 * PUT  — updates display name
 */
export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        id: user.id,
        email: user.email,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
      });
    }

    if (req.method === 'PUT') {
      const { displayName } = req.body;

      if (!displayName || displayName.trim().length === 0) {
        return res.status(400).json({ error: 'Display name is required' });
      }

      const { rows } = await sql`
        UPDATE users 
        SET display_name = ${displayName.trim()}, updated_at = NOW()
        WHERE id = ${user.id}
        RETURNING id, email, display_name, avatar_url
      `;

      return res.status(200).json({
        id: rows[0].id,
        email: rows[0].email,
        displayName: rows[0].display_name,
        avatarUrl: rows[0].avatar_url,
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Profile API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
