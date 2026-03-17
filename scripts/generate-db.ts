/**
 * generate-db.ts — Reads static recipe/protocol data and outputs
 * a versioned JSON file to public/db/recipes-v1.json.
 *
 * Run: npx tsx scripts/generate-db.ts
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

// Use relative imports — these files have no @/ dependencies
import { RECIPES } from '../src/data/recipes.ts'
import { PROTOCOL_ENHANCEMENTS } from '../src/data/protocolEnhancements.ts'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface SeedProtocol {
  externalId: string
  name: string
  nameZh: string
  category: string
  tags: string[]
  components: { name: string; amount: number | string | null; unit: string; note?: string; mw?: number }[]
  instructions: { en: string; zh: string }
  reference?: string
  source: 'official'
  defaultVolume?: number
  unit?: string
  ph?: string
  estimatedTime?: string
  usage?: { en: string; zh: string }
  briefSteps?: { en: string; zh: string; isHeader?: boolean }[]
  detailedSteps?: { en: string; zh: string; isHeader?: boolean }[]
  materials?: { name: string; note?: { en: string; zh: string }; linkedRecipe?: string }[]
  storage?: { temp: string; duration: string; icon?: string; label: { en: string; zh: string } }
  version: number
}

function buildProtocols(): SeedProtocol[] {
  const protocols: SeedProtocol[] = []
  const seenIds = new Set<string>()

  for (const r of RECIPES) {
    seenIds.add(r.externalId)
    const enh = PROTOCOL_ENHANCEMENTS[r.externalId]

    const proto: SeedProtocol = {
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

    if (enh) {
      proto.estimatedTime = enh.estimatedTime
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

  // Enhancements without matching recipes
  const toTitle = (k: string) =>
    k.split('_').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')

  for (const [key, enh] of Object.entries(PROTOCOL_ENHANCEMENTS)) {
    if (seenIds.has(key)) continue

    protocols.push({
      externalId: key,
      name: toTitle(key),
      nameZh: toTitle(key),
      category: 'protocol',
      tags: [],
      components: [],
      instructions: { en: '', zh: '' },
      source: 'official',
      version: 1,
      estimatedTime: enh.estimatedTime,
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

// ── Main ──
const protocols = buildProtocols()
const output = {
  version: 1,
  generatedAt: new Date().toISOString(),
  protocols,
}

const outDir = resolve(__dirname, '../public/db')
mkdirSync(outDir, { recursive: true })

const outPath = resolve(outDir, 'recipes-v1.json')
writeFileSync(outPath, JSON.stringify(output, null, 2))

console.log(`Generated ${outPath}`)
console.log(`  ${protocols.length} protocols (${protocols.filter(p => p.category !== 'protocol').length} recipes + ${protocols.filter(p => p.category === 'protocol').length} protocols)`)
