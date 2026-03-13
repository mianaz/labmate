import { db } from '@/lib/db'
import type { StorageLocation, SampleBox, Sample, SampleType, BoxType, StorageType } from '@/lib/db'

const VALID_SAMPLE_TYPES: SampleType[] = [
  'cell_line', 'plasmid', 'antibody', 'primer',
  'protein', 'reagent', 'tissue', 'virus', 'other',
]

const VALID_BOX_TYPES: BoxType[] = ['cryo_81', 'cryo_100', 'tip', 'slide', 'tube', 'custom']
// StorageType validated via guessLocationType below

// ── CSV Template ──
export function generateCsvTemplate() {
  const headers = [
    'Location', 'Temperature', 'Box', 'BoxType', 'Position',
    'Name', 'Name (ZH)', 'Type', 'Quantity', 'Concentration',
    'Passage', 'Date Stored', 'Expiry Date', 'Owner', 'Tags', 'Description', 'Notes',
  ]

  const exampleRows = [
    ['-80 Freezer #1', '-80\u00B0C', 'Box A-1', 'cryo_81', 'A1',
     'HEK293T P12', '', 'cell_line', '1 mL', '',
     'P12', '2026-01-15', '', 'Miana', 'validated; mycoplasma-free', '', ''],
    ['-80 Freezer #1', '-80\u00B0C', 'Box A-1', 'cryo_81', 'A2',
     'pCMV-GFP', '', 'plasmid', '50 µL', '500 ng/µL',
     '', '2026-02-01', '2027-02-01', 'Miana', 'cloning', 'GFP expression vector', ''],
    ['-20 Freezer', '-20\u00B0C', 'Antibody Box', 'cryo_81', 'B3',
     'Anti-GAPDH', '抗GAPDH', 'antibody', '100 µL', '1 mg/mL',
     '', '2025-11-20', '2026-11-20', '', 'WB; IF', 'Mouse monoclonal', 'Lot# 12345'],
  ]

  const csv = [
    headers.join(','),
    ...exampleRows.map(row => row.map(csvEscape).join(',')),
  ].join('\n')

  downloadFile(csv, 'labmate_inventory_template.csv', 'text/csv;charset=utf-8')
}

// ── Import file (auto-detect CSV or JSON) ──
export async function importInventoryFile(file: File): Promise<{ message: string; count: number }> {
  const text = await file.text()

  if (file.name.endsWith('.json')) {
    return importJson(text)
  }
  return importCsv(text)
}

// ── Import JSON backup ──
async function importJson(text: string): Promise<{ message: string; count: number }> {
  const payload = JSON.parse(text)

  if (payload.labmate_export !== 'inventory' || !payload.data) {
    throw new Error('Invalid LabMate inventory JSON file')
  }

  const { locations, boxes, samples } = payload.data as {
    locations: StorageLocation[]
    boxes: SampleBox[]
    samples: Sample[]
  }

  // Import with ID remapping to avoid conflicts
  const now = Date.now()
  const locationIdMap = new Map<number, number>()
  const boxIdMap = new Map<number, number>()

  // Import locations
  for (const loc of locations) {
    const oldId = loc.id!
    const newId = await db.storageLocations.add({
      name: loc.name,
      nameZh: loc.nameZh,
      type: loc.type,
      temperature: loc.temperature,
      parentId: loc.parentId ? locationIdMap.get(loc.parentId) : undefined,
      order: loc.order,
      createdAt: loc.createdAt || now,
      updatedAt: now,
    })
    locationIdMap.set(oldId, newId as number)
  }

  // Import boxes
  for (const box of boxes) {
    const oldId = box.id!
    const newLocId = locationIdMap.get(box.locationId)
    if (!newLocId) continue
    const newId = await db.sampleBoxes.add({
      name: box.name,
      nameZh: box.nameZh,
      locationId: newLocId,
      boxType: box.boxType,
      rows: box.rows,
      cols: box.cols,
      color: box.color,
      createdAt: box.createdAt || now,
      updatedAt: now,
    })
    boxIdMap.set(oldId, newId as number)
  }

  // Import samples
  let sampleCount = 0
  for (const sample of samples) {
    const newBoxId = boxIdMap.get(sample.boxId)
    if (!newBoxId) continue
    await db.samples.add({
      name: sample.name,
      nameZh: sample.nameZh,
      boxId: newBoxId,
      position: sample.position,
      sampleType: sample.sampleType,
      description: sample.description,
      quantity: sample.quantity,
      concentration: sample.concentration,
      passage: sample.passage,
      dateStored: sample.dateStored || now,
      expiryDate: sample.expiryDate,
      owner: sample.owner,
      tags: sample.tags || [],
      notes: sample.notes,
      isFavorite: sample.isFavorite,
      createdAt: sample.createdAt || now,
      updatedAt: now,
    })
    sampleCount++
  }

  return {
    message: `${locationIdMap.size} locations, ${boxIdMap.size} boxes, ${sampleCount} samples`,
    count: sampleCount,
  }
}

// ── Import CSV ──
async function importCsv(text: string): Promise<{ message: string; count: number }> {
  const rows = parseCsv(text)
  if (rows.length < 2) throw new Error('CSV file is empty or has no data rows')

  const headers = rows[0].map(h => h.trim().toLowerCase())
  const dataRows = rows.slice(1).filter(row => row.some(cell => cell.trim()))

  // Map column indices
  const col = (name: string): number => {
    const variants: Record<string, string[]> = {
      location: ['location'],
      temperature: ['temperature', 'temp'],
      box: ['box'],
      boxtype: ['boxtype', 'box type'],
      position: ['position', 'pos'],
      name: ['name'],
      namezh: ['name (zh)', 'name (chinese)', 'namezh', 'chinese name'],
      type: ['type', 'sample type', 'sampletype'],
      quantity: ['quantity', 'qty'],
      concentration: ['concentration', 'conc'],
      passage: ['passage'],
      datestored: ['date stored', 'datestored', 'date'],
      expirydate: ['expiry date', 'expirydate', 'expiry'],
      owner: ['owner'],
      tags: ['tags'],
      description: ['description', 'desc'],
      notes: ['notes'],
    }
    const alts = variants[name] ?? [name]
    for (const alt of alts) {
      const idx = headers.indexOf(alt)
      if (idx !== -1) return idx
    }
    return -1
  }

  const now = Date.now()
  const locationCache = new Map<string, number>()  // "name|temp" → id
  const boxCache = new Map<string, number>()        // "locationId|name|type" → id

  let sampleCount = 0

  for (const row of dataRows) {
    const get = (name: string) => {
      const idx = col(name)
      return idx >= 0 && idx < row.length ? row[idx].trim() : ''
    }

    const locationName = get('location')
    const temperature = get('temperature')
    const boxName = get('box')
    const boxTypeRaw = get('boxtype')
    const position = get('position')
    const sampleName = get('name')

    if (!sampleName || !position) continue

    // Resolve or create location
    let locationId: number
    const locKey = `${locationName}|${temperature}`
    if (locationCache.has(locKey)) {
      locationId = locationCache.get(locKey)!
    } else if (locationName) {
      // Check if location already exists
      const existing = await db.storageLocations.where('name').equals(locationName).first()
      if (existing) {
        locationId = existing.id!
      } else {
        locationId = await db.storageLocations.add({
          name: locationName,
          nameZh: '',
          type: guessLocationType(locationName, temperature),
          temperature: temperature || undefined,
          order: locationCache.size,
          createdAt: now,
          updatedAt: now,
        }) as number
      }
      locationCache.set(locKey, locationId)
    } else {
      // Default location
      const defaultKey = '_default|'
      if (!locationCache.has(defaultKey)) {
        const id = await db.storageLocations.add({
          name: 'Imported',
          nameZh: '导入',
          type: 'shelf',
          order: 0,
          createdAt: now,
          updatedAt: now,
        }) as number
        locationCache.set(defaultKey, id)
      }
      locationId = locationCache.get(defaultKey)!
    }

    // Resolve or create box
    const boxType = validateBoxType(boxTypeRaw)
    const boxKey = `${locationId}|${boxName || 'Default Box'}|${boxType}`
    let boxId: number
    if (boxCache.has(boxKey)) {
      boxId = boxCache.get(boxKey)!
    } else {
      const resolvedBoxName = boxName || 'Default Box'
      const existing = await db.sampleBoxes.where('name').equals(resolvedBoxName).first()
      if (existing && existing.locationId === locationId) {
        boxId = existing.id!
      } else {
        const dims = getBoxDimensions(boxType)
        boxId = await db.sampleBoxes.add({
          name: resolvedBoxName,
          nameZh: '',
          locationId,
          boxType,
          rows: dims.rows,
          cols: dims.cols,
          createdAt: now,
          updatedAt: now,
        }) as number
      }
      boxCache.set(boxKey, boxId)
    }

    // Check for existing sample at this position in this box
    const existingAtPos = await db.samples
      .where(['boxId', 'position'])
      .equals([boxId, position])
      .first()
    if (existingAtPos) continue // Skip duplicates

    // Create sample
    const sampleType = validateSampleType(get('type'))
    const tags = get('tags').split(/[;,]/).map(s => s.trim()).filter(Boolean)
    const dateStored = parseDate(get('datestored')) ?? now
    const expiryDate = parseDate(get('expirydate'))

    await db.samples.add({
      name: sampleName,
      nameZh: get('namezh') || undefined,
      boxId,
      position: position.toUpperCase(),
      sampleType,
      description: get('description') || undefined,
      quantity: get('quantity') || undefined,
      concentration: get('concentration') || undefined,
      passage: get('passage') || undefined,
      dateStored,
      expiryDate,
      owner: get('owner') || undefined,
      tags,
      notes: get('notes') || undefined,
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    })
    sampleCount++
  }

  return {
    message: `${sampleCount} samples imported`,
    count: sampleCount,
  }
}

// ── Helpers ──

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let current: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        field += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        current.push(field)
        field = ''
      } else if (ch === '\n' || (ch === '\r' && text[i + 1] === '\n')) {
        current.push(field)
        field = ''
        rows.push(current)
        current = []
        if (ch === '\r') i++
      } else {
        field += ch
      }
    }
  }
  // Last field/row
  if (field || current.length > 0) {
    current.push(field)
    rows.push(current)
  }

  return rows
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function validateSampleType(raw: string): SampleType {
  const normalized = raw.toLowerCase().replace(/\s+/g, '_')
  if (VALID_SAMPLE_TYPES.includes(normalized as SampleType)) return normalized as SampleType
  // Common aliases
  if (normalized === 'cell' || normalized === 'cells') return 'cell_line'
  if (normalized === 'ab') return 'antibody'
  return 'other'
}

function validateBoxType(raw: string): BoxType {
  const normalized = raw.toLowerCase().replace(/\s+/g, '_')
  if (VALID_BOX_TYPES.includes(normalized as BoxType)) return normalized as BoxType
  if (normalized.includes('81') || normalized === '9x9') return 'cryo_81'
  if (normalized.includes('100') || normalized === '10x10') return 'cryo_100'
  return 'cryo_81' // default
}

function guessLocationType(name: string, temp: string): StorageType {
  const n = (name + ' ' + temp).toLowerCase()
  if (n.includes('-80') || n.includes('freezer') || n.includes('-20')) return 'freezer'
  if (n.includes('fridge') || n.includes('4°c') || n.includes('4c')) return 'fridge'
  if (n.includes('ln2') || n.includes('nitrogen') || n.includes('tank')) return 'tank'
  if (n.includes('rack')) return 'rack'
  return 'shelf'
}

function getBoxDimensions(boxType: BoxType): { rows: number; cols: number } {
  const dims: Record<BoxType, { rows: number; cols: number }> = {
    cryo_81: { rows: 9, cols: 9 },
    cryo_100: { rows: 10, cols: 10 },
    tip: { rows: 8, cols: 12 },
    slide: { rows: 1, cols: 25 },
    tube: { rows: 4, cols: 6 },
    custom: { rows: 8, cols: 8 },
  }
  return dims[boxType]
}

function parseDate(str: string): number | undefined {
  if (!str) return undefined
  const d = new Date(str)
  return isNaN(d.getTime()) ? undefined : d.getTime()
}
