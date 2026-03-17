import { db } from '@/lib/db'
import type { StorageLocation, SampleBox, Sample, SampleType, BoxType, StorageType } from '@/lib/db'
import type { ParsedWorkbook } from './parseExcel'

const VALID_SAMPLE_TYPES: SampleType[] = [
  'cell_line', 'plasmid', 'antibody', 'primer',
  'protein', 'reagent', 'tissue', 'virus', 'compound', 'other',
]

const VALID_BOX_TYPES: BoxType[] = ['cryo_81', 'cryo_100', 'tip', 'slide', 'tube', 'shelf', 'box', 'custom']
// StorageType validated via guessLocationType below

// ── CSV Template ──
export function generateCsvTemplate() {
  const headers = [
    'Location', 'Temperature', 'Box', 'BoxType', 'Position',
    'Name', 'Name (ZH)', 'Type', 'Quantity', 'Concentration',
    'Passage', 'Vendor', 'Catalog #', 'Lot #',
    'Date Stored', 'Expiry Date', 'Owner', 'Tags', 'Description', 'Notes',
  ]

  const exampleRows = [
    ['-80 Freezer #1', '-80\u00B0C', 'Box A-1', 'cryo_81', 'A1',
     'HEK293T P12', '', 'cell_line', '1 mL', '',
     'P12', '', '', '',
     '2026-01-15', '', 'Miana', 'validated; mycoplasma-free', '', ''],
    ['-80 Freezer #1', '-80\u00B0C', 'Box A-1', 'cryo_81', 'A2',
     'pCMV-GFP', '', 'plasmid', '50 µL', '500 ng/µL',
     '', 'Addgene', '#12345', '',
     '2026-02-01', '2027-02-01', 'Miana', 'cloning', 'GFP expression vector', ''],
    ['-20 Freezer', '-20\u00B0C', 'Antibody Box', 'cryo_81', 'B3',
     'Anti-GAPDH', '抗GAPDH', 'antibody', '100 µL', '1 mg/mL',
     '', 'CST', '5174S', 'Lot# 12345',
     '2025-11-20', '2026-11-20', '', 'WB; IF', 'Mouse monoclonal', ''],
  ]

  const csv = [
    headers.join(','),
    ...exampleRows.map(row => row.map(csvEscape).join(',')),
  ].join('\n')

  downloadFile(csv, 'labmate_inventory_template.csv', 'text/csv;charset=utf-8')
}

// ── Import file (auto-detect CSV, JSON, or XLSX) ──
export type ImportResult = { message: string; count: number }

export async function importInventoryFile(
  file: File,
): Promise<ImportResult | { needsWizard: true; workbook: ParsedWorkbook }> {
  if (file.name.endsWith('.json')) {
    const text = await file.text()
    return importJson(text)
  }

  if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
    const { parseExcelFile } = await import('./parseExcel')
    const workbook = await parseExcelFile(file)
    const importableSheets = workbook.sheets.filter(s => s.kind !== 'skip')

    // Single simple sheet → import directly
    if (importableSheets.length === 1 && importableSheets[0].kind === 'tabular') {
      return importTabularSheet(importableSheets[0])
    }

    // Multi-sheet → needs wizard
    return { needsWizard: true, workbook }
  }

  const text = await file.text()
  return importCsv(text)
}

// ── Import a single parsed tabular sheet ──
async function importTabularSheet(
  sheet: import('./parseExcel').ParsedSheet,
  overrideType?: SampleType,
  defaultOwner?: string,
): Promise<ImportResult> {
  const now = Date.now()
  const sType = overrideType ?? sheet.detectedType
  const { col: colFn } = await import('./parseExcel')

  let count = 0

  await db.transaction('rw', db.storageLocations, db.sampleBoxes, db.samples, async () => {
    // Resolve or create location and box (dedup by name)
    const locName = `Imported - ${sheet.name}`
    const existingLoc = await db.storageLocations.where('name').equals(locName).first()
    const locationId = existingLoc?.id ?? await db.storageLocations.add({
      name: locName,
      nameZh: '',
      type: 'shelf' as StorageType,
      order: 0,
      createdAt: now,
      updatedAt: now,
    }) as number

    const existingBox = await db.sampleBoxes.where('name').equals(sheet.name).first()
    const boxId = (existingBox && existingBox.locationId === locationId)
      ? existingBox.id!
      : await db.sampleBoxes.add({
          name: sheet.name,
          nameZh: '',
          locationId,
          boxType: 'cryo_81',
          rows: 9,
          cols: 9,
          createdAt: now,
          updatedAt: now,
        }) as number

    const headers = sheet.headers

    for (const row of sheet.rows) {
      const get = (field: string) => {
        const idx = colFn(headers, field)
        if (idx < 0) return ''
        const key = headers[idx]
        return row[key]?.trim() ?? ''
      }

      const name = get('name')
      if (!name) continue

      // Auto-assign position (cap to box dimensions)
      const boxRows = 9
      const boxCols = 9
      if (count >= boxRows * boxCols) break // box full
      const posRow = Math.floor(count / boxCols)
      const posCol = count % boxCols
      const position = `${String.fromCharCode(65 + posRow)}${posCol + 1}`

      const metadata: Record<string, string> = {}
      if (sType === 'antibody') {
        const d = get('dilution'); if (d) metadata.dilution = d
        const c = get('clone'); if (c) metadata.clone = c
        const h = get('host'); if (h) metadata.hostSpecies = h
        const r = get('reactivity'); if (r) metadata.reactivity = r
        const m = get('mw'); if (m) metadata.mw = m
        const a = get('application'); if (a) metadata.application = a
      } else if (sType === 'primer') {
        const s = get('sequence'); if (s) metadata.sequence = s
        const t = get('targetGene'); if (t) metadata.targetGene = t
        const a = get('ampliconSize'); if (a) metadata.ampliconSize = a
        const sp = get('species'); if (sp) metadata.species = sp
      } else if (sType === 'compound') {
        const ct = get('compoundType'); if (ct) metadata.compoundType = ct
      }

      await db.samples.add({
        name,
        boxId,
        position,
        sampleType: sType,
        vendor: get('vendor') || undefined,
        catalogNumber: get('catalog') || undefined,
        lotNumber: get('lot') || undefined,
        quantity: get('quantity') || undefined,
        concentration: get('concentration') || undefined,
        owner: get('owner') || defaultOwner || undefined,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
        tags: [],
        notes: get('notes') || undefined,
        dateStored: now,
        isFavorite: false,
        createdAt: now,
        updatedAt: now,
      })
      count++
    }
  })

  return { message: `${count} samples imported from "${sheet.name}"`, count }
}

// ── Import selected sheets from wizard ──
export async function importSelectedSheets(
  workbook: ParsedWorkbook,
  selections: Array<{
    sheetName: string
    sampleType: SampleType
    defaultOwner?: string
  }>,
): Promise<ImportResult> {
  let totalCount = 0
  const messages: string[] = []

  for (const sel of selections) {
    const sheet = workbook.sheets.find(s => s.name === sel.sheetName)
    if (!sheet || sheet.kind === 'skip') continue

    if (sheet.kind === 'tabular') {
      const result = await importTabularSheet(sheet, sel.sampleType, sel.defaultOwner)
      totalCount += result.count
      messages.push(result.message)
    } else if (sheet.kind === 'grid') {
      const { parseGridSheet, guessBoxDimensions, detectBoxType } = await import('./parseExcel')
      const gridSamples = parseGridSheet(sheet.gridData!)
      if (gridSamples.length === 0) continue

      const now = Date.now()
      const dims = guessBoxDimensions(gridSamples)

      await db.transaction('rw', db.storageLocations, db.sampleBoxes, db.samples, async () => {
        const gridLocName = `Imported - ${sheet.name}`
        const existingGridLoc = await db.storageLocations.where('name').equals(gridLocName).first()
        const locationId = existingGridLoc?.id ?? await db.storageLocations.add({
          name: gridLocName,
          nameZh: '',
          type: 'freezer' as StorageType,
          order: 0,
          createdAt: now,
          updatedAt: now,
        }) as number

        const existingGridBox = await db.sampleBoxes.where('name').equals(sheet.name).first()
        const boxId = (existingGridBox && existingGridBox.locationId === locationId)
          ? existingGridBox.id!
          : await db.sampleBoxes.add({
              name: sheet.name,
              nameZh: '',
              locationId,
              boxType: detectBoxType(dims.rows, dims.cols),
              rows: dims.rows,
              cols: dims.cols,
              createdAt: now,
              updatedAt: now,
            }) as number

        for (const gs of gridSamples) {
          await db.samples.add({
            name: gs.name,
            boxId,
            position: gs.position,
            sampleType: sel.sampleType,
            owner: sel.defaultOwner || undefined,
            tags: [],
            dateStored: now,
            isFavorite: false,
            createdAt: now,
            updatedAt: now,
          })
        }
      })

      totalCount += gridSamples.length
      messages.push(`${gridSamples.length} samples from "${sheet.name}" (grid)`)
    }
  }

  return { message: messages.join('; '), count: totalCount }
}

// ── Import JSON backup ──
async function importJson(text: string): Promise<{ message: string; count: number }> {
  const payload = JSON.parse(text)

  if (payload.labmate_export !== 'inventory' || !payload.data) {
    throw new Error('Invalid LabMate inventory JSON file')
  }

  const data = payload.data as {
    locations: StorageLocation[]
    boxes: SampleBox[]
    samples: Sample[]
  }

  // Validate arrays exist
  const locations = Array.isArray(data.locations) ? data.locations : []
  const boxes = Array.isArray(data.boxes) ? data.boxes : []
  const samples = Array.isArray(data.samples) ? data.samples : []

  const VALID_STORAGE_TYPES: StorageType[] = ['freezer', 'fridge', 'shelf', 'tank', 'rack']

  // Import with ID remapping to avoid conflicts — wrapped in transaction for atomicity
  const now = Date.now()
  const locationIdMap = new Map<number, number>()
  const boxIdMap = new Map<number, number>()
  let sampleCount = 0

  await db.transaction('rw', db.storageLocations, db.sampleBoxes, db.samples, async () => {
    // Sort locations so parents come before children (topological order)
    const sorted = [...locations].sort((a, b) => {
      if (!a.parentId && b.parentId) return -1
      if (a.parentId && !b.parentId) return 1
      return 0
    })

    // Import locations — two-pass: insert all, then fix parentId references
    const pendingParents: Array<{ newId: number; oldParentId: number }> = []
    for (const loc of sorted) {
      if (!loc.name || typeof loc.id !== 'number') continue
      const oldId = loc.id
      const locType = VALID_STORAGE_TYPES.includes(loc.type) ? loc.type : 'shelf'
      const resolvedParent = loc.parentId ? locationIdMap.get(loc.parentId) : undefined
      const newId = await db.storageLocations.add({
        name: String(loc.name),
        nameZh: String(loc.nameZh ?? ''),
        type: locType,
        temperature: loc.temperature ? String(loc.temperature) : undefined,
        parentId: resolvedParent,
        order: typeof loc.order === 'number' ? loc.order : 0,
        createdAt: loc.createdAt || now,
        updatedAt: now,
      })
      locationIdMap.set(oldId, newId as number)
      // Track unresolved parents for second pass
      if (loc.parentId && !resolvedParent) {
        pendingParents.push({ newId: newId as number, oldParentId: loc.parentId })
      }
    }
    // Second pass: fix any parentId that couldn't be resolved on first insert
    for (const { newId, oldParentId } of pendingParents) {
      const resolvedParent = locationIdMap.get(oldParentId)
      if (resolvedParent) {
        await db.storageLocations.update(newId, { parentId: resolvedParent })
      }
    }

    // Import boxes
    for (const box of boxes) {
      if (!box.name || typeof box.id !== 'number') continue
      const oldId = box.id
      const newLocId = locationIdMap.get(box.locationId)
      if (!newLocId) continue
      const boxType = VALID_BOX_TYPES.includes(box.boxType) ? box.boxType : 'cryo_81'
      const newId = await db.sampleBoxes.add({
        name: String(box.name),
        nameZh: String(box.nameZh ?? ''),
        locationId: newLocId,
        boxType,
        rows: typeof box.rows === 'number' ? box.rows : 9,
        cols: typeof box.cols === 'number' ? box.cols : 9,
        color: box.color ? String(box.color) : undefined,
        createdAt: box.createdAt || now,
        updatedAt: now,
      })
      boxIdMap.set(oldId, newId as number)
    }

    // Import samples
    for (const sample of samples) {
      if (!sample.name) continue
      const newBoxId = boxIdMap.get(sample.boxId)
      if (!newBoxId) continue
      const sampleType = VALID_SAMPLE_TYPES.includes(sample.sampleType as SampleType)
        ? sample.sampleType as SampleType
        : 'other'
      await db.samples.add({
        name: String(sample.name),
        nameZh: sample.nameZh ? String(sample.nameZh) : undefined,
        boxId: newBoxId,
        position: String(sample.position ?? 'A1'),
        sampleType,
        description: sample.description ? String(sample.description) : undefined,
        quantity: sample.quantity ? String(sample.quantity) : undefined,
        concentration: sample.concentration ? String(sample.concentration) : undefined,
        passage: sample.passage ? String(sample.passage) : undefined,
        vendor: sample.vendor ? String(sample.vendor) : undefined,
        catalogNumber: sample.catalogNumber ? String(sample.catalogNumber) : undefined,
        lotNumber: sample.lotNumber ? String(sample.lotNumber) : undefined,
        metadata: sample.metadata && typeof sample.metadata === 'object' && !Array.isArray(sample.metadata)
          ? Object.fromEntries(
              Object.entries(sample.metadata)
                .filter(([, v]) => typeof v === 'string' || typeof v === 'number')
                .map(([k, v]) => [String(k).slice(0, 100), String(v).slice(0, 500)])
            )
          : undefined,
        dateStored: sample.dateStored || now,
        expiryDate: sample.expiryDate,
        owner: sample.owner ? String(sample.owner) : undefined,
        tags: Array.isArray(sample.tags) ? sample.tags.map(String) : [],
        notes: sample.notes ? String(sample.notes) : undefined,
        isFavorite: !!sample.isFavorite,
        createdAt: sample.createdAt || now,
        updatedAt: now,
      })
      sampleCount++
    }
  })

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
      vendor: ['vendor', 'supplier', 'company', 'manufacturer'],
      catalog: ['catalog', 'catalog#', 'cat#', 'cat.#', 'catalogue', 'product#'],
      lot: ['lot', 'lot#', 'lot number', 'batch'],
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

  await db.transaction('rw', db.storageLocations, db.sampleBoxes, db.samples, async () => {
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
        .where('boxId').equals(boxId)
        .filter(s => s.position === position)
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
        vendor: get('vendor') || undefined,
        catalogNumber: get('catalog') || undefined,
        lotNumber: get('lot') || undefined,
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
  })

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
  if (normalized === 'drug' || normalized === 'inhibitor' || normalized === 'inducer') return 'compound'
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
    shelf: { rows: 10, cols: 1 },
    box: { rows: 10, cols: 1 },
    custom: { rows: 8, cols: 8 },
  }
  return dims[boxType]
}

function parseDate(str: string): number | undefined {
  if (!str) return undefined
  const d = new Date(str)
  return isNaN(d.getTime()) ? undefined : d.getTime()
}
