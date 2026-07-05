// Reusable style constants (avoid recreating on every render)
export const S_MUTED = Object.freeze({ color: 'var(--text-muted)' });
export const S_TEXT = Object.freeze({ color: 'var(--text)' });
// NOTE: --primary (#16B364) is a bright fill color calibrated for ink-on-green use
// (buttons, active backgrounds); it fails AA contrast as small text on paper/card.
// --accent is the brand-strong shade calibrated for text/links — use that here.
export const S_PRIMARY = Object.freeze({ color: 'var(--accent)' });
export const S_MUTED_DIM = Object.freeze({ color: 'var(--text-muted)', opacity: 0.7 });
export const S_BORDER = Object.freeze({ borderColor: 'var(--border)' });
export const S_PILL_PRIMARY = Object.freeze({ background: 'var(--primary-light)', color: 'var(--accent)', border: '2px solid var(--border)' });
export const S_PILL_ACCENT = Object.freeze({ background: 'var(--accent-light)', color: 'var(--accent)', border: '2px solid var(--border)' });
export const S_BG2 = Object.freeze({ background: 'var(--bg-2)' });
export const S_INLINE_ICON = Object.freeze({ display: 'inline', marginRight: '4px', verticalAlign: 'middle' });
