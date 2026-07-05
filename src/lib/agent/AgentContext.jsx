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
import { useLang } from '../../i18n/index.js';
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

  const clear = useCallback(() => {
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

    try {
      const sessionId = await getAgentSessionId();
      const permissions = await loadPermissions();
      const callModel = createOwnerProxy({
        baseUrl: apiBase, model, sessionId,
        onDelta: (t) => setStreamingText((s) => s + t),
      });

      const res = await runAgentTurn({
        messages: convo,
        callModel,
        ctx: buildCtx(),
        permissions,
        requestPermission,
        onPermissionChange: (name, mode) => { setPermission(name, mode); },
      });

      // Everything the loop appended after the user message (assistant + tool).
      const produced = res.messages.slice(convo.length);
      setMessages((prev) => [...prev, ...produced]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: errorText(err, lang), _error: true }]);
    } finally {
      setIsRunning(false);
      setStreamingText('');
    }
  }, [isRunning, lang, model, apiBase, buildCtx, requestPermission]);

  const value = useMemo(() => ({
    messages, isRunning, streamingText,
    model, setModel,
    sendMessage, clear,
    pendingPermission, resolvePermission,
  }), [messages, isRunning, streamingText, model, sendMessage, clear, pendingPermission, resolvePermission]);

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}
