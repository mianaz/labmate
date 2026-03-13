import { useState, useEffect, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProtocols } from '@/hooks/useProtocols'
import { EXTERNAL_TOOLS } from '@/data/externalTools'
import { getRecent, addRecent } from '@/lib/recentlyViewed'

type Tab = 'buffers' | 'protocols' | 'calc' | 'plate' | 'inventory' | 'tools' | 'refs'

interface SearchResult {
  id: string
  name: string
  category: 'buffer' | 'protocol' | 'staining' | 'media' | 'tool'
  tab: Tab
  score: number
}

interface SearchModalProps {
  open: boolean
  onClose: () => void
  onNavigate: (tab: Tab, id?: string) => void
}

function scoreMatch(query: string, text: string): number {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (t === q) return 100
  if (t.startsWith(q)) return 80
  if (t.includes(q)) return 60
  let qi = 0
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++
  }
  return qi === q.length ? 30 : 0
}

/** Wrapper: unmounts inner when closed, so inner resets naturally on re-mount */
export default function SearchModal({ open, onClose, onNavigate }: SearchModalProps) {
  if (!open) return null
  return <SearchModalInner onClose={onClose} onNavigate={onNavigate} />
}

function SearchModalInner({ onClose, onNavigate }: Omit<SearchModalProps, 'open'>) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'en' | 'zh'
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const [selectedIdx, setSelectedIdx] = useState(0)

  const allProtocols = useProtocols()
  const protocols = useMemo(() => allProtocols ?? [], [allProtocols])

  // Auto-focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [])

  const results = useMemo(() => {
    if (!query.trim()) {
      const recent = getRecent()
      return recent
        .map(id => {
          const p = protocols.find(pr => pr.externalId === id)
          if (!p) return null
          const catTab: Tab = p.category === 'protocol' ? 'protocols' : 'buffers'
          return { id: p.externalId, name: lang === 'zh' ? p.nameZh : p.name, category: p.category, tab: catTab, score: 0 } as SearchResult
        })
        .filter(Boolean) as SearchResult[]
    }

    const q = query.trim()
    const hits: SearchResult[] = []

    for (const p of protocols) {
      const nameScore = Math.max(
        scoreMatch(q, p.name),
        scoreMatch(q, p.nameZh),
        ...p.tags.map(tag => scoreMatch(q, tag)),
      )
      if (nameScore > 0) {
        const catTab: Tab = p.category === 'protocol' ? 'protocols' : 'buffers'
        hits.push({ id: p.externalId, name: lang === 'zh' ? p.nameZh : p.name, category: p.category, tab: catTab, score: nameScore })
      }
    }

    for (const group of EXTERNAL_TOOLS) {
      for (const tool of group.tools) {
        const nameScore = Math.max(scoreMatch(q, tool.name), scoreMatch(q, tool.desc.en), scoreMatch(q, tool.desc.zh))
        if (nameScore > 0) {
          hits.push({ id: tool.url, name: tool.name, category: 'tool', tab: 'tools', score: nameScore })
        }
      }
    }

    return hits.sort((a, b) => b.score - a.score).slice(0, 15)
  }, [query, protocols, lang])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); onClose() }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter' && results[selectedIdx]) { e.preventDefault(); handleSelect(results[selectedIdx]) }
  }

  function handleSelect(result: SearchResult) {
    if (result.category === 'tool') {
      window.open(result.id, '_blank')
    } else {
      addRecent(result.id)
      onNavigate(result.tab, result.id)
    }
    onClose()
  }

  const catLabel = (cat: SearchResult['category']) => {
    switch (cat) {
      case 'buffer': case 'staining': case 'media': return t('search.buffers')
      case 'protocol': return t('search.protocols')
      case 'tool': return t('search.tools')
    }
  }

  const catColor = (cat: SearchResult['category']) => {
    switch (cat) {
      case 'buffer': return '#0b6e63'
      case 'staining': return '#d4552a'
      case 'media': return '#2563eb'
      case 'protocol': return '#7c3aed'
      case 'tool': return 'var(--color-text-muted)'
    }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--color-bg-card)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          overflow: 'hidden',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '14px 18px',
          borderBottom: '1px solid var(--color-border)',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-muted)"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIdx(0) }}
            onKeyDown={handleKeyDown}
            placeholder={t('search.hint')}
            style={{
              flex: 1, border: 'none', outline: 'none', fontSize: 15,
              background: 'transparent', color: 'var(--color-text)',
              fontFamily: 'var(--font-body)',
            }}
          />
          <kbd style={{
            fontSize: 11, padding: '2px 6px', borderRadius: 4,
            background: 'var(--color-bg)', border: '1px solid var(--color-border)',
            color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)',
          }}>
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: '6px 0' }}>
          {!query.trim() && results.length > 0 && (
            <div style={{
              padding: '6px 18px', fontSize: 11, fontWeight: 600,
              color: 'var(--color-text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}>
              {t('search.recentlyViewed')}
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.id}-${i}`}
              onClick={() => handleSelect(r)}
              onMouseEnter={() => setSelectedIdx(i)}
              style={{
                width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center',
                gap: 10, padding: '10px 18px', border: 'none', cursor: 'pointer',
                background: i === selectedIdx ? 'var(--color-border-light)' : 'transparent',
                color: 'var(--color-text)', fontSize: 14,
                transition: 'background 0.1s',
              }}
            >
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: catColor(r.category),
              }} />
              <span style={{ flex: 1, fontWeight: 500 }}>{r.name}</span>
              <span style={{
                fontSize: 11, color: catColor(r.category),
                fontWeight: 600, flexShrink: 0,
              }}>
                {catLabel(r.category)}
              </span>
              {r.category === 'tool' && (
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>↗</span>
              )}
            </button>
          ))}
          {query.trim() && results.length === 0 && (
            <div style={{
              padding: '32px 18px', textAlign: 'center',
              color: 'var(--color-text-muted)', fontSize: 14,
            }}>
              {t('search.noResults')}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
