import { sql, getOrCreateCanvas } from '../lib/db.js';
import { getAuthUser } from '../lib/auth.js';

/**
 * /api/orbits
 * GET    — returns all orbit items for user's canvas
 * POST   — creates a new orbit item
 * PUT    — updates an orbit item (requires ?id=UUID)
 * DELETE — removes an orbit item (requires ?id=UUID)
 */
export default async function handler(req, res) {
  const user = await getAuthUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });

  try {
    const canvas = await getOrCreateCanvas(user.id);

    // ─── GET all orbit items ───
    if (req.method === 'GET') {
      const { rows } = await sql`
        SELECT * FROM orbit_items 
        WHERE canvas_id = ${canvas.id}
        ORDER BY sort_order ASC, created_at ASC
      `;
      return res.status(200).json(rows);
    }

    // ─── POST new orbit item ───
    if (req.method === 'POST') {
      const { photo_url, label, message } = req.body;

      // Count existing items to determine ring/sort
      const { rows: countRows } = await sql`
        SELECT COUNT(*) as cnt FROM orbit_items WHERE canvas_id = ${canvas.id}
      `;
      const count = parseInt(countRows[0].cnt);
      const ringIndex = Math.floor(count / 6);
      const angle = (count % 6) * (Math.PI * 2 / 6) + Math.random() * 0.5;

      const { rows } = await sql`
        INSERT INTO orbit_items (canvas_id, photo_url, label, message, ring_index, angle, sort_order)
        VALUES (${canvas.id}, ${photo_url || null}, ${label || 'New Star'}, ${message || ''}, ${ringIndex}, ${angle}, ${count})
        RETURNING *
      `;

      return res.status(201).json(rows[0]);
    }

    // ─── PUT update orbit item ───
    if (req.method === 'PUT') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing orbit item id' });

      const { photo_url, label, message, ring_index, angle } = req.body;

      // Verify ownership
      const { rows: check } = await sql`
        SELECT id FROM orbit_items WHERE id = ${id} AND canvas_id = ${canvas.id}
      `;
      if (check.length === 0) return res.status(404).json({ error: 'Not found' });

      const { rows } = await sql`
        UPDATE orbit_items SET
          photo_url = COALESCE(${photo_url ?? null}, photo_url),
          label = COALESCE(${label ?? null}, label),
          message = COALESCE(${message ?? null}, message),
          ring_index = COALESCE(${ring_index ?? null}, ring_index),
          angle = COALESCE(${angle ?? null}, angle),
          updated_at = NOW()
        WHERE id = ${id}
        RETURNING *
      `;

      return res.status(200).json(rows[0]);
    }

    // ─── DELETE orbit item ───
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'Missing orbit item id' });

      // Verify ownership
      const { rows: check } = await sql`
        SELECT id FROM orbit_items WHERE id = ${id} AND canvas_id = ${canvas.id}
      `;
      if (check.length === 0) return res.status(404).json({ error: 'Not found' });

      await sql`DELETE FROM orbit_items WHERE id = ${id}`;

      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Orbits API error:', error);
    return res.status(500).json({ error: error.message });
  }
}
