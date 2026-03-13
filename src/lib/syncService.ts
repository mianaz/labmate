import db, { type Protocol } from '@/lib/db'

const SYNC_URL = '/db/recipes-v1.json'

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
  const existing = await db.settings.where('key').equals(key).first()
  if (existing) {
    await db.settings.update(existing.id!, { value })
  } else {
    await db.settings.add({ key, value })
  }
}

/**
 * Check if a newer database version is available.
 * Returns the remote version number, or null if up-to-date / offline.
 */
export async function checkForUpdates(): Promise<number | null> {
  try {
    const res = await fetch(SYNC_URL, { cache: 'no-cache' })
    if (!res.ok) return null

    const data: SyncPayload = await res.json()
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
  const res = await fetch(SYNC_URL, { cache: 'no-cache' })
  if (!res.ok) throw new Error(`Sync fetch failed: ${res.status}`)

  const data: SyncPayload = await res.json()
  const now = Date.now()

  let added = 0
  let updated = 0

  await db.transaction('rw', db.protocols, db.settings, async () => {
    for (const remote of data.protocols) {
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
