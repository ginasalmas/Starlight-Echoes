import { SignJWT, jwtVerify } from 'jose';
import { getUserFromToken } from './db.js';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'starlight-echoes-default-secret'
);

/**
 * Create a JWT token for a user session.
 */
export async function createSessionToken(userId) {
  return new SignJWT({ userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(JWT_SECRET);
}

/**
 * Verify and decode a JWT token.
 */
export async function verifySessionToken(token) {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract the authenticated user from request cookies.
 * Returns null if not authenticated.
 */
export async function getAuthUser(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionToken = cookies['se_session'];
  
  if (!sessionToken) return null;
  
  const payload = await verifySessionToken(sessionToken);
  if (!payload) return null;
  
  return getUserFromToken(sessionToken);
}

/**
 * Set the session cookie on a response.
 */
export function setSessionCookie(res, token, maxAgeDays = 30) {
  const maxAge = maxAgeDays * 24 * 60 * 60;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const sameSite = process.env.NODE_ENV === 'production' ? 'Lax' : 'Lax';
  
  res.setHeader('Set-Cookie', 
    `se_session=${token}; Path=/; HttpOnly; SameSite=${sameSite}; Max-Age=${maxAge}${secure}`
  );
}

/**
 * Clear the session cookie.
 */
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie',
    'se_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'
  );
}

/**
 * Simple cookie parser.
 */
function parseCookies(cookieString) {
  const cookies = {};
  if (!cookieString) return cookies;
  
  cookieString.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name) {
      cookies[name.trim()] = rest.join('=').trim();
    }
  });
  
  return cookies;
}
