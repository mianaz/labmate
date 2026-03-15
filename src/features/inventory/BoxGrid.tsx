import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import type { Sample, SampleBox, SampleType } from '@/lib/db'
import { sampleTypeColors } from '@/lib/db'

interface BoxGridProps {
  box: SampleBox
  samples: Sample[]
  onCellClick: (position: string, sample?: Sample) => void
}

function positionLabel(row: number, col: number): string {
  return `${String.fromCharCode(65 + row)}${col + 1}`
}

/** List layout types don't use A1-style grids */
const LIST_TYPES = new Set(['shelf', 'box'])

export default function BoxGrid({ box, samples, onCellClick }: BoxGridProps) {
  if (LIST_TYPES.has(box.boxType)) {
    return <ListLayout box={box} samples={samples} onCellClick={onCellClick} />
  }

  return <GridLayout box={box} samples={samples} onCellClick={onCellClick} />
}

// ── List Layout (for shelf / general box) ──
function ListLayout({ box, samples, onCellClick }: BoxGridProps) {
  const { t } = useTranslation()

  const sorted = [...samples].sort((a, b) => a.position.localeCompare(b.position, undefined, { numeric: true }))
  const nextPos = `S${samples.length + 1}`

  return (
    <div>
      {/* Stats bar */}
      <div
        className="flex items-center justify-between mb-3 text-sm"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span>{samples.length} {t('inv.total')}</span>
        <span
          className="text-[10px] px-1.5 py-0.5 rounded"
          style={{
            background: 'var(--color-border-light)',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {t(`inv.box.${box.boxType}`)}
        </span>
      </div>

      {/* Item list */}
      <div className="space-y-1">
        {sorted.map(sample => {
          const colors = sampleTypeColors[sample.sampleType]
          return (
            <button
              key={sample.id}
              onClick={() => onCellClick(sample.position, sample)}
              className="w-full flex items-center gap-3 py-2.5 px-3 rounded-md text-left hover:opacity-80 transition-colors"
              style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border-light)' }}
            >
              {/* Position badge */}
              <span
                className="text-[10px] font-bold w-7 text-center shrink-0"
                style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
              >
                {sample.position}
              </span>
              {/* Type dot */}
              <span
                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: colors.text }}
              />
              {/* Name & details */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                  {sample.name}
                </p>
                {(sample.vendor || sample.catalogNumber || sample.quantity) && (
                  <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {[sample.vendor, sample.catalogNumber ? `#${sample.catalogNumber}` : '', sample.quantity].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>
              {/* Type badge */}
              <span
                className="text-[10px] px-1.5 py-0.5 rounded-full shrink-0"
                style={{ background: colors.bg, color: colors.text }}
              >
                {t(`inv.sample.${sample.sampleType}`)}
              </span>
            </button>
          )
        })}
      </div>

      {/* Add new item button */}
      <button
        onClick={() => onCellClick(nextPos)}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-3 mt-2 rounded-md text-sm transition-colors"
        style={{
          border: '1px dashed var(--color-border)',
          color: 'var(--color-primary)',
          background: 'transparent',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {t('inv.addSample')}
      </button>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2">
        {legendTypes(samples).map(st => (
          <span
            key={st}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: sampleTypeColors[st].bg, color: sampleTypeColors[st].text }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: sampleTypeColors[st].text }}
            />
            {t(`inv.sample.${st}`)}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Grid Layout (cryo boxes, tip boxes, etc.) ──
function GridLayout({ box, samples, onCellClick }: BoxGridProps) {
  const { t } = useTranslation()

  const sampleMap = new Map<string, Sample>()
  for (const s of samples) {
    sampleMap.set(s.position, s)
  }

  const occupied = sampleMap.size
  const total = box.rows * box.cols

  return (
    <div>
      {/* Stats bar */}
      <div
        className="flex items-center justify-between mb-3 text-sm"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <span>
          {occupied}/{total} {t('inv.occupied')} · {total - occupied} {t('inv.empty')}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
          {box.rows}×{box.cols}
        </span>
      </div>

      {/* Grid */}
      <div
        className="overflow-x-auto"
        style={{
          display: 'grid',
          gridTemplateColumns: `2rem repeat(${box.cols}, 1fr)`,
          gridTemplateRows: `1.5rem repeat(${box.rows}, 1fr)`,
          gap: '2px',
        }}
      >
        {/* Top-left empty cell */}
        <div />

        {/* Column headers */}
        {Array.from({ length: box.cols }, (_, c) => (
          <div
            key={`col-${c}`}
            className="flex items-center justify-center text-xs font-medium"
            style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
          >
            {c + 1}
          </div>
        ))}

        {/* Rows */}
        {Array.from({ length: box.rows }, (_, r) => (
          <Fragment key={`row-${r}`}>
            {/* Row header */}
            <div
              className="flex items-center justify-center text-xs font-medium"
              style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
            >
              {String.fromCharCode(65 + r)}
            </div>

            {/* Cells */}
            {Array.from({ length: box.cols }, (_, c) => {
              const pos = positionLabel(r, c)
              const sample = sampleMap.get(pos)
              const colors = sample ? sampleTypeColors[sample.sampleType] : null

              return (
                <button
                  key={pos}
                  onClick={() => onCellClick(pos, sample)}
                  title={sample
                    ? `${sample.name} (${pos})${sample.vendor ? ` · ${sample.vendor}` : ''}${sample.catalogNumber ? ` #${sample.catalogNumber}` : ''}`
                    : pos
                  }
                  className="aspect-square rounded-sm transition-all hover:scale-110 hover:z-10 relative"
                  style={{
                    background: colors ? colors.bg : 'var(--color-border-light)',
                    border: `1px solid ${colors ? colors.text + '33' : 'var(--color-border)'}`,
                    minWidth: '1.75rem',
                    cursor: 'pointer',
                  }}
                >
                  {sample && (
                    <span
                      className="absolute inset-0 flex items-center justify-center text-[9px] font-semibold leading-none overflow-hidden"
                      style={{ color: colors!.text }}
                    >
                      {sample.name.length > 4 ? sample.name.slice(0, 3) + '..' : sample.name}
                    </span>
                  )}
                </button>
              )
            })}
          </Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-2">
        {legendTypes(samples).map(st => (
          <span
            key={st}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full"
            style={{ background: sampleTypeColors[st].bg, color: sampleTypeColors[st].text }}
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: sampleTypeColors[st].text }}
            />
            {t(`inv.sample.${st}`)}
          </span>
        ))}
      </div>
    </div>
  )
}

function legendTypes(samples: Sample[]): SampleType[] {
  const seen = new Set<SampleType>()
  for (const s of samples) seen.add(s.sampleType)
  return Array.from(seen).sort()
}
