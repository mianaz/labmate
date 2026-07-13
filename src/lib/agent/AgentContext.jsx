// ──────────────────────────────────────────────────────────────────────────────
// AgentContext — binds the agent brain (tools + loop) to the live app.
// ──────────────────────────────────────────────────────────────────────────────
//
// Provides the tool `ctx` (closing over recipes/lang/inventory/Dexie/download),
// runs a user turn through runAgentTurn() with the owner-proxy adapter, and
// surfaces chat state + a permission-request promise for the UI (AgentPanel) to
// render. NOT mounted in App.jsx yet — mounting has zero visual effect but is
// deferred until the Phase-1 UI consumes it, so the current bundle stays inert.
//
// Cross-tab refresh: agent writes go straight to Dexie via saveExperimentRecord;
// we emit a `labmate:experiments-changed` window event so open Notebook/Calendar
// tabs can reload (wire the listener when the UI lands).
// ──────────────────────────────────────────────────────────────────────────────

import { createContext, useContext, useCallback, useMemo, useRef, useState } from 'react';
import { useRecipes } from '../RecipeProvider.jsx';
import { t, useLang } from '../../i18n/index.js';
import db from '../db.js';
import { saveExperimentRecord } from '../experiments.js';
import { loadInventoryAsync } from '../../features/inventory/inventoryUtils.js';
import { downloadText } from './exportProtocol.js';
import { runAgentTurn } from './loop.js';
import { buildSystemPrompt } from './prompt.js';
import { createOwnerProxy } from './providers/ownerProxy.js';
import { loadPermissions, setPermission } from './permissions.js';
import { getAgentSessionId } from './session.js';

const DEFAULT_MODEL = 'minimax-m3';
const AGENT_API_BASE = '/api/labmate/agent';

const AgentContext = createContext(null);
export function useAgent() { return useContext(AgentContext); }

const todayStr = () => new Date().toISOString().slice(0, 10);

function errorText(err, lang) {
  const status = err?.status;
  // The proxy passes an upstream provider failure (e.g. OpenRouter 402/429)
  // through with the SAME HTTP status as its own budget/rate limits, tagging it
  // error:'upstream_error'. Branch on that tag first — otherwise a provider-side
  // 402 shows "monthly budget used up, switch models", which is useless advice
  // when every model shares one provider account.
  if (err?.detail?.error === 'upstream_error') return lang === 'zh' ? 'AI 服务暂时不可用，请稍后重试。' : 'The AI provider is temporarily unavailable. Please try again shortly.';
  if (status === 429) return lang === 'zh' ? '已达速率上限。请稍后重试，或切换回默认模型。' : 'Rate limit reached. Retry shortly, or switch back to the default model.';
  if (status === 402) return lang === 'zh' ? '该模型的本月预算已用尽。请切换到默认模型以继续使用。' : 'The monthly budget for this model is used up. Switch to the default model to continue.';
  if (status === 503) return lang === 'zh' ? '智能助手尚未配置。' : 'The agent is not configured yet.';
  return lang === 'zh' ? '请求失败，请重试。' : 'Request failed — please try again.';
}

export default function AgentProvider({ children, apiBase = AGENT_API_BASE }) {
  const { recipes } = useRecipes();
  const lang = useLang();

  const [messages, setMessages] = useState([]); // user/assistant/tool (no system)
  const [isRunning, setIsRunning] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [pendingPermission, setPendingPermission] = useState(null);

  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const abortRef = useRef(null);

  // Tool execution context — closes over the live app data/writers.
  const buildCtx = useCallback(() => ({
    recipes,
    lang,
    loadInventory: () => loadInventoryAsync(),
    saveExperiment: async (entry) => {
      const rec = await saveExperimentRecord(entry);
      try { window.dispatchEvent(new window.CustomEvent('labmate:experiments-changed')); } catch { /* SSR/no-window */ }
      return rec;
    },
    getExperiment: (id) => db.experiments.get(id),
    download: (text, filename, mime) => downloadText(text, filename, mime),
  }), [recipes, lang]);

  // The loop calls this for a write set to 'ask'; the UI resolves it.
  const requestPermission = useCallback((req) => new Promise((resolve) => {
    setPendingPermission({ ...req, resolve });
  }), []);

  const resolvePermission = useCallback((decision) => {
    setPendingPermission((prev) => { prev?.resolve?.(decision); return null; });
  }, []);

  // Stop the in-flight turn. The loop halts cleanly (stopReason 'aborted') and
  // sendMessage appends a muted note; isRunning is cleared in its finally.
  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setStreamingText('');
    setPendingPermission((prev) => { prev?.resolve?.('deny'); return null; });
  }, []);

  const sendMessage = useCallback(async (text) => {
    const trimmed = String(text || '').trim();
    if (!trimmed || isRunning) return;

    const userMsg = { role: 'user', content: trimmed };
    const priorHistory = messagesRef.current;
    const convo = [
      { role: 'system', content: buildSystemPrompt({ lang, today: todayStr() }) },
      ...priorHistory,
      userMsg,
    ];

    setMessages((prev) => [...prev, userMsg]);
    setIsRunning(true);
    setStreamingText('');

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const sessionId = await getAgentSessionId();
      const permissions = await loadPermissions();
      const callModel = createOwnerProxy({
        baseUrl: apiBase, model, sessionId,
        signal: controller.signal,
        onDelta: (t) => setStreamingText((s) => s + t),
      });

      const res = await runAgentTurn({
        messages: convo,
        callModel,
        ctx: buildCtx(),
        permissions,
        requestPermission,
        onPermissionChange: (name, mode) => { setPermission(name, mode); },
        signal: controller.signal,
      });

      // Everything the loop appended after the user message (assistant + tool).
      const produced = res.messages.slice(convo.length);
      const notes = [];
      if (res.stopReason === 'aborted') notes.push({ role: 'assistant', content: t('agentStopped', lang), _note: true });
      else if (res.stopReason === 'max_steps') notes.push({ role: 'assistant', content: t('agentMaxSteps', lang), _note: true });
      setMessages((prev) => [...prev, ...produced, ...notes]);
    } catch (err) {
      if (controller.signal.aborted || err?.name === 'AbortError') {
        setMessages((prev) => [...prev, { role: 'assistant', content: t('agentStopped', lang), _note: true }]);
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: errorText(err, lang), _error: true }]);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsRunning(false);
      setStreamingText('');
    }
  }, [isRunning, lang, model, apiBase, buildCtx, requestPermission]);

  const value = useMemo(() => ({
    messages, isRunning, streamingText,
    model, setModel,
    sendMessage, stop, clear,
    pendingPermission, resolvePermission,
  }), [messages, isRunning, streamingText, model, sendMessage, stop, clear, pendingPermission, resolvePermission]);

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
