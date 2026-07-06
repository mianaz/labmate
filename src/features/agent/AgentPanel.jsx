// AgentPanel — the chat surface. Consumes useAgent() + useLang(), maps state to
// the presentational pieces, and hosts the permission dialog. Portaled to <body>.
// Desktop (≥768px): floating card anchored above the launcher FAB.
// Mobile (<768px): full-screen overlay. Neither reflows page content (fixed).
import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { t, useLang } from '../../i18n/index.js';
import { useIsMobile } from '../../hooks/useMediaQuery.js';
import { useAgent } from '../../lib/agent/AgentContext.jsx';
import { S_MUTED } from '../../lib/styleConstants.js';
import AgentMessage from './AgentMessage.jsx';
import ToolCallCard from './ToolCallCard.jsx';
import PermissionDialog from './PermissionDialog.jsx';
import AgentComposer from './AgentComposer.jsx';
import { CloseIcon, NewChatIcon, SparkIcon } from './icons.jsx';

// Roster mirrors the backend registry (agentModels.js). Keys must match exactly.
const MODELS = [
  { key: 'minimax-m3', label: 'MiniMax M3', badge: 'Default' },
  { key: 'deepseek-v4-flash', label: 'DeepSeek V4', badge: 'Fast' },
  { key: 'glm-5.2', label: 'GLM-5.2', badge: 'Premium' },
];

function ThinkingDots({ lang }) {
  return (
    <div className="flex justify-start">
      <div className="flex items-center gap-1.5 px-3 py-2"
        style={{ background: 'var(--card)', border: '2px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
        {[0, 1, 2].map((i) => (
          <span key={i} className="rounded-full animate-pulse" style={{
            width: '6px', height: '6px', background: 'var(--text-muted)', animationDelay: `${i * 0.18}s`,
          }} />
        ))}
        <span className="sr-only">{t('agentThinking', lang)}</span>
      </div>
    </div>
  );
}

export default function AgentPanel({ open, onClose }) {
  const lang = useLang();
  const isMobile = useIsMobile();
  const {
    messages, isRunning, streamingText, model, setModel,
    sendMessage, clear, pendingPermission, resolvePermission,
  } = useAgent();

  const scrollRef = useRef(null);

  // Map each tool result back to the args of the assistant call that produced it.
  const argsById = useMemo(() => {
    const m = {};
    for (const msg of messages) {
      if (msg.role === 'assistant' && Array.isArray(msg.tool_calls)) {
        for (const call of msg.tool_calls) {
          let args = {};
          try { args = call.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch { args = {}; }
          m[call.id] = { name: call.function?.name, args };
        }
      }
    }
    return m;
  }, [messages]);

  // Auto-scroll to the newest content.
  useEffect(() => {
    if (!open) return;
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [open, messages, streamingText, isRunning, pendingPermission]);

  // Escape closes the panel (the permission dialog intercepts Escape first, in the
  // capture phase, so it resolves-deny before this ever fires while it's open).
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll on the mobile full-screen overlay.
  useEffect(() => {
    if (!open || !isMobile) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open, isMobile]);

  if (!open) return null;

  const shellStyle = isMobile
    ? { position: 'fixed', inset: 0 }
    : {
        position: 'fixed',
        right: 'calc(env(safe-area-inset-right, 0px) + 1rem)',
        bottom: 'calc(var(--fab-b) + 3.75rem + 3.5rem)',
        width: 'min(400px, calc(100vw - 2rem))',
        height: 'min(620px, calc(100dvh - 11rem))',
      };

  const hasMessages = messages.length > 0;

  return createPortal(
    <div
      className="z-50 flex flex-col"
      role="dialog" aria-modal={isMobile ? 'true' : 'false'} aria-label={t('agentTitle', lang)}
      style={{
        ...shellStyle,
        background: 'var(--card)',
        border: '2px solid var(--border-strong)',
        boxShadow: isMobile ? 'none' : 'var(--shadow-lg)',
        paddingBottom: isMobile ? 'env(safe-area-inset-bottom, 0px)' : 0,
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
        style={{ borderBottom: '2px solid var(--border)' }}>
        <span style={{ color: 'var(--accent)', flexShrink: 0 }}><SparkIcon size={18} /></span>
        <span className="mono font-bold text-sm" style={{ color: 'var(--text)', letterSpacing: '-0.01em' }}>
          {t('agentTitle', lang)}
        </span>
        <div className="flex items-center gap-1.5 ml-auto">
          <label className="sr-only" htmlFor="agent-model-select">{t('agentModel', lang)}</label>
          <select
            id="agent-model-select"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mono"
            title={t('agentModel', lang)}
            style={{
              fontSize: '0.68rem', padding: '0.2rem 0.35rem', background: 'var(--bg-2)',
              border: '2px solid var(--border)', color: 'var(--text)', maxWidth: '9.5rem',
            }}
          >
            {MODELS.map((m) => (
              <option key={m.key} value={m.key}>{m.label} · {m.badge}</option>
            ))}
          </select>
          <button type="button" onClick={clear} title={t('agentClear', lang)} aria-label={t('agentClear', lang)}
            className="flex items-center justify-center"
            style={{ width: '2rem', height: '2rem', color: 'var(--text-muted)', border: '2px solid var(--border)', background: 'var(--card)' }}>
            <NewChatIcon size={15} />
          </button>
          <button type="button" onClick={onClose} title={t('agentClose', lang)} aria-label={t('agentClose', lang)}
            className="flex items-center justify-center"
            style={{ width: '2rem', height: '2rem', color: 'var(--text-muted)', border: '2px solid var(--border)', background: 'var(--card)' }}>
            <CloseIcon size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5" style={{ background: 'var(--bg)' }}>
        {!hasMessages && !isRunning && (
          <div className="py-4">
            <div className="flex items-center gap-2 mb-2" style={{ color: 'var(--accent)' }}>
              <SparkIcon size={20} />
              <span className="mono font-bold text-sm" style={{ color: 'var(--text)' }}>{t('agentTitle', lang)}</span>
            </div>
            <p className="text-sm mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.55 }}>{t('agentIntro', lang)}</p>
            <div className="space-y-1.5 mb-4">
              {[t('agentEmptyExample1', lang), t('agentEmptyExample2', lang)].map((ex) => (
                <button key={ex} type="button" onClick={() => sendMessage(ex)}
                  className="block w-full text-left text-xs px-2.5 py-2"
                  style={{ background: 'var(--bg-2)', border: '2px solid var(--border)', color: 'var(--text)' }}>
                  {ex}
                </button>
              ))}
            </div>
            <p className="mono" style={{ fontSize: '0.62rem', color: 'var(--text-muted)', lineHeight: 1.5, opacity: 0.85 }}>
              {t('agentRedLine', lang)}
            </p>
          </div>
        )}

        {messages.map((msg, i) => {
          if (msg.role === 'tool') {
            const meta = argsById[msg.tool_call_id] || {};
            let result = {};
            try { result = msg.content ? JSON.parse(msg.content) : {}; } catch { result = { error: 'parse_error' }; }
            return (
              <div key={i} className="flex justify-start">
                <ToolCallCard name={msg.name || meta.name} args={meta.args || {}} result={result} lang={lang} />
              </div>
            );
          }
          // assistant tool-call-only turns have empty content → AgentMessage renders null
          return (
            <AgentMessage key={i} role={msg.role} content={msg.content} error={msg._error} />
          );
        })}

        {isRunning && (streamingText
          ? <AgentMessage role="assistant" content={streamingText} streaming />
          : <ThinkingDots lang={lang} />
        )}
      </div>

      {/* Composer */}
      <div className="px-3 py-2.5 flex-shrink-0" style={{ borderTop: '2px solid var(--border)', background: 'var(--card)' }}>
        <AgentComposer onSend={sendMessage} disabled={isRunning} lang={lang} autoFocus={!isMobile} />
        <p className="mt-1.5" style={{ ...S_MUTED, fontSize: '0.62rem', textAlign: 'center' }}>
          {t('agentComposerHint', lang)}
        </p>
      </div>

      <PermissionDialog permission={pendingPermission} onResolve={resolvePermission} lang={lang} />
    </div>,
    document.body,
  );
}
