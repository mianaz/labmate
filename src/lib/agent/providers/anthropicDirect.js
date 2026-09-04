// ──────────────────────────────────────────────────────────────────────────────
// Anthropic-direct provider — the BYOK `callModel` adapter for the Anthropic
// Messages API, called straight from the browser with the user's own key.
// ──────────────────────────────────────────────────────────────────────────────
//
// POST {baseUrl}/v1/messages with `stream: true`, headers `x-api-key`,
// `anthropic-version: 2023-06-01`, and `anthropic-dangerous-direct-browser-access:
// true` (required for a browser-origin request — Anthropic blocks
// cross-origin calls without it). Streams SSE with named events:
//   message_start | content_block_start | content_block_delta
//   content_block_stop | message_delta | message_stop | ping | error
//
// The agent loop and every other adapter are OpenAI-shaped (see loop.js), so
// this file does two translations that ownerProxy/openaiCompat don't need:
//   1. REQUEST: OpenAI-shaped `messages`/`tools` → Anthropic `system` (top-level
//      field, pulled out of the array) + `messages` (assistant tool_calls become
//      `tool_use` blocks; role:'tool' results become role:'user' messages with
//      `tool_result` blocks) + `tools` (parameters → input_schema).
//   2. RESPONSE: Anthropic content blocks (`text` + `tool_use`) accumulated via
//      streaming deltas → the same { content, tool_calls, usage, stopReason }
//      shape every adapter returns.
//
// Like ownerProxy.js and openaiCompat.js, the pure request/response translators
// and the pure accumulator are exported separately from the fetch-based
// `createAnthropicDirect()` factory for unit testing without real network.
// ──────────────────────────────────────────────────────────────────────────────

import { redactMessagesForEgress } from '../egress.js';

const ANTHROPIC_VERSION = '2023-06-01';
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const DEFAULT_MAX_TOKENS = 4096;

// ── request translation: OpenAI-shaped tools → Anthropic tools ────────────────
export function toAnthropicTools(tools) {
  if (!Array.isArray(tools)) return undefined;
  return tools.map((t) => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

// ── request translation: OpenAI-shaped messages → { system, messages } ────────
// - system message(s): pulled out of the array into the top-level `system` field.
// - assistant with tool_calls: content becomes an array of {type:'text'} (if any)
//   plus one {type:'tool_use', id, name, input} block per call.
// - role:'tool' results: become role:'user' messages with a single
//   {type:'tool_result', tool_use_id, content} block. Anthropic requires
//   tool_result blocks to immediately follow the assistant's tool_use turn, so
//   consecutive tool messages are merged into ONE user message (multiple
//   tool_result blocks), matching how the loop emits them (all results for one
//   assistant turn are pushed back-to-back).
export function toAnthropicMessages(messages) {
  let system = '';
  const out = [];

  for (const m of messages || []) {
    if (m.role === 'system') {
      system = system ? `${system}\n\n${m.content || ''}` : (m.content || '');
      continue;
    }
    if (m.role === 'user') {
      out.push({ role: 'user', content: m.content || '' });
      continue;
    }
    if (m.role === 'assistant') {
      const blocks = [];
      if (m.content) blocks.push({ type: 'text', text: m.content });
      for (const call of m.tool_calls || []) {
        let input = {};
        try { input = call.function?.arguments ? JSON.parse(call.function.arguments) : {}; } catch { input = {}; }
        blocks.push({ type: 'tool_use', id: call.id, name: call.function?.name, input });
      }
      out.push({ role: 'assistant', content: blocks.length ? blocks : (m.content || '') });
      continue;
    }
    if (m.role === 'tool') {
      const block = {
        type: 'tool_result',
        tool_use_id: m.tool_call_id,
        content: typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''),
      };
      const last = out[out.length - 1];
      if (last && last.role === 'user' && Array.isArray(last.content) && last.content[0]?.type === 'tool_result') {
        last.content.push(block);
      } else {
        out.push({ role: 'user', content: [block] });
      }
      continue;
    }
  }

  return { system, messages: out };
}

// ── pure accumulator ─────────────────────────────────────────────────────────
// Consumes Anthropic named SSE events and builds the same { content,
// tool_calls, usage, stopReason } shape the loop expects.
export function makeAssembler() {
  const state = {
    content: '', blocks: new Map(), // index -> {type, id?, name?, jsonBuf?}
    usage: null, stopReason: 'end_turn', error: null,
  };

  function push(event, data) {
    switch (event) {
      case 'content_block_start': {
        const block = data?.content_block || {};
        state.blocks.set(data.index, { type: block.type, id: block.id, name: block.name, jsonBuf: '' });
        break;
      }
      case 'content_block_delta': {
        const cur = state.blocks.get(data.index);
        const delta = data?.delta || {};
        if (delta.type === 'text_delta') {
          state.content += delta.text || '';
        } else if (delta.type === 'input_json_delta' && cur) {
          cur.jsonBuf += delta.partial_json || '';
        }
        break;
      }
      case 'message_delta': {
        const stop = data?.delta?.stop_reason;
        if (stop) state.stopReason = stop === 'tool_use' ? 'tool_calls' : 'end_turn';
        if (data?.usage) {
          state.usage = {
            input_tokens: data.usage.input_tokens,
            output_tokens: data.usage.output_tokens,
          };
        }
        break;
      }
      case 'message_start': {
        if (data?.message?.usage) {
          state.usage = {
            input_tokens: data.message.usage.input_tokens,
            output_tokens: data.message.usage.output_tokens,
          };
        }
        break;
      }
      case 'error': {
        state.error = data?.error?.message || data?.message || 'stream_error';
        break;
      }
      default:
        break;
    }
  }

  function finalize() {
    const tool_calls = [];
    for (const [, b] of [...state.blocks.entries()].sort((a, b) => a[0] - b[0])) {
      if (b.type !== 'tool_use') continue;
      tool_calls.push({
        id: b.id,
        type: 'function',
        function: { name: b.name, arguments: b.jsonBuf || '{}' },
      });
    }
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

// ── SSE line parser (named events, like ownerProxy's) ──────────────────────────
export function makeSSEParser() {
  let buf = '';
  let event = 'message';
  let dataLines = [];

  function feed(text) {
    buf += text;
    const out = [];
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line === '') {
        if (dataLines.length) {
          const raw = dataLines.join('\n');
          let data = raw;
          try { data = JSON.parse(raw); } catch { /* keep string */ }
          out.push({ event, data });
        }
        event = 'message';
        dataLines = [];
        continue;
      }
      if (line.startsWith(':')) continue;
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      else if (field === 'data') dataLines.push(value);
    }
    return out;
  }

  return { feed };
}

// ── the adapter ──────────────────────────────────────────────────────────────
/**
 * Build a `callModel(messages, tools)` bound to the Anthropic Messages API.
 * @param {object} o
 * @param {string} [o.baseUrl='https://api.anthropic.com']
 * @param {string} o.apiKey
 * @param {string} o.model
 * @param {boolean} [o.disableRedaction]  skip egress redaction (explicit opt-out only —
 *   this adapter is never used for the local lane)
 * @param {number} [o.maxTokens]
 * @param {Function} [o.onDelta]  (text) => void  streaming UI hook
 * @param {AbortSignal} [o.signal]
 * @param {typeof fetch} [o.fetchImpl]  override for tests
 */
export function createAnthropicDirect(o = {}) {
  const {
    baseUrl = DEFAULT_BASE_URL, apiKey, model, disableRedaction,
    maxTokens = DEFAULT_MAX_TOKENS, onDelta, signal, fetchImpl,
  } = o;
  const doFetch = fetchImpl || fetch;
  const url = `${String(baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '')}/v1/messages`;

  return async function callModel(messages, tools) {
    const outMessages = disableRedaction ? messages : redactMessagesForEgress(messages);
    const { system, messages: anthMessages } = toAnthropicMessages(outMessages);

    const res = await doFetch(url, {
      method: 'POST',
      ...(signal ? { signal } : {}),
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        stream: true,
        ...(system ? { system } : {}),
        messages: anthMessages,
        ...(tools?.length ? { tools: toAnthropicTools(tools) } : {}),
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
    const parser = makeSSEParser();
    const decoder = new TextDecoder();
    const reader = res.body.getReader();

    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      for (const { event, data } of parser.feed(decoder.decode(value, { stream: true }))) {
        assembler.push(event, data);
        if (event === 'content_block_delta' && data?.delta?.type === 'text_delta' && data.delta.text) {
          onDelta?.(data.delta.text);
        }
      }
    }

    const final = assembler.finalize();
    if (final.error && !final.content && !final.tool_calls.length) {
      throw new Error(final.error);
    }
    return final;
  };
}
