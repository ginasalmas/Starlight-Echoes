import { sql } from '@vercel/postgres';

/**
 * Shared database helper for all API routes.
 * Uses @vercel/postgres which automatically connects using POSTGRES_URL env var.
 */

export { sql };

/**
 * Get a user by their session token.
 */
export async function getUserFromToken(token) {
  if (!token) return null;
  
  const { rows } = await sql`
    SELECT u.id, u.google_id, u.email, u.display_name, u.avatar_url
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.token = ${token}
      AND s.expires_at > NOW()
    LIMIT 1
  `;
  
  return rows[0] || null;
}

/**
 * Get or create canvas for a user.
 */
export async function getOrCreateCanvas(userId) {
  // Try to get existing canvas
  let { rows } = await sql`
    SELECT * FROM canvases WHERE user_id = ${userId} LIMIT 1
  `;
  
  if (rows.length > 0) return rows[0];
  
  // Create default canvas
  const result = await sql`
    INSERT INTO canvases (user_id, center_name, title_text)
    VALUES (${userId}, 'My Universe', 'Starlight Echoes')
    RETURNING *
  `;
  
  return result.rows[0];
}
