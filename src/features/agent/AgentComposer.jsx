// Composer: auto-growing textarea + send button.
// Enter sends · Shift+Enter newline · IME-safe (won't send mid-composition).
import { useRef, useState, useCallback } from 'react';
import { t } from '../../i18n/index.js';
import { SendIcon } from './icons.jsx';

const MAX_HEIGHT = 120; // px — ~5 lines before internal scroll

export default function AgentComposer({ onSend, disabled = false, lang = 'en', autoFocus = false }) {
  const [text, setText] = useState('');
  const composingRef = useRef(false);
  const taRef = useRef(null);

  const grow = useCallback((el) => {
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, MAX_HEIGHT) + 'px';
  }, []);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText('');
    if (taRef.current) taRef.current.style.height = 'auto';
  }, [text, disabled, onSend]);

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !composingRef.current) {
      e.preventDefault();
      submit();
    }
  }, [submit]);

  const canSend = text.trim().length > 0 && !disabled;

  return (
    <div className="flex items-end gap-2">
      <textarea
        ref={taRef}
        rows={1}
        autoFocus={autoFocus}
        value={text}
        disabled={disabled}
        onChange={(e) => { setText(e.target.value); grow(e.target); }}
        onKeyDown={onKeyDown}
        onCompositionStart={() => { composingRef.current = true; }}
        onCompositionEnd={() => { composingRef.current = false; }}
        placeholder={t('agentPlaceholder', lang)}
        aria-label={t('agentPlaceholder', lang)}
        className="flex-1 mono px-2.5 py-2 text-sm resize-none"
        style={{
          background: 'var(--bg-2)', border: '2px solid var(--border)', color: 'var(--text)',
          lineHeight: 1.45, maxHeight: MAX_HEIGHT + 'px', minWidth: 0,
          opacity: disabled ? 0.65 : 1,
        }}
      />
      <button
        type="button"
        onClick={submit}
        disabled={!canSend}
        aria-label={t('agentSend', lang)}
        title={t('agentSend', lang)}
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: '2.5rem', height: '2.5rem',
          background: canSend ? 'var(--primary)' : 'var(--bg-2)',
          color: canSend ? 'var(--on-primary)' : 'var(--text-muted)',
          border: `2px solid ${canSend ? 'var(--border-strong)' : 'var(--border)'}`,
          cursor: canSend ? 'pointer' : 'default',
          transition: 'background var(--duration-fast, 120ms)',
        }}
      >
        <SendIcon size={17} />
      </button>
    </div>
  );
}
