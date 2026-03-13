import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import './i18n'
import './styles/index.css'

type Tab = 'buffers' | 'protocols' | 'calc' | 'plate' | 'tools' | 'refs'

function App() {
  const { t, i18n } = useTranslation()
  const [tab, setTab] = useState<Tab>('buffers')
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('labmate_theme') as 'light' | 'dark') || 'light'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('labmate_theme', theme)
  }, [theme])

  const toggleLang = () => {
    const next = i18n.language === 'zh' ? 'en' : 'zh'
    i18n.changeLanguage(next)
    localStorage.setItem('labmate_lang', next)
  }

  const toggleTheme = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  const tabs: { key: Tab; label: string }[] = [
    { key: 'buffers', label: t('nav.buffers') },
    { key: 'protocols', label: t('nav.protocols') },
    { key: 'calc', label: t('nav.calculator') },
    { key: 'plate', label: t('nav.plate') },
    { key: 'tools', label: t('nav.tools') },
    { key: 'refs', label: t('nav.refs') },
  ]

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
        <div
          className="card p-8 text-center"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: 'var(--font-heading)' }}>
            {t('app.title')} v2.0
          </h2>
          <p className="mb-4">
            Phase 1 — Migrating from single-file prototype to modular React + TypeScript
          </p>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.875rem' }}>
            Tab: <strong>{tab}</strong> • Lang: <strong>{i18n.language}</strong> • Theme: <strong>{theme}</strong>
          </p>
          <div className="mt-6 flex gap-3 justify-center flex-wrap">
            <span className="tag tag-primary">Vite + React 19</span>
            <span className="tag tag-primary">TypeScript</span>
            <span className="tag tag-primary">Tailwind CSS 4</span>
            <span className="tag tag-primary">Dexie.js (IndexedDB)</span>
            <span className="tag tag-primary">Web Crypto API</span>
            <span className="tag">react-i18next (EN/ZH)</span>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
