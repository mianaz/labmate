// BottomNav — mobile bottom tab bar (<lg only). Desktop keeps the Header top tab bar.
import { t } from '../i18n/index.js';

const PRIMARY_TABS = [
  { id: 'buffers', label: 'tabBuffers' },
  { id: 'protocols', label: 'tabProtocols' },
  { id: 'calc', label: 'tabCalc' },
  { id: 'plate', label: 'tabPlate' },
];

const MORE_TAB_IDS = ['tools', 'inventory', 'notebook', 'calendar', 'refs'];

function Icon({ children }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

// Feather-style stroke icons matching Header's inline SVG idiom.
const ICONS = {
  buffers: (
    <Icon>
      <path d="M10 2v6.34a2 2 0 0 1-.36 1.14L4.32 18.6A2 2 0 0 0 6 22h12a2 2 0 0 0 1.68-3.4l-5.32-9.12A2 2 0 0 1 14 8.34V2" />
      <line x1="8.5" y1="2" x2="15.5" y2="2" />
      <line x1="6.5" y1="14" x2="17.5" y2="14" />
    </Icon>
  ),
  protocols: (
    <Icon>
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <line x1="8" y1="11" x2="16" y2="11" />
      <line x1="8" y1="15" x2="16" y2="15" />
      <line x1="8" y1="19" x2="12" y2="19" />
    </Icon>
  ),
  // Calculator icon reused from the retired QuickCalculatorButton FAB.
  calc: (
    <Icon>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="10" y2="10" />
      <line x1="14" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="10" y2="14" />
      <line x1="14" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="16" y2="18" />
    </Icon>
  ),
  plate: (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="1" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
      <line x1="9" y1="3" x2="9" y2="21" />
      <line x1="15" y1="3" x2="15" y2="21" />
    </Icon>
  ),
};

function MoreIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="1.75" />
      <circle cx="12" cy="12" r="1.75" />
      <circle cx="19" cy="12" r="1.75" />
    </svg>
  );
}

function ActiveBar() {
  return (
    <span aria-hidden="true" style={{
      position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'var(--primary)',
    }} />
  );
}

function NavSlot({ active, onClick, icon, label, ariaControls, id }) {
  return (
    <button
      type="button"
      onClick={onClick}
      role="tab"
      id={id}
      aria-selected={active}
      aria-controls={ariaControls}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full relative"
      style={{ color: active ? 'var(--primary)' : 'var(--text-muted)' }}
    >
      {active && <ActiveBar />}
      {icon}
      <span className="mono" style={{ fontSize: '10px', letterSpacing: '0.02em', lineHeight: 1 }}>{label}</span>
    </button>
  );
}

export default function BottomNav({ activeTab, setActiveTab, onMore, lang }) {
  const moreActive = MORE_TAB_IDS.includes(activeTab);

  return (
    <nav
      role="tablist"
      aria-label={lang === 'zh' ? '底部导航' : 'Bottom navigation'}
      className="bottom-nav fixed bottom-0 left-0 right-0 z-40 lg:hidden"
      style={{
        display: 'flex',
        background: 'var(--nav-bg)',
        borderTop: '2px solid var(--border-strong)',
        height: 'var(--bottom-nav-h)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        boxSizing: 'content-box',
      }}
    >
      {PRIMARY_TABS.map(tab => (
        <NavSlot
          key={tab.id}
          id={`bottomnav-tab-${tab.id}`}
          ariaControls={`tabpanel-${tab.id}`}
          active={activeTab === tab.id}
          onClick={() => setActiveTab(tab.id)}
          icon={ICONS[tab.id]}
          label={t(tab.label, lang)}
        />
      ))}
      <button
        type="button"
        onClick={onMore}
        role="tab"
        aria-selected={moreActive}
        aria-haspopup="true"
        className="flex-1 flex flex-col items-center justify-center gap-0.5 h-full relative"
        style={{ color: moreActive ? 'var(--primary)' : 'var(--text-muted)' }}
      >
        {moreActive && <ActiveBar />}
        <MoreIcon />
        <span className="mono" style={{ fontSize: '10px', letterSpacing: '0.02em', lineHeight: 1 }}>
          {lang === 'zh' ? '更多' : 'More'}
        </span>
      </button>
    </nav>
  );
}
