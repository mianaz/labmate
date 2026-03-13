import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { EXTERNAL_TOOLS } from '@/data/externalTools'

export default function ToolsTab() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'en' | 'zh'
  const [filter, setFilter] = useState('all')

  const cats = ['all', ...EXTERNAL_TOOLS.map((g) => g.cat)]

  const filtered = filter === 'all'
    ? EXTERNAL_TOOLS
    : EXTERNAL_TOOLS.filter((g) => g.cat === filter)

  return (
    <div className="fade-in">
      {/* Header card with filter buttons */}
      <div className="card p-5 mb-6">
        <h2 className="text-xl font-bold mb-1">{t('tools.title')}</h2>
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          {t('tools.subtitle')}
        </p>
        <div className="flex flex-wrap gap-2">
          {cats.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: filter === c ? 'var(--color-primary, var(--primary))' : 'var(--bg-2)',
                color: filter === c ? 'white' : 'var(--text-muted)',
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
            style={{ color: 'var(--text-muted)' }}
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
                style={{ textDecoration: 'none', color: 'var(--text)' }}
              >
                <span className="text-2xl flex-shrink-0">{tool.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{tool.name}</p>
                  <p
                    className="text-xs mt-0.5"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {tool.desc[lang] ?? tool.desc.en}
                  </p>
                  <p
                    className="text-xs mono mt-1 truncate"
                    style={{
                      color: 'var(--color-primary, var(--primary))',
                      opacity: 0.7,
                    }}
                  >
                    {tool.url.replace('https://', '').replace(/\/$/, '')}
                  </p>
                </div>
                <span
                  className="text-xs ml-auto flex-shrink-0"
                  style={{ color: 'var(--text-muted)' }}
                >
                  ↗
                </span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
