/**
 * API Client — thin wrapper for all backend API calls.
 * Handles JSON encoding, error responses, and file uploads.
 */

const API_BASE = '';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body && !(options.body instanceof File) ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const error = new Error(errorData.error || `API Error: ${res.status}`);
    error.status = res.status;
    throw error;
  }

  return res.json();
}

// ═══════════════════════════════════
// AUTH
// ═══════════════════════════════════
export function getLoginUrl() {
  return '/api/auth/google';
}

export async function getCurrentUser() {
  return request('/api/auth/me');
}

export async function logout() {
  return request('/api/auth/logout', { method: 'POST' });
}

// ═══════════════════════════════════
// CANVAS
// ═══════════════════════════════════
export async function getCanvas() {
  return request('/api/canvas');
}

export async function updateCanvas(data) {
  return request('/api/canvas', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ═══════════════════════════════════
// ORBIT ITEMS
// ═══════════════════════════════════
export async function getOrbitItems() {
  return request('/api/orbits');
}

export async function createOrbitItem(data) {
  return request('/api/orbits', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateOrbitItem(id, data) {
  return request(`/api/orbits?id=${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function deleteOrbitItem(id) {
  return request(`/api/orbits?id=${id}`, { method: 'DELETE' });
}

// ═══════════════════════════════════
// FILE UPLOAD
// ═══════════════════════════════════
export async function uploadImage(file) {
  const res = await fetch(`/api/upload?filename=${encodeURIComponent(file.name)}`, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': file.type },
    body: file,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Upload failed');
  }

  return res.json();
}

// ═══════════════════════════════════
// PROFILE
// ═══════════════════════════════════
export async function updateProfile(data) {
  return request('/api/profile', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ═══════════════════════════════════
// DB MIGRATION
// ═══════════════════════════════════
export async function runMigration() {
  return request('/api/db/migrate', { method: 'POST' });
}
