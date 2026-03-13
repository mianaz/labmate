import { useState, useMemo, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useProtocols, toggleFavorite } from '@/hooks/useProtocols'
import type { Protocol, StepItem } from '@/lib/db'
import db from '@/lib/db'
import RecipeForm from '@/features/shared/RecipeForm'

// -- Helpers ------------------------------------------------------------------

function bold(text: string): React.ReactNode {
  const p = text.split(/\*\*(.+?)\*\*/g)
  return p.length === 1 ? text : p.map((s, i) => (i % 2 ? <strong key={i}>{s}</strong> : s))
}

const bi = (lang: string, obj: { en: string; zh: string }) => (lang === 'zh' ? obj.zh : obj.en)

// -- Shared style fragments ---------------------------------------------------

const S = {
  heading: { fontFamily: 'var(--font-heading)', fontWeight: 700, color: 'var(--color-text)' } as CSSProperties,
  col: { display: 'flex', flexDirection: 'column' } as CSSProperties,
  mono: { fontFamily: 'var(--font-mono)' } as CSSProperties,
  sec: { color: 'var(--color-text-secondary)' } as CSSProperties,
  muted: { color: 'var(--color-text-muted)' } as CSSProperties,
  pill: {
    padding: '4px 12px', borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
  } as CSSProperties,
}
const on = (v: boolean): CSSProperties => ({
  background: v ? 'var(--color-primary)' : 'var(--color-bg-card)',
  color: v ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
})

// -- StepList -----------------------------------------------------------------

function StepList({ steps, lang }: { steps: StepItem[]; lang: string }) {
  return (
    <ol style={{ ...S.col, listStyle: 'none', padding: 0, margin: 0, gap: '6px' }}>
      {steps.map((step, i) => {
        const text = bi(lang, step)
        if (step.isHeader) {
          return (
            <li key={i} style={{ ...S.heading, fontSize: '0.95rem', marginTop: i ? '12px' : 0 }}>
              {bold(text)}
            </li>
          )
        }
        return (
          <li key={i} style={{ display: 'flex', gap: '8px', fontSize: '0.85rem', lineHeight: 1.55, ...S.sec }}>
            <span style={{ ...S.mono, ...S.muted, flexShrink: 0, minWidth: 22, textAlign: 'right' }}>
              {i + 1}.
            </span>
            <span>{bold(text)}</span>
          </li>
        )
      })}
    </ol>
  )
}

// -- ProtocolDetail -----------------------------------------------------------

function ProtocolDetail({
  protocol, lang, t,
}: {
  protocol: Protocol; lang: string; t: (k: string) => string
}) {
  const [detailed, setDetailed] = useState(false)
  const steps = detailed ? protocol.detailedSteps : protocol.briefSteps
  const label = lang === 'zh' ? protocol.nameZh : protocol.name

  return (
    <div style={{ ...S.col, gap: '16px' }}>
      {/* Name + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ ...S.heading, fontSize: '1.25rem', margin: 0 }}>{label}</h2>
        {protocol.source === 'custom' && (
          <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px',
            borderRadius: 'var(--radius-sm)', background: 'var(--color-accent-light)', color: '#fff' }}>
            {t('db.custom')}
          </span>
        )}
        {protocol.id && (
          <button onClick={() => toggleFavorite(protocol.id!)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18,
              color: protocol.isFavorite ? 'var(--color-warning)' : 'var(--color-text-muted)' }}>
            {protocol.isFavorite ? '\u2605' : '\u2606'}
          </button>
        )}
      </div>

      {/* Usage */}
      {protocol.usage && (
        <p style={{ fontSize: '0.875rem', lineHeight: 1.6, ...S.sec, margin: 0 }}>
          {bi(lang, protocol.usage)}
        </p>
      )}

      {/* Storage */}
      {protocol.storage && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.8rem',
          ...S.muted, padding: '4px 10px', borderRadius: 'var(--radius-sm)',
          background: 'var(--color-bg)', alignSelf: 'flex-start',
        }}>
          {protocol.storage.icon && <span>{protocol.storage.icon}</span>}
          <span>{bi(lang, protocol.storage.label)}</span>
          {protocol.storage.temp !== 'N/A' && (
            <span style={S.mono}>{protocol.storage.temp}</span>
          )}
        </div>
      )}

      {/* Materials */}
      {protocol.materials && protocol.materials.length > 0 && (
        <section>
          <h3 style={{ ...S.heading, fontSize: '0.95rem', margin: '0 0 8px' }}>
            {t('protocol.materials')}
          </h3>
          <ul style={{ ...S.col, listStyle: 'none', padding: 0, margin: 0, gap: '4px' }}>
            {protocol.materials.map((m, i) => (
              <li key={i} style={{ fontSize: '0.85rem', display: 'flex', alignItems: 'baseline', gap: 6 }}>
                {m.linkedRecipe ? (
                  <span style={{ fontWeight: 700, color: 'var(--color-primary)', cursor: 'default' }}>{m.name}</span>
                ) : (
                  <span style={{ color: 'var(--color-text)' }}>{m.name}</span>
                )}
                {m.note && (
                  <span style={{ fontSize: '0.75rem', ...S.muted }}>
                    — {bi(lang, m.note)}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Recipe components table */}
      {protocol.components.length > 0 && (
        <section>
          <h3 style={{ ...S.heading, fontSize: '0.95rem', margin: '0 0 8px' }}>
            {lang === 'zh' ? 'Recipe 组分' : 'Recipe Components'}
          </h3>
          <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg)', ...S.sec, textAlign: 'left' }}>
                  <th style={{ padding: '6px 10px', fontWeight: 600 }}>{lang === 'zh' ? '组分' : 'Component'}</th>
                  <th style={{ padding: '6px 10px', fontWeight: 600, ...S.mono }}>{lang === 'zh' ? '用量' : 'Amount'}</th>
                  <th style={{ padding: '6px 10px', fontWeight: 600 }}>{lang === 'zh' ? '备注' : 'Note'}</th>
                </tr>
              </thead>
              <tbody>
                {protocol.components.map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '5px 10px', color: 'var(--color-text)' }}>{c.name}</td>
                    <td style={{ padding: '5px 10px', ...S.mono, ...S.sec }}>
                      {c.amount != null ? `${c.amount} ${c.unit}` : c.unit}
                    </td>
                    <td style={{ padding: '5px 10px', ...S.muted }}>{c.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Steps toggle + list */}
      {steps && steps.length > 0 && (
        <section>
          <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            <button onClick={() => setDetailed(false)} style={{ ...S.pill, ...on(!detailed) }}>
              {t('protocol.brief')}
            </button>
            <button onClick={() => setDetailed(true)} style={{ ...S.pill, ...on(detailed) }}>
              {t('protocol.detailed')}
            </button>
          </div>
          <StepList steps={steps} lang={lang} />
        </section>
      )}

      {/* Reference */}
      {protocol.reference && (
        <p style={{ fontSize: '0.75rem', ...S.muted, fontStyle: 'italic', marginTop: 8 }}>
          Ref: {protocol.reference}
        </p>
      )}
    </div>
  )
}

// -- Main component -----------------------------------------------------------

export default function ProtocolsTab() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'en' | 'zh'
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editingProtocol, setEditingProtocol] = useState<Protocol | null>(null)

  const allProtocols = useProtocols('protocol')
  const protocols = useMemo(() => allProtocols ?? [], [allProtocols])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return protocols.filter(p => {
      const n = (lang === 'zh' ? p.nameZh : p.name).toLowerCase()
      return n.includes(q) || p.name.toLowerCase().includes(q)
        || p.tags.some(tag => tag.toLowerCase().includes(q))
    })
  }, [protocols, search, lang])

  const selected = protocols.find(p => p.externalId === selectedId) ?? null

  async function handleDelete(proto: Protocol) {
    if (proto.id) {
      await db.protocols.delete(proto.id)
      setSelectedId(null)
      setEditingProtocol(null)
    }
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
          defaultCategory="protocol"
          existing={editingProtocol ?? undefined}
          onSave={() => { setShowForm(false); setEditingProtocol(null) }}
          onCancel={() => { setShowForm(false); setEditingProtocol(null) }}
        />
      </div>
    )
  }

  return (
    <div className="fade-in" style={{ ...S.col, gap: '16px' }}>
      <div
        style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}
        className="md:!grid-cols-[300px_1fr]"
      >
        {/* Left panel */}
        <div
          className="card"
          style={{
            ...S.col, padding: 12, gap: 8,
            maxHeight: selectedId ? '40vh' : 'none', overflowY: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ ...S.heading, fontSize: '1rem', margin: 0 }}>{t('nav.protocols')}</h2>
            <button
              onClick={() => setShowForm(true)}
              title={t('db.addCustom')}
              style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)', background: 'var(--color-bg-card)',
                color: 'var(--color-primary)', cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
            >
              +
            </button>
          </div>

          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search protocols..."
            style={{
              width: '100%', padding: '6px 10px', fontSize: '0.85rem',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
              background: 'var(--color-bg)', color: 'var(--color-text)',
              outline: 'none', boxSizing: 'border-box',
            }}
          />

          <div style={{ ...S.col, gap: 2, overflowY: 'auto', flex: 1 }}>
            {filtered.map(proto => {
              const name = lang === 'zh' ? proto.nameZh : proto.name
              const active = selectedId === proto.externalId
              return (
                <button
                  key={proto.externalId}
                  onClick={() => setSelectedId(active ? null : proto.externalId)}
                  style={{
                    textAlign: 'left', padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                    border: 'none', cursor: 'pointer', fontSize: '0.85rem',
                    fontWeight: active ? 600 : 400, transition: 'background 0.15s',
                    background: active ? 'var(--color-primary)' : 'transparent',
                    color: active ? 'var(--color-text-inverse)' : 'var(--color-text)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ flex: 1 }}>{name}</span>
                  {proto.source === 'custom' && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 'var(--radius-sm)',
                      background: active ? 'rgba(255,255,255,0.2)' : 'var(--color-accent-light)',
                      color: '#fff', fontWeight: 600, flexShrink: 0 }}>
                      {t('db.custom')}
                    </span>
                  )}
                  {proto.isFavorite && (
                    <span style={{ color: active ? '#fff' : 'var(--color-warning)', fontSize: 12, flexShrink: 0 }}>&#9733;</span>
                  )}
                </button>
              )
            })}
            {filtered.length === 0 && (
              <p style={{ fontSize: '0.8rem', ...S.muted, padding: 8, margin: 0 }}>
                No matching protocols
              </p>
            )}
          </div>
        </div>

        {/* Right panel */}
        {selected ? (
          <div className="card" style={{ padding: 20, overflowY: 'auto' }}>
            <ProtocolDetail protocol={selected} lang={lang} t={t} />

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
          <div
            className="card"
            style={{
              padding: '40px 20px', display: 'flex', alignItems: 'center',
              justifyContent: 'center', ...S.muted, fontSize: '0.9rem', minHeight: 200,
            }}
          >
            Select a protocol from the list
          </div>
        )}
      </div>
    </div>
  )
}
