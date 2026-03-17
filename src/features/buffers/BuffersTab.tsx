import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProtocols } from '@/hooks/useProtocols'
import { toggleFavorite } from '@/hooks/useProtocols'
import { catColors } from '@/data/recipes'
import { BUFFER_ENHANCEMENTS } from '@/data/buffer-enhancements'
import { REFERENCES, REF_NOTES_EN, RECIPE_REFS } from '@/data/references'
import type { Protocol } from '@/lib/db'
import db from '@/lib/db'
import RecipeForm from '@/features/shared/RecipeForm'
import GelRecipeDetail from './GelRecipeDetail'
import { addRecent } from '@/lib/recentlyViewed'

const GEL_ID = '__gel_calculator__'

const VISIBLE_CATS = ['buffer', 'staining', 'media'] as const
const CAT_ORDER: Record<string, number> = { buffer: 0, staining: 1, media: 2 }
const CAT_LABEL: Record<string, string> = { buffer: 'Buffers', staining: 'Staining', media: 'Media' }

interface BuffersTabProps {
  initialSelectedId?: string | null
  onNavigate?: (tab: 'buffers' | 'protocols' | 'calc' | 'plate' | 'inventory' | 'tools', id?: string) => void
}

export default function BuffersTab({ initialSelectedId, onNavigate }: BuffersTabProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'en' | 'zh'

  const allProtocols = useProtocols([...VISIBLE_CATS])
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)
  const [search, setSearch] = useState('')
  const [targetVolumes, setTargetVolumes] = useState<Record<string, number>>({})
  const [mobileDetail, setMobileDetail] = useState(!!initialSelectedId)
  const [showForm, setShowForm] = useState(false)
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null)

  const recipes = useMemo(() => allProtocols ?? [], [allProtocols])

  const filtered = useMemo(() => {
    if (!search.trim()) return recipes
    const q = search.toLowerCase()
    return recipes.filter(
      (r) => r.name.toLowerCase().includes(q) || r.nameZh.includes(q),
    )
  }, [recipes, search])

  const grouped = useMemo(() => {
    const map = new Map<string, Protocol[]>()
    for (const r of filtered) {
      const list = map.get(r.category) ?? []
      list.push(r)
      map.set(r.category, list)
    }
    return [...map.entries()].sort((a, b) => (CAT_ORDER[a[0]] ?? 9) - (CAT_ORDER[b[0]] ?? 9))
  }, [filtered])

  const selected = recipes.find((r) => r.externalId === selectedId) ?? null

  function handleSelect(r: Protocol) { setSelectedId(r.externalId); setMobileDetail(true); addRecent(r.externalId) }

  function getTargetVol(r: Protocol) { return targetVolumes[r.externalId] ?? (r.defaultVolume || 1) }
  function setTargetVol(r: Protocol, v: number) { setTargetVolumes((p) => ({ ...p, [r.externalId]: v })) }

  function scaleAmount(recipe: Protocol, amount: number | string | null): string {
    if (amount == null) return '-'
    if (typeof amount === 'string') return amount
    const defVol = recipe.defaultVolume || 1
    const scaled = amount * (getTargetVol(recipe) / defVol)
    return scaled % 1 === 0 ? String(scaled) : scaled.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  }

  const name = (r: Protocol) => (lang === 'zh' ? r.nameZh : r.name)

  async function handleDelete(proto: Protocol) {
    if (proto.id) {
      await db.protocols.delete(proto.id)
      setSelectedId(null)
      setEditingProtocol(null)
    }
  }

  // Get related protocols for a buffer
  function getRelatedProtocols(externalId: string): string[] {
    const enh = BUFFER_ENHANCEMENTS[externalId]
    return enh?.relatedProtocols ?? []
  }

  // Get references for a recipe
  function getReferences(externalId: string) {
    const refIds = RECIPE_REFS[externalId]
    if (!refIds?.length) return []
    return refIds.map(id => REFERENCES.find(r => r.id === id)).filter(Boolean)
  }

  // Loading state
  if (!allProtocols) {
    return <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>Loading...</div>
  }

  // Form modal
  if (showForm || editingProtocol) {
    return (
      <div className="card" style={{ padding: 24, maxWidth: 640, margin: '0 auto' }}>
        <RecipeForm
          defaultCategory="buffer"
          existing={editingProtocol ?? undefined}
          onSave={() => { setShowForm(false); setEditingProtocol(null) }}
          onCancel={() => { setShowForm(false); setEditingProtocol(null) }}
        />
      </div>
    )
  }

  // ── List panel ──
  const listPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder={t('search.placeholder')}
            style={{ width: '100%', paddingLeft: 36, paddingRight: 32, paddingTop: 8, paddingBottom: 8,
              fontSize: 14, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
              background: 'var(--color-bg)', color: 'var(--color-text)', outline: 'none' }}
          />
          {search && (
            <button onClick={() => setSearch('')}
              style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          title={t('db.addCustom')}
          style={{ padding: '6px 12px', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'var(--color-bg-card)',
            color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}
        >
          +
        </button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* SDS-PAGE Gel Calculator — pinned entry */}
        {(!search.trim() || ['gel', 'sds', 'page', 'acrylamide', 'polyacrylamide', '配胶', '电泳'].some(k => search.toLowerCase().includes(k))) && (
          <button
            onClick={() => { setSelectedId(GEL_ID); setMobileDetail(true) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
              padding: '10px 8px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
              background: selectedId === GEL_ID ? 'var(--color-border-light, var(--color-border))' : 'transparent',
              transition: 'background 0.12s', marginBottom: 4,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ color: 'var(--color-primary)', flexShrink: 0 }}>
              <rect x="6" y="2" width="12" height="20" rx="1" />
              <line x1="6" y1="8" x2="18" y2="8" />
              <line x1="6" y1="14" x2="18" y2="14" />
            </svg>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0 }}>
                {t('gel.title')}
              </p>
              <p style={{ fontSize: 10, color: 'var(--color-text-muted)', margin: '2px 0 0' }}>
                {t('gel.subtitle')}
              </p>
            </div>
          </button>
        )}
        {grouped.length === 0 && (
          <p style={{ textAlign: 'center', padding: 24, color: 'var(--color-text-muted)', fontSize: 14 }}>No results</p>
        )}
        {grouped.map(([cat, recipes]) => (
          <div key={cat}>
            <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '6px 0', fontSize: 11,
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: 'var(--color-text-muted)', background: 'var(--color-bg-card)' }}>
              {CAT_LABEL[cat] ?? cat}
            </div>
            {recipes.map((r) => {
              const cc = catColors[r.category]
              return (
                <button key={r.externalId} onClick={() => handleSelect(r)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left',
                    padding: '10px 8px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                    background: selectedId === r.externalId ? 'var(--color-border-light, var(--color-border))' : 'transparent',
                    transition: 'background 0.12s' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, marginTop: 5,
                    background: cc?.text ?? 'var(--color-primary)' }} />
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text)', margin: 0, flex: 1 }}>{name(r)}</p>
                      {r.source === 'custom' && (
                        <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--color-accent-light)', color: '#fff', fontWeight: 600 }}>
                          {t('db.custom')}
                        </span>
                      )}
                      {r.isFavorite && (
                        <span style={{ color: 'var(--color-warning)', fontSize: 12 }}>&#9733;</span>
                      )}
                    </div>
                    {r.tags.length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {r.tags.map((tag) => (
                          <span key={tag} style={{ fontSize: 10, padding: '1px 6px',
                            borderRadius: 'var(--radius-sm)',
                            background: 'var(--color-border-light, var(--color-border))',
                            color: 'var(--color-text-muted)' }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )

  // ── Detail panel ──
  const relatedProtos = selected ? getRelatedProtocols(selected.externalId) : []
  const refs = selected ? getReferences(selected.externalId) : []

  const detailPanel = selectedId === GEL_ID ? (
    <GelRecipeDetail lang={lang} onNavigate={onNavigate} />
  ) : selected ? (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700,
            color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em' }}>
            {name(selected)}
          </h2>
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px',
            borderRadius: 'var(--radius-sm)',
            background: catColors[selected.category]?.bg ?? 'var(--color-border)',
            color: catColors[selected.category]?.text ?? 'var(--color-text)' }}>
            {CAT_LABEL[selected.category] ?? selected.category}
          </span>
          {selected.source === 'custom' && (
            <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px',
              borderRadius: 'var(--radius-sm)', background: 'var(--color-accent-light)', color: '#fff' }}>
              {t('db.custom')}
            </span>
          )}
          {selected.id && (
            <button onClick={() => toggleFavorite(selected.id!)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
                color: selected.isFavorite ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
              {selected.isFavorite ? '\u2605' : '\u2606'}
            </button>
          )}
        </div>
        {lang === 'zh' && (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>{selected.name}</p>
        )}
        {selected.ph && (
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>pH {selected.ph}</p>
        )}
      </div>

      {/* Volume scaler */}
      {selected.defaultVolume != null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          marginBottom: 16, padding: '10px 14px', borderRadius: 'var(--radius-sm)',
          background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-secondary)' }}>{t('buffer.scale')}</label>
          <input type="number" min={0} step="any" value={getTargetVol(selected)}
            onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setTargetVol(selected, v) }}
            style={{ width: 90, padding: '4px 8px', fontSize: 14, fontFamily: 'var(--font-mono)',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
              background: 'var(--color-bg-card)', color: 'var(--color-text)', textAlign: 'right' }}
          />
          <span style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{selected.unit}</span>
          {getTargetVol(selected) !== (selected.defaultVolume || 1) && (
            <button onClick={() => setTargetVol(selected, selected.defaultVolume || 1)}
              style={{ fontSize: 11, padding: '2px 8px', cursor: 'pointer',
                borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                background: 'var(--color-bg-card)', color: 'var(--color-text-muted)' }}>
              Reset ({selected.defaultVolume})
            </button>
          )}
        </div>
      )}

      {/* Component table */}
      {selected.components.length > 0 && (
        <div style={{ overflowX: 'auto', marginBottom: 20 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Reagent', 'Amount', 'Unit', 'MW'].map((h) => (
                  <th key={h} style={{ textAlign: h === 'Reagent' ? 'left' : 'right', padding: '8px 10px',
                    fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)',
                    textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selected.components.map((c, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '8px 10px', color: 'var(--color-text)' }}>
                    {c.name}
                    {c.note && <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginLeft: 6 }}>({c.note})</span>}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text)' }}>
                    {scaleAmount(selected, c.amount)}
                  </td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>{c.unit}</td>
                  <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
                    {c.mw ?? '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Instructions */}
      {(selected.instructions.en || selected.instructions.zh) && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700,
            color: 'var(--color-text)', marginBottom: 8 }}>{t('buffer.usage')}</h3>
          <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
            {lang === 'zh' ? selected.instructions.zh : selected.instructions.en}
          </p>
        </div>
      )}

      {/* Storage */}
      {selected.storage && (
        <div style={{ marginBottom: 20, padding: '12px 14px', borderRadius: 'var(--radius-sm)',
          background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700,
            color: 'var(--color-text)', marginBottom: 6 }}>{t('buffer.storage')}</h3>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: 0 }}>
            {selected.storage.temp}{selected.storage.duration ? ` / ${selected.storage.duration}` : ''}
          </p>
          <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '4px 0 0' }}>
            {lang === 'zh' ? selected.storage.label.zh : selected.storage.label.en}
          </p>
        </div>
      )}

      {/* Used in Protocols — crosslinks */}
      {relatedProtos.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700,
            color: 'var(--color-text)', marginBottom: 8 }}>{t('buffer.usedInProtocols')}</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {relatedProtos.map(protoId => {
              // Try to find a human-readable name for the protocol
              const protoLabel = protoId
                .replace(/_protocol$/, '')
                .replace(/_/g, ' ')
                .replace(/\b\w/g, c => c.toUpperCase())
              return (
                <button key={protoId} className="crosslink-pill"
                  onClick={() => onNavigate?.('protocols', protoId)}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                    <polyline points="15 3 21 3 21 9" />
                    <line x1="10" y1="14" x2="21" y2="3" />
                  </svg>
                  {protoLabel}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* References — inline */}
      {refs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700,
            color: 'var(--color-text)', marginBottom: 8 }}>{t('buffer.references')}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {refs.map(ref => ref && (
              <div key={ref.id} className="ref-card">
                <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>{ref.text}</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
                  <span style={{ fontStyle: 'italic', color: 'var(--color-primary)' }}>{ref.journal}</span>
                  {ref.vol && <span style={{ color: 'var(--color-text-muted)' }}> {ref.vol}</span>}
                  {ref.pages && <span style={{ color: 'var(--color-text-muted)' }}>, {ref.pages}</span>}
                </p>
                {ref.doi && (
                  <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noopener noreferrer">
                    DOI: {ref.doi}
                  </a>
                )}
                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                  {lang === 'en' ? (REF_NOTES_EN[ref.id] ?? ref.note) : ref.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit / Delete for custom */}
      {selected.source === 'custom' && (
        <div style={{ display: 'flex', gap: 8, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)' }}>
          <button onClick={() => setEditingProtocol(selected)}
            style={{ fontSize: 13, padding: '6px 16px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg-card)',
              color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
            {t('db.edit')}
          </button>
          <button onClick={() => { if (confirm(t('db.deleteConfirm'))) handleDelete(selected) }}
            style={{ fontSize: 13, padding: '6px 16px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-error)', background: 'transparent',
              color: 'var(--color-error)', cursor: 'pointer' }}>
            {t('db.delete')}
          </button>
        </div>
      )}
    </div>
  ) : (
    <div style={{ textAlign: 'center', padding: 48, color: 'var(--color-text-muted)' }}>
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
        style={{ margin: '0 auto 12px', opacity: 0.4, display: 'block' }}>
        <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3" />
        <path d="M3 16v3a2 2 0 002 2h3m8 0h3a2 2 0 002-2v-3" />
        <line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" />
      </svg>
      <p style={{ fontSize: 14 }}>Select a recipe from the list</p>
    </div>
  )

  // ── Layout ──
  return (
    <div>
      {/* Desktop two-panel */}
      <div className="hidden lg:grid" style={{ gridTemplateColumns: '320px 1fr', gap: 24 }}>
        <div className="card" style={{ padding: 16, position: 'sticky', top: '7rem',
          maxHeight: 'calc(100vh - 8rem)', display: 'flex', flexDirection: 'column' }}>
          {listPanel}
        </div>
        <div className="card" style={{ padding: 24 }}>{detailPanel}</div>
      </div>
      {/* Mobile drill-down */}
      <div className="lg:hidden">
        {!mobileDetail ? (
          <div className="card" style={{ padding: 16 }}>{listPanel}</div>
        ) : (
          <div className="card" style={{ padding: 16 }}>
            <button onClick={() => setMobileDetail(false)}
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 14,
                color: 'var(--color-primary)', background: 'none', border: 'none',
                cursor: 'pointer', marginBottom: 16, padding: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              {t('nav.back')}
            </button>
            {detailPanel}
          </div>
        )}
      </div>
    </div>
  )
}
