import { getAuthUser } from '../lib/auth.js';

/**
 * GET /api/auth/me
 * Returns the currently authenticated user, or 401 if not logged in.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await getAuthUser(req);

    if (!user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    return res.status(200).json({
      id: user.id,
      email: user.email,
      displayName: user.display_name,
      avatarUrl: user.avatar_url,
    });
  } catch (error) {
    console.error('Auth me error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
