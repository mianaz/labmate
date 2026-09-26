// UtilityPanel — the surface for small always-available tools (quick timer,
// quick calculator). Desktop (≥1024px): a non-modal popover docked beside the
// sidebar, so it can stay open while you read a protocol. Below that: a modal
// bottom sheet (thumb-reachable keypad, never covers the bottom nav's taps
// by accident because the backdrop closes it).
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { t, useLang } from '../i18n/index.js';
import { useIsDesktop } from '../hooks/useMediaQuery.js';
import { IconClose } from './icons.jsx';

export default function UtilityPanel({ open, onClose, title, icon, width = 288, children }) {
  const lang = useLang();
  const isDesktop = useIsDesktop();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const previouslyFocused = document.activeElement;
    panelRef.current?.focus({ preventScroll: true });
    function onKey(e) {
      if (e.key !== 'Escape') return;
      // The desktop popover is non-modal: only claim Escape when focus is inside it.
      if (isDesktop && !panelRef.current?.contains(document.activeElement)) return;
      e.stopPropagation();
      onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [open, onClose, isDesktop]);

  if (!open) return null;

  const head = (
    <div className={isDesktop ? 'popover-head' : 'sheet-head'}>
      <span className="flex items-center gap-2 eyebrow" style={{ color: 'var(--text)' }}>
        {icon && <span style={{ color: 'var(--accent)', display: 'inline-flex' }}>{icon}</span>}
        {title}
      </span>
      <button type="button" onClick={onClose} className="btn-ghost btn-icon btn-sm" aria-label={t('closeLabel', lang)}>
        <IconClose size={16} />
      </button>
    </div>
  );

  if (isDesktop) {
    return createPortal(
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-label={title} className="popover"
        style={{ left: 'calc(var(--sidebar-w) + 0.75rem)', bottom: '0.75rem', width, outline: 'none' }}>
        {head}
        {children}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <>
      <div className="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <div ref={panelRef} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} className="sheet" style={{ outline: 'none' }}>
        <div className="sheet-handle" aria-hidden="true" />
        {head}
        {children}
      </div>
    </>,
    document.body,
  );
}
