import { sql } from '@vercel/postgres';

/**
 * POST /api/db/migrate
 * Creates all required database tables.
 * Safe to run multiple times (uses IF NOT EXISTS).
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        google_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        display_name VARCHAR(255) NOT NULL,
        avatar_url TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Canvas settings per user
    await sql`
      CREATE TABLE IF NOT EXISTS canvases (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        center_photo_url TEXT,
        center_name VARCHAR(255) DEFAULT 'My Universe',
        title_text VARCHAR(255) DEFAULT 'Starlight Echoes',
        pan_x FLOAT DEFAULT 0,
        pan_y FLOAT DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `;

    // Orbit items
    await sql`
      CREATE TABLE IF NOT EXISTS orbit_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        canvas_id UUID REFERENCES canvases(id) ON DELETE CASCADE,
        photo_url TEXT,
        label VARCHAR(255) NOT NULL DEFAULT 'New Star',
        message TEXT,
        ring_index INTEGER DEFAULT 0,
        angle FLOAT DEFAULT 0,
        sort_order INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `;

    // Sessions
    await sql`
      CREATE TABLE IF NOT EXISTS sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        token TEXT UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `;

    return res.status(200).json({ 
      success: true, 
      message: 'All tables created successfully',
      tables: ['users', 'canvases', 'orbit_items', 'sessions']
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({ error: error.message });
  }
}
