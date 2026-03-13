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

export default function BoxGrid({ box, samples, onCellClick }: BoxGridProps) {
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
                  title={sample ? `${sample.name} (${pos})` : pos}
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
