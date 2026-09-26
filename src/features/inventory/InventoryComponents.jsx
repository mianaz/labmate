// ═══════════════════════════════════════════════
// Inventory — Reusable small components (JSX)
// ═══════════════════════════════════════════════
import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { t, useLang } from '../../i18n/index.js';
import Icon, { IconClose } from '../../components/icons.jsx';
import { SAMPLE_TYPE_COLORS, SAMPLE_TYPE_LABELS } from './inventoryUtils.js';

// ── Icons ────────────────────────────────────────────────────────────────────
// Drawn on the shared 24×24 stroke Icon so they match the app icon set.

const STORAGE_GLYPHS = {
  freezer: (<><path d="M5 2.5h14v19H5z" /><path d="M5 8.5h14" /><path d="M12 11.5v7M9 13.25l6 3.5M9 16.75l6-3.5" /></>),
  fridge:  (<><path d="M5 2.5h14v19H5z" /><path d="M5 9.5h14" /><path d="M8.5 5v2M8.5 12.5v4" /></>),
  shelf:   (<><path d="M3.5 3v18M20.5 3v18" /><path d="M3.5 7.5h17M3.5 13.5h17M3.5 19.5h17" /></>),
  tank:    (<><path d="M9 2.5h6v3H9z" /><path d="M6 5.5h12v16H6z" /><path d="M6 10.5h12" /></>),
  rack:    (<><path d="M3.5 3.5h17v17h-17z" /><path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" /></>),
};

export function StorageIcon({ type, size = 16, style, className }) {
  return <Icon size={size} style={style} className={className}>{STORAGE_GLYPHS[type] || STORAGE_GLYPHS.shelf}</Icon>;
}

// Bar-chart glyph for the statistics action.
export const IconBars = (p) => (
  <Icon {...p}><path d="M3 21h18" /><path d="M5.5 12h3v9h-3zM10.5 4h3v17h-3zM15.5 8.5h3V21h-3z" /></Icon>
);

// ── Sample type badge ────────────────────────────────────────────────────────

export function TypeBadge({ type, lang, children, style }) {
  const c = SAMPLE_TYPE_COLORS[type] || SAMPLE_TYPE_COLORS.other;
  return (
    <span className="badge badge-solid" style={{ '--badge-fg': c.text, '--badge-bg': c.bg, ...style }}>
      {children ?? t(SAMPLE_TYPE_LABELS[type] || SAMPLE_TYPE_LABELS.other, lang)}
    </span>
  );
}

// ── Meter (thin square progress bar) ─────────────────────────────────────────

export const utilColor = (pct) => (pct < 60 ? 'var(--primary)' : pct < 85 ? 'var(--warning-border)' : 'var(--danger-border)');

export function Meter({ pct, color, height = 4, style }) {
  const w = Math.max(0, Math.min(100, pct || 0));
  return (
    <div aria-hidden="true" style={{ height, background: 'var(--bg-2)', boxShadow: 'inset 0 0 0 1px var(--rule)', ...style }}>
      <div style={{
        width: w + '%', minWidth: w > 0 ? 2 : 0, height: '100%',
        background: color || utilColor(w), transition: 'width var(--duration-slow) var(--ease-out)',
      }} />
    </div>
  );
}

// ── Dropdown menu item (Import / Export menus) ───────────────────────────────

export function MenuItem({ icon, label, sub, onClick, disabled }) {
  return (
    <button
      type="button" role="menuitem" onClick={onClick} disabled={disabled}
      className="flex w-full items-start gap-2.5 px-3 py-2 text-left hover:bg-[var(--bg-2)] disabled:cursor-not-allowed disabled:opacity-[0.45] disabled:hover:bg-transparent"
      style={{ background: 'transparent', border: 0, color: 'var(--text)' }}
    >
      <span className="mt-0.5 shrink-0" style={{ color: 'var(--text-muted)', display: 'inline-flex' }}>{icon}</span>
      <span className="min-w-0">
        <span className="block" style={{ fontSize: '0.8125rem', fontWeight: 500, lineHeight: 1.35 }}>{label}</span>
        {sub && <span className="block mono truncate" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>{sub}</span>}
      </span>
    </button>
  );
}

export function MenuPanel({ children, label, align = 'right', minWidth = 248 }) {
  return (
    <div
      role="menu" aria-label={label} className="popover py-1"
      style={{ position: 'absolute', top: 'calc(100% + 6px)', [align]: 0, minWidth, zIndex: 30 }}
    >
      {children}
    </div>
  );
}

// ── InvModal — shared dialog (brief's modal pattern) ─────────────────────────
// Sticky head (title + close) and footer; optional onSubmit turns the dialog
// into a <form> so Enter submits. Escape closes; body scroll is locked while
// open and focus returns to the trigger on close.

export function InvModal({ open, onClose, title, meta, children, footer, onSubmit, size = 'md', bodyClassName = 'space-y-3' }) {
  const lang = useLang();
  const titleId = useId();
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root) return;
      const target = root.querySelector('[data-autofocus]')
        || root.querySelector('.panel-body input:not([type="hidden"]):not([disabled]), .panel-body select, .panel-body textarea')
        || root;
      target.focus({ preventScroll: true });
    });
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onCloseRef.current && onCloseRef.current(); } };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  const maxW = size === 'lg' ? 'sm:max-w-2xl' : size === 'sm' ? 'sm:max-w-md' : 'sm:max-w-lg';
  const Panel = onSubmit ? 'form' : 'div';
  const formProps = onSubmit ? { onSubmit: (e) => { e.preventDefault(); onSubmit(); }, noValidate: true } : {};

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <Panel ref={panelRef} tabIndex={-1} {...formProps}
        className={`dialog w-full ${maxW} max-h-[92vh] overflow-y-auto`}
        style={{ zIndex: 51, outline: 'none', overscrollBehavior: 'contain' }}>
        <div className="panel-head" style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--card)' }}>
          <div className="flex min-w-0 items-center gap-2">
            <h2 id={titleId} className="section-title truncate">{title}</h2>
            {meta}
          </div>
          <button type="button" className="btn-ghost btn-icon btn-sm" onClick={onClose} aria-label={t('closeLabel', lang)}>
            <IconClose size={16} />
          </button>
        </div>
        <div className={'panel-body ' + bodyClassName}>{children}</div>
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3"
            style={{ borderTop: '1px solid var(--rule)', position: 'sticky', bottom: 0, zIndex: 2, background: 'var(--card)' }}>
            {footer}
          </div>
        )}
      </Panel>
    </div>,
    document.body
  );
}

// ── Form fields (global input styles do the look; these add label wiring) ────

export function InvInput({ label, value, onChange, type = 'text', placeholder = '', autoFocus, min, max, className, inputStyle }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id} type={type} value={value || ''} placeholder={placeholder} min={min} max={max}
        onChange={e => onChange(e.target.value)} data-autofocus={autoFocus ? '' : undefined}
        className="w-full" style={inputStyle}
      />
    </div>
  );
}

export function InvSelect({ label, value, onChange, options, className }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value || ''} onChange={e => onChange(e.target.value)} className="w-full">
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function InvTextarea({ label, value, onChange, rows = 3, className }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      <textarea id={id} value={value || ''} rows={rows} onChange={e => onChange(e.target.value)}
        className="w-full" style={{ resize: 'vertical', minHeight: 0 }} />
    </div>
  );
}
