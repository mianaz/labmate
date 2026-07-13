// ──────────────────────────────────────────────────────────────────────────────
// Credential store — BYO provider keys & OAuth tokens, kept OFF the backup path.
// ──────────────────────────────────────────────────────────────────────────────
//
// These are the only secrets the app holds client-side (owner-proxy mode has
// none). They live in their own Dexie table `credentials`, which the backup /
// export code (backup.js) never reads — so a shared or emailed backup file can
// never carry a key or token. Nothing here ever writes to localStorage or the
// `settings` table, both of which DO ride the backup. Values stay on-device and
// are sent only to the provider the user chose (BYOK-direct / local endpoint),
// never to our server.
//
// This is the storage foundation for the Phase-A "bring your own key" and
// Phase-C OAuth lanes; the UI that reads/writes these lands with those phases.
// ──────────────────────────────────────────────────────────────────────────────

import db from './db.js';

/** Store (or overwrite) a secret by name, e.g. setCredential('openrouter', 'sk-…'). */
export async function setCredential(name, value) {
  if (!name) return;
  await db.credentials.put({ name, value: String(value ?? ''), updatedAt: Date.now() });
}

/** Read a secret's value, or null if unset / on any error. */
export async function getCredential(name) {
  try {
    const row = await db.credentials.get(name);
    return row?.value ?? null;
  } catch { return null; }
}

/** Remove a secret. */
export async function deleteCredential(name) {
  try { await db.credentials.delete(name); } catch { /* ignore */ }
}

/** Names only (never values) — e.g. to show which providers are configured. */
export async function listCredentialNames() {
  try { return (await db.credentials.toArray()).map((r) => r.name); }
  catch { return []; }
}
