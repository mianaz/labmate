// RefsTab — Guide / usage documentation tab with data export/import and literature references
import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { REF_NOTES_EN, REFERENCES } from '../../data/references.js';
import { S_MUTED, S_TEXT, S_PRIMARY } from '../../lib/styleConstants.js';
import { safeText } from '../../lib/utils.js';
import { exportBackup, importBackup } from '../../lib/backup.js';

import { useToast } from '../../components/Toast.jsx';

function RefsTab({ onReplayTour }) {
  const lang = useLang();
  const toast = useToast();
  const [refsOpen, setRefsOpen] = useState(false);
  const fileInputRef = React.useRef(null);

  // ═══════════════════════════════════════════════
  // DATA EXPORT / IMPORT
  // ═══════════════════════════════════════════════

  function handleExport() {
    exportBackup();
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const count = importBackup(ev.target.result);
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
  // GUIDE SECTIONS CONFIG
  // ═══════════════════════════════════════════════

  const guideSections = [
    { num: '1', titleKey: 'guideBuffersTitle', bodyKey: 'guideBuffersBody' },
    { num: '2', titleKey: 'guideProtocolsTitle', bodyKey: 'guideProtocolsBody' },
    { num: '3', titleKey: 'guideCalcTitle', bodyKey: 'guideCalcBody' },
    { num: '4', titleKey: 'guideGelTitle', bodyKey: 'guideGelBody' },
    { num: '5', titleKey: 'guidePlateTitle', bodyKey: 'guidePlateBody' },
    { num: '6', titleKey: 'guideInventoryTitle', bodyKey: 'guideInventoryBody' },
    { num: '7', titleKey: 'guideNotebookTitle', bodyKey: 'guideNotebookBody' },
    { num: '8', titleKey: 'guideCalendarTitle', bodyKey: 'guideCalendarBody' },
    { num: '9', titleKey: 'guideToolsTitle', bodyKey: 'guideToolsBody' },
    { num: '⌘', titleKey: 'guideShortcutsTitle', bodyKey: 'guideShortcutsBody' },
    { num: '+', titleKey: 'guideCustomTitle', bodyKey: 'guideCustomBody' },
    { num: '!', titleKey: 'guideDataSafetyTitle', bodyKey: 'guideDataSafetyBody' },
  ];

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  return (
    <div className="fade-in">
      <div className="card p-6 mb-8">
        <h2 className="text-xl font-bold mb-1">{t('refsTitle', lang)}</h2>
        <p className="text-sm" style={S_MUTED}>{t('guideIntro', lang)}</p>
      </div>

      {/* Data Export/Import */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        <div className="card p-5">
          <div className="flex items-start gap-3 mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            <div>
              <h3 className="text-sm font-bold">{t('exportTitle', lang)}</h3>
              <p className="text-xs mt-1 leading-relaxed" style={S_MUTED}>{t('exportDesc', lang)}</p>
            </div>
          </div>
          <button onClick={handleExport}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{background:'var(--primary)', color:'var(--on-primary)'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            {t('exportBtn', lang)}
          </button>
        </div>

        <div className="card p-5">
          <div className="flex items-start gap-3 mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <div>
              <h3 className="text-sm font-bold">{t('importTitle', lang)}</h3>
              <p className="text-xs mt-1 leading-relaxed" style={S_MUTED}>{t('importDesc', lang)}</p>
            </div>
          </div>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{display:'none'}} />
          <button onClick={() => fileInputRef.current && fileInputRef.current.click()}
            className="w-full px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90"
            style={{background:'var(--bg-2)', color:'var(--text)', border:'1px solid var(--border)'}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            {t('importBtn', lang)}
          </button>
        </div>
      </div>

      {/* Feature guide sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
        {guideSections.map((sec, i) => (
          <div key={i} className="card p-5">
            <h3 className="text-base font-bold mb-2" style={{fontFamily:'var(--font-heading)'}}>
              <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-bold mr-2" style={{background:"var(--primary)", color:"var(--on-primary)"}}>{sec.num}</span>{t(sec.titleKey, lang)}
            </h3>
            <p className="text-sm leading-relaxed" style={S_MUTED}>{t(sec.bodyKey, lang)}</p>
          </div>
        ))}
      </div>

      {/* Replay Tour button */}
      {onReplayTour && (
        <div className="mb-8">
          <button onClick={onReplayTour}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all hover:opacity-90"
            style={{background:'var(--primary)', color:'var(--on-primary)'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>
            {t('replayTour', lang)}
          </button>
        </div>
      )}

      {/* Privacy statement */}
      <div className="card p-5 mb-8" style={{background:'var(--bg-2)', borderLeft:'3px solid var(--primary)'}}>
        <div className="flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          <div>
            <h3 className="text-sm font-bold mb-1">{t('privacyTitle', lang)}</h3>
            <p className="text-xs leading-relaxed" style={S_MUTED}>{t('privacyBody', lang)}</p>
          </div>
        </div>
      </div>

      {/* Collapsible literature references — compact list */}
      <div className="card overflow-hidden">
        <button onClick={() => setRefsOpen(!refsOpen)}
          className="w-full flex items-center justify-between p-4 text-left transition-colors"
          style={{background: refsOpen ? 'var(--primary-light)' : 'var(--card)'}}>
          <div>
            <h3 className="text-sm font-bold">{t('guideRefsCollapse', lang)}</h3>
            <p className="text-xs" style={S_MUTED}>{t('guideRefsCollapseDesc', lang)}</p>
          </div>
          <span className="text-lg" style={{color:'var(--text-muted)', transform: refsOpen ? 'rotate(180deg)' : 'none', transition:'transform 0.2s'}}>▼</span>
        </button>
        {refsOpen && (
          <div className="p-4 pt-2">
            <ol className="space-y-1.5 text-xs" style={S_MUTED}>
              {REFERENCES.map(ref => (
                <li key={ref.id} className="leading-relaxed">
                  <span className="mono font-semibold" style={S_TEXT}>{ref.id}.</span>{' '}
                  <span>{ref.text}</span>{' '}
                  <span className="italic" style={S_PRIMARY}>{ref.journal}</span>
                  {ref.vol && <span> {ref.vol}</span>}
                  {ref.pages && <span>:{ref.pages}</span>}
                  {' — '}
                  <span>{lang === 'en' ? (REF_NOTES_EN[ref.id] || safeText(ref.note, lang)) : safeText(ref.note, lang)}</span>
                  {ref.doi && (
                    <span>{' '}
                      <a href={`https://doi.org/${ref.doi}`} target="_blank" rel="noopener"
                        className="mono hover:underline" style={{color:'var(--accent)', fontSize:'0.65rem'}}>
                        DOI
                      </a>
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}

export default RefsTab;
