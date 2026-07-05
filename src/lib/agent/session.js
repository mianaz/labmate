// ──────────────────────────────────────────────────────────────────────────────
// Agent session id — a stable anonymous UUID for per-session rate limiting.
// ──────────────────────────────────────────────────────────────────────────────
//
// Sent to the owner proxy as X-LabMate-Session so the backend can apply the
// per-session/tier limits without any account. Persisted in db.settings; not
// PII, just a random handle. (The backend also falls back to per-IP, so a
// missing/spoofed id can't bypass the global spend cap.)
// ──────────────────────────────────────────────────────────────────────────────

import db from '../db.js';

const SETTINGS_KEY = 'agent_session';

export function generateSessionId() {
  try {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  } catch { /* fall through */ }
  // Fallback: timestamp + random, adequate for a non-security handle.
  return `sess_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function getAgentSessionId() {
  try {
    const row = await db.settings.get(SETTINGS_KEY);
    if (row?.value) return row.value;
    const id = generateSessionId();
    await db.settings.put({ key: SETTINGS_KEY, value: id });
    return id;
  } catch {
    return generateSessionId();
  }
}
