// MoreSheet — brutalist bottom sheet for secondary tabs + settings (mobile/tablet, <lg).
import { useEffect } from 'react';
import { t } from '../i18n/index.js';

const SECONDARY_TABS = [
  { id: 'tools', label: 'tabTools' },
  { id: 'inventory', label: 'tabInventory' },
  { id: 'notebook', label: 'tabNotebook' },
  { id: 'calendar', label: 'tabCalendar' },
  { id: 'refs', label: 'tabRefs' },
];

function RowIcon({ children }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0 }}>
      {children}
    </svg>
  );
}

const ICONS = {
  tools: (
    <RowIcon>
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z" />
    </RowIcon>
  ),
  inventory: (
    <RowIcon>
      <rect x="2" y="4" width="20" height="4" />
      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
      <line x1="10" y1="13" x2="14" y2="13" />
    </RowIcon>
  ),
  // Reused from NotebookTab's empty-state book icon for visual consistency.
  notebook: (
    <RowIcon>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      <line x1="8" y1="7" x2="16" y2="7" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </RowIcon>
  ),
  calendar: (
    <RowIcon>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </RowIcon>
  ),
  refs: (
    <RowIcon>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </RowIcon>
  ),
};

function RefreshIcon({ spinning }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, ...(spinning ? { animation: 'spin 1s linear infinite' } : {}) }}>
      <path d="M23 4v6h-6" /><path d="M1 20v-6h6" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function LangIcon() {
  return (
    <RowIcon>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </RowIcon>
  );
}

function AgentIcon() {
  return (
    <RowIcon>
      <path d="M12 3l1.6 4.6L18 9l-4.4 1.4L12 15l-1.6-4.6L6 9l4.4-1.4z" />
      <path d="M18 15l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z" />
    </RowIcon>
  );
}

const ROW_STYLE_BASE = {
  minHeight: '44px',
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem',
  paddingLeft: '1.25rem',
  paddingRight: '1.25rem',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.85rem',
  textAlign: 'left',
  borderBottom: '1px solid var(--border)',
};

export default function MoreSheet({ isOpen, onClose, activeTab, setActiveTab, lang, setLang, onRefreshRecipes, isSyncing, onOpenAgent }) {
  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; };
  }, [isOpen]);

  // Close on Escape.
  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  function go(tabId) {
    setActiveTab(tabId);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'zh' ? '更多' : 'More'}
    >
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, background: 'rgba(20,23,18,0.5)' }}
      />
      {/* Panel */}
      <div
        className="more-sheet-panel absolute bottom-0 left-0 right-0"
        style={{
          background: 'var(--card)',
          borderTop: '2px solid var(--border-strong)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div className="more-sheet-list" role="tablist" aria-label={lang === 'zh' ? '更多导航' : 'More navigation'}>
          {SECONDARY_TABS.map(tab => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => go(tab.id)}
                style={{
                  ...ROW_STYLE_BASE,
                  color: active ? 'var(--primary)' : 'var(--text)',
                  fontWeight: active ? 700 : 500,
                  background: active ? 'var(--primary-light)' : 'transparent',
                }}
              >
                {ICONS[tab.id]}
                <span>{t(tab.label, lang)}</span>
              </button>
            );
          })}
        </div>

        <div style={{ borderTop: '2px solid var(--border-strong)' }}>
          {onOpenAgent && (
            <button
              type="button"
              onClick={() => { onClose(); onOpenAgent(); }}
              style={{ ...ROW_STYLE_BASE, color: 'var(--primary)', fontWeight: 700 }}
            >
              <AgentIcon />
              <span>{t('agentTitle', lang)}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onRefreshRecipes}
            disabled={isSyncing}
            style={{
              ...ROW_STYLE_BASE,
              color: isSyncing ? 'var(--primary)' : 'var(--text)',
              opacity: isSyncing ? 0.7 : 1,
              fontWeight: 500,
            }}
          >
            <RefreshIcon spinning={isSyncing} />
            <span>{t('refreshRecipes', lang)}</span>
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
            style={{ ...ROW_STYLE_BASE, color: 'var(--primary)', fontWeight: 700, borderBottom: 'none' }}
          >
            <LangIcon />
            <span>{t('langToggle', lang)}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
