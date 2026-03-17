import db, { type Protocol } from '@/lib/db'

// Primary: local bundled JSON; Fallback: GitHub raw content from labmate-recipe repo
const SYNC_URL_LOCAL = '/db/recipes-v1.json'
const SYNC_URL_REMOTE = 'https://raw.githubusercontent.com/mianaz/labmate-recipe/main/recipes-v1.json'

interface SyncPayload {
  version: number
  generatedAt: string
  protocols: Omit<Protocol, 'id' | 'createdAt' | 'updatedAt' | 'isFavorite' | 'lastUsed'>[]
}

interface SyncResult {
  added: number
  updated: number
  version: number
}

async function getSetting(key: string): Promise<string | undefined> {
  const row = await db.settings.where('key').equals(key).first()
  return row?.value
}

async function putSetting(key: string, value: string): Promise<void> {
  // Use upsert pattern: try update first, then add if not found
  const existing = await db.settings.where('key').equals(key).first()
  if (existing) {
    await db.settings.update(existing.id!, { value })
  } else {
    try {
      await db.settings.add({ key, value })
    } catch {
      // Handle race: another call inserted the key concurrently
      const retry = await db.settings.where('key').equals(key).first()
      if (retry) await db.settings.update(retry.id!, { value })
    }
  }
}

/** Fetch sync payload — try remote GitHub repo first, fallback to local bundle */
async function fetchPayload(): Promise<SyncPayload | null> {
  // Try remote repo first
  try {
    const res = await fetch(SYNC_URL_REMOTE, { cache: 'no-cache' })
    if (res.ok) return await res.json()
  } catch { /* remote unavailable */ }
  // Fallback to local bundled JSON
  try {
    const res = await fetch(SYNC_URL_LOCAL, { cache: 'no-cache' })
    if (res.ok) return await res.json()
  } catch { /* local unavailable */ }
  return null
}

/**
 * Check if a newer database version is available.
 * Returns the remote version number, or null if up-to-date / offline.
 */
export async function checkForUpdates(): Promise<number | null> {
  try {
    const data = await fetchPayload()
    if (!data) return null

    const localVersion = await getSetting('dbVersion')
    const local = localVersion ? parseInt(localVersion, 10) : 0

    return data.version > local ? data.version : null
  } catch {
    return null // offline or fetch error
  }
}

/**
 * Sync official protocols from the public JSON file.
 * - New externalIds → insert
 * - Existing official records with newer version → update (preserve isFavorite, lastUsed)
 * - Custom records → never touched
 */
export async function syncDatabase(): Promise<SyncResult> {
  const data = await fetchPayload()
  if (!data) throw new Error('Sync fetch failed: no payload available')
  const now = Date.now()

  let added = 0
  let updated = 0

  const VALID_CATEGORIES = ['buffer', 'protocol', 'staining', 'media']

  await db.transaction('rw', db.protocols, db.settings, async () => {
    for (const remote of data.protocols) {
      if (!remote.externalId || !remote.name || !VALID_CATEGORIES.includes(remote.category)) continue
      const existing = await db.protocols
        .where('externalId')
        .equals(remote.externalId)
        .first()

      if (!existing) {
        // New entry — insert
        await db.protocols.add({
          ...remote,
          source: 'official',
          isFavorite: false,
          createdAt: now,
          updatedAt: now,
        } as Protocol)
        added++
      } else if (existing.source === 'official' && remote.version > existing.version) {
        // Official entry with newer version — update, preserve user metadata
        await db.protocols.update(existing.id!, {
          ...remote,
          source: 'official',
          isFavorite: existing.isFavorite,
          lastUsed: existing.lastUsed,
          createdAt: existing.createdAt,
          updatedAt: now,
        })
        updated++
      }
      // Custom entries or same-version official entries → skip
    }

    // Update sync metadata
    await putSetting('dbVersion', String(data.version))
    await putSetting('lastSyncAt', new Date().toISOString())
  })

  return { added, updated, version: data.version }
}

/**
 * Get the last sync timestamp, or null if never synced.
 */
export async function getLastSyncTime(): Promise<string | null> {
  return (await getSetting('lastSyncAt')) ?? null
}
