// Dialog — the shared modal shell. Bottom sheet on phones, centred panel from
// 640px. Escape and a backdrop click close it; focus moves in on open (to
// [data-autofocus] on pointer devices, the panel itself on touch so the keyboard
// doesn't pop up) and returns to the trigger on close; page scroll is locked
// while open. Pass `onSubmit` to render the panel as a <form> so Enter submits
// and a footer type="submit" button works.
import { useEffect, useRef, useId } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../i18n/index.js';
import { IconClose } from './icons.jsx';

const DIALOG_WIDTH = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-xl' };

export default function Dialog({
  title,
  onClose,
  lang,
  size = 'md',
  headActions,
  footer,
  onSubmit,
  bodyClassName = 'panel-body space-y-3',
  children,
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const panel = panelRef.current;
    const finePointer =
      typeof window.matchMedia === 'function' && window.matchMedia('(pointer: fine)').matches;
    const target = (finePointer && panel?.querySelector('[data-autofocus]')) || panel;
    target?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onCloseRef.current?.();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (
        previouslyFocused &&
        typeof previouslyFocused.focus === 'function' &&
        document.contains(previouslyFocused)
      ) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, []);

  const Panel = onSubmit ? 'form' : 'div';
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <Panel
        ref={panelRef}
        tabIndex={-1}
        onSubmit={onSubmit}
        className={`dialog flex flex-col w-full ${DIALOG_WIDTH[size] || DIALOG_WIDTH.md} max-h-[92vh]`}
        style={{ zIndex: 51, outline: 'none' }}
      >
        <div className="panel-head flex-none">
          <h2 id={titleId} className="section-title min-w-0 truncate">
            {title}
          </h2>
          <div className="flex items-center gap-1 flex-none">
            {headActions}
            <button
              type="button"
              className="btn-ghost btn-icon btn-sm"
              onClick={onClose}
              aria-label={t('closeLabel', lang)}
            >
              <IconClose size={16} />
            </button>
          </div>
        </div>
        <div className={`flex-1 min-h-0 overflow-y-auto ${bodyClassName}`}>{children}</div>
        {footer && (
          <div
            className="flex-none flex flex-wrap items-center justify-end gap-2 px-4 pt-3"
            style={{
              borderTop: '1px solid var(--rule)',
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
            }}
          >
            {footer}
          </div>
        )}
      </Panel>
    </div>,
    document.body,
  );
}
