import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { catColors } from '@/data/recipes'
import { REFERENCES, REF_NOTES_EN } from '@/data/references'
import {
  calcGel, gelToText, downloadFile,
  RESOLVING_PERC_OPTIONS, MW_GUIDE,
  type GelRow,
} from './gelCalc'

const GEL_REFS = [1, 6, 10] // Laemmli, Gallagher, Bio-Rad
const RELATED_BUFFERS = ['laemmli_2x', 'running_buffer', 'transfer_buffer']

type Tab = 'buffers' | 'protocols' | 'calc' | 'plate' | 'inventory' | 'tools'

interface GelRecipeDetailProps {
  lang: 'en' | 'zh'
  onNavigate?: (tab: Tab, id?: string) => void
}

export default function GelRecipeDetail({ lang, onNavigate }: GelRecipeDetailProps) {
  const { t } = useTranslation()
  const [resPerc, setResPerc] = useState(10)
  const [resVol, setResVol] = useState(10)
  const [stackPerc, setStackPerc] = useState(4)
  const [stackVol, setStackVol] = useState(5)
  const [numGels, setNumGels] = useState(2)

  const resGel = calcGel(resPerc, resVol * numGels, 'resolving')
  const stackGel = calcGel(stackPerc, stackVol * numGels, 'stacking')

  const refs = GEL_REFS.map(id => REFERENCES.find(r => r.id === id)).filter(Boolean)

  function handleDownload() {
    let txt = 'SDS-PAGE Gel Recipe\n' + '\u2550'.repeat(50) + '\n'
    txt += `Gels: ${numGels}\n\n`
    txt += gelToText(`Resolving Gel (${resPerc}%, ${resVol * numGels} mL)`, resGel)
    txt += '\n'
    txt += gelToText(`Stacking Gel (${stackPerc}%, ${stackVol * numGels} mL)`, stackGel)
    txt += '\nRef: Laemmli (1970) Nature 227:680; Bio-Rad Mini-PROTEAN Manual\n'
    downloadFile(`SDS-PAGE_${resPerc}pct_x${numGels}.txt`, txt)
  }

  const inputStyle: React.CSSProperties = {
    padding: '4px 8px', fontSize: 14, fontFamily: 'var(--font-mono)',
    borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
    background: 'var(--color-bg-card)', color: 'var(--color-text)', textAlign: 'right',
    width: '100%',
  }

  const cc = catColors.buffer

  return (
    <div>
      {/* Header — matches recipe detail header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 700,
            color: 'var(--color-text)', margin: 0, letterSpacing: '-0.02em',
          }}>
            {t('gel.title')}
          </h2>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '2px 10px',
            borderRadius: 'var(--radius-sm)',
            background: cc?.bg ?? 'var(--color-border)',
            color: cc?.text ?? 'var(--color-text)',
          }}>
            Buffers
          </span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', margin: '4px 0 0' }}>
          {t('gel.subtitle')}
        </p>
      </div>

      {/* Controls — styled like volume scaler bar */}
      <div style={{
        marginBottom: 16, padding: '12px 14px', borderRadius: 'var(--radius-sm)',
        background: 'var(--color-bg)', border: '1px solid var(--color-border)',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('gel.resolvingPct')}
            </label>
            <select value={resPerc} onChange={e => setResPerc(+e.target.value)} style={inputStyle}>
              {RESOLVING_PERC_OPTIONS.map(p => <option key={p} value={p}>{p}%</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('gel.resolvingVol')}
            </label>
            <input type="number" value={resVol} min={1} step={0.5} onChange={e => setResVol(+e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('gel.stackingPct')}
            </label>
            <select value={stackPerc} onChange={e => setStackPerc(+e.target.value)} style={inputStyle}>
              <option value={4}>4%</option>
              <option value={5}>5%</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('gel.stackingVol')}
            </label>
            <input type="number" value={stackVol} min={1} step={0.5} onChange={e => setStackVol(+e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: 'var(--color-text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {t('gel.count')}
            </label>
            <input type="number" value={numGels} min={1} max={20} onChange={e => setNumGels(Math.max(1, +e.target.value))} style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Resolving gel table — matches recipe component table */}
      <GelComponentTable
        title={`${t('gel.resolving')} (${resPerc}%, ${resVol * numGels} mL)`}
        data={resGel}
        highlightColor="var(--color-primary)"
      />

      {/* Stacking gel table */}
      <GelComponentTable
        title={`${t('gel.stacking')} (${stackPerc}%, ${stackVol * numGels} mL)`}
        data={stackGel}
        highlightColor="var(--color-accent)"
      />

      {/* Download */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button onClick={handleDownload} style={{
          fontSize: 13, padding: '6px 16px', borderRadius: 'var(--radius-sm)',
          background: 'var(--color-primary)', color: 'var(--color-text-inverse)',
          border: 'none', cursor: 'pointer', fontWeight: 600,
        }}>
          {t('gel.download')}
        </button>
      </div>

      {/* MW guide */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
          {t('gel.mwRange')}
        </h3>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('gel.concentration')}
                </th>
                <th style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  {t('gel.bestRange')}
                </th>
              </tr>
            </thead>
            <tbody>
              {MW_GUIDE.map(g => (
                <tr key={g.perc} style={{
                  borderBottom: '1px solid var(--color-border)',
                  background: g.perc === resPerc + '%' ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent',
                }}>
                  <td style={{ padding: '6px 10px', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--color-text)' }}>{g.perc}</td>
                  <td style={{ padding: '6px 10px', color: 'var(--color-text-muted)' }}>{g.range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, marginTop: 6, fontStyle: 'italic', color: 'var(--color-text-muted)' }}>
          Ref: Gallagher (2012) Curr Protoc Mol Biol
        </p>
      </div>

      {/* Safety tips — styled like instructions section */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
          {t('gel.safetyTitle')}
        </h3>
        <ul style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--color-text-secondary)', listStyle: 'none', padding: 0, margin: 0 }}>
          <li>&#8226; <strong style={{ color: 'var(--color-text)' }}>30% Acrylamide</strong> — <span style={{ color: 'var(--color-error)', fontWeight: 600 }}>{t('gel.safety1')}</span></li>
          <li>&#8226; <strong style={{ color: 'var(--color-text)' }}>APS</strong> — {t('gel.safety2')}</li>
          <li>&#8226; <strong style={{ color: 'var(--color-text)' }}>TEMED</strong> — {t('gel.safety3')}</li>
          <li>&#8226; {t('gel.safety4')}</li>
          <li>&#8226; {t('gel.safety5')}</li>
          <li>&#8226; Mini-gel: resolving ~5–8 mL, stacking ~2–3 mL; RT polymerization ~30–45 min</li>
        </ul>
      </div>

      {/* Related buffers — crosslinks */}
      <div style={{ marginBottom: 20 }}>
        <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
          {t('buffer.usedInProtocols')}
        </h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {RELATED_BUFFERS.map(id => {
            const label = id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
            return (
              <button key={id} className="crosslink-pill" onClick={() => onNavigate?.('buffers', id)}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                  <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                {label}
              </button>
            )
          })}
          <button className="crosslink-pill" onClick={() => onNavigate?.('protocols', 'wb_protocol')}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
              <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Western Blot
          </button>
        </div>
      </div>

      {/* References — inline, matching recipe refs style */}
      {refs.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 8 }}>
            {t('buffer.references')}
          </h3>
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
    </div>
  )
}

// ── Component table matching recipe table format ──

function GelComponentTable({ title, data, highlightColor }: { title: string; data: GelRow[]; highlightColor: string }) {
  return (
    <div style={{ overflowX: 'auto', marginBottom: 20 }}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 14, fontWeight: 700, color: highlightColor, marginBottom: 8 }}>
        {title}
      </h3>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
            {['Reagent', 'Amount', 'Unit'].map(h => (
              <th key={h} style={{
                textAlign: h === 'Reagent' ? 'left' : 'right', padding: '8px 10px',
                fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)',
                textTransform: 'uppercase', letterSpacing: '0.04em',
              }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px 10px', color: 'var(--color-text)' }}>{row.name}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600, color: highlightColor }}>
                {row.unit === '\u00B5L' ? row.vol.toFixed(1) : row.vol.toFixed(3)}
              </td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>
                {row.unit}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: `2px solid ${highlightColor}` }}>
            <td style={{ padding: '8px 10px', fontWeight: 700, color: 'var(--color-text)' }}>Total</td>
            <td style={{ padding: '8px 10px', textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: highlightColor }}>
              {data.reduce((s, r) => s + (r.unit === '\u00B5L' ? r.vol / 1000 : r.vol), 0).toFixed(2)}
            </td>
            <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--color-text-secondary)' }}>mL</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
