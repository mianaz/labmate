import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { REFERENCES, REF_NOTES_EN } from '@/data/references'
import db from '@/lib/db'

// ── Guide section definitions ──

interface GuideSection {
  titleKey: string
  bodyKey: string
  icon: string[]       // SVG path(s) for the section icon
}

const GUIDE_SECTIONS: GuideSection[] = [
  {
    titleKey: 'guide.buffersTitle',
    bodyKey: 'guide.buffersBody',
    // Flask
    icon: ['M9 3h6M10 3v6l-5 12h14L14 9V3', 'M7.5 15h9'],
  },
  {
    titleKey: 'guide.protocolsTitle',
    bodyKey: 'guide.protocolsBody',
    // Clipboard with steps
    icon: ['M9 2h6v2H9zM7 4h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6a2 2 0 012-2z', 'M9 10h6M9 14h4'],
  },
  {
    titleKey: 'guide.calcTitle',
    bodyKey: 'guide.calcBody',
    // Calculator
    icon: ['M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z', 'M4 9h16', 'M8 13h2M14 13h2M8 17h2M14 17h2'],
  },
  {
    titleKey: 'guide.gelTitle',
    bodyKey: 'guide.gelBody',
    // Gel cassette
    icon: ['M6 2h12v20H6z', 'M6 8h12', 'M6 14h12', 'M10 8v6M14 8v6'],
  },
  {
    titleKey: 'guide.plateTitle',
    bodyKey: 'guide.plateBody',
    // Grid plate
    icon: ['M3 5h18v14H3z', 'M7 9h2M11 9h2M15 9h2', 'M7 13h2M11 13h2M15 13h2'],
  },
  {
    titleKey: 'guide.inventoryTitle',
    bodyKey: 'guide.inventoryBody',
    // Storage box
    icon: ['M3 3h18v18H3z', 'M3 9h18', 'M3 15h18', 'M9 3v18', 'M15 3v18'],
  },
  {
    titleKey: 'guide.shortcutsTitle',
    bodyKey: 'guide.shortcutsBody',
    // Keyboard
    icon: ['M2 6h20v12H2z', 'M6 10h2M10 10h4M16 10h2', 'M6 14h12'],
  },
]

export default function RefsTab() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language
  const [refsOpen, setRefsOpen] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const importRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    try {
      const protocols = await db.protocols.toArray()
      const experiments = await db.experiments.toArray()
      const settings = await db.settings.toArray()
      const locations = await db.storageLocations.toArray()
      const boxes = await db.sampleBoxes.toArray()
      const samples = await db.samples.toArray()

      const data = { protocols, experiments, settings, storageLocations: locations, sampleBoxes: boxes, samples, exportedAt: Date.now() }
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `labmate-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportMsg(t('data.exportSuccess'))
      setTimeout(() => setExportMsg(''), 3000)
    } catch {
      setExportMsg('Export failed')
      setTimeout(() => setExportMsg(''), 3000)
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      let count = 0
      if (data.protocols?.length) { await db.protocols.bulkPut(data.protocols); count += data.protocols.length }
      if (data.experiments?.length) { await db.experiments.bulkPut(data.experiments); count += data.experiments.length }
      if (data.settings?.length) { await db.settings.bulkPut(data.settings); count += data.settings.length }
      if (data.storageLocations?.length) { await db.storageLocations.bulkPut(data.storageLocations); count += data.storageLocations.length }
      if (data.sampleBoxes?.length) { await db.sampleBoxes.bulkPut(data.sampleBoxes); count += data.sampleBoxes.length }
      if (data.samples?.length) { await db.samples.bulkPut(data.samples); count += data.samples.length }
      setExportMsg(t('data.importSuccess', { count }))
      setTimeout(() => setExportMsg(''), 3000)
    } catch {
      setExportMsg(t('data.importFailed'))
      setTimeout(() => setExportMsg(''), 3000)
    }
    if (importRef.current) importRef.current.value = ''
  }

  return (
    <div className="fade-in" style={{ maxWidth: 720 }}>
      {/* Header */}
      <div className="card p-6 mb-6">
        <h2
          className="text-xl font-bold mb-1"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
        >
          {t('guide.title')}
        </h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t('guide.subtitle')}
        </p>
      </div>

      {/* Feature guide cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {GUIDE_SECTIONS.map((section) => (
          <div
            key={section.titleKey}
            className="card"
            style={{ padding: 20, display: 'flex', gap: 16, alignItems: 'flex-start' }}
          >
            {/* Icon */}
            <div
              style={{
                width: 40, height: 40, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'hsl(168, 55%, 92%)',
              }}
            >
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
                style={{ color: 'var(--color-primary)' }}
              >
                {section.icon.map((d, i) => <path key={i} d={d} />)}
              </svg>
            </div>

            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3 style={{
                fontSize: '0.9rem', fontWeight: 700, margin: '0 0 6px',
                fontFamily: 'var(--font-heading)', color: 'var(--color-text)',
              }}>
                {t(section.titleKey)}
              </h3>
              <p style={{
                fontSize: '0.82rem', lineHeight: 1.65, margin: 0,
                color: 'var(--color-text-secondary)',
              }}>
                {t(section.bodyKey)}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Privacy section */}
      <div className="card" style={{
        padding: 20, marginTop: 20,
        borderLeft: '3px solid var(--color-primary)',
      }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <svg
            width="20" height="20" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
            style={{ color: 'var(--color-primary)', flexShrink: 0, marginTop: 2 }}
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          <div>
            <h3 style={{
              fontSize: '0.9rem', fontWeight: 700, margin: '0 0 6px',
              fontFamily: 'var(--font-heading)', color: 'var(--color-text)',
            }}>
              {t('guide.privacyTitle')}
            </h3>
            <p style={{
              fontSize: '0.82rem', lineHeight: 1.65, margin: 0,
              color: 'var(--color-text-secondary)',
            }}>
              {t('guide.privacyBody')}
            </p>
          </div>
        </div>
      </div>

      {/* Data export / import */}
      <div className="card" style={{ padding: 20, marginTop: 12 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h4 style={{
              fontSize: '0.82rem', fontWeight: 700, margin: '0 0 4px',
              fontFamily: 'var(--font-heading)', color: 'var(--color-text)',
            }}>
              {t('guide.exportTitle')}
            </h4>
            <p style={{ fontSize: '0.75rem', margin: '0 0 10px', color: 'var(--color-text-muted)' }}>
              {t('guide.exportDesc')}
            </p>
            <button
              onClick={handleExport}
              className="btn-primary text-xs px-4 py-1.5"
            >
              {t('guide.exportBtn')}
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h4 style={{
              fontSize: '0.82rem', fontWeight: 700, margin: '0 0 4px',
              fontFamily: 'var(--font-heading)', color: 'var(--color-text)',
            }}>
              {t('guide.importTitle')}
            </h4>
            <p style={{ fontSize: '0.75rem', margin: '0 0 10px', color: 'var(--color-text-muted)' }}>
              {t('guide.importDesc')}
            </p>
            <label
              className="text-xs px-4 py-1.5 rounded-md cursor-pointer inline-block"
              style={{
                background: 'var(--color-border-light)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
              }}
            >
              {t('guide.importBtn')}
              <input
                ref={importRef}
                type="file"
                accept=".json"
                onChange={handleImport}
                style={{ display: 'none' }}
              />
            </label>
          </div>
        </div>
        {exportMsg && (
          <p style={{
            fontSize: '0.75rem', marginTop: 10, marginBottom: 0,
            color: 'var(--color-primary)', fontWeight: 600,
          }}>
            {exportMsg}
          </p>
        )}
      </div>

      {/* Usage notes */}
      <div className="card" style={{
        padding: 20, marginTop: 20,
        borderLeft: '3px solid var(--color-warning)',
      }}>
        <h3 style={{
          fontSize: '0.85rem', fontWeight: 700, marginBottom: 8,
          fontFamily: 'var(--font-heading)', color: 'var(--color-text)',
        }}>
          {t('guide.usageNotesTitle')}
        </h3>
        <ul style={{
          listStyle: 'none', padding: 0, margin: 0,
          display: 'flex', flexDirection: 'column', gap: 6,
          fontSize: '0.8rem', color: 'var(--color-text-secondary)',
        }}>
          {[1, 2, 3, 4, 5, 6].map(n => (
            <li key={n}>&#8226; {t(`guide.usageNote${n}`)}</li>
          ))}
        </ul>
      </div>

      {/* Collapsible literature references */}
      <div className="card" style={{ marginTop: 20, overflow: 'hidden' }}>
        <button
          onClick={() => setRefsOpen(prev => !prev)}
          style={{
            width: '100%', padding: 16, border: 'none', background: 'transparent',
            display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
            textAlign: 'left',
          }}
        >
          <svg
            width="14" height="14" viewBox="0 0 12 12" fill="none"
            stroke="currentColor" strokeWidth="2"
            style={{
              color: 'var(--color-text-muted)',
              transform: refsOpen ? 'rotate(90deg)' : 'rotate(0)',
              transition: 'transform 0.15s',
            }}
          >
            <path d="M4 2l4 4-4 4" />
          </svg>
          <div>
            <h3 style={{
              fontSize: '0.9rem', fontWeight: 700, margin: 0,
              fontFamily: 'var(--font-heading)', color: 'var(--color-text)',
            }}>
              {t('guide.refsCollapse')}
            </h3>
            <p style={{ fontSize: '0.72rem', margin: '2px 0 0', color: 'var(--color-text-muted)' }}>
              {t('guide.refsCollapseDesc')}
            </p>
          </div>
          <span
            style={{
              marginLeft: 'auto', fontSize: '0.7rem',
              fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)',
            }}
          >
            {REFERENCES.length}
          </span>
        </button>

        {refsOpen && (
          <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {REFERENCES.map((ref) => (
              <div
                key={ref.id}
                style={{
                  display: 'flex', gap: 12, padding: 12, borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-bg)',
                }}
              >
                {/* Numbered badge */}
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, fontFamily: 'var(--font-mono)',
                  background: 'hsl(168, 55%, 92%)', color: 'var(--color-primary)',
                }}>
                  {ref.id}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: '0.8rem', lineHeight: 1.55, color: 'var(--color-text-secondary)', margin: 0 }}>
                    {ref.text}
                  </p>
                  <p style={{ fontSize: '0.72rem', marginTop: 3, marginBottom: 0 }}>
                    <span style={{ fontStyle: 'italic', color: 'var(--color-primary)' }}>
                      {ref.journal}
                    </span>
                    {ref.vol && (
                      <span style={{ color: 'var(--color-text-muted)' }}> {ref.vol}</span>
                    )}
                    {ref.pages && (
                      <span style={{ color: 'var(--color-text-muted)' }}>, pp. {ref.pages}</span>
                    )}
                  </p>
                  {ref.doi && (
                    <a
                      href={`https://doi.org/${ref.doi}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'inline-block', marginTop: 2,
                        color: 'var(--color-primary)', textDecoration: 'none',
                        fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                      }}
                    >
                      DOI: {ref.doi}
                    </a>
                  )}
                  <p style={{
                    fontSize: '0.7rem', marginTop: 4, marginBottom: 0,
                    padding: '2px 6px', borderRadius: 'var(--radius-sm)',
                    background: 'var(--color-border-light)', color: 'var(--color-text-muted)',
                    display: 'inline-block',
                  }}>
                    {lang === 'en' ? (REF_NOTES_EN[ref.id] ?? ref.note) : ref.note}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
