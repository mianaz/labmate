// MoreSheet — phones/tablets (<1024px) bottom sheet: the sections that don't fit
// in the bottom bar (same grouping as the desktop sidebar) plus settings and
// backup status. Hidden ≥1024px by CSS (lg:hidden on the wrapper).
import { useEffect, useRef } from 'react';
import { t } from '../i18n/index.js';
import { NAV_GROUPS, BOTTOM_NAV_TABS, TABS, tabHref, isPlainClick } from '../lib/nav.jsx';
import { describeLastBackup } from '../hooks/useBackupStatus.js';
import { IconClose, IconRefresh, IconSpark, IconDownload, IconChevronRight, IconGithub } from './icons.jsx';
import BetaBadge from './BetaBadge.jsx';

const ROW = 'flex items-center gap-3 w-full px-4 text-left';
const ROW_STYLE = { minHeight: '3rem', borderBottom: '1px solid var(--rule)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem' };

export default function MoreSheet({
  isOpen, onClose, activeTab, setActiveTab, lang, setLang, theme, setTheme,
  onRefreshRecipes, isSyncing, onOpenAgent, backup,
}) {
  const panelRef = useRef(null);

  // Lock body scroll while open; Escape closes; focus moves into the sheet.
  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus({ preventScroll: true });
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const groups = NAV_GROUPS
    .map(g => ({ ...g, tabs: g.tabs.filter(id => !BOTTOM_NAV_TABS.includes(id)) }))
    .filter(g => g.tabs.length > 0);

  return (
    <div className="lg:hidden">
      <div className="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} tabIndex={-1} className="sheet" role="dialog" aria-modal="true" aria-label={t('navMore', lang)} style={{ outline: 'none' }}>
        <div className="sheet-handle" aria-hidden="true" />
        <div className="sheet-head">
          <span className="sheet-title">{t('navMore', lang)}</span>
          <button type="button" onClick={onClose} className="btn-ghost btn-icon btn-sm" aria-label={t('closeLabel', lang)}>
            <IconClose size={16} />
          </button>
        </div>

        <nav aria-label={t('navMore', lang)}>
          {groups.map(group => (
            <div key={group.id}>
              <div className="nav-group-label" style={{ padding: '0.75rem 1rem 0.35rem', borderTop: '1px solid var(--rule)' }}>{t(group.label, lang)}</div>
              {group.tabs.map(id => {
                const { Icon, label, beta } = TABS[id];
                const active = activeTab === id;
                return (
                  <a key={id} href={tabHref(id, lang)} className={ROW} aria-current={active ? 'page' : undefined}
                    onClick={(e) => { if (!isPlainClick(e)) return; e.preventDefault(); setActiveTab(id); onClose(); }}
                    style={{
                      ...ROW_STYLE, textDecoration: 'none',
                      color: 'var(--text)', fontWeight: active ? 700 : 500,
                      background: active ? 'var(--primary-light)' : 'transparent',
                      boxShadow: active ? 'inset 3px 0 0 var(--primary)' : 'none',
                    }}>
                    <span style={{ color: active ? 'var(--accent)' : 'var(--text-muted)', display: 'inline-flex' }}><Icon size={18} /></span>
                    <span className="flex-1">{t(label, lang)}</span>
                    {beta && <BetaBadge lang={lang} />}
                    <IconChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
                  </a>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="nav-group-label" style={{ padding: '0.75rem 1rem 0.35rem', borderTop: '1px solid var(--rule)' }}>{t('navSettings', lang)}</div>
        <div className={ROW} style={ROW_STYLE}>
          <span className="flex-1">{t('languageLabel', lang)}</span>
          <div className="seg" role="group" aria-label={t('languageLabel', lang)}>
            <button type="button" aria-pressed={lang === 'en'} onClick={() => lang !== 'en' && setLang('en')} lang="en">EN</button>
            <button type="button" aria-pressed={lang === 'zh'} onClick={() => lang !== 'zh' && setLang('zh')} lang="zh">中文</button>
          </div>
        </div>
        <div className={ROW} style={ROW_STYLE}>
          <span className="flex-1">{t('themeLabel', lang)}</span>
          <div className="seg" role="group" aria-label={t('themeLabel', lang)}>
            <button type="button" aria-pressed={theme !== 'dark'} onClick={() => setTheme('light')}>{t('themeLight', lang)}</button>
            <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>{t('themeDark', lang)}</button>
          </div>
        </div>
        <button type="button" onClick={onRefreshRecipes} disabled={isSyncing} className={ROW}
          style={{ ...ROW_STYLE, color: 'var(--text)', opacity: isSyncing ? 0.6 : 1 }}>
          <IconRefresh size={18} style={{ color: 'var(--text-muted)', ...(isSyncing ? { animation: 'spin 1s linear infinite' } : {}) }} />
          <span className="flex-1">{t('refreshRecipes', lang)}</span>
        </button>
        {onOpenAgent && (
          <button type="button" onClick={() => { onClose(); onOpenAgent(); }} className={ROW} style={{ ...ROW_STYLE, color: 'var(--text)' }}>
            <IconSpark size={18} style={{ color: 'var(--accent)' }} />
            <span className="flex-1">{t('agentTitle', lang)}</span>
          </button>
        )}

        {backup && (
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--rule)' }}>
            <div className="flex-1 min-w-0">
              <div className="eyebrow">{t('localDataOnly', lang)}</div>
              <div className="mono" style={{ fontSize: '0.75rem', color: backup.due ? 'var(--warning-text)' : 'var(--text-muted)' }}>
                {t('backupLast', lang)}: {describeLastBackup(backup.lastExport, t, lang)}
              </div>
            </div>
            <button type="button" className={backup.due ? 'btn-primary btn-sm' : 'btn btn-sm'} onClick={backup.backupNow}>
              <IconDownload size={14} />{t('backupAction', lang)}
            </button>
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap px-4 py-3 mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          <span>labmate v{__APP_VERSION__}</span>
          <span aria-hidden="true">·</span>
          <a href="https://bioinfospace.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit' }}>bioinfospace.com</a>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/mianaz/labmate" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1" style={{ color: 'inherit' }}>
            <IconGithub size={11} />GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
