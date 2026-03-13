import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { EXTERNAL_TOOLS } from '@/data/externalTools'
import db from '@/lib/db'

async function exportAllData(): Promise<string> {
  const [protocols, experiments, storageLocations, sampleBoxes, samples, settings] = await Promise.all([
    db.protocols.toArray(),
    db.experiments.toArray(),
    db.storageLocations.toArray(),
    db.sampleBoxes.toArray(),
    db.samples.toArray(),
    db.settings.toArray(),
  ])

  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'LabMate',
    protocols,
    experiments,
    storageLocations,
    sampleBoxes,
    samples,
    settings,
    localStorage: {
      labmate_theme: localStorage.getItem('labmate_theme'),
      labmate_lang: localStorage.getItem('labmate_lang'),
      labmate_recent: localStorage.getItem('labmate_recent'),
      labmate_step_progress: localStorage.getItem('labmate_step_progress'),
      labmate_icon: localStorage.getItem('labmate_icon'),
    },
  }
  return JSON.stringify(data, null, 2)
}

async function importAllData(json: string): Promise<number> {
  const data = JSON.parse(json)
  if (!data.app || data.app !== 'LabMate') throw new Error('Invalid format')

  let count = 0

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function stripId(obj: any) { const copy = { ...obj }; delete copy.id; return copy }

  // Import protocols (merge by externalId)
  if (data.protocols?.length) {
    for (const proto of data.protocols) {
      const existing = await db.protocols.where('externalId').equals(proto.externalId).first()
      if (existing) {
        if (proto.updatedAt > existing.updatedAt) {
          await db.protocols.update(existing.id!, proto)
          count++
        }
      } else {
        await db.protocols.add(stripId(proto))
        count++
      }
    }
  }

  // Import other tables
  if (data.storageLocations?.length) {
    for (const loc of data.storageLocations) {
      await db.storageLocations.add(stripId(loc))
      count++
    }
  }
  if (data.sampleBoxes?.length) {
    for (const box of data.sampleBoxes) {
      await db.sampleBoxes.add(stripId(box))
      count++
    }
  }
  if (data.samples?.length) {
    for (const sample of data.samples) {
      await db.samples.add(stripId(sample))
      count++
    }
  }

  // Restore localStorage preferences
  if (data.localStorage) {
    for (const [key, val] of Object.entries(data.localStorage)) {
      if (val != null) localStorage.setItem(key, val as string)
    }
  }

  return count
}

export default function ToolsTab() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'en' | 'zh'
  const [filter, setFilter] = useState('all')
  const [toast, setToast] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const cats = ['all', ...EXTERNAL_TOOLS.map((g) => g.cat)]

  const filtered = filter === 'all'
    ? EXTERNAL_TOOLS
    : EXTERNAL_TOOLS.filter((g) => g.cat === filter)

  async function handleExport() {
    const json = await exportAllData()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `labmate-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setToast(t('data.exportSuccess'))
    setTimeout(() => setToast(''), 3000)
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      if (!confirm(t('data.confirmImport'))) return
      const count = await importAllData(text)
      setToast(t('data.importSuccess', { count }))
    } catch {
      setToast(t('data.importFailed'))
    }
    setTimeout(() => setToast(''), 4000)
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <div className="fade-in">
      {/* Header card with filter buttons */}
      <div className="card p-5 mb-6">
        <h2 className="text-xl font-bold mb-1">{t('tools.title')}</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {t('tools.subtitle')}
        </p>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: filter === c ? 'var(--color-primary)' : 'var(--color-bg)',
                color: filter === c ? 'white' : 'var(--color-text-muted)',
              }}
            >
              {c === 'all' ? t('tools.filterAll') : t(c)}
            </button>
          ))}
        </div>
      </div>

      {/* Tool groups */}
      {filtered.map((group) => (
        <div key={group.cat} className="mb-6">
          <h3
            className="text-sm font-bold mb-3 px-1"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {t(group.cat)}
          </h3>
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}
          >
            {group.tools.map((tool) => (
              <a
                key={tool.name}
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="card p-4 flex items-start gap-3 transition-all hover:scale-[1.02]"
                style={{ textDecoration: 'none', color: 'var(--color-text)' }}
              >
                <span className="text-2xl flex-shrink-0">{tool.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{tool.name}</p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--color-text-muted)' }}
                  >
                    {tool.desc[lang] ?? tool.desc.en}
                  </p>
                  <p
                    className="text-xs mono mt-1 truncate"
                    style={{
                      color: 'var(--color-primary)',
                      opacity: 0.7,
                    }}
                  >
                    {tool.url.replace('https://', '').replace(/\/$/, '')}
                  </p>
                </div>
                <span
                  className="text-xs ml-auto flex-shrink-0"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  ↗
                </span>
              </a>
            ))}
          </div>
        </div>
      ))}

      {/* Data Management Section */}
      <div className="card p-5 mt-6">
        <h3 className="text-lg font-bold mb-1">{t('data.title')}</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {t('data.privacy')}
        </p>
        <div className="flex flex-wrap gap-3">
          <button onClick={handleExport} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-bg-card)', color: 'var(--color-text)',
            cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {t('data.export')}
          </button>
          <button onClick={() => fileRef.current?.click()} style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-bg-card)', color: 'var(--color-text)',
            cursor: 'pointer', fontWeight: 600, fontSize: 13,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            {t('data.import')}
          </button>
          <input ref={fileRef} type="file" accept=".json" style={{ display: 'none' }}
            onChange={handleImport} />
        </div>
        {toast && (
          <p style={{
            marginTop: 12, fontSize: 13, fontWeight: 600,
            color: toast.includes('fail') || toast.includes('失败')
              ? 'var(--color-error)' : 'var(--color-success)',
          }}>
            {toast}
          </p>
        )}
      </div>
    </div>
  )
}
