import { sql } from '../lib/db.js';
import { createSessionToken, setSessionCookie } from '../lib/auth.js';

/**
 * GET /api/auth/callback
 * Handles the Google OAuth callback.
 * Exchanges code for tokens, upserts user, creates session.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code, state } = req.query;

  if (!code) {
    return res.redirect('/?error=no_code');
  }

  // Verify state (CSRF protection)
  const cookies = parseCookies(req.headers.cookie || '');
  if (!state || state !== cookies['oauth_state']) {
    return res.redirect('/?error=invalid_state');
  }

  // Clear the oauth_state cookie
  res.setHeader('Set-Cookie', [
    'oauth_state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  ]);

  try {
    const host = req.headers.host;
    const protocol = host?.includes('localhost') ? 'http' : 'https';
    const redirectUri = `${protocol}://${host}/api/auth/callback`;

    // 1. Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return res.redirect('/?error=token_exchange_failed');
    }

    // 2. Get user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const googleUser = await userInfoRes.json();

    if (!googleUser.id) {
      return res.redirect('/?error=user_info_failed');
    }

    // 3. Upsert user in database
    const { rows: existingUsers } = await sql`
      SELECT id FROM users WHERE google_id = ${googleUser.id} LIMIT 1
    `;

    let userId;

    if (existingUsers.length > 0) {
      userId = existingUsers[0].id;
      // Update user info
      await sql`
        UPDATE users 
        SET email = ${googleUser.email},
            display_name = ${googleUser.name},
            avatar_url = ${googleUser.picture},
            updated_at = NOW()
        WHERE id = ${userId}
      `;
    } else {
      // Create new user
      const { rows } = await sql`
        INSERT INTO users (google_id, email, display_name, avatar_url)
        VALUES (${googleUser.id}, ${googleUser.email}, ${googleUser.name}, ${googleUser.picture})
        RETURNING id
      `;
      userId = rows[0].id;

      // Create default canvas for new user
      await sql`
        INSERT INTO canvases (user_id, center_name, title_text)
        VALUES (${userId}, ${googleUser.name + "'s Universe"}, 'Starlight Echoes')
      `;
    }

    // 4. Create session
    const sessionToken = await createSessionToken(userId);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await sql`
      INSERT INTO sessions (user_id, token, expires_at)
      VALUES (${userId}, ${sessionToken}, ${expiresAt.toISOString()})
    `;

    // 5. Set session cookie and redirect
    // Need to append to existing Set-Cookie header
    const existingCookies = res.getHeader('Set-Cookie') || [];
    const cookieArray = Array.isArray(existingCookies) ? existingCookies : [existingCookies];
    
    const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
    const maxAge = 30 * 24 * 60 * 60;
    cookieArray.push(
      `se_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
    );
    
    res.setHeader('Set-Cookie', cookieArray);
    
    return res.redirect('/');
  } catch (error) {
    console.error('OAuth callback error:', error);
    return res.redirect('/?error=server_error');
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
