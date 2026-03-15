import * as XLSX from 'xlsx'
import type { SampleType, BoxType } from '@/lib/db'

// ── Types ──

export type SheetKind = 'tabular' | 'grid' | 'skip'

export interface ParsedSheet {
  name: string
  kind: SheetKind
  headers: string[]       // for tabular sheets
  rows: Record<string, string>[]  // for tabular sheets — header-keyed
  gridData?: string[][]   // raw 2D array for grid sheets
  rowCount: number
  detectedType: SampleType
}

export interface ParsedWorkbook {
  fileName: string
  sheets: ParsedSheet[]
}

// ── Main entry ──

export async function parseExcelFile(file: File): Promise<ParsedWorkbook> {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })

  const sheets: ParsedSheet[] = []

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    if (!ws) continue

    const raw: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
      .map((row: unknown) => (row as unknown[]).map(cell => String(cell ?? '').trim()))

    // Skip sheets with very few rows
    if (raw.length < 2) {
      sheets.push({
        name: sheetName,
        kind: 'skip',
        headers: [],
        rows: [],
        rowCount: 0,
        detectedType: 'other',
      })
      continue
    }

    const kind = classifySheet(sheetName, raw)

    if (kind === 'skip') {
      sheets.push({
        name: sheetName,
        kind: 'skip',
        headers: [],
        rows: [],
        rowCount: raw.length,
        detectedType: 'other',
      })
      continue
    }

    if (kind === 'grid') {
      sheets.push({
        name: sheetName,
        kind: 'grid',
        headers: [],
        rows: [],
        gridData: raw,
        rowCount: raw.length,
        detectedType: detectTypeFromSheetName(sheetName),
      })
      continue
    }

    // Tabular: first non-empty row with multiple cells is headers
    const headerRowIdx = findHeaderRow(raw)
    if (headerRowIdx < 0) {
      sheets.push({
        name: sheetName,
        kind: 'skip',
        headers: [],
        rows: [],
        rowCount: raw.length,
        detectedType: 'other',
      })
      continue
    }

    const headers = raw[headerRowIdx].map(h => h.toLowerCase().trim())
    const dataRows = raw.slice(headerRowIdx + 1)
      .filter(row => row.some(cell => cell !== ''))
      .map(row => {
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => {
          if (h && i < row.length) obj[h] = row[i]
        })
        return obj
      })

    const detectedType = detectTypeFromHeaders(headers, sheetName)

    sheets.push({
      name: sheetName,
      kind: 'tabular',
      headers,
      rows: dataRows,
      rowCount: dataRows.length,
      detectedType,
    })
  }

  return { fileName: file.name, sheets }
}

// ── Sheet classification ──

function classifySheet(name: string, raw: string[][]): SheetKind {
  const n = name.toLowerCase()

  // Known skip patterns
  const skipPatterns = ['empty', 'general inv', 'basement', 'ln2 allocation', 'consumable', 'equipment']
  if (skipPatterns.some(p => n.includes(p))) return 'skip'

  // Grid detection: looks for 9x9 or 10x10 layouts typical of cryo boxes
  // Check if we have row labels (A-I or A-J) in first column
  if (raw.length >= 9) {
    const firstCol = raw.slice(0, 12).map(r => r[0]?.toUpperCase())
    const hasRowLabels = firstCol.filter(c => /^[A-J]$/.test(c)).length >= 8
    if (hasRowLabels) return 'grid'
  }

  // Check if the sheet looks like a box grid with numbered columns
  if (raw.length >= 2 && raw[0].length >= 9) {
    const firstRow = raw[0]
    const numberedCols = firstRow.filter(c => /^\d+$/.test(c)).length
    if (numberedCols >= 8) return 'grid'
  }

  return 'tabular'
}

function findHeaderRow(raw: string[][]): number {
  for (let i = 0; i < Math.min(5, raw.length); i++) {
    const nonEmpty = raw[i].filter(c => c !== '').length
    if (nonEmpty >= 3) return i
  }
  return -1
}

// ── Type detection ──

function detectTypeFromSheetName(name: string): SampleType {
  const n = name.toLowerCase()
  if (n.includes('antibod') || n.includes('ab')) return 'antibody'
  if (n.includes('oligo') || n.includes('primer')) return 'primer'
  if (n.includes('compound') || n.includes('drug')) return 'compound'
  if (n.includes('cell') || n.includes('n2') || n.includes('ln2')) return 'cell_line'
  if (n.includes('plasmid')) return 'plasmid'
  if (n.includes('virus')) return 'virus'
  if (n.includes('protein')) return 'protein'
  return 'reagent'
}

function detectTypeFromHeaders(headers: string[], sheetName: string): SampleType {
  const all = headers.join(' ') + ' ' + sheetName.toLowerCase()

  if (all.includes('dilution') || all.includes('clone') || all.includes('host species')
    || all.includes('antibod') || /\bab\b/.test(all)) return 'antibody'
  if (all.includes('sequence') || all.includes('oligo') || all.includes('primer')
    || all.includes('amplicon')) return 'primer'
  if (all.includes('compound') || all.includes('drug')) return 'compound'
  if (all.includes('passage') || all.includes('cell line') || all.includes('cell_line')) return 'cell_line'
  if (all.includes('plasmid') || all.includes('vector')) return 'plasmid'

  return detectTypeFromSheetName(sheetName)
}

// ── Fuzzy column matcher ──

export function col(headers: string[], name: string): number {
  const variants: Record<string, string[]> = {
    name: ['name', 'sample', 'reagent', 'item', 'description', 'antibody', 'chemical', 'label'],
    vendor: ['vendor', 'company', 'supplier', 'manufacturer', 'source', 'brand'],
    catalog: ['catalog', 'cat', 'cat#', 'catalog#', 'cat.#', 'catalogue', 'product', 'product#', 'order #', 'order#'],
    lot: ['lot', 'lot#', 'lot number', 'batch'],
    quantity: ['quantity', 'qty', 'amount', 'stock', 'size'],
    concentration: ['concentration', 'conc', 'conc.'],
    location: ['location', 'storage', 'stored', 'where', 'shelf', 'bin', 'rack'],
    owner: ['owner', 'person', 'user', 'who', 'contact', 'responsible'],
    notes: ['notes', 'note', 'comments', 'comment', 'remark', 'remarks'],
    type: ['type', 'category', 'class'],
    position: ['position', 'pos', 'well', 'slot', 'box position'],
    box: ['box', 'box name', 'container'],
    // Antibody-specific
    dilution: ['dilution', 'working dilution', 'dil.', 'dil'],
    clone: ['clone', 'clone#'],
    host: ['host', 'host species', 'raised in', 'species'],
    reactivity: ['reactivity', 'reactive', 'reacts with', 'target species'],
    mw: ['mw', 'molecular weight', 'mol. weight', 'kda'],
    application: ['application', 'applications', 'app', 'use', 'validated for'],
    // Primer-specific
    sequence: ['sequence', 'seq', 'oligo sequence', 'nucleotide'],
    targetGene: ['target', 'target gene', 'gene', 'gene name'],
    ampliconSize: ['amplicon', 'amplicon size', 'product size', 'size (bp)', 'bp'],
    species: ['species', 'organism'],
    // Compound-specific
    compoundType: ['compound type', 'drug type', 'class', 'category'],
  }

  const alts = variants[name] ?? [name]
  for (const alt of alts) {
    const idx = headers.indexOf(alt)
    if (idx !== -1) return idx
  }
  // Partial match fallback
  for (const alt of alts) {
    const idx = headers.findIndex(h => h.includes(alt) || alt.includes(h))
    if (idx !== -1) return idx
  }
  return -1
}

// ── Grid parser for cryo box layouts ──

export interface GridSample {
  position: string
  name: string
}

export function parseGridSheet(raw: string[][]): GridSample[] {
  const samples: GridSample[] = []

  // Find the start of the grid (row with numbered columns)
  let startRow = -1
  let colOffset = 0

  for (let i = 0; i < Math.min(5, raw.length); i++) {
    const row = raw[i]
    // Look for numbered column headers (1, 2, 3... or just data starting with letters)
    const numberedStart = row.findIndex(c => /^\d+$/.test(c))
    if (numberedStart >= 0) {
      startRow = i + 1
      colOffset = numberedStart
      break
    }
  }

  // If no numbered headers, try to detect row labels (A, B, C...)
  if (startRow < 0) {
    for (let i = 0; i < raw.length; i++) {
      if (/^[A-J]$/i.test(raw[i][0])) {
        startRow = i
        colOffset = 1
        break
      }
    }
  }

  if (startRow < 0) return samples

  for (let r = startRow; r < raw.length; r++) {
    const row = raw[r]
    const rowLabel = row[0]?.toUpperCase()
    if (!/^[A-J]$/i.test(rowLabel)) continue

    for (let c = colOffset; c < row.length; c++) {
      const value = row[c]?.trim()
      if (!value) continue
      const colNum = c - colOffset + 1
      const position = `${rowLabel}${colNum}`
      samples.push({ position, name: value })
    }
  }

  return samples
}

// ── Helpers ──

export function detectBoxType(rows: number, cols: number): BoxType {
  if (rows === 9 && cols === 9) return 'cryo_81'
  if (rows === 10 && cols === 10) return 'cryo_100'
  if (rows === 8 && cols === 12) return 'tip'
  return 'custom'
}

export function guessBoxDimensions(gridSamples: GridSample[]): { rows: number; cols: number } {
  let maxRow = 0
  let maxCol = 0
  for (const s of gridSamples) {
    const rowIdx = s.position.charCodeAt(0) - 64  // A=1
    const colIdx = parseInt(s.position.slice(1))
    if (rowIdx > maxRow) maxRow = rowIdx
    if (colIdx > maxCol) maxCol = colIdx
  }
  // Round up to standard box sizes
  if (maxRow <= 9 && maxCol <= 9) return { rows: 9, cols: 9 }
  if (maxRow <= 10 && maxCol <= 10) return { rows: 10, cols: 10 }
  return { rows: Math.max(maxRow, 8), cols: Math.max(maxCol, 8) }
}
