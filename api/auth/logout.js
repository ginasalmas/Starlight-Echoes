import { sql } from '../lib/db.js';
import { clearSessionCookie } from '../lib/auth.js';

/**
 * POST /api/auth/logout
 * Logs out the current user by clearing the session.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse session token from cookie
    const cookies = parseCookies(req.headers.cookie || '');
    const sessionToken = cookies['se_session'];

    if (sessionToken) {
      // Delete session from database
      await sql`DELETE FROM sessions WHERE token = ${sessionToken}`;
    }

    // Clear cookie
    clearSessionCookie(res);

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    clearSessionCookie(res);
    return res.status(200).json({ success: true });
  }
}

function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;
  cookieString.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  });
  return cookies;
}
