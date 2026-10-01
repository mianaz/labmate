// RefsTab — Guide / usage documentation tab with data export/import and literature references
import { useState, useEffect, useRef } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { REF_NOTES_EN, REFERENCES } from '../../data/references.js';
import { S_MUTED } from '../../lib/styleConstants.js';
import { safeText } from '../../lib/utils.js';
import { exportBackup, importBackup } from '../../lib/backup.js';
import { useBackupStatus, describeLastBackup } from '../../hooks/useBackupStatus.js';
import PageHeader from '../../components/PageHeader.jsx';
import { IconDownload, IconUpload, IconShield, IconChevronDown, IconReset, IconArrowUpRight, IconBook } from '../../components/icons.jsx';
import { useToast } from '../../components/Toast.jsx';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// ═══════════════════════════════════════════════
// GUIDE SECTIONS CONFIG
// ═══════════════════════════════════════════════

const GUIDE_SECTIONS = [
  { titleKey: 'guideBuffersTitle', bodyKey: 'guideBuffersBody' },
  { titleKey: 'guideProtocolsTitle', bodyKey: 'guideProtocolsBody' },
  { titleKey: 'guideCalcTitle', bodyKey: 'guideCalcBody' },
  { titleKey: 'guideGelTitle', bodyKey: 'guideGelBody' },
  { titleKey: 'guidePlateTitle', bodyKey: 'guidePlateBody' },
  { titleKey: 'guideInventoryTitle', bodyKey: 'guideInventoryBody' },
  { titleKey: 'guideEvidenceTitle', bodyKey: 'guideEvidenceBody' },
  { titleKey: 'guideNotebookTitle', bodyKey: 'guideNotebookBody' },
  { titleKey: 'guideCalendarTitle', bodyKey: 'guideCalendarBody' },
  { titleKey: 'guideToolsTitle', bodyKey: 'guideToolsBody' },
  { titleKey: 'guideAgentTitle', bodyKey: 'guideAgentBody' },
  { titleKey: 'guideShortcutsTitle', bodyKey: 'guideShortcutsBody' },
  { titleKey: 'guideCustomTitle', bodyKey: 'guideCustomBody' },
  { titleKey: 'guideDataSafetyTitle', bodyKey: 'guideDataSafetyBody' },
];

// Square icon tile — same language as the Links monograms.
function Tile({ children }) {
  return (
    <span aria-hidden="true" className="flex items-center justify-center flex-shrink-0"
      style={{ width: 32, height: 32, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--accent)' }}>
      {children}
    </span>
  );
}

function RefsTab({ onReplayTour }) {
  const lang = useLang();
  const toast = useToast();
  const [refsOpen, setRefsOpen] = useState(false);
  const [persisted, setPersisted] = useState(null);
  const fileInputRef = useRef(null);
  const { lastExport } = useBackupStatus();

  useEffect(() => {
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(setPersisted).catch(() => {});
    }
  }, []);

  // ═══════════════════════════════════════════════
  // DATA EXPORT / IMPORT
  // ═══════════════════════════════════════════════

  function handleExport() {
    exportBackup().catch(() => {});
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const count = await importBackup(ev.target.result);
        toast.show(t('importSuccess', lang).replace('{n}', count));
        setTimeout(() => window.location.reload(), 500);
      } catch {
        toast.show(t('importError', lang));
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  const backupStale = !lastExport || Date.now() - lastExport > WEEK_MS;
  const oddCount = GUIDE_SECTIONS.length % 2 === 1;

  return (
    <div className="fade-in">
      <PageHeader tab="refs" title={t('refsTitle', lang)} description={t('guideIntro', lang)}
        actions={onReplayTour && (
          <button type="button" onClick={onReplayTour} className="btn">
            <IconReset size={15} />{t('replayTour', lang)}
          </button>
        )} />

      {/* Data backup / restore */}
      <section className="panel" aria-labelledby="guide-data-title" style={{ marginBottom: '1.25rem' }}>
        <div className="panel-head flex-wrap">
          <h2 id="guide-data-title" className="panel-title">{lang === 'zh' ? '备份与恢复' : 'Backup & restore'}</h2>
          <span className="mono text-[11px]" style={{ color: backupStale ? 'var(--warning-text)' : 'var(--text-muted)' }}>
            {t('backupLast', lang)}: {describeLastBackup(lastExport, t, lang)}
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2">
          <div className="flex flex-col gap-4 p-4 md:p-5">
            <div className="flex items-start gap-3">
              <Tile><IconDownload size={16} /></Tile>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{t('exportTitle', lang)}</h3>
                <p className="text-[13px] mt-1" style={{ ...S_MUTED, lineHeight: 1.55 }}>{t('exportDesc', lang)}</p>
              </div>
            </div>
            <div className="mt-auto" style={{ paddingLeft: 44 }}>
              <button type="button" onClick={handleExport} className="btn-primary">
                <IconDownload size={15} />{t('exportBtn', lang)}
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-4 p-4 md:p-5 border-t md:border-t-0 md:border-l border-[var(--rule)]">
            <div className="flex items-start gap-3">
              <Tile><IconUpload size={16} /></Tile>
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">{t('importTitle', lang)}</h3>
                <p className="text-[13px] mt-1" style={{ ...S_MUTED, lineHeight: 1.55 }}>{t('importDesc', lang)}</p>
              </div>
            </div>
            <div className="mt-auto" style={{ paddingLeft: 44 }}>
              <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: 'none' }} />
              <button type="button" onClick={() => fileInputRef.current && fileInputRef.current.click()} className="btn">
                <IconUpload size={15} />{t('importBtn', lang)}
              </button>
            </div>
          </div>
        </div>
        {persisted !== null && (
          <p className="flex items-start gap-2 px-4 py-2.5 mono text-[11px]" style={{ ...S_MUTED, lineHeight: 1.5, borderTop: '1px solid var(--rule)' }}>
            <span className="dot" aria-hidden="true" style={{ marginTop: '0.3em', color: persisted ? 'var(--primary)' : 'var(--warning-border)' }} />
            <span>{t(persisted ? 'storagePersistent' : 'storageBestEffort', lang)}</span>
          </p>
        )}
      </section>

      {/* Feature guide — one hairline-ruled list */}
      <section className="panel" aria-labelledby="guide-features-title" style={{ marginBottom: '1.25rem' }}>
        <div className="panel-head">
          <h2 id="guide-features-title" className="panel-title">{lang === 'zh' ? '功能指南' : 'Feature guide'}</h2>
          <span className="mono tabular text-[11px]" style={S_MUTED}>{GUIDE_SECTIONS.length}</span>
        </div>
        <ol className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 1, background: 'var(--rule)' }}>
          {GUIDE_SECTIONS.map((sec, i) => (
            <li key={sec.titleKey}
              className={`flex gap-3 p-4 md:px-5 ${oddCount && i === GUIDE_SECTIONS.length - 1 ? 'md:col-span-2' : ''}`}
              style={{ background: 'var(--card)' }}>
              <span aria-hidden="true" className="mono tabular flex-shrink-0"
                style={{ width: '1.5rem', paddingTop: '0.2rem', fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent)' }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0">
                <h3 className="font-semibold" style={{ fontSize: '0.9375rem', lineHeight: 1.35 }}>{t(sec.titleKey, lang)}</h3>
                <p className="text-[13px] mt-1" style={{ ...S_MUTED, lineHeight: 1.6 }}>{t(sec.bodyKey, lang)}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* Privacy statement */}
      <div className="notice notice-info" style={{ marginBottom: '1.25rem', padding: '0.875rem 1rem' }}>
        <IconShield size={18} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
        <div className="min-w-0">
          <p className="notice-title">{t('privacyTitle', lang)}</p>
          <p className="mt-1" style={{ ...S_MUTED, lineHeight: 1.6 }}>{t('privacyBody', lang)}</p>
        </div>
      </div>

      {/* Collapsible literature references */}
      <section className="panel">
        <h2 style={{ margin: 0 }}>
          <button type="button" onClick={() => setRefsOpen(!refsOpen)}
            aria-expanded={refsOpen} aria-controls="guide-references"
            className="w-full flex items-center gap-3 px-4 py-3 text-left bg-transparent hover:bg-[var(--bg-2)]"
            style={{ border: 0, color: 'var(--text)', fontFamily: 'var(--font-body)', letterSpacing: 0, transition: 'background-color var(--duration-fast) ease' }}>
            <Tile><IconBook size={16} /></Tile>
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline gap-2">
                <span className="text-sm font-semibold">{t('guideRefsCollapse', lang)}</span>
                <span className="mono tabular text-[11px]" style={{ ...S_MUTED, fontWeight: 500 }}>{REFERENCES.length}</span>
              </span>
              <span className="block text-xs mt-0.5" style={{ ...S_MUTED, fontWeight: 400 }}>{t('guideRefsCollapseDesc', lang)}</span>
            </span>
            <IconChevronDown size={16} style={{
              color: 'var(--text-muted)', flexShrink: 0,
              transform: refsOpen ? 'rotate(180deg)' : 'none', transition: 'transform var(--duration-base) var(--ease-out)',
            }} />
          </button>
        </h2>
        {refsOpen && (
          <ol id="guide-references" className="fade-in" style={{ borderTop: '1px solid var(--rule)' }}>
            {REFERENCES.map((ref, i) => (
              <li key={ref.id} className="grid gap-3 px-4 py-3"
                style={{ gridTemplateColumns: '1.75rem minmax(0, 1fr)', borderTop: i ? '1px solid var(--rule)' : 0 }}>
                <span className="mono tabular" style={{ ...S_MUTED, fontSize: '0.6875rem', fontWeight: 700, paddingTop: '0.15rem' }}>
                  {String(ref.id).padStart(2, '0')}
                </span>
                <div className="min-w-0 text-[13px]" style={{ lineHeight: 1.55 }}>
                  <p>
                    {ref.text}{' '}
                    <em>{ref.journal}</em>
                    {(ref.vol || ref.pages) && (
                      <span className="mono" style={{ ...S_MUTED, fontSize: '0.75rem' }}>
                        {ref.vol && ` ${ref.vol}`}{ref.pages && `:${ref.pages}`}
                      </span>
                    )}
                  </p>
                  <p className="text-xs mt-1" style={S_MUTED}>
                    {lang === 'en' ? (REF_NOTES_EN[ref.id] || safeText(ref.note, lang)) : safeText(ref.note, lang)}
                  </p>
                  {ref.doi && (
                    <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noopener noreferrer"
                      className="mono inline-flex items-center gap-1 mt-1 hover:underline"
                      style={{ color: 'var(--accent)', fontSize: '0.6875rem', overflowWrap: 'anywhere' }}>
                      doi:{ref.doi}<IconArrowUpRight size={11} />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export default RefsTab;
