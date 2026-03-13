import { useLiveQuery } from 'dexie-react-hooks'
import db, { type Protocol } from '@/lib/db'

type Category = Protocol['category']

/**
 * Live-query protocols from IndexedDB, optionally filtered by category.
 * Returns undefined while loading, then Protocol[].
 */
export function useProtocols(category?: Category | Category[]) {
  return useLiveQuery(() => {
    if (!category) return db.protocols.toArray()

    const cats = Array.isArray(category) ? category : [category]
    return db.protocols
      .where('category')
      .anyOf(cats)
      .toArray()
  }, [Array.isArray(category) ? category.join(',') : category])
}

/**
 * Look up a single protocol by externalId.
 */
export function useProtocol(externalId: string | null) {
  return useLiveQuery(
    () => externalId
      ? db.protocols.where('externalId').equals(externalId).first()
      : undefined,
    [externalId],
  )
}

/**
 * Toggle the isFavorite flag on a protocol.
 */
export async function toggleFavorite(id: number) {
  const proto = await db.protocols.get(id)
  if (!proto) return
  await db.protocols.update(id, {
    isFavorite: !proto.isFavorite,
    updatedAt: Date.now(),
  })
}

/**
 * Update lastUsed timestamp.
 */
export async function markUsed(id: number) {
  await db.protocols.update(id, {
    lastUsed: Date.now(),
    updatedAt: Date.now(),
  })
}
