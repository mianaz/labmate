// ──────────────────────────────────────────────────────────────────────────────
// Owner-proxy provider — the `callModel` adapter for the shared-key web mode.
// ──────────────────────────────────────────────────────────────────────────────
//
// Speaks SSE to the Bioinfospace backend (`POST /api/labmate/agent/chat`), which
// relays to OpenRouter with the owner key. The backend streams named events:
//   event: delta  data: { content }
//   event: tool   data: { tool_calls: [ {index, id?, function:{name?, arguments?}} ] }
//   event: usage  data: { input_tokens, output_tokens, cost_usd, is_byok, counted }
//   event: done   data: { stop_reason }
//   event: error  data: { message }
//
// The agent loop wants a COMPLETE assistant message per turn, so this adapter
// accumulates the stream (streaming deltas out via onDelta for the UI) and
// returns { content, tool_calls, usage, stopReason }. The accumulator is a pure,
// unit-tested state machine; only the fetch/stream plumbing is browser-coupled.
// ──────────────────────────────────────────────────────────────────────────────

// ── pure accumulator ─────────────────────────────────────────────────────────
export function makeAssembler() {
  const state = { content: '', toolCalls: new Map(), usage: null, stopReason: 'end_turn', error: null };

  function push(event, data) {
    switch (event) {
      case 'delta':
        if (data?.content) state.content += data.content;
        break;
      case 'tool':
        // OpenAI streams tool_calls as indexed fragments; concatenate arguments.
        for (const frag of data?.tool_calls || []) {
          const i = frag.index ?? 0;
          const cur = state.toolCalls.get(i) || { id: null, name: '', arguments: '' };
          if (frag.id) cur.id = frag.id;
          if (frag.function?.name) cur.name = frag.function.name;
          if (frag.function?.arguments) cur.arguments += frag.function.arguments;
          state.toolCalls.set(i, cur);
        }
        break;
      case 'usage':
        state.usage = data;
        break;
      case 'done':
        if (data?.stop_reason) state.stopReason = data.stop_reason;
        break;
      case 'error':
        state.error = data?.message || 'stream_error';
        break;
      default:
        break;
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
      stopReason: state.stopReason,
      error: state.error,
    };
  }

  return { push, finalize, _state: state };
}

// ── SSE line parser ────────────────────────────────────────────────────────────
// Feeds decoded text in; yields { event, data } once a blank-line-terminated
// SSE record is complete. Handles multi-line data and CRLF.
export function makeSSEParser() {
  let buf = '';
  let event = 'message';
  let dataLines = [];
  const out = [];

  function flush() {
    if (dataLines.length === 0) { event = 'message'; return; }
    const raw = dataLines.join('\n');
    let data = raw;
    try { data = JSON.parse(raw); } catch { /* keep string */ }
    out.push({ event, data });
    event = 'message';
    dataLines = [];
  }

  function feed(text) {
    buf += text;
    let nl;
    while ((nl = buf.indexOf('\n')) >= 0) {
      let line = buf.slice(0, nl);
      buf = buf.slice(nl + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line === '') { flush(); continue; }
      if (line.startsWith(':')) continue; // comment/heartbeat
      const colon = line.indexOf(':');
      const field = colon === -1 ? line : line.slice(0, colon);
      let value = colon === -1 ? '' : line.slice(colon + 1);
      if (value.startsWith(' ')) value = value.slice(1);
      if (field === 'event') event = value;
      else if (field === 'data') dataLines.push(value);
    }
    const drained = out.splice(0, out.length);
    return drained;
  }

  return { feed };
}

// ── the adapter ──────────────────────────────────────────────────────────────
/**
 * Build a `callModel(messages, tools)` bound to the owner proxy.
 * @param {object} o
 * @param {string} [o.baseUrl='/api/labmate/agent']
 * @param {string} o.model      allowlist key (e.g. 'minimax-m3')
 * @param {string} [o.sessionId]  sent as X-LabMate-Session for per-session limits
 * @param {number} [o.temperature]
 * @param {Function} [o.onDelta]  (text) => void  streaming UI hook
 * @param {typeof fetch} [o.fetchImpl]  override for tests
 */
export function createOwnerProxy(o = {}) {
  const {
    baseUrl = '/api/labmate/agent', model, sessionId,
    temperature, onDelta, fetchImpl,
  } = o;
  const doFetch = fetchImpl || fetch;

  return async function callModel(messages, tools) {
    const res = await doFetch(`${baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(sessionId ? { 'X-LabMate-Session': sessionId } : {}),
      },
      body: JSON.stringify({
        model, messages,
        ...(tools ? { tools } : {}),
        ...(temperature != null ? { temperature } : {}),
      }),
    });

    if (!res.ok) {
      let detail = {};
      try { detail = await res.json(); } catch { /* non-JSON body */ }
      const err = new Error(detail.error || `HTTP ${res.status}`);
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
        if (event === 'delta' && data?.content) onDelta?.(data.content);
      }
    }

    const final = assembler.finalize();
    if (final.error && !final.content && !final.tool_calls.length) {
      throw new Error(final.error);
    }
    return final;
  };
}
