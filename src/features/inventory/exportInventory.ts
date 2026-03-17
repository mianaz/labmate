import * as XLSX from 'xlsx'
import type { StorageLocation, SampleBox, Sample } from '@/lib/db'

// ── File download helper ──
function downloadFile(content: string | Blob, filename: string, mime?: string) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function csvEscape(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`
  }
  return val
}

function formatDate(epoch?: number): string {
  if (!epoch) return ''
  return new Date(epoch).toISOString().slice(0, 10)
}

// ── Export box samples as CSV ──
export function exportBoxCsv(
  box: SampleBox,
  samples: Sample[],
  locationPath: string,
) {
  const headers = [
    'Position', 'Name', 'Name (ZH)', 'Type', 'Quantity', 'Concentration',
    'Passage', 'Vendor', 'Catalog #', 'Lot #',
    'Date Stored', 'Expiry Date', 'Owner', 'Tags', 'Description', 'Notes',
  ]

  const rows = samples
    .sort((a, b) => a.position.localeCompare(b.position))
    .map(s => [
      s.position,
      s.name,
      s.nameZh ?? '',
      s.sampleType,
      s.quantity ?? '',
      s.concentration ?? '',
      s.passage ?? '',
      s.vendor ?? '',
      s.catalogNumber ?? '',
      s.lotNumber ?? '',
      formatDate(s.dateStored),
      formatDate(s.expiryDate),
      s.owner ?? '',
      s.tags.join('; '),
      s.description ?? '',
      s.notes ?? '',
    ].map(csvEscape).join(','))

  const csv = [headers.join(','), ...rows].join('\n')
  const safeName = box.name.replace(/[^a-zA-Z0-9_-]/g, '_')
  downloadFile(csv, `${safeName}_samples.csv`, 'text/csv;charset=utf-8')

  return { locationPath, count: samples.length }
}

// ── Export all inventory as CSV ──
export function exportAllCsv(
  _locations: StorageLocation[],
  boxes: SampleBox[],
  samples: Sample[],
  getLocationPath: (id: number) => string,
) {
  const headers = [
    'Location', 'Box', 'Position', 'Name', 'Name (ZH)', 'Type',
    'Quantity', 'Concentration', 'Passage', 'Vendor', 'Catalog #', 'Lot #',
    'Date Stored', 'Expiry Date', 'Owner', 'Tags', 'Description', 'Notes',
  ]

  const sortedSamples = [...samples].sort((a, b) => {
    const boxA = boxes.find(bx => bx.id === a.boxId)
    const boxB = boxes.find(bx => bx.id === b.boxId)
    const locCmp = (boxA?.locationId ?? 0) - (boxB?.locationId ?? 0)
    if (locCmp !== 0) return locCmp
    const boxCmp = (a.boxId) - (b.boxId)
    if (boxCmp !== 0) return boxCmp
    return a.position.localeCompare(b.position)
  })

  const rows = sortedSamples.map(s => {
    const box = boxes.find(b => b.id === s.boxId)
    return [
      box ? getLocationPath(box.locationId) : '',
      box?.name ?? '',
      s.position,
      s.name,
      s.nameZh ?? '',
      s.sampleType,
      s.quantity ?? '',
      s.concentration ?? '',
      s.passage ?? '',
      s.vendor ?? '',
      s.catalogNumber ?? '',
      s.lotNumber ?? '',
      formatDate(s.dateStored),
      formatDate(s.expiryDate),
      s.owner ?? '',
      s.tags.join('; '),
      s.description ?? '',
      s.notes ?? '',
    ].map(csvEscape).join(',')
  })

  const csv = [headers.join(','), ...rows].join('\n')
  const date = new Date().toISOString().slice(0, 10)
  downloadFile(csv, `labmate_inventory_${date}.csv`, 'text/csv;charset=utf-8')
}

// ── Export all inventory as XLSX ──
export function exportAllXlsx(
  _locations: StorageLocation[],
  boxes: SampleBox[],
  samples: Sample[],
  getLocationPath: (id: number) => string,
) {
  const headers = [
    'Location', 'Box', 'Position', 'Name', 'Name (ZH)', 'Type',
    'Quantity', 'Concentration', 'Passage', 'Vendor', 'Catalog #', 'Lot #',
    'Date Stored', 'Expiry Date', 'Owner', 'Tags', 'Description', 'Notes',
  ]

  const sortedSamples = [...samples].sort((a, b) => {
    const boxA = boxes.find(bx => bx.id === a.boxId)
    const boxB = boxes.find(bx => bx.id === b.boxId)
    const locCmp = (boxA?.locationId ?? 0) - (boxB?.locationId ?? 0)
    if (locCmp !== 0) return locCmp
    const boxCmp = (a.boxId) - (b.boxId)
    if (boxCmp !== 0) return boxCmp
    return a.position.localeCompare(b.position)
  })

  const data = sortedSamples.map(s => {
    const box = boxes.find(b => b.id === s.boxId)
    return [
      box ? getLocationPath(box.locationId) : '',
      box?.name ?? '',
      s.position,
      s.name,
      s.nameZh ?? '',
      s.sampleType,
      s.quantity ?? '',
      s.concentration ?? '',
      s.passage ?? '',
      s.vendor ?? '',
      s.catalogNumber ?? '',
      s.lotNumber ?? '',
      formatDate(s.dateStored),
      formatDate(s.expiryDate),
      s.owner ?? '',
      s.tags.join('; '),
      s.description ?? '',
      s.notes ?? '',
    ]
  })

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Inventory')
  const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
  const date = new Date().toISOString().slice(0, 10)
  downloadFile(
    new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `labmate_inventory_${date}.xlsx`,
  )
}

// ── Export full inventory as JSON (backup) ──
export function exportInventoryJson(
  locations: StorageLocation[],
  boxes: SampleBox[],
  samples: Sample[],
) {
  const payload = {
    labmate_export: 'inventory',
    version: 1,
    exportedAt: new Date().toISOString(),
    data: { locations, boxes, samples },
  }

  const json = JSON.stringify(payload, null, 2)
  const date = new Date().toISOString().slice(0, 10)
  downloadFile(json, `labmate_inventory_${date}.json`, 'application/json')
}

// ── Print current box grid ──
export function printBoxGrid() {
  window.print()
}
