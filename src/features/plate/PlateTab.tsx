import { useState, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

// ── Constants ────────────────────────────────────────────────────────────────

interface PlateConfig {
  rows: number
  cols: number
  wellSize: number
}

const PLATE_CONFIGS: Record<number, PlateConfig> = {
  6:   { rows: 2,  cols: 3,  wellSize: 56 },
  12:  { rows: 3,  cols: 4,  wellSize: 44 },
  24:  { rows: 4,  cols: 6,  wellSize: 36 },
  48:  { rows: 6,  cols: 8,  wellSize: 28 },
  96:  { rows: 8,  cols: 12, wellSize: 22 },
  384: { rows: 16, cols: 24, wellSize: 14 },
}

const WELL_COLORS: string[] = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
  '#a855f7', '#84cc16', '#e11d48', '#0ea5e9', '#d946ef',
]

const ROW_LABELS: string[] = 'ABCDEFGHIJKLMNOP'.split('')

// ── Types ─────────────────────────────────────────────────────────────────────

interface WellEntry {
  color: string
  label: string
}

interface WellData {
  [key: string]: WellEntry
}

interface Group {
  label: string
  color: string
  wells: string[]
}

type TemplateType = 'serial' | 'checkerboard' | 'dose'

interface SerialParams {
  startConc: string
  factor: string
  direction: 'row' | 'col'
}

interface CheckerboardParams {
  label1: string
  label2: string
}

interface DoseParams {
  drugs: string
  startConc: string
  dilFactor: string
}

type TemplateParams = SerialParams | CheckerboardParams | DoseParams

// ── Utilities ─────────────────────────────────────────────────────────────────

function downloadFile(filename: string, content: string, mimeType = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

function plateToCSV(wellData: WellData, config: PlateConfig): string {
  let csv = ','
  for (let c = 0; c < config.cols; c++) {
    csv += (c + 1) + (c < config.cols - 1 ? ',' : '')
  }
  csv += '\n'
  for (let r = 0; r < config.rows; r++) {
    csv += ROW_LABELS[r]
    for (let c = 0; c < config.cols; c++) {
      const key = ROW_LABELS[r] + (c + 1)
      const d = wellData[key]
      csv += ',' + (d ? '"' + d.label.replace(/"/g, '""') + '"' : '')
    }
    csv += '\n'
  }
  return csv
}

function plateToSVG(wellData: WellData, config: PlateConfig, groups: Group[]): string {
  const pad = 40, ws = 32, gap = 4
  const w = pad + config.cols * (ws + gap) + 20
  const h = pad + config.rows * (ws + gap) + 60 + groups.length * 20
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="font-family:monospace;font-size:10px">`
  svg += `<rect width="${w}" height="${h}" fill="#f5f2ec"/>`
  // column headers
  for (let c = 0; c < config.cols; c++) {
    const x = pad + c * (ws + gap) + ws / 2
    svg += `<text x="${x}" y="${pad - 8}" text-anchor="middle" fill="#888">${c + 1}</text>`
  }
  // rows
  for (let r = 0; r < config.rows; r++) {
    const y = pad + r * (ws + gap)
    svg += `<text x="${pad - 12}" y="${y + ws / 2 + 4}" text-anchor="middle" fill="#888">${ROW_LABELS[r]}</text>`
    for (let c = 0; c < config.cols; c++) {
      const x = pad + c * (ws + gap)
      const key = ROW_LABELS[r] + (c + 1)
      const d = wellData[key]
      const fill = d ? d.color + '40' : '#f0f0f0'
      const stroke = d ? d.color : '#ccc'
      svg += `<circle cx="${x + ws / 2}" cy="${y + ws / 2}" r="${ws / 2 - 2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`
      if (d && config.cols <= 12) {
        const label = d.label.length > 5 ? d.label.slice(0, 4) + '…' : d.label
        svg += `<text x="${x + ws / 2}" y="${y + ws / 2 + 3}" text-anchor="middle" fill="${d.color}" font-size="7" font-weight="bold">${label}</text>`
      }
    }
  }
  // legend
  const ly = pad + config.rows * (ws + gap) + 16
  svg += `<text x="${pad}" y="${ly}" font-weight="bold" fill="#333">Legend:</text>`
  groups.forEach((g, i) => {
    const gy = ly + 18 + i * 18
    svg += `<circle cx="${pad + 6}" cy="${gy - 4}" r="5" fill="${g.color}"/>`
    svg += `<text x="${pad + 16}" y="${gy}" fill="#555">${g.label} (${g.wells.length} wells)</text>`
  })
  svg += '</svg>'
  return svg
}

// ── DownloadBtn ───────────────────────────────────────────────────────────────

interface DownloadBtnProps {
  onClick: () => void
  label: string
  small?: boolean
}

function DownloadBtn({ onClick, label, small = false }: DownloadBtnProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all hover:shadow-md ${
        small ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs'
      }`}
      style={{ background: 'linear-gradient(135deg, var(--color-primary-dark), var(--color-primary))', color: 'white' }}
    >
      <svg
        width="11" height="11" viewBox="0 0 12 12" fill="none"
        stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <path d="M6 1v7M3 6l3 3 3-3" />
        <line x1="1" y1="11" x2="11" y2="11" />
      </svg>
      {label}
    </button>
  )
}

// ── Toast (minimal local implementation) ─────────────────────────────────────

interface ToastState {
  visible: boolean
  message: string
}

function useLocalToast() {
  const [toast, setToast] = useState<ToastState>({ visible: false, message: '' })

  const show = (message: string) => {
    setToast({ visible: true, message })
    setTimeout(() => setToast({ visible: false, message: '' }), 2000)
  }

  return { toast, show }
}

// ── PlateTableView ────────────────────────────────────────────────────────────

type SortCol = 'well' | 'row' | 'col' | 'label' | 'color'

interface TableRow {
  well: string
  row: string
  col: number
  label: string
  color: string
}

interface PlateTableViewProps {
  wellData: WellData
  config: PlateConfig
}

function PlateTableView({ wellData }: PlateTableViewProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [showTable, setShowTable] = useState(false)
  const [sortCol, setSortCol] = useState<SortCol>('well')
  const [sortAsc, setSortAsc] = useState(true)

  const rows = useMemo<TableRow[]>(() => {
    const entries: TableRow[] = Object.entries(wellData).map(([key, data]) => ({
      well: key,
      row: key[0],
      col: parseInt(key.slice(1)),
      label: data.label,
      color: data.color,
    }))
    entries.sort((a, b) => {
      let cmp = 0
      if (sortCol === 'well') cmp = a.well.localeCompare(b.well, undefined, { numeric: true })
      else if (sortCol === 'row') cmp = a.row.localeCompare(b.row) || a.col - b.col
      else if (sortCol === 'col') cmp = a.col - b.col || a.row.localeCompare(b.row)
      else if (sortCol === 'label') cmp = a.label.localeCompare(b.label)
      return sortAsc ? cmp : -cmp
    })
    return entries
  }, [wellData, sortCol, sortAsc])

  function toggleSort(col: SortCol) {
    if (sortCol === col) setSortAsc(!sortAsc)
    else { setSortCol(col); setSortAsc(true) }
  }

  const sortArrow = (col: SortCol) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : ''

  const headers: { id: SortCol; l: string }[] = [
    { id: 'well',  l: 'Well' },
    { id: 'row',   l: 'Row' },
    { id: 'col',   l: 'Col' },
    { id: 'label', l: 'Label' },
    { id: 'color', l: 'Color' },
  ]

  if (!showTable) {
    return (
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => setShowTable(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
        >
          {t('plate.viewTable')}
        </button>
      </div>
    )
  }

  return (
    <div className="mt-4 card p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">{t('plate.viewTable')}</h4>
        <button
          onClick={() => setShowTable(false)}
          className="text-xs px-3 py-1 rounded-lg"
          style={{ background: 'var(--color-bg)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}
        >
          {t('plate.viewGrid')}
        </button>
      </div>
      <div className="overflow-x-auto" style={{ maxHeight: '320px', overflowY: 'auto' }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0" style={{ background: 'var(--color-bg-card)' }}>
            <tr className="border-b" style={{ borderColor: 'var(--color-border)' }}>
              {headers.map(h => (
                <th
                  key={h.id}
                  onClick={() => toggleSort(h.id)}
                  className="text-left py-2 px-2 text-xs cursor-pointer select-none"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {h.l}{sortArrow(h.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.well} className="border-b" style={{ borderColor: 'var(--color-border)' }}>
                <td className="py-1.5 px-2 mono font-semibold text-xs">{r.well}</td>
                <td className="py-1.5 px-2 text-xs">{r.row}</td>
                <td className="py-1.5 px-2 text-xs mono">{r.col}</td>
                <td className="py-1.5 px-2 text-xs font-medium">{r.label}</td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: r.color }} />
                    <span className="text-[10px] mono" style={{ color: 'var(--color-text-muted)' }}>{r.color}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] mt-2" style={{ color: 'var(--color-text-muted)' }}>
        {rows.length} {lang === 'en' ? 'labeled wells' : '个已标记孔'}
      </p>
    </div>
  )
}

// ── PlateTab (main export) ────────────────────────────────────────────────────

export default function PlateTab() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const { toast, show: showToast } = useLocalToast()

  const [plateType, setPlateType] = useState<number>(96)
  const [wellData, setWellData] = useState<WellData>({})
  const [selectedWells, setSelectedWells] = useState<Set<string>>(new Set())
  const [currentColor, setCurrentColor] = useState<number>(0)
  const [currentLabel, setCurrentLabel] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [groups, setGroups] = useState<Group[]>([])

  const config = PLATE_CONFIGS[plateType]

  // Reset on plate type change
  useEffect(() => {
    setWellData({})
    setSelectedWells(new Set())
    setGroups([])
  }, [plateType])

  // Global mouseup listener for drag-select
  useEffect(() => {
    function handleUp() { setIsDragging(false) }
    window.addEventListener('mouseup', handleUp)
    return () => window.removeEventListener('mouseup', handleUp)
  }, [])

  // ── Well helpers ──────────────────────────────────────────────────────────

  function wellKey(r: number, c: number): string {
    return `${ROW_LABELS[r]}${c + 1}`
  }

  function toggleWell(r: number, c: number) {
    const key = wellKey(r, c)
    setSelectedWells(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function handleMouseDown(r: number, c: number, e: React.MouseEvent) {
    e.preventDefault()
    setIsDragging(true)
    toggleWell(r, c)
  }

  function handleMouseEnter(r: number, c: number) {
    if (isDragging) {
      const key = wellKey(r, c)
      setSelectedWells(prev => {
        const next = new Set(prev)
        next.add(key)
        return next
      })
    }
  }

  function selectRow(r: number) {
    setSelectedWells(prev => {
      const next = new Set(prev)
      for (let c = 0; c < config.cols; c++) next.add(wellKey(r, c))
      return next
    })
  }

  function selectCol(c: number) {
    setSelectedWells(prev => {
      const next = new Set(prev)
      for (let r = 0; r < config.rows; r++) next.add(wellKey(r, c))
      return next
    })
  }

  // ── Assign wells ──────────────────────────────────────────────────────────

  function assignSelected() {
    if (selectedWells.size === 0 || !currentLabel) return
    const color = WELL_COLORS[currentColor % WELL_COLORS.length]
    setWellData(prev => {
      const next = { ...prev }
      selectedWells.forEach(key => {
        next[key] = { color, label: currentLabel }
      })
      return next
    })
    const existingIdx = groups.findIndex(g => g.label === currentLabel)
    if (existingIdx === -1) {
      setGroups(prev => [...prev, { label: currentLabel, color, wells: [...selectedWells] }])
    } else {
      setGroups(prev =>
        prev.map((g, i) =>
          i === existingIdx
            ? { ...g, wells: [...new Set([...g.wells, ...selectedWells])] }
            : g
        )
      )
    }
    setSelectedWells(new Set())
    setCurrentLabel('')
    setCurrentColor(prev => prev + 1)
  }

  function clearAll() {
    setWellData({})
    setSelectedWells(new Set())
    setGroups([])
    setCurrentColor(0)
  }

  // ── Templates ─────────────────────────────────────────────────────────────

  const [templateDialog, setTemplateDialog] = useState<TemplateType | null>(null)
  const [templateParams, setTemplateParams] = useState<TemplateParams>({} as TemplateParams)

  function openTemplate(type: TemplateType) {
    const defaults: Record<TemplateType, TemplateParams> = {
      serial:       { startConc: '100', factor: '2', direction: 'row' },
      checkerboard: { label1: 'Treatment', label2: 'Control' },
      dose:         { drugs: '3', startConc: '100', dilFactor: '3' },
    }
    setTemplateParams(defaults[type])
    setTemplateDialog(type)
  }

  function updateParam<K extends keyof TemplateParams>(key: K, val: TemplateParams[K]) {
    setTemplateParams(prev => ({ ...prev, [key]: val }))
  }

  function confirmTemplate() {
    if (templateDialog === 'serial') applySerialDilution()
    else if (templateDialog === 'checkerboard') applyCheckerboard()
    else if (templateDialog === 'dose') applyDoseResponse()
    setTemplateDialog(null)
  }

  function applySerialDilution() {
    const p = templateParams as SerialParams
    if (!p.startConc || !p.factor) return
    const f = +p.factor
    if (!isFinite(f) || f <= 0 || f === 1) return

    const newData: WellData = {}
    const newGroups: Group[] = []
    let conc = +p.startConc
    if (!isFinite(conc) || conc <= 0) return

    if (p.direction === 'row') {
      for (let c = 0; c < config.cols; c++) {
        const label = conc >= 1 ? conc.toFixed(1) : conc.toExponential(1)
        const color = WELL_COLORS[c % WELL_COLORS.length]
        const wells: string[] = []
        for (let r = 0; r < config.rows; r++) {
          const key = wellKey(r, c)
          newData[key] = { color, label }
          wells.push(key)
        }
        newGroups.push({ label, color, wells })
        conc /= f
      }
    } else {
      for (let r = 0; r < config.rows; r++) {
        const label = conc >= 1 ? conc.toFixed(1) : conc.toExponential(1)
        const color = WELL_COLORS[r % WELL_COLORS.length]
        const wells: string[] = []
        for (let c = 0; c < config.cols; c++) {
          const key = wellKey(r, c)
          newData[key] = { color, label }
          wells.push(key)
        }
        newGroups.push({ label, color, wells })
        conc /= f
      }
    }

    setWellData(newData)
    setGroups(newGroups)
    setSelectedWells(new Set())
  }

  function applyCheckerboard() {
    const p = templateParams as CheckerboardParams
    if (!p.label1 || !p.label2) return
    const newData: WellData = {}
    const wells1: string[] = []
    const wells2: string[] = []
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        const key = wellKey(r, c)
        if ((r + c) % 2 === 0) {
          newData[key] = { color: WELL_COLORS[0], label: p.label1 }
          wells1.push(key)
        } else {
          newData[key] = { color: WELL_COLORS[1], label: p.label2 }
          wells2.push(key)
        }
      }
    }
    setWellData(newData)
    setGroups([
      { label: p.label1, color: WELL_COLORS[0], wells: wells1 },
      { label: p.label2, color: WELL_COLORS[1], wells: wells2 },
    ])
  }

  function applyDoseResponse() {
    const p = templateParams as DoseParams
    if (!p.drugs || !p.startConc || !p.dilFactor) return
    const dilF = +p.dilFactor
    if (!isFinite(dilF) || dilF <= 0 || dilF === 1) return
    if (!isFinite(+p.startConc) || +p.startConc <= 0) return
    const nDrugs = Math.min(+p.drugs, config.rows)
    const newData: WellData = {}
    const newGroups: Group[] = []

    for (let d = 0; d < nDrugs; d++) {
      let conc = +p.startConc
      const color = WELL_COLORS[d % WELL_COLORS.length]
      const drugLabel = `Drug ${d + 1}`
      for (let c = 0; c < config.cols; c++) {
        const key = wellKey(d, c)
        const label = conc >= 1 ? conc.toFixed(1) : conc.toExponential(1)
        newData[key] = { color, label }
        conc /= +p.dilFactor
      }
      newGroups.push({
        label: drugLabel,
        color,
        wells: Array.from({ length: config.cols }, (_, c) => wellKey(d, c)),
      })
    }

    setWellData(newData)
    setGroups(newGroups)
  }

  // ── Export helpers ────────────────────────────────────────────────────────

  function handleCopyLayout() {
    let txt = `${plateType}-well Plate Layout\n${'─'.repeat(40)}\n`
    groups.forEach(g => { txt += `■ ${g.label}: ${g.wells.join(', ')}\n` })
    if (groups.length === 0) txt += '(empty)\n'
    navigator.clipboard.writeText(txt)
    showToast(t('plate.copied'))
  }

  // ── Derived state for template params (typed casts) ───────────────────────

  const serialParams = templateParams as SerialParams
  const checkerParams = templateParams as CheckerboardParams
  const doseParams = templateParams as DoseParams

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fade-in">
      {/* Toast */}
      {toast.visible && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg"
          style={{ background: 'var(--color-primary)', color: 'white' }}
        >
          {toast.message}
        </div>
      )}

      {/* Header card */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold mb-1">{t('plate.title')}</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('plate.subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              {t('plate.type')}:
            </label>
            <select
              value={plateType}
              onChange={e => setPlateType(+e.target.value)}
              className="w-28"
            >
              {Object.keys(PLATE_CONFIGS).map(k => (
                <option key={k} value={k}>{k}-well</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* ── Grid panel ─────────────────────────────────────────────────── */}
        <div className="xl:col-span-3">
          <div className="card p-5 overflow-x-auto">
            {/* Column headers */}
            <div className="flex items-center gap-0.5 mb-1 ml-6">
              {Array.from({ length: config.cols }, (_, c) => (
                <div
                  key={c}
                  onClick={() => selectCol(c)}
                  className="text-center text-[10px] mono cursor-pointer font-bold"
                  style={{
                    width: config.wellSize,
                    minWidth: config.wellSize,
                    color: 'var(--color-text-muted)',
                  }}
                >
                  {c + 1}
                </div>
              ))}
            </div>

            {/* Well grid */}
            {Array.from({ length: config.rows }, (_, r) => (
              <div key={r} className="flex items-center gap-0.5 mb-0.5">
                {/* Row label */}
                <div
                  onClick={() => selectRow(r)}
                  className="w-5 text-right text-[10px] mono cursor-pointer font-bold mr-1"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  {ROW_LABELS[r]}
                </div>

                {/* Wells */}
                {Array.from({ length: config.cols }, (_, c) => {
                  const key = wellKey(r, c)
                  const data = wellData[key]
                  const isSel = selectedWells.has(key)
                  return (
                    <div
                      key={c}
                      className={`well${isSel ? ' selected' : ''}`}
                      style={{
                        width: config.wellSize,
                        height: config.wellSize,
                        minWidth: config.wellSize,
                        background: data ? data.color + '30' : 'var(--color-bg)',
                        borderColor: data ? data.color : 'var(--color-border)',
                        borderWidth: data ? 2 : 1,
                        borderStyle: 'solid',
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        userSelect: 'none',
                        fontSize: plateType > 96 ? 6 : plateType > 48 ? 7 : 9,
                        boxSizing: 'border-box',
                        outline: isSel ? '2px solid var(--color-primary)' : 'none',
                        outlineOffset: '1px',
                        transition: 'outline 0.1s',
                      }}
                      onMouseDown={e => handleMouseDown(r, c, e)}
                      onMouseEnter={() => handleMouseEnter(r, c)}
                      title={key + (data ? ': ' + data.label : '')}
                    >
                      {plateType <= 48 && data && (
                        <span
                          className="truncate px-0.5"
                          style={{ color: data.color, fontWeight: 700 }}
                        >
                          {data.label.length > 5 ? data.label.slice(0, 4) + '…' : data.label}
                        </span>
                      )}
                      {plateType <= 48 && !data && (
                        <span style={{ color: 'var(--color-border)' }}>{key}</span>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Table view (below grid) */}
          {Object.keys(wellData).length > 0 && (
            <PlateTableView wellData={wellData} config={config} />
          )}
        </div>

        {/* ── Side panel ─────────────────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Assign / mark panel */}
          <div className="card p-4">
            <h4 className="text-sm font-bold mb-3">{t('plate.markTitle')}</h4>
            <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
              {t('plate.selected')}:{' '}
              <span className="mono font-bold" style={{ color: 'var(--color-accent)' }}>
                {selectedWells.size}
              </span>{' '}
              {t('plate.wells')}
              {selectedWells.size > 0 && (
                <span className="ml-1">
                  ({[...selectedWells].slice(0, 6).join(', ')}{selectedWells.size > 6 ? '...' : ''})
                </span>
              )}
            </p>
            <div className="mb-3">
              <label
                className="text-xs font-semibold block mb-1"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t('plate.labelName')}
              </label>
              <input
                type="text"
                value={currentLabel}
                onChange={e => setCurrentLabel(e.target.value)}
                placeholder="e.g. 10 µM Drug A"
                style={{ fontFamily: 'var(--font-body)', width: '100%' }}
              />
            </div>
            <div className="mb-3">
              <label
                className="text-xs font-semibold block mb-1.5"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t('plate.color')}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {WELL_COLORS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentColor(i)}
                    className={`w-6 h-6 rounded-full border-2 transition-transform ${currentColor === i ? 'scale-125' : ''}`}
                    style={{
                      background: c,
                      borderColor: currentColor === i ? 'var(--color-text)' : 'transparent',
                    }}
                  />
                ))}
              </div>
            </div>
            <button
              onClick={assignSelected}
              className="btn-primary w-full"
              disabled={!selectedWells.size || !currentLabel}
            >
              {t('plate.confirm')}
            </button>
          </div>

          {/* Templates */}
          <div className="card p-4">
            <h4 className="text-sm font-bold mb-3">{t('plate.templates')}</h4>
            <div className="space-y-2">
              <button onClick={() => openTemplate('serial')} className="btn-secondary w-full text-sm">
                {t('plate.serial')}
              </button>
              <button onClick={() => openTemplate('dose')} className="btn-secondary w-full text-sm">
                {t('plate.dose')}
              </button>
              <button onClick={() => openTemplate('checkerboard')} className="btn-secondary w-full text-sm">
                {t('plate.checkerboard')}
              </button>
              <button
                onClick={clearAll}
                className="w-full text-sm px-4 py-2 rounded-lg border font-semibold"
                style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
              >
                {t('plate.clear')}
              </button>
            </div>

            {/* Inline template config */}
            {templateDialog && (
              <div
                className="mt-3 p-3 rounded-lg border"
                style={{ background: 'var(--color-bg)', borderColor: 'var(--color-primary)' }}
              >
                <h5 className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary)' }}>
                  {templateDialog === 'serial'
                    ? t('plate.serial')
                    : templateDialog === 'dose'
                    ? t('plate.dose')
                    : t('plate.checkerboard')}
                </h5>
                <div className="space-y-2">
                  {/* Serial dilution fields */}
                  {templateDialog === 'serial' && (
                    <>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {t('plate.serialStartConc')}
                        </label>
                        <input
                          type="text"
                          value={serialParams.startConc}
                          onChange={e => updateParam('startConc' as keyof TemplateParams, e.target.value as never)}
                          className="w-full text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {t('plate.serialFactor')}
                        </label>
                        <input
                          type="text"
                          value={serialParams.factor}
                          onChange={e => updateParam('factor' as keyof TemplateParams, e.target.value as never)}
                          className="w-full text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {t('plate.direction')}
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateParam('direction' as keyof TemplateParams, 'row' as never)}
                            className="flex-1 px-2 py-1 rounded text-xs font-semibold"
                            style={{
                              background: serialParams.direction === 'row' ? 'var(--color-primary)' : 'var(--color-bg-card)',
                              color: serialParams.direction === 'row' ? 'white' : 'var(--color-text-muted)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            → {t('plate.dirRow')}
                          </button>
                          <button
                            onClick={() => updateParam('direction' as keyof TemplateParams, 'col' as never)}
                            className="flex-1 px-2 py-1 rounded text-xs font-semibold"
                            style={{
                              background: serialParams.direction === 'col' ? 'var(--color-primary)' : 'var(--color-bg-card)',
                              color: serialParams.direction === 'col' ? 'white' : 'var(--color-text-muted)',
                              border: '1px solid var(--color-border)',
                            }}
                          >
                            ↓ {t('plate.dirCol')}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Checkerboard fields */}
                  {templateDialog === 'checkerboard' && (
                    <>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {t('plate.label1')}
                        </label>
                        <input
                          type="text"
                          value={checkerParams.label1}
                          onChange={e => updateParam('label1' as keyof TemplateParams, e.target.value as never)}
                          className="w-full text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {t('plate.label2')}
                        </label>
                        <input
                          type="text"
                          value={checkerParams.label2}
                          onChange={e => updateParam('label2' as keyof TemplateParams, e.target.value as never)}
                          className="w-full text-sm"
                        />
                      </div>
                    </>
                  )}

                  {/* Dose-response fields */}
                  {templateDialog === 'dose' && (
                    <>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {t('plate.doseNumDrugs')}
                        </label>
                        <input
                          type="number"
                          value={doseParams.drugs}
                          onChange={e => updateParam('drugs' as keyof TemplateParams, e.target.value as never)}
                          min={1}
                          max={config.rows}
                          className="w-full text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {t('plate.serialStartConc')}
                        </label>
                        <input
                          type="text"
                          value={doseParams.startConc}
                          onChange={e => updateParam('startConc' as keyof TemplateParams, e.target.value as never)}
                          className="w-full text-sm"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold block mb-0.5" style={{ color: 'var(--color-text-muted)' }}>
                          {t('plate.serialFactor')}
                        </label>
                        <input
                          type="text"
                          value={doseParams.dilFactor}
                          onChange={e => updateParam('dilFactor' as keyof TemplateParams, e.target.value as never)}
                          className="w-full text-sm"
                        />
                      </div>
                    </>
                  )}

                  <div className="flex gap-2 mt-2">
                    <button onClick={confirmTemplate} className="btn-primary flex-1 text-sm py-1.5">
                      {t('plate.apply')}
                    </button>
                    <button
                      onClick={() => setTemplateDialog(null)}
                      className="flex-1 text-sm py-1.5 rounded-lg border"
                      style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}
                    >
                      {t('plate.cancel')}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          <div className="card p-4">
            <h4 className="text-sm font-bold mb-3">{t('plate.export')}</h4>
            <div className="space-y-2">
              <DownloadBtn
                small
                label={t('plate.downloadCSV')}
                onClick={() =>
                  downloadFile(
                    `plate_${plateType}well.csv`,
                    plateToCSV(wellData, config),
                    'text/csv',
                  )
                }
              />
              <DownloadBtn
                small
                label={t('plate.downloadSVG')}
                onClick={() =>
                  downloadFile(
                    `plate_${plateType}well.svg`,
                    plateToSVG(wellData, config, groups),
                    'image/svg+xml',
                  )
                }
              />
              <DownloadBtn
                small
                label={t('plate.copyLayout')}
                onClick={handleCopyLayout}
              />
            </div>
          </div>

          {/* Legend */}
          {groups.length > 0 && (
            <div className="card p-4">
              <h4 className="text-sm font-bold mb-3">{t('plate.legend')}</h4>
              <div className="space-y-1.5">
                {groups.map((g, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: g.color }} />
                    <span className="font-medium truncate">{g.label}</span>
                    <span className="ml-auto mono" style={{ color: 'var(--color-text-muted)' }}>
                      {g.wells.length}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Well selection info bar (bottom) */}
      {selectedWells.size > 0 && (
        <div
          className="fixed bottom-6 right-6 z-40 px-4 py-2 rounded-xl text-xs font-semibold shadow-lg"
          style={{
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-primary)',
            color: 'var(--color-primary)',
          }}
        >
          {selectedWells.size} {lang === 'en' ? 'wells selected' : '个孔已选中'}
        </div>
      )}
    </div>
  )
}
