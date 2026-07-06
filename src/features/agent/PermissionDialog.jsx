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
      <div className="absolute inset-0" style={{ background: 'rgba(20,23,18,0.55)' }} />
      <div
        className="relative w-full"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '26rem', background: 'var(--card)',
          border: '2px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)',
        }}
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
          style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-2)' }}
        >
          <button
            type="button"
            onClick={() => onResolve('deny')}
            className="px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'transparent', color: 'var(--text-muted)', border: '2px solid var(--border)' }}
          >
            {t('agentDeny', lang)}
          </button>
          <button
            type="button"
            onClick={() => onResolve('once')}
            className="px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'transparent', color: 'var(--accent)', border: '2px solid var(--border)' }}
          >
            {t('agentAllowOnce', lang)}
          </button>
          <button
            type="button"
            onClick={() => onResolve('remember')}
            className="px-3 py-1.5 text-xs font-bold"
            style={{ background: 'var(--primary)', color: 'var(--on-primary)', border: '2px solid var(--border-strong)' }}
          >
            {t('agentAllowRemember', lang)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
