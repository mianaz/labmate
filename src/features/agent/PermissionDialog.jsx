// Confirm dialog for a write tool awaiting approval. Pure/prop-driven:
//   permission = { name, args, preview }   onResolve('once'|'remember'|'deny')
// Portaled to <body> and rendered above the panel; Escape / backdrop = deny.
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n/index.js';
import { toolLabel } from './agentFormat.js';

export default function PermissionDialog({ permission, onResolve, lang = 'en' }) {
  useEffect(() => {
    if (!permission) return;
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onResolve('deny'); }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [permission, onResolve]);

  if (!permission) return null;
  const { name, preview } = permission;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-label={t('agentPermConfirm', lang)}
      onClick={() => onResolve('deny')}
    >
      <div className="overlay-backdrop" aria-hidden="true" />
      <div
        className="dialog"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '26rem', zIndex: 51 }}
      >
        <div className="px-4 pt-3.5 pb-3">
          <div className="mono" style={{
            fontSize: '0.62rem', letterSpacing: '0.05em', textTransform: 'uppercase',
            color: 'var(--accent)', fontWeight: 700, marginBottom: '0.4rem',
          }}>
            {toolLabel(name, lang)}
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
            {t('agentPermConfirm', lang)}
          </p>
          <p className="text-sm" style={{ color: 'var(--text)', lineHeight: 1.5, fontWeight: 600 }}>
            {preview || toolLabel(name, lang)}
          </p>
        </div>
        <div
          className="flex items-center justify-end gap-2 px-4 py-3"
          style={{ borderTop: '1px solid var(--rule)', background: 'var(--bg-2)' }}
        >
          <button type="button" onClick={() => onResolve('deny')} className="btn-ghost btn-sm">
            {t('agentDeny', lang)}
          </button>
          <button type="button" onClick={() => onResolve('once')} className="btn btn-sm">
            {t('agentAllowOnce', lang)}
          </button>
          <button type="button" onClick={() => onResolve('remember')} className="btn-primary btn-sm">
            {t('agentAllowRemember', lang)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
