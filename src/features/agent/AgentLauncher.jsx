// Floating launcher for the agent panel. Additive overlay — desktop and mobile.
// Stacked ABOVE the QuickTimerButton (which sits at `bottom: var(--fab-b)`) using
// the same +3.75rem offset the timer popup/toast use, so the two never collide.
import { t, useLang } from '../../i18n/index.js';
import { ChatIcon, CloseIcon } from './icons.jsx';

export default function AgentLauncher({ open, onToggle }) {
  const lang = useLang();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={t('agentTitle', lang)}
      aria-expanded={open}
      aria-haspopup="dialog"
      title={open ? t('agentClose', lang) : t('agentOpen', lang)}
      className="fixed z-40 flex items-center justify-center shadow-lg transition-transform hover:scale-110"
      style={{
        bottom: 'calc(var(--fab-b) + 3.75rem)',
        right: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
        width: '3rem', height: '3rem',
        background: 'var(--primary)', color: 'var(--on-primary)',
        border: '2px solid var(--border-strong)',
      }}
    >
      {open ? <CloseIcon size={20} /> : <ChatIcon size={20} />}
    </button>
  );
}
