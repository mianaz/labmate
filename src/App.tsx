import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
import './styles/index.css'
import BuffersTab from '@/features/buffers/BuffersTab'
import ProtocolsTab from '@/features/protocols/ProtocolsTab'
import CalcTab from '@/features/calculator/CalcTab'
import PlateTab from '@/features/plate/PlateTab'
import InventoryTab from '@/features/inventory/InventoryTab'
import ToolsTab from '@/features/tools/ToolsTab'
import { checkForUpdates, syncDatabase, getLastSyncTime } from '@/lib/syncService'

type Tab = 'buffers' | 'protocols' | 'calc' | 'plate' | 'inventory' | 'tools'

type SyncState = 'idle' | 'checking' | 'syncing' | 'done' | 'error'

// ── Lab icon templates ───────────────────────────────────────────────────────

type IconConfig = {
  type: 'template' | 'text' | 'custom'
  template?: string
  text?: string
  customSrc?: string
}

const ICON_TEMPLATES: { id: string; label: string; path: string }[] = [
  { id: 'flask', label: 'Flask', path: 'M10 4V10L5 22H23L18 10V4H10ZM12 4H16M8 18H20' },
  { id: 'microscope', label: 'Microscope', path: 'M12 2L12 7M9 7H15L13 14H11L9 7M8 14H16M7 18H17M12 14V18' },
  { id: 'dna', label: 'DNA', path: 'M8 2C8 2 8 6 12 8C16 10 16 14 16 14M16 22C16 22 16 18 12 16C8 14 8 10 8 10M7 5H17M7 19H17M8 12H16' },
  { id: 'beaker', label: 'Beaker', path: 'M6 3H18V19C18 20.1 17.1 21 16 21H8C6.9 21 6 20.1 6 19V3ZM6 3H4M6 12H18' },
  { id: 'leaf', label: 'Leaf', path: 'M12 22V12M12 12C12 12 6 10 4 4C10 4 12 8 12 12ZM12 12C12 12 18 10 20 4C14 4 12 8 12 12Z' },
  { id: 'atom', label: 'Atom', path: 'M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0M12 4C6 4 2 7.6 2 12C2 16.4 6 20 12 20M12 4C18 4 22 7.6 22 12C22 16.4 18 20 12 20M4.9 7.5C7.9 4.5 11.4 3 14 4C17 5 17 9 14 13C11 17 7 19 4 18C1 17 1.9 13 4.9 10' },
]

function getIconConfig(): IconConfig {
  try {
    const stored = localStorage.getItem('labmate_icon')
    if (stored) return JSON.parse(stored)
  } catch { /* ignore */ }
  return { type: 'template', template: 'flask' }
}

function saveIconConfig(config: IconConfig) {
  localStorage.setItem('labmate_icon', JSON.stringify(config))
}

function LabIcon({ config, size = 28 }: { config: IconConfig; size?: number }) {
  if (config.type === 'custom' && config.customSrc) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 6, overflow: 'hidden',
        background: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <img src={config.customSrc} alt="Lab" style={{ width: size - 4, height: size - 4, objectFit: 'contain' }} />
      </div>
    )
  }

  if (config.type === 'text' && config.text) {
    const fontSize = config.text.length <= 2 ? 12 : config.text.length <= 3 ? 10 : 8
    return (
      <div style={{
        width: size, height: size, borderRadius: 6,
        background: 'var(--color-primary)', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize,
        letterSpacing: '-0.02em', lineHeight: 1,
      }}>
        {config.text}
      </div>
    )
  }

  // Template icon
  const tmpl = ICON_TEMPLATES.find(t => t.id === config.template) ?? ICON_TEMPLATES[0]
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="var(--color-primary)" />
      <g transform="translate(2, 2)" stroke="white" strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d={tmpl.path} />
      </g>
    </svg>
  )
}

function IconSettings({ config, onChange, onClose }: {
  config: IconConfig; onChange: (c: IconConfig) => void; onClose: () => void
}) {
  const { t } = useTranslation()
  const fileRef = useRef<HTMLInputElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const src = reader.result as string
      onChange({ type: 'custom', customSrc: src })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div ref={popoverRef} className="icon-popover">
      <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text)', marginBottom: 12,
        fontFamily: 'var(--font-heading)' }}>
        {t('icon.customize')}
      </p>

      {/* Template grid */}
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6,
        textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {t('icon.templates')}
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
        {ICON_TEMPLATES.map(tmpl => (
          <button key={tmpl.id} title={tmpl.label}
            onClick={() => onChange({ type: 'template', template: tmpl.id })}
            style={{
              padding: 4, borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              border: config.type === 'template' && config.template === tmpl.id
                ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
              background: 'var(--color-bg)',
            }}>
            <LabIcon config={{ type: 'template', template: tmpl.id }} size={32} />
          </button>
        ))}
      </div>

      {/* Custom text */}
      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 4,
        textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        {t('icon.labName')}
      </p>
      <input
        type="text" maxLength={4} placeholder="e.g. ZL"
        value={config.type === 'text' ? config.text ?? '' : ''}
        onChange={e => {
          const val = e.target.value
          if (val) onChange({ type: 'text', text: val })
          else onChange({ type: 'template', template: config.template ?? 'flask' })
        }}
        style={{
          width: '100%', padding: '6px 10px', fontSize: 14, marginBottom: 14,
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
          background: 'var(--color-bg)', color: 'var(--color-text)', boxSizing: 'border-box',
        }}
      />

      {/* Upload */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => fileRef.current?.click()}
          style={{
            flex: 1, padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)',
          }}>
          {t('icon.upload')}
        </button>
        <button onClick={() => onChange({ type: 'template', template: 'flask' })}
          style={{
            padding: '6px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-bg-card)', color: 'var(--color-text-muted)',
          }}>
          {t('icon.reset')}
        </button>
      </div>
      <input ref={fileRef} type="file" accept="image/png,image/svg+xml,image/jpeg"
        style={{ display: 'none' }} onChange={handleUpload} />
    </div>
  )
}

// ── Main App ─────────────────────────────────────────────────────────────────

function App() {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<Tab>('buffers')
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('labmate_theme') as 'light' | 'dark') || 'light'
  )

  // Sync state
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncMsg, setSyncMsg] = useState('')
  const [lastSync, setLastSync] = useState<string | null>(null)

  // Icon customization
  const [iconConfig, setIconConfig] = useState<IconConfig>(getIconConfig)
  const [showIconSettings, setShowIconSettings] = useState(false)

  // Cross-tab navigation
  const [navigateId, setNavigateId] = useState<string | null>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('labmate_theme', theme)
  }, [theme])

  useEffect(() => {
    getLastSyncTime().then(setLastSync)
  }, [syncState])

  const toggleLang = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh'
    i18n.changeLanguage(next)
    localStorage.setItem('labmate_lang', next)
  }

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  const handleIconChange = useCallback((config: IconConfig) => {
    setIconConfig(config)
    saveIconConfig(config)
  }, [])

  const handleNavigate = useCallback((targetTab: Tab, targetId?: string) => {
    setTab(targetTab)
    setNavigateId(targetId ?? null)
  }, [])

  const handleSync = useCallback(async () => {
    setSyncState('checking')
    setSyncMsg('')

    const available = await checkForUpdates()
    if (available === null) {
      setSyncState('idle')
      setSyncMsg(t('sync.upToDate'))
      setTimeout(() => setSyncMsg(''), 3000)
      return
    }

    setSyncState('syncing')
    try {
      const result = await syncDatabase()
      setSyncState('done')
      setSyncMsg(t('sync.result', { added: result.added, updated: result.updated }))
      setTimeout(() => { setSyncState('idle'); setSyncMsg('') }, 5000)
    } catch {
      setSyncState('error')
      setSyncMsg(t('sync.error'))
      setTimeout(() => { setSyncState('idle'); setSyncMsg('') }, 5000)
    }
  }, [t])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'buffers', label: t('nav.buffers') },
    { key: 'protocols', label: t('nav.protocols') },
    { key: 'calc', label: t('nav.calculator') },
    { key: 'plate', label: t('nav.plate') },
    { key: 'inventory', label: t('nav.inventory') },
    { key: 'tools', label: t('nav.tools') },
  ]

  const renderTab = () => {
    switch (tab) {
      case 'buffers':   return <BuffersTab initialSelectedId={navigateId} onNavigate={handleNavigate} />
      case 'protocols': return <ProtocolsTab initialSelectedId={navigateId} onNavigate={handleNavigate} />
      case 'calc':      return <CalcTab />
      case 'plate':     return <PlateTab />
      case 'inventory': return <InventoryTab />
      case 'tools':     return <ToolsTab />
    }
  }

  return (
    <div className="min-h-screen" style={{
      backgroundColor: 'var(--color-bg)', color: 'var(--color-text)',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <header className="app-header sticky top-0 z-50 px-6 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3" style={{ position: 'relative' }}>
          <button
            onClick={() => setShowIconSettings(!showIconSettings)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 0 }}
            title={t('icon.customize')}
          >
            <LabIcon config={iconConfig} />
          </button>
          {showIconSettings && (
            <IconSettings
              config={iconConfig}
              onChange={handleIconChange}
              onClose={() => setShowIconSettings(false)}
            />
          )}
          <div>
            <h1
              className="text-lg font-bold leading-tight"
              style={{
                fontFamily: 'var(--font-heading)', color: 'var(--color-text)',
                letterSpacing: '-0.03em',
              }}
            >
              {t('app.title')}
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {t('app.subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync indicator */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSync}
              disabled={syncState === 'checking' || syncState === 'syncing'}
              title={lastSync ? `${t('sync.lastSync')}: ${new Date(lastSync).toLocaleDateString()}` : t('sync.check')}
              className="p-2 rounded-md hover:opacity-80"
              style={{
                color: syncState === 'error' ? 'var(--color-error)'
                  : syncState === 'done' ? 'var(--color-success)'
                  : 'var(--color-text-secondary)',
                opacity: (syncState === 'checking' || syncState === 'syncing') ? 0.5 : 1,
                background: 'none', border: 'none',
                cursor: (syncState === 'checking' || syncState === 'syncing') ? 'wait' : 'pointer',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{
                  animation: (syncState === 'checking' || syncState === 'syncing')
                    ? 'spin 1s linear infinite' : undefined,
                }}>
                <path d="M21.5 2v6h-6M2.5 22v-6h6" />
                <path d="M2.5 11.5a10 10 0 0118.2-4.4L21.5 8M21.5 12.5a10 10 0 01-18.2 4.4L2.5 16" />
              </svg>
            </button>
            {syncMsg && (
              <span style={{
                fontSize: 11,
                color: syncState === 'error' ? 'var(--color-error)'
                  : syncState === 'done' ? 'var(--color-success)'
                  : 'var(--color-text-muted)',
                whiteSpace: 'nowrap',
              }}>
                {syncMsg}
              </span>
            )}
          </div>

          <button onClick={toggleLang} className="btn-primary text-sm px-3 py-1">
            {t('lang.switch')}
          </button>
          <button
            onClick={toggleTheme}
            className="p-2 rounded-md hover:opacity-80"
            style={{ color: 'var(--color-text-secondary)' }}
            aria-label="Toggle theme"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {theme === 'light' ? (
                <path d="M21 12.79A9 9 0 1111.21 3a7 7 0 009.79 9.79z" />
              ) : (
                <>
                  <circle cx="12" cy="12" r="5" />
                  <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
                </>
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* Tab Bar */}
      <nav className="app-nav sticky top-[49px] z-40 px-6 flex gap-1 overflow-x-auto">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key); setNavigateId(null) }}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
            style={{
              borderColor: tab === key ? 'var(--color-primary)' : 'transparent',
              color: tab === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              background: 'transparent',
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6" style={{ flex: 1, width: '100%' }}>
        {renderTab()}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500 }}>
          LabMate v0.1.0
        </span>
        <span style={{ color: 'var(--color-border)' }}>·</span>
        <span>{t('footer.madeBy')}</span>
        <span style={{ color: 'var(--color-border)' }}>·</span>
        <a href="https://github.com/mianaz/labmate" target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          {t('footer.github')}
        </a>
      </footer>

      {/* Spin animation for sync icon */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default App
