// ──────────────────────────────────────────────────────────────────────────────
// OpenAI-compatible provider — the BYOK `callModel` adapter for any endpoint
// that speaks the OpenAI `/chat/completions` streaming + tool-calling wire
// format: OpenRouter, Groq, DeepSeek, Gemini's OpenAI-compat surface, Ollama,
// LM Studio, and fully custom self-hosted endpoints.
// ──────────────────────────────────────────────────────────────────────────────
//
// POST {baseUrl}/chat/completions with `stream: true`. The stream is plain SSE
// with NO `event:` field — every line is `data: {...}` (a raw OpenAI chunk)
// until a terminal `data: [DONE]`. That's simpler than ownerProxy's named-event
// SSE, so this file has its own tiny line-based reader rather than reusing
// ownerProxy's makeSSEParser (which expects `event:`/`data:` pairs).
//
// Like ownerProxy.js, the pure accumulator (`makeAssembler`) and the pure line
// splitter (`splitSSELines`) are exported separately from the fetch-based
// `createOpenAICompat()` factory so they can be unit-tested with a fake
// fetch/ReadableStream, decoupled from stream plumbing.
//
// LOCAL vs NON-LOCAL: this adapter is used for BOTH the local lane (Ollama /
// LM Studio) and cloud BYOK. Redaction is controlled by the caller via
// `disableRedaction` (the BYOK config's own toggle, or true for local
// baseUrl presets) — NOT re-derived here from the baseUrl string, since the
// caller (select.js) already knows whether the config is 'local' vs 'cloud'
// and that classification is one central decision. See select.js.
// ──────────────────────────────────────────────────────────────────────────────

import { redactMessagesForEgress } from '../egress.js';

// ── pure accumulator ─────────────────────────────────────────────────────────
// Mirrors ownerProxy's makeAssembler but consumes raw OpenAI chunk objects
// (`choices[0].delta`) directly instead of named SSE events.
export function makeAssembler() {
  const state = { content: '', toolCalls: new Map(), usage: null, stopReason: 'end_turn', error: null };

  function push(chunk) {
    const choice = chunk?.choices?.[0];
    if (!choice) return;
    const delta = choice.delta || {};
    if (delta.content) state.content += delta.content;
    for (const frag of delta.tool_calls || []) {
      const i = frag.index ?? 0;
      const cur = state.toolCalls.get(i) || { id: null, name: '', arguments: '' };
      if (frag.id) cur.id = frag.id;
      if (frag.function?.name) cur.name = frag.function.name;
      if (frag.function?.arguments) cur.arguments += frag.function.arguments;
      state.toolCalls.set(i, cur);
    }
    if (choice.finish_reason) {
      state.stopReason = choice.finish_reason === 'tool_calls' ? 'tool_calls' : 'end_turn';
    }
    if (chunk.usage) {
      state.usage = {
        input_tokens: chunk.usage.prompt_tokens,
        output_tokens: chunk.usage.completion_tokens,
      };
    }
  }

  function finalize() {
    const tool_calls = [...state.toolCalls.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, c], idx) => ({
        id: c.id || `call_${idx}`,
        type: 'function',
        function: { name: c.name, arguments: c.arguments || '{}' },
      }));
    return {
      content: state.content,
      tool_calls,
      usage: state.usage,
      stopReason: tool_calls.length ? 'tool_calls' : state.stopReason,
      error: state.error,
    };
  }

  return { push, finalize, _state: state };
}

// ── pure SSE line splitter ───────────────────────────────────────────────────
// Feeds decoded text in; yields parsed JSON payloads for each complete
// `data: {...}` line (skipping `data: [DONE]` and blank/comment lines).
export function makeDataLineParser() {
  let buf = '';

  function feed(text) {
    buf += text;
    const out = [];
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line || line.startsWith(':')) continue;
      if (!line.startsWith('data:')) continue;
      let value = line.slice(5);
      if (value.startsWith(' ')) value = value.slice(1);
      if (value === '[DONE]') continue;
      try { out.push(JSON.parse(value)); } catch { /* ignore partial/non-JSON */ }
    }
    return out;
  }

  return { feed };
}

// ── the adapter ──────────────────────────────────────────────────────────────
/**
 * Build a `callModel(messages, tools)` bound to an OpenAI-compatible endpoint.
 * @param {object} o
 * @param {string} o.baseUrl   e.g. 'https://openrouter.ai/api/v1' (no trailing slash)
 * @param {string} [o.apiKey]  sent as `Authorization: Bearer <apiKey>` when set
 * @param {string} o.model
 * @param {boolean} [o.disableRedaction]  skip egress redaction (local lane, or explicit opt-out)
 * @param {Function} [o.onDelta]  (text) => void  streaming UI hook
 * @param {AbortSignal} [o.signal]
 * @param {typeof fetch} [o.fetchImpl]  override for tests
 */
export function createOpenAICompat(o = {}) {
  const {
    baseUrl, apiKey, model, disableRedaction, onDelta, signal, fetchImpl,
  } = o;
  const doFetch = fetchImpl || fetch;
  const url = `${String(baseUrl || '').replace(/\/$/, '')}/chat/completions`;

  return async function callModel(messages, tools) {
    const outMessages = disableRedaction ? messages : redactMessagesForEgress(messages);

    const res = await doFetch(url, {
      method: 'POST',
      ...(signal ? { signal } : {}),
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: outMessages,
        stream: true,
        ...(tools?.length ? { tools } : {}),
      }),
    });

    if (!res.ok) {
      let detail = {};
      try { detail = await res.json(); } catch { /* non-JSON body */ }
      const err = new Error(detail.error?.message || detail.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.detail = detail;
      throw err;
    }

    const assembler = makeAssembler();
    const parser = makeDataLineParser();
    const decoder = new TextDecoder();
    const reader = res.body.getReader();

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const chunk of parser.feed(decoder.decode(value, { stream: true }))) {
        assembler.push(chunk);
        const delta = chunk?.choices?.[0]?.delta;
        if (delta?.content) onDelta?.(delta.content);
      }
    }

    return assembler.finalize();
  };
}
