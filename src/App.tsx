import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
import './styles/index.css'
import BuffersTab from '@/features/buffers/BuffersTab'
import ProtocolsTab from '@/features/protocols/ProtocolsTab'
import CalcTab from '@/features/calculator/CalcTab'
import PlateTab from '@/features/plate/PlateTab'
import InventoryTab from '@/features/inventory/InventoryTab'
import ToolsTab from '@/features/tools/ToolsTab'
import RefsTab from '@/features/refs/RefsTab'
import { checkForUpdates, syncDatabase, getLastSyncTime } from '@/lib/syncService'

type Tab = 'buffers' | 'protocols' | 'calc' | 'plate' | 'inventory' | 'tools' | 'refs'

type SyncState = 'idle' | 'checking' | 'syncing' | 'done' | 'error'

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
    { key: 'refs', label: t('nav.refs') },
  ]

  const renderTab = () => {
    switch (tab) {
      case 'buffers':   return <BuffersTab />
      case 'protocols': return <ProtocolsTab />
      case 'calc':      return <CalcTab />
      case 'plate':     return <PlateTab />
      case 'inventory': return <InventoryTab />
      case 'tools':     return <ToolsTab />
      case 'refs':      return <RefsTab />
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Header */}
      <header
        className="sticky top-0 z-50 border-b px-6 py-3 flex items-center justify-between"
        style={{
          background: 'var(--color-bg-card)',
          borderColor: 'var(--color-border)',
        }}
      >
        <div className="flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="var(--color-primary)" />
            <path d="M8 20V8h3v5h6V8h3v12h-3v-5h-6v5H8z" fill="white" />
          </svg>
          <div>
            <h1
              className="text-lg font-bold leading-tight"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
            >
              {t('app.title')}
            </h1>
            <p
              className="text-xs"
              style={{ color: 'var(--color-text-muted)' }}
            >
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
                background: 'none',
                border: 'none',
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

          <button
            onClick={toggleLang}
            className="btn-primary text-sm px-3 py-1"
          >
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
      <nav
        className="border-b px-6 flex gap-1 overflow-x-auto"
        style={{
          background: 'var(--color-bg-card)',
          borderColor: 'var(--color-border)',
        }}
      >
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className="px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
            style={{
              borderColor: tab === key ? 'var(--color-primary)' : 'transparent',
              color: tab === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
            }}
          >
            {label}
          </button>
        ))}
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {renderTab()}
      </main>

      {/* Spin animation for sync icon */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}

export default App
