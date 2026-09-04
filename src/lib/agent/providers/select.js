// ──────────────────────────────────────────────────────────────────────────────
// Provider selection — picks the `callModel` adapter for a turn.
// ──────────────────────────────────────────────────────────────────────────────
//
// Three lanes, one `callModel(messages, tools)` contract (see loop.js):
//   1. owner-proxy (default, free tier) — createOwnerProxy(), no config needed.
//   2. BYOK cloud   — createOpenAICompat() or createAnthropicDirect(), keyed
//      directly against a third-party provider from the browser.
//   3. BYOK local   — createOpenAICompat() against Ollama/LM Studio; no key,
//      no egress redaction (nothing leaves the device).
//
// The BYOK config is persisted as one JSON blob in the `credentials` Dexie
// table (see credentials.js) under BYOK_CREDENTIAL_NAME — never in
// localStorage/db.settings, so it never rides the app backup file.
//
// PRESETS enumerates the provider shortcuts the settings UI offers. `local:
// true` presets skip egress redaction and don't require an API key; every
// other preset defaults to redaction ON (the config's own `disableRedaction`
// toggle, default false, is the only way to turn it off for a cloud preset).
// ──────────────────────────────────────────────────────────────────────────────

import { getCredential, setCredential, deleteCredential } from '../../credentials.js';
import { createOwnerProxy } from './ownerProxy.js';
import { createOpenAICompat } from './openaiCompat.js';
import { createAnthropicDirect } from './anthropicDirect.js';

// Credential name deliberately matches backup.js's SECRET_KEY_RE (contains
// "credential") — defense in depth in case this value ever leaked into a
// backup-eligible store; today it never does, since credentials.js/db.credentials
// is untouched by backup.js.
export const BYOK_CREDENTIAL_NAME = 'agent_byok_credential';

export const PRESETS = [
  { key: 'openrouter', label: 'OpenRouter', provider: 'openaiCompat', baseUrl: 'https://openrouter.ai/api/v1', local: false, modelsPath: '/models' },
  { key: 'groq', label: 'Groq', provider: 'openaiCompat', baseUrl: 'https://api.groq.com/openai/v1', local: false, modelsPath: '/models' },
  { key: 'deepseek', label: 'DeepSeek', provider: 'openaiCompat', baseUrl: 'https://api.deepseek.com', local: false, modelsPath: '/models' },
  { key: 'gemini', label: 'Gemini (OpenAI-compatible)', provider: 'openaiCompat', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', local: false, modelsPath: '/models' },
  { key: 'ollama', label: 'Ollama (local)', provider: 'openaiCompat', baseUrl: 'http://localhost:11434/v1', local: true, modelsPath: '/models' },
  { key: 'lmstudio', label: 'LM Studio (local)', provider: 'openaiCompat', baseUrl: 'http://localhost:1234/v1', local: true, modelsPath: '/models' },
  { key: 'anthropic', label: 'Anthropic (direct)', provider: 'anthropicDirect', baseUrl: 'https://api.anthropic.com', local: false, modelsPath: null },
  { key: 'custom', label: 'Custom', provider: 'openaiCompat', baseUrl: '', local: false, modelsPath: '/models' },
];

export function getPreset(key) {
  return PRESETS.find((p) => p.key === key) || null;
}

/** Load the persisted BYOK config, or null if never configured. */
export async function loadByokConfig() {
  const raw = await getCredential(BYOK_CREDENTIAL_NAME);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

/** Persist the BYOK config (whole object, JSON-stringified). */
export async function saveByokConfig(config) {
  await setCredential(BYOK_CREDENTIAL_NAME, JSON.stringify(config || {}));
}

/** Remove the BYOK config entirely (reverts to owner-proxy only). */
export async function clearByokConfig() {
  await deleteCredential(BYOK_CREDENTIAL_NAME);
}

/**
 * A config is "ready" (usable to build a callModel) when it's enabled, has a
 * baseUrl and model, and — unless it's a local preset — an apiKey.
 */
export function isByokConfigReady(config) {
  if (!config || !config.enabled) return false;
  if (!config.baseUrl || !config.model) return false;
  const preset = getPreset(config.preset);
  const local = preset?.local ?? config.local ?? false;
  if (!local && !config.apiKey) return false;
  return true;
}

/**
 * Build the `callModel(messages, tools)` for this turn: BYOK if a ready
 * config is provided, otherwise the owner proxy.
 * @param {object} o
 * @param {object} [o.byokConfig]  persisted BYOK config (see loadByokConfig)
 * @param {object} [o.ownerProxy]  { baseUrl, model, sessionId } for the fallback lane
 * @param {Function} [o.onDelta]
 * @param {AbortSignal} [o.signal]
 * @param {typeof fetch} [o.fetchImpl]  override for tests, applies to whichever adapter is chosen
 */
export function selectCallModel(o = {}) {
  const { byokConfig, ownerProxy = {}, onDelta, signal, fetchImpl } = o;

  if (isByokConfigReady(byokConfig)) {
    const preset = getPreset(byokConfig.preset);
    const local = preset?.local ?? byokConfig.local ?? false;
    const disableRedaction = local || !!byokConfig.disableRedaction;
    const providerKind = byokConfig.provider || preset?.provider || 'openaiCompat';

    if (providerKind === 'anthropicDirect') {
      return createAnthropicDirect({
        baseUrl: byokConfig.baseUrl, apiKey: byokConfig.apiKey, model: byokConfig.model,
        disableRedaction, onDelta, signal, fetchImpl,
      });
    }
    return createOpenAICompat({
      baseUrl: byokConfig.baseUrl, apiKey: byokConfig.apiKey, model: byokConfig.model,
      disableRedaction, onDelta, signal, fetchImpl,
    });
  }

  return createOwnerProxy({ ...ownerProxy, onDelta, signal, fetchImpl });
}
