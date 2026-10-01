// Sidebar — desktop (≥1024px) navigation: brand, search, grouped sections,
// always-available tools (timer / quick calculator / assistant), running timers,
// backup status, and language/theme/refresh settings. Hidden below lg by CSS
// (.app-sidebar), where MobileTopBar + BottomNav + MoreSheet take over.
import { t } from '../i18n/index.js';
import { NAV_GROUPS, TABS, tabHref, isPlainClick } from '../lib/nav.jsx';
import { describeLastBackup } from '../hooks/useBackupStatus.js';
import { QuickTimerButton, TimerDock } from './Timer.jsx';
import QuickCalculatorButton from '../features/calc/QuickCalculatorButton.jsx';
import { IconSearch, IconSun, IconMoon, IconRefresh, IconSpark, IconAlert, IconDownload, IconGithub } from './icons.jsx';
import BetaBadge from './BetaBadge.jsx';

export default function Sidebar({
  activeTab, onNavigate, lang, setLang, theme, onToggleTheme, onOpenSearch,
  onRefreshRecipes, isSyncing, counts = {}, backup, utility, onToggleUtility,
  agentAvailable, agentOpen, onToggleAgent,
}) {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

  return (
    <aside className="app-sidebar">
      <a href={tabHref('buffers', lang)} className="sidebar-brand"
        onClick={(e) => { if (!isPlainClick(e)) return; e.preventDefault(); onNavigate('buffers'); }}>
        <img src={import.meta.env.BASE_URL + 'favicon.svg'} alt="" width="28" height="28" style={{ flexShrink: 0 }} />
        <span className="flex flex-col">
          <span className="sidebar-brand-name">labmate</span>
          <span className="sidebar-brand-sub">
            bio<span style={{ color: 'var(--accent)' }}>info</span>space
          </span>
        </span>
      </a>

      <button type="button" className="sidebar-search" onClick={onOpenSearch} aria-keyshortcuts="Meta+K Control+K">
        <IconSearch size={15} />
        <span>{t('navSearch', lang)}</span>
        <kbd>{isMac ? '⌘K' : 'Ctrl K'}</kbd>
      </button>

      <nav aria-label={t('navMain', lang)} className="sidebar-nav">
        {NAV_GROUPS.map(group => (
          <div key={group.id} className="nav-group">
            <div className="nav-group-label" id={`nav-group-${group.id}`}>{t(group.label, lang)}</div>
            <ul aria-labelledby={`nav-group-${group.id}`} className="space-y-px">
              {group.tabs.map(id => {
                const { Icon, label, beta } = TABS[id];
                const active = activeTab === id;
                return (
                  <li key={id}>
                    <a href={tabHref(id, lang)} className="nav-item" aria-current={active ? 'page' : undefined}
                      onClick={(e) => { if (!isPlainClick(e)) return; e.preventDefault(); onNavigate(id); }}>
                      <Icon size={16} />
                      <span className="truncate">{t(label, lang)}</span>
                      {beta && <BetaBadge lang={lang} style={{ marginLeft: 'auto' }} />}
                      {counts[id] != null && <span className="nav-item-count">{counts[id]}</span>}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-bottom">
      <div className="sidebar-section">
        <div className="sidebar-tools">
          <QuickTimerButton variant="sidebar" open={utility === 'timer'} onToggle={() => onToggleUtility('timer')} />
          <QuickCalculatorButton variant="sidebar" open={utility === 'calc'} onToggle={() => onToggleUtility('calc')} />
          {agentAvailable && (
            <button type="button" className="sidebar-tool" onClick={onToggleAgent} aria-expanded={agentOpen} aria-haspopup="dialog"
              aria-label={t('agentTitle', lang)} title={`${t('agentTitle', lang)} · ${t('agentShortcutHint', lang)}`}>
              <IconSpark size={15} />
              <span>{t('toolAssistant', lang)}</span>
            </button>
          )}
        </div>
      </div>

      <TimerDock />

      {backup?.due && (
        <div className="sidebar-section">
          <div className="notice notice-warn" role="status" style={{ padding: '0.5rem 0.6rem', display: 'block' }}>
            <div className="flex items-center gap-1.5" style={{ fontSize: '0.75rem' }} title={t('backupDueDesc', lang)}>
              <IconAlert size={14} style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
              <span className="notice-title">{t('backupLast', lang)}:</span>
              <span className="mono truncate" style={{ color: 'var(--warning-text)' }}>{describeLastBackup(backup.lastExport, t, lang)}</span>
            </div>
            <div className="flex gap-1.5 mt-1.5">
              <button type="button" className="btn-primary btn-sm flex-1" onClick={backup.backupNow}>
                <IconDownload size={13} />{t('backupAction', lang)}
              </button>
              <button type="button" className="btn btn-sm" onClick={backup.snooze}>{t('backupLater', lang)}</button>
            </div>
          </div>
        </div>
      )}

      <div className="sidebar-foot">
        <div className="seg" role="group" aria-label={t('languageLabel', lang)}>
          <button type="button" aria-pressed={lang === 'en'} onClick={() => lang !== 'en' && setLang('en')} lang="en">EN</button>
          <button type="button" aria-pressed={lang === 'zh'} onClick={() => lang !== 'zh' && setLang('zh')} lang="zh">中文</button>
        </div>
        <span className="flex-1" />
        <button type="button" className="btn-ghost btn-icon btn-sm" onClick={onToggleTheme}
          aria-label={t('themeToggle', lang)} title={t('themeToggle', lang)}>
          {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
        </button>
        <button type="button" className="btn-ghost btn-icon btn-sm" onClick={onRefreshRecipes} disabled={isSyncing}
          aria-label={t('refreshRecipes', lang)} title={t('refreshRecipes', lang)}>
          <IconRefresh size={16} style={isSyncing ? { animation: 'spin 1s linear infinite' } : undefined} />
        </button>
      </div>
      <div className="sidebar-meta">
        {!backup?.due && (
          <div>{t('backupLast', lang)}: {describeLastBackup(backup?.lastExport, t, lang)}</div>
        )}
        <div className="flex items-center gap-1.5">
          <span>v{__APP_VERSION__}</span>
          <span aria-hidden="true">·</span>
          <a href="https://bioinfospace.com" target="_blank" rel="noopener noreferrer">bioinfospace.com</a>
          <span aria-hidden="true">·</span>
          <a href="https://github.com/mianaz/labmate" target="_blank" rel="noopener noreferrer" aria-label="GitHub" title="GitHub" className="inline-flex items-center">
            <IconGithub size={12} />
          </a>
        </div>
      </div>
      </div>
    </aside>
  );
}
