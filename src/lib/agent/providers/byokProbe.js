// ──────────────────────────────────────────────────────────────────────────────
// BYOK probe helpers — "fetch models" and "test connection" for the settings UI.
// ──────────────────────────────────────────────────────────────────────────────
//
// Pure network helpers, deliberately separate from the streaming adapters: the
// settings modal needs cheap one-shot requests (list models, validate a key)
// without pulling in the SSE plumbing. Both speak the two wire formats the
// adapters do:
//   openaiCompat    → GET {baseUrl}/models, POST {baseUrl}/chat/completions
//   anthropicDirect → GET/POST {baseUrl}/v1/models | /v1/messages
//
// Neither helper ever persists anything; the key passed in comes from the form
// state, not the credential store, so a user can test before saving.
// ──────────────────────────────────────────────────────────────────────────────

const ANTHROPIC_VERSION = '2023-06-01';

const trimSlash = (u) => String(u || '').replace(/\/$/, '');

function headersFor(provider, apiKey) {
  if (provider === 'anthropicDirect') {
    return {
      'Content-Type': 'application/json',
      'x-api-key': apiKey || '',
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    };
  }
  const h = { 'Content-Type': 'application/json' };
  if (apiKey) h.Authorization = `Bearer ${apiKey}`;
  return h;
}

/**
 * List the models an endpoint offers. Both wire formats answer with
 * `{ data: [{ id }] }` (OpenAI, OpenRouter, Groq, Ollama, LM Studio, and
 * Anthropic's /v1/models all agree on this shape).
 * @returns {Promise<string[]>} model ids (may be empty)
 * @throws {Error} with `.status` on a non-2xx response
 */
export async function fetchByokModels({ baseUrl, apiKey, provider = 'openaiCompat', fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;
  const url = provider === 'anthropicDirect'
    ? `${trimSlash(baseUrl)}/v1/models`
    : `${trimSlash(baseUrl)}/models`;
  const res = await doFetch(url, { headers: headersFor(provider, apiKey) });
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const body = await res.json();
  const list = Array.isArray(body?.data) ? body.data : Array.isArray(body?.models) ? body.models : [];
  return list.map((m) => m?.id || m?.name).filter(Boolean);
}

/**
 * Validate baseUrl + key + model with a minimal 1-token completion — the only
 * check that exercises the exact endpoint the chat lane will use. Returns a
 * result object rather than throwing, so the UI can render it directly.
 * @returns {Promise<{ok: boolean, status?: number, message?: string}>}
 */
export async function testByokConnection({ baseUrl, apiKey, model, provider = 'openaiCompat', fetchImpl } = {}) {
  const doFetch = fetchImpl || fetch;
  const anthropic = provider === 'anthropicDirect';
  const url = anthropic
    ? `${trimSlash(baseUrl)}/v1/messages`
    : `${trimSlash(baseUrl)}/chat/completions`;
  const body = anthropic
    ? { model, max_tokens: 1, messages: [{ role: 'user', content: 'ping' }] }
    : { model, max_tokens: 1, stream: false, messages: [{ role: 'user', content: 'ping' }] };
  try {
    const res = await doFetch(url, {
      method: 'POST',
      headers: headersFor(provider, apiKey),
      body: JSON.stringify(body),
    });
    if (res.ok) return { ok: true, status: res.status };
    let detail = {};
    try { detail = await res.json(); } catch { /* non-JSON error body */ }
    const message = detail?.error?.message || (typeof detail?.error === 'string' ? detail.error : `HTTP ${res.status}`);
    return { ok: false, status: res.status, message };
  } catch (err) {
    // Network / CORS / CSP failure — no HTTP status to report.
    return { ok: false, message: err?.message || 'network error' };
  }
}
