// One chat bubble (user or assistant). Pure/prop-driven for easy testing.
// Renders markdown-lite (line breaks + **bold** + `code`) with NO HTML injection:
// parseInline() returns tokens we map to React elements, so it is XSS-safe.
import { parseInline } from './agentFormat.js';
import { t } from '../../i18n/index.js';

// Render a block of text: split on newlines, format inline markup per line.
function RichText({ text }) {
  const lines = String(text ?? '').split('\n');
  return lines.map((line, li) => (
    <span key={li}>
      {li > 0 && <br />}
      {parseInline(line).map((tok, ti) => {
        if (tok.type === 'bold') return <strong key={ti} style={{ fontWeight: 700 }}>{tok.value}</strong>;
        if (tok.type === 'code') {
          return (
            <code key={ti} className="mono" style={{
              background: 'var(--bg-2)', border: '1px solid var(--border)',
              padding: '0.05em 0.3em', fontSize: '0.85em',
            }}>{tok.value}</code>
          );
        }
        return <span key={ti}>{tok.value}</span>;
      })}
    </span>
  ));
}

export default function AgentMessage({ role, content, error = false, streaming = false, ungrounded, lang = 'en' }) {
  const isUser = role === 'user';
  const text = String(content ?? '');
  if (!text && !streaming) return null; // tool-call-only assistant turns render nothing here

  const bubbleStyle = isUser
    ? { background: 'var(--primary-light)', border: '2px solid var(--border)', color: 'var(--text)' }
    : error
      ? { background: 'var(--danger-bg)', border: '2px solid var(--danger-border)', color: 'var(--danger-text)' }
      : { background: 'var(--card)', border: '2px solid var(--border)', color: 'var(--text)', boxShadow: 'var(--shadow-sm)' };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className="px-3 py-2 text-sm"
        style={{
          ...bubbleStyle,
          maxWidth: '88%',
          fontFamily: 'var(--font-body)',
          lineHeight: 1.55,
          whiteSpace: 'normal',
          wordBreak: 'break-word',
        }}
      >
        <RichText text={text} />
        {streaming && (
          <span aria-hidden="true" className="mono" style={{ opacity: 0.6, marginLeft: '1px' }}>▍</span>
        )}
        {!isUser && !error && Array.isArray(ungrounded) && ungrounded.length > 0 && (
          <div style={{
            marginTop: '0.45rem', paddingTop: '0.4rem', borderTop: '1px dashed var(--border)',
            fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', gap: '0.3rem', alignItems: 'flex-start',
          }}>
            <span aria-hidden="true">⚠</span>
            <span>{t('agentUnverifiedValues', lang)}: {ungrounded.join(', ')}</span>
          </div>
        )}
      </div>
    </div>
  );
}
