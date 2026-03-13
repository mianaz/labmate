import { useState, useEffect, useRef, useMemo, useCallback, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useProtocols, toggleFavorite } from '@/hooks/useProtocols'
import { REFERENCES, REF_NOTES_EN, RECIPE_REFS } from '@/data/references'
import type { Protocol, StepItem } from '@/lib/db'
import db from '@/lib/db'
import RecipeForm from '@/features/shared/RecipeForm'
import { addRecent } from '@/lib/recentlyViewed'

// -- Helpers ------------------------------------------------------------------

function bold(text: string): React.ReactNode {
  const p = text.split(/\*\*(.+?)\*\*/g)
  return p.length === 1 ? text : p.map((s, i) => (i % 2 ? <strong key={i}>{s}</strong> : s))
}

const bi = (lang: string, obj: { en: string; zh: string }) => (lang === 'zh' ? obj.zh : obj.en)

// Get references for a recipe
function getReferences(externalId: string) {
  const refIds = RECIPE_REFS[externalId]
  if (!refIds?.length) return []
  return refIds.map(id => REFERENCES.find(r => r.id === id)).filter(Boolean)
}

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

// -- Timer helpers ------------------------------------------------------------

/** Parse time from step text, e.g. "incubate 5 min", "wash 30 seconds", "1 hour" */
function parseTime(text: string): number | null {
  // Match patterns like: 5 min, 30 seconds, 1 hour, 10 s, 2 h, 15min
  const m = text.match(/(\d+(?:\.\d+)?)\s*(?:min(?:ute)?s?|分钟)/i)
  if (m) return Math.round(parseFloat(m[1]) * 60)
  const s = text.match(/(\d+(?:\.\d+)?)\s*(?:sec(?:ond)?s?|秒)/i)
  if (s) return Math.round(parseFloat(s[1]))
  const h = text.match(/(\d+(?:\.\d+)?)\s*(?:h(?:our)?s?|小时)/i)
  if (h) return Math.round(parseFloat(h[1]) * 3600)
  return null
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

function useTimer() {
  const [remaining, setRemaining] = useState<number | null>(null)
  const [running, setRunning] = useState(false)
  const [total, setTotal] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback((seconds: number) => {
    setTotal(seconds)
    setRemaining(seconds)
    setRunning(true)
  }, [])

  const pause = useCallback(() => setRunning(false), [])
  const resume = useCallback(() => setRunning(true), [])
  const reset = useCallback(() => {
    setRunning(false)
    setRemaining(null)
    setTotal(0)
  }, [])

  useEffect(() => {
    if (running && remaining !== null && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r === null || r <= 1) {
            setRunning(false)
            return 0
          }
          return r - 1
        })
      }, 1000)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, remaining])

  return { remaining, running, total, start, pause, resume, reset }
}

// -- Progress persistence ---------------------------------------------------

const PROGRESS_KEY = 'labmate_step_progress'

function getProgress(protocolId: string): Set<number> {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}')
    return new Set(all[protocolId] ?? [])
  } catch { return new Set() }
}

function saveProgress(protocolId: string, steps: Set<number>) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}')
    all[protocolId] = [...steps]
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

function clearProgress(protocolId: string) {
  try {
    const all = JSON.parse(localStorage.getItem(PROGRESS_KEY) ?? '{}')
    delete all[protocolId]
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(all))
  } catch { /* ignore */ }
}

// -- StepList with progress + timers -----------------------------------------

function StepList({ steps, lang, protocolId, t }: {
  steps: StepItem[]; lang: string; protocolId: string; t: (k: string, opts?: Record<string, unknown>) => string
}) {
  const [completed, setCompleted] = useState<Set<number>>(() => getProgress(protocolId))
  const timer = useTimer()
  const [timerStepIdx, setTimerStepIdx] = useState<number | null>(null)

  // Reset completed when protocol changes
  useEffect(() => {
    setCompleted(getProgress(protocolId))
    timer.reset()
    setTimerStepIdx(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [protocolId])

  function toggleStep(idx: number) {
    const next = new Set(completed)
    if (next.has(idx)) next.delete(idx)
    else next.add(idx)
    setCompleted(next)
    saveProgress(protocolId, next)
  }

  function handleReset() {
    setCompleted(new Set())
    clearProgress(protocolId)
  }

  function handleStartTimer(idx: number, seconds: number) {
    setTimerStepIdx(idx)
    timer.start(seconds)
  }

  const stepCount = steps.filter(s => !s.isHeader).length
  const doneCount = completed.size

  return (
    <div style={{ ...S.col, gap: 6 }}>
      {/* Progress bar */}
      {stepCount > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div style={{
            flex: 1, height: 4, borderRadius: 2, background: 'var(--color-border)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', borderRadius: 2, background: 'var(--color-primary)',
              width: `${stepCount ? (doneCount / stepCount) * 100 : 0}%`,
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{ fontSize: '0.75rem', ...S.mono, ...S.muted, flexShrink: 0 }}>
            {t('protocol.stepOf', { current: doneCount, total: stepCount })}
          </span>
          {doneCount > 0 && (
            <button onClick={handleReset} style={{
              fontSize: '0.7rem', padding: '2px 8px', borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--color-border)', background: 'var(--color-bg-card)',
              color: 'var(--color-text-muted)', cursor: 'pointer',
            }}>
              {t('protocol.resetProgress')}
            </button>
          )}
        </div>
      )}

      {/* Timer display */}
      {timer.remaining !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px',
          borderRadius: 'var(--radius-sm)', marginBottom: 8,
          background: timer.remaining === 0 ? 'var(--color-success)' : 'var(--color-bg)',
          border: '1px solid',
          borderColor: timer.remaining === 0 ? 'var(--color-success)' : 'var(--color-border)',
        }}>
          <span style={{
            ...S.mono, fontSize: '1.4rem', fontWeight: 700,
            color: timer.remaining === 0 ? '#fff' : 'var(--color-text)',
          }}>
            {timer.remaining === 0 ? t('protocol.timerDone') : formatTimer(timer.remaining)}
          </span>
          <div style={{ flex: 1 }} />
          {timer.remaining > 0 && (
            <button onClick={timer.running ? timer.pause : timer.resume} style={{
              padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
              background: 'var(--color-bg-card)', color: 'var(--color-text-secondary)',
            }}>
              {timer.running ? t('protocol.timerPause') : t('protocol.timerResume')}
            </button>
          )}
          <button onClick={() => { timer.reset(); setTimerStepIdx(null) }} style={{
            padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
            background: 'var(--color-bg-card)', color: 'var(--color-text-muted)',
          }}>
            {t('protocol.timerReset')}
          </button>
        </div>
      )}

      {/* Steps */}
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

          const isDone = completed.has(i)
          const seconds = parseTime(step.en) ?? parseTime(step.zh)
          const isTimerActive = timerStepIdx === i

          return (
            <li key={i} style={{
              display: 'flex', gap: '8px', fontSize: '0.85rem', lineHeight: 1.55,
              opacity: isDone ? 0.5 : 1, transition: 'opacity 0.2s',
            }}>
              {/* Checkbox */}
              <button onClick={() => toggleStep(i)} style={{
                width: 18, height: 18, borderRadius: 4, flexShrink: 0, marginTop: 2,
                border: `2px solid ${isDone ? 'var(--color-primary)' : 'var(--color-border)'}`,
                background: isDone ? 'var(--color-primary)' : 'transparent',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 0,
              }}>
                {isDone && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                    stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </button>
              <span style={{
                flex: 1, textDecoration: isDone ? 'line-through' : 'none',
                color: isDone ? 'var(--color-text-muted)' : 'var(--color-text-secondary)',
              }}>
                {bold(text)}
              </span>
              {/* Timer button for timed steps */}
              {seconds != null && !isTimerActive && (
                <button
                  onClick={() => handleStartTimer(i, seconds)}
                  title={formatTimer(seconds)}
                  style={{
                    flexShrink: 0, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                    border: '1px solid var(--color-border)',
                    background: 'var(--color-bg)', color: 'var(--color-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {formatTimer(seconds)}
                </button>
              )}
              {isTimerActive && timer.running && (
                <span style={{
                  flexShrink: 0, padding: '2px 8px', fontSize: 11, fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--color-primary)', color: '#fff',
                  fontFamily: 'var(--font-mono)',
                }}>
                  {formatTimer(timer.remaining ?? 0)}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

// -- ProtocolDetail -----------------------------------------------------------

function ProtocolDetail({
  protocol, lang, t, onNavigateToBuffer,
}: {
  protocol: Protocol; lang: string; t: (k: string, opts?: Record<string, unknown>) => string
  onNavigateToBuffer?: (bufferId: string) => void
}) {
  const [detailed, setDetailed] = useState(false)
  const steps = detailed ? protocol.detailedSteps : protocol.briefSteps
  const label = lang === 'zh' ? protocol.nameZh : protocol.name
  const refs = getReferences(protocol.externalId)

  return (
    <div style={{ ...S.col, gap: '16px' }}>
      {/* Name + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <h2 style={{ ...S.heading, fontSize: '1.25rem', margin: 0, letterSpacing: '-0.02em' }}>{label}</h2>
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
                  <button
                    className="crosslink-pill"
                    onClick={() => onNavigateToBuffer?.(m.linkedRecipe!)}
                    title={t('protocol.viewRecipe')}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                      <polyline points="15 3 21 3 21 9" />
                      <line x1="10" y1="14" x2="21" y2="3" />
                    </svg>
                    {m.name}
                  </button>
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

      {/* Recipe components table — only for buffer/staining/media, not protocols */}
      {protocol.category !== 'protocol' && protocol.components.length > 0 && (
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
          <StepList steps={steps} lang={lang} protocolId={protocol.externalId} t={t} />
        </section>
      )}

      {/* References — inline */}
      {refs.length > 0 && (
        <section>
          <h3 style={{ ...S.heading, fontSize: '0.95rem', margin: '0 0 8px' }}>
            {t('protocol.references')}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {refs.map(ref => ref && (
              <div key={ref.id} className="ref-card">
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>{ref.text}</p>
                <p style={{ margin: '4px 0 0', fontSize: '0.75rem' }}>
                  <span style={{ fontStyle: 'italic', color: 'var(--color-primary)' }}>{ref.journal}</span>
                  {ref.vol && <span style={{ color: 'var(--color-text-muted)' }}> {ref.vol}</span>}
                  {ref.pages && <span style={{ color: 'var(--color-text-muted)' }}>, {ref.pages}</span>}
                </p>
                {ref.doi && (
                  <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--color-primary)', textDecoration: 'none', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>
                    DOI: {ref.doi}
                  </a>
                )}
                <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                  {lang === 'en' ? (REF_NOTES_EN[ref.id] ?? ref.note) : ref.note}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

// -- Props & Main component ---------------------------------------------------

interface ProtocolsTabProps {
  initialSelectedId?: string | null
  onNavigate?: (tab: 'buffers' | 'protocols' | 'calc' | 'plate' | 'inventory' | 'tools', id?: string) => void
}

export default function ProtocolsTab({ initialSelectedId, onNavigate }: ProtocolsTabProps) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as 'en' | 'zh'
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(initialSelectedId ?? null)
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

  function handleNavigateToBuffer(bufferId: string) {
    onNavigate?.('buffers', bufferId)
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
            overflowY: 'auto',
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
                  onClick={() => { setSelectedId(active ? null : proto.externalId); if (!active) addRecent(proto.externalId) }}
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
            <ProtocolDetail
              protocol={selected}
              lang={lang}
              t={t}
              onNavigateToBuffer={handleNavigateToBuffer}
            />

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
