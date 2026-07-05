// ──────────────────────────────────────────────────────────────────────────────
// Agent tool permissions — persisted per-tool policy (auto | ask | off).
// ──────────────────────────────────────────────────────────────────────────────
//
// Only WRITE tools are gated (reads/compute always run). Stored as one row in
// db.settings so it survives reloads and rides along in the unified backup.
// Default is 'ask' — nothing mutates local data without an explicit confirm
// until the user chooses "Allow & remember" (which flips that tool to 'auto').
// ──────────────────────────────────────────────────────────────────────────────

import db from '../db.js';

const SETTINGS_KEY = 'agent_permissions';

// Keep in sync with the write tools in tools.js.
export const WRITE_TOOLS = ['createExperiment', 'scheduleCalendarEvent', 'exportProtocol'];
export const PERMISSION_MODES = ['auto', 'ask', 'off'];

export const DEFAULT_PERMISSIONS = Object.freeze(
  Object.fromEntries(WRITE_TOOLS.map((t) => [t, 'ask']))
);

function sanitize(obj) {
  const out = { ...DEFAULT_PERMISSIONS };
  for (const t of WRITE_TOOLS) {
    if (obj && PERMISSION_MODES.includes(obj[t])) out[t] = obj[t];
  }
  return out;
}

export async function loadPermissions() {
  try {
    const row = await db.settings.get(SETTINGS_KEY);
    return sanitize(row?.value);
  } catch {
    return { ...DEFAULT_PERMISSIONS };
  }
}

export async function savePermissions(perms) {
  const clean = sanitize(perms);
  await db.settings.put({ key: SETTINGS_KEY, value: clean });
  return clean;
}

/** Set one tool's mode, persist, and return the merged map. */
export async function setPermission(name, mode) {
  if (!WRITE_TOOLS.includes(name) || !PERMISSION_MODES.includes(mode)) {
    return loadPermissions();
  }
  const cur = await loadPermissions();
  return savePermissions({ ...cur, [name]: mode });
}
