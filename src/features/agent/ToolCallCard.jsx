// Compact card summarizing one tool call + its result (never raw JSON up front).
// Pure/prop-driven. `result` is the already-parsed tool result object.
import { useState } from 'react';
import { t } from '../../i18n/index.js';
import { summarizeToolResult } from './agentFormat.js';

const TONE_STYLE = {
  ok:    { accent: 'var(--accent)', dot: 'var(--primary)' },
  error: { accent: 'var(--danger-text)', dot: 'var(--danger-text)' },
  muted: { accent: 'var(--text-muted)', dot: 'var(--text-muted)' },
};

export default function ToolCallCard({ name, args = {}, result = {}, lang = 'en' }) {
  const [showDetails, setShowDetails] = useState(false);
  const { tone, title, lines } = summarizeToolResult(name, args, result, lang);
  const toneStyle = TONE_STYLE[tone] || TONE_STYLE.ok;

  // Details = the args + result as pretty JSON, behind a toggle (opt-in, not default).
  const detailText = safeStringify({ args, result });

  return (
    <div
      className="text-xs"
      style={{ background: 'var(--bg-2)', border: '2px solid var(--border)', maxWidth: '88%' }}
    >
      <div className="flex items-start gap-2 px-2.5 py-1.5">
        <span aria-hidden="true" className="rounded-full" style={{
          width: '7px', height: '7px', marginTop: '0.35em', flexShrink: 0, background: toneStyle.dot,
        }} />
        <div className="min-w-0 flex-1">
          <div className="mono" style={{
            fontSize: '0.62rem', letterSpacing: '0.04em', textTransform: 'uppercase',
            color: toneStyle.accent, fontWeight: 700,
          }}>
            {title}
          </div>
          {lines.map((line, i) => (
            <div key={i} className="truncate" style={{ color: 'var(--text)', lineHeight: 1.45 }} title={line}>
              {line}
            </div>
          ))}
        </div>
        {detailText && (
          <button
            type="button"
            onClick={() => setShowDetails((s) => !s)}
            className="mono flex-shrink-0"
            aria-expanded={showDetails}
            style={{
              fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase',
              letterSpacing: '0.03em', padding: '0.1rem 0.25rem',
            }}
          >
            {showDetails ? '−' : t('agentToolDetails', lang)}
          </button>
        )}
      </div>
      {showDetails && detailText && (
        <pre
          className="mono"
          style={{
            margin: 0, padding: '0.5rem 0.65rem', borderTop: '1px solid var(--border)',
            background: 'var(--card)', color: 'var(--text-muted)', fontSize: '0.62rem',
            lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '11rem', overflow: 'auto',
          }}
        >
          {detailText}
        </pre>
      )}
    </div>
  );
}

function safeStringify(obj) {
  try {
    const s = JSON.stringify(obj, null, 2);
    return s && s.length > 2000 ? s.slice(0, 2000) + '\n…' : s;
  } catch {
    return '';
  }
}
