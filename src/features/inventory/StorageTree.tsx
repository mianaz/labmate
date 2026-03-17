import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { StorageLocation, SampleBox, Sample } from '@/lib/db'

interface StorageTreeProps {
  locations: StorageLocation[]
  boxes: SampleBox[]
  samples: Sample[]
  selectedBoxId: number | null
  onSelectBox: (boxId: number) => void
  onAddLocation: () => void
  onAddBox: (locationId: number) => void
  onEditLocation: (loc: StorageLocation) => void
  onEditBox: (box: SampleBox) => void
}

/** Location type icons — multi-path SVGs rendered as separate <path> elements */
const storageIcons: Record<string, string[]> = {
  // Snowflake — universally recognized for frozen storage
  freezer: [
    'M12 2v20', 'M17 5l-5 5-5-5', 'M17 19l-5-5-5 5',
    'M2 12h20', 'M5 7l5 5-5 5', 'M19 7l-5 5 5 5',
  ],
  // Fridge box with door handle
  fridge: [
    'M5 2h14a1 1 0 011 1v18a1 1 0 01-1 1H5a1 1 0 01-1-1V3a1 1 0 011-1z',
    'M4 10h16', 'M15 6v2', 'M15 13v4',
  ],
  // Horizontal shelves with vertical supports
  shelf: [
    'M4 6h16', 'M4 12h16', 'M4 18h16',
    'M6 6v12', 'M18 6v12',
  ],
  // LN2 dewar: cylindrical with neck
  tank: [
    'M8 2h8', 'M9 2v3', 'M15 2v3',
    'M7 5a1 1 0 00-1 1v13a4 4 0 004 4h4a4 4 0 004-4V6a1 1 0 00-1-1z',
  ],
  // Wire rack grid
  rack: [
    'M3 5h18', 'M3 12h18', 'M3 19h18',
    'M6 5v14', 'M12 5v14', 'M18 5v14',
  ],
}

/** Box type icons — used in the tree for individual boxes */
const boxIcons: Record<string, string[]> = {
  // Grid (default) — cryo box / tip box
  grid: [
    'M3 3h18v18H3z', 'M3 9h18', 'M3 15h18', 'M9 3v18', 'M15 3v18',
  ],
  // List layout — shelf / general box
  list: [
    'M4 6h16', 'M4 10h16', 'M4 14h16', 'M4 18h12',
  ],
  // Slide box — long horizontal
  slide: [
    'M2 8h20v8H2z', 'M6 8v8', 'M10 8v8', 'M14 8v8', 'M18 8v8',
  ],
}

/** Map box type to icon style */
function boxIconKey(boxType: string): string {
  if (boxType === 'shelf' || boxType === 'box') return 'list'
  if (boxType === 'slide') return 'slide'
  return 'grid'
}

export default function StorageTree({
  locations,
  boxes,
  samples,
  selectedBoxId,
  onSelectBox,
  onAddLocation,
  onAddBox,
  onEditLocation,
  onEditBox,
}: StorageTreeProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(locations.map(l => l.id).filter((id): id is number => id !== undefined)))

  const topLevel = locations.filter(l => !l.parentId).sort((a, b) => a.order - b.order)

  function toggle(id: number) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getChildLocations(parentId: number) {
    return locations.filter(l => l.parentId === parentId).sort((a, b) => a.order - b.order)
  }

  function getBoxes(locationId: number) {
    return boxes.filter(b => b.locationId === locationId)
  }

  function getSampleCount(boxId: number) {
    return samples.filter(s => s.boxId === boxId).length
  }

  function renderLocation(loc: StorageLocation, depth: number) {
    if (depth > 10) return null // guard against circular parentId references
    const children = getChildLocations(loc.id!)
    const locBoxes = getBoxes(loc.id!)
    const isExpanded = expanded.has(loc.id!)
    const hasChildren = children.length > 0 || locBoxes.length > 0

    return (
      <div key={loc.id}>
        <div
          className="flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer group hover:opacity-90 transition-colors"
          style={{
            paddingLeft: `${depth + 0.5}rem`,
            background: 'transparent',
          }}
          onClick={() => hasChildren && toggle(loc.id!)}
        >
          {/* Expand/collapse arrow */}
          <svg
            width="12" height="12" viewBox="0 0 12 12" fill="none"
            stroke="currentColor" strokeWidth="2"
            style={{
              color: 'var(--color-text-muted)',
              transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
              transition: 'transform 0.15s',
              opacity: hasChildren ? 1 : 0,
            }}
          >
            <path d="M4 2l4 4-4 4" />
          </svg>

          {/* Location icon */}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--color-primary)', flexShrink: 0 }}
          >
            {(storageIcons[loc.type] || storageIcons.shelf).map((d, i) => (
              <path key={i} d={d} />
            ))}
          </svg>

          <span className="text-sm font-medium truncate flex-1" style={{ color: 'var(--color-text)' }}>
            {lang === 'zh' && loc.nameZh ? loc.nameZh : loc.name}
          </span>

          {loc.temperature && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded"
              style={{
                background: 'var(--color-border-light)',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {loc.temperature}
            </span>
          )}

          {/* Context buttons (visible on hover) */}
          <div className="hidden group-hover:flex items-center gap-1">
            <button
              onClick={e => { e.stopPropagation(); onEditLocation(loc) }}
              className="p-0.5 rounded hover:opacity-70"
              style={{ color: 'var(--color-text-muted)' }}
              title={t('inv.editLocation')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </button>
            <button
              onClick={e => { e.stopPropagation(); onAddBox(loc.id!) }}
              className="p-0.5 rounded hover:opacity-70"
              style={{ color: 'var(--color-primary)' }}
              title={t('inv.addBox')}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Children */}
        {isExpanded && (
          <>
            {children.map(child => renderLocation(child, depth + 1))}
            {locBoxes.map(box => {
              const count = getSampleCount(box.id!)
              const total = box.rows * box.cols
              const isSelected = selectedBoxId === box.id

              return (
                <div
                  key={`box-${box.id}`}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md cursor-pointer group transition-colors"
                  style={{
                    paddingLeft: `${depth + 1.5}rem`,
                    background: isSelected ? 'var(--color-border-light)' : 'transparent',
                  }}
                  onClick={() => onSelectBox(box.id!)}
                >
                  {/* Box icon */}
                  <svg
                    width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                    style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text-muted)', flexShrink: 0 }}
                  >
                    {boxIcons[boxIconKey(box.boxType)].map((d, i) => (
                      <path key={i} d={d} />
                    ))}
                  </svg>

                  <span
                    className="text-sm truncate flex-1"
                    style={{ color: isSelected ? 'var(--color-primary)' : 'var(--color-text)' }}
                  >
                    {lang === 'zh' && box.nameZh ? box.nameZh : box.name}
                  </span>

                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{
                      background: count > 0 ? 'var(--color-border-light)' : 'transparent',
                      color: 'var(--color-text-muted)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {count}/{total}
                  </span>

                  <button
                    onClick={e => { e.stopPropagation(); onEditBox(box) }}
                    className="hidden group-hover:block p-0.5 rounded hover:opacity-70"
                    style={{ color: 'var(--color-text-muted)' }}
                    title={t('inv.editBox')}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Add location button */}
      <button
        onClick={onAddLocation}
        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-sm font-medium mb-3 transition-colors"
        style={{
          background: 'var(--color-border-light)',
          color: 'var(--color-primary)',
          border: '1px dashed var(--color-border)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        {t('inv.addLocation')}
      </button>

      {/* Tree */}
      {topLevel.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
          {t('inv.emptyState')}
        </p>
      ) : (
        topLevel.map(loc => renderLocation(loc, 0))
      )}
    </div>
  )
}
