// MobileTopBar — phones/tablets (<1024px). Brand on the left; search and the
// always-available tools (timer, quick calculator, assistant) on the right.
// Hidden ≥1024px by CSS (.app-topbar) where the sidebar takes over.
import { t } from '../i18n/index.js';
import { tabHref, isPlainClick } from '../lib/nav.jsx';
import { QuickTimerButton } from './Timer.jsx';
import QuickCalculatorButton from '../features/calc/QuickCalculatorButton.jsx';
import { IconSearch, IconSpark } from './icons.jsx';

export default function MobileTopBar({ lang, onNavigate, onOpenSearch, utility, onToggleUtility, agentAvailable, agentOpen, onToggleAgent }) {
  return (
    <header className="app-topbar">
      <a href={tabHref('buffers', lang)} className="topbar-brand"
        onClick={(e) => { if (!isPlainClick(e)) return; e.preventDefault(); onNavigate('buffers'); }}>
        <img src={import.meta.env.BASE_URL + 'favicon.svg'} alt="" width="24" height="24" />
        labmate
      </a>
      <div className="topbar-actions">
        <button type="button" className="topbar-btn" onClick={onOpenSearch} aria-label={t('navSearchShort', lang)} title={t('navSearchShort', lang)}>
          <IconSearch size={20} />
        </button>
        <QuickTimerButton open={utility === 'timer'} onToggle={() => onToggleUtility('timer')} />
        <QuickCalculatorButton open={utility === 'calc'} onToggle={() => onToggleUtility('calc')} />
        {agentAvailable && (
          <button type="button" className="topbar-btn" onClick={onToggleAgent} aria-expanded={agentOpen} aria-haspopup="dialog"
            aria-label={t('agentTitle', lang)} title={t('agentTitle', lang)} style={{ color: 'var(--accent)' }}>
            <IconSpark size={20} />
          </button>
        )}
      </div>
    </header>
  );
}
