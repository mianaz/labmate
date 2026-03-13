import { RECIPES } from '@/data/recipes'
import { PROTOCOL_ENHANCEMENTS } from '@/data/protocolEnhancements'
import db, { type Protocol } from '@/lib/db'

/**
 * Maps static RECIPES + PROTOCOL_ENHANCEMENTS into unified Protocol objects.
 * Merges by externalId — a recipe with a matching enhancement produces a
 * single record with both component data and protocol steps.
 */
export function getSeedProtocols(): Omit<Protocol, 'id'>[] {
  const now = Date.now()
  const protocols: Omit<Protocol, 'id'>[] = []
  const seenIds = new Set<string>()

  // First pass: all recipes (some may have matching enhancements)
  for (const r of RECIPES) {
    seenIds.add(r.externalId)
    const enh = PROTOCOL_ENHANCEMENTS[r.externalId]

    const proto: Omit<Protocol, 'id'> = {
      externalId: r.externalId,
      name: r.name,
      nameZh: r.nameZh,
      category: r.category,
      tags: r.tags,
      components: r.components.map(c => ({
        name: c.name,
        amount: c.amount,
        unit: c.unit,
        note: c.note,
        mw: c.mw,
      })),
      instructions: r.instructions,
      reference: r.reference,
      source: 'official',
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      defaultVolume: r.defaultVolume,
      unit: r.unit,
      ph: r.ph,
      storage: r.storage ? {
        temp: r.storage.temp,
        duration: r.storage.duration,
        label: r.storage.label,
      } : undefined,
      version: 1,
    }

    // Merge enhancement data if available
    if (enh) {
      proto.usage = enh.usage
      proto.briefSteps = enh.briefSteps
      proto.detailedSteps = enh.detailedSteps
      proto.materials = enh.materials.map(m => ({
        name: m.name,
        note: m.note,
        linkedRecipe: m.linkedRecipe,
      }))
      if (enh.storage) {
        proto.storage = {
          temp: enh.storage.temp,
          duration: enh.storage.duration,
          icon: enh.storage.icon,
          label: enh.storage.label,
        }
      }
    }

    protocols.push(proto)
  }

  // Second pass: enhancements without matching recipes (protocol-only entries)
  for (const [key, enh] of Object.entries(PROTOCOL_ENHANCEMENTS)) {
    if (seenIds.has(key)) continue

    const toTitle = (k: string) =>
      k.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')

    protocols.push({
      externalId: key,
      name: toTitle(key),
      nameZh: toTitle(key), // fallback — no Chinese name available
      category: 'protocol',
      tags: [],
      components: [],
      instructions: { en: '', zh: '' },
      source: 'official',
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
      version: 1,
      usage: enh.usage,
      briefSteps: enh.briefSteps,
      detailedSteps: enh.detailedSteps,
      materials: enh.materials.map(m => ({
        name: m.name,
        note: m.note,
        linkedRecipe: m.linkedRecipe,
      })),
      storage: enh.storage ? {
        temp: enh.storage.temp,
        duration: enh.storage.duration,
        icon: enh.storage.icon,
        label: enh.storage.label,
      } : undefined,
    })
  }

  return protocols
}

/**
 * Seeds the protocols table if it's empty.
 * Called once at app startup.
 */
export async function seedIfEmpty(): Promise<void> {
  const count = await db.protocols.count()
  if (count > 0) return

  const seeds = getSeedProtocols()
  await db.protocols.bulkAdd(seeds as Protocol[])
}
