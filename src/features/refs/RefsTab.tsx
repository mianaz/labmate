import { useTranslation } from 'react-i18next'
import { REFERENCES, REF_NOTES_EN } from '@/data/references'

export default function RefsTab() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  return (
    <div className="fade-in">
      {/* Header card */}
      <div className="card p-6 mb-6">
        <h2 className="text-xl font-bold mb-1">{t('refs.title')}</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          {t('refs.subtitle')}
        </p>
      </div>

      {/* Reference list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {REFERENCES.map((ref) => (
          <div key={ref.id} className="card" style={{ padding: 16, display: 'flex', gap: 14 }}>
            {/* Numbered badge */}
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, fontFamily: 'var(--font-mono)',
              background: 'hsl(168, 55%, 92%)', color: 'var(--color-primary)',
            }}>
              {ref.id}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Citation text */}
              <p style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--color-text-secondary)', margin: 0 }}>
                {ref.text}
              </p>

              {/* Journal / volume / pages */}
              <p style={{ fontSize: '0.75rem', marginTop: 4, marginBottom: 0 }}>
                <span style={{ fontStyle: 'italic', color: 'var(--color-primary)' }}>
                  {ref.journal}
                </span>
                {ref.vol && (
                  <span style={{ color: 'var(--color-text-muted)' }}> {ref.vol}</span>
                )}
                {ref.pages && (
                  <span style={{ color: 'var(--color-text-muted)' }}>, pp. {ref.pages}</span>
                )}
              </p>

              {/* DOI link */}
              {ref.doi && (
                <a
                  href={`https://doi.org/${ref.doi}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-block', marginTop: 2,
                    color: 'var(--color-primary)', textDecoration: 'none',
                    fontFamily: 'var(--font-mono)', fontSize: '0.7rem',
                  }}
                >
                  DOI: {ref.doi}
                </a>
              )}

              {/* Contextual note */}
              <p style={{
                fontSize: '0.72rem', marginTop: 6, marginBottom: 0,
                padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                background: 'var(--color-bg)', color: 'var(--color-text-muted)',
                display: 'inline-block',
              }}>
                {lang === 'en' ? (REF_NOTES_EN[ref.id] ?? ref.note) : ref.note}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Usage notes callout */}
      <div className="card" style={{
        padding: 20, marginTop: 24,
        borderLeft: '3px solid var(--color-warning)',
      }}>
        <h3 style={{
          fontSize: '0.85rem', fontWeight: 700, marginBottom: 8,
          fontFamily: 'var(--font-heading)', color: 'var(--color-text)',
        }}>
          {t('refs.usageGuide')}
        </h3>
        <ul style={{
          listStyle: 'none', padding: 0, margin: 0,
          display: 'flex', flexDirection: 'column', gap: 6,
          fontSize: '0.8rem', color: 'var(--color-text-secondary)',
        }}>
          <li>&#8226; {t('refs.usage1')}</li>
          <li>&#8226; {t('refs.usage2')}</li>
          <li>&#8226; {t('refs.usage3')}</li>
          <li>&#8226; {t('refs.usage4')}</li>
          <li>&#8226; {t('refs.usage5')}</li>
          <li>&#8226; {t('refs.usage6')}</li>
        </ul>
      </div>
    </div>
  )
}
