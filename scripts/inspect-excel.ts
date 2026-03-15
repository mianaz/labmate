/**
 * Quick inspection of Excel files — prints sheet names, headers, row counts, and sample data.
 * Run: npx tsx scripts/inspect-excel.ts
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import XLSX from 'xlsx'

const args = process.argv.slice(2)
if (args.length === 0) {
  console.error('Usage: npx tsx scripts/inspect-excel.ts <file1.xlsx> [file2.xlsx ...]')
  process.exit(1)
}

for (const file of args) {
  const path = resolve(file)
  console.log(`\n${'='.repeat(70)}`)
  console.log(`FILE: ${file}`)
  console.log('='.repeat(70))

  const buf = readFileSync(path)
  const wb = XLSX.read(buf, { type: 'buffer' })

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName]
    const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
    const rows = raw.map(r => (r as unknown[]).map(c => String(c ?? '').trim()))

    // Find first non-empty row
    const nonEmptyRows = rows.filter(r => r.some(c => c !== ''))
    const dataRows = nonEmptyRows.length

    console.log(`\n  SHEET: "${sheetName}" (${dataRows} non-empty rows, ${rows[0]?.length ?? 0} cols)`)

    // Print first 3 rows
    for (let i = 0; i < Math.min(4, rows.length); i++) {
      const row = rows[i].slice(0, 12).map(c => c.length > 25 ? c.slice(0, 22) + '...' : c)
      console.log(`    Row ${i}: [${row.join(' | ')}]`)
    }

    // Check if it looks like a grid (row labels A-I in first column)
    const firstCol = rows.slice(0, 15).map(r => r[0]?.toUpperCase())
    const rowLabels = firstCol.filter(c => /^[A-J]$/.test(c))
    if (rowLabels.length >= 5) {
      console.log(`    → GRID detected (row labels: ${rowLabels.join(',')})`)
    }
  }
}
