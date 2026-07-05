/* global ReadableStream */
import { describe, it, expect } from 'vitest';
import { makeAssembler, makeSSEParser, createOwnerProxy } from '../providers/ownerProxy.js';

describe('makeAssembler', () => {
  it('accumulates content deltas', () => {
    const a = makeAssembler();
    a.push('delta', { content: 'Hel' });
    a.push('delta', { content: 'lo' });
    a.push('done', { stop_reason: 'end_turn' });
    const f = a.finalize();
    expect(f.content).toBe('Hello');
    expect(f.tool_calls).toEqual([]);
    expect(f.stopReason).toBe('end_turn');
  });

  it('reassembles indexed tool-call fragments (name + streamed arguments)', () => {
    const a = makeAssembler();
    a.push('tool', { tool_calls: [{ index: 0, id: 'call_a', function: { name: 'searchProtocols' } }] });
    a.push('tool', { tool_calls: [{ index: 0, function: { arguments: '{"query":' } }] });
    a.push('tool', { tool_calls: [{ index: 0, function: { arguments: '"trizol"}' } }] });
    const f = a.finalize();
    expect(f.tool_calls).toHaveLength(1);
    expect(f.tool_calls[0].id).toBe('call_a');
    expect(f.tool_calls[0].function.name).toBe('searchProtocols');
    expect(JSON.parse(f.tool_calls[0].function.arguments)).toEqual({ query: 'trizol' });
  });

  it('handles two parallel tool calls by index and sorts them', () => {
    const a = makeAssembler();
    a.push('tool', { tool_calls: [{ index: 1, id: 'b', function: { name: 'getProtocol', arguments: '{}' } }] });
    a.push('tool', { tool_calls: [{ index: 0, id: 'a', function: { name: 'searchProtocols', arguments: '{}' } }] });
    const f = a.finalize();
    expect(f.tool_calls.map((c) => c.function.name)).toEqual(['searchProtocols', 'getProtocol']);
  });

  it('captures usage and error', () => {
    const a = makeAssembler();
    a.push('usage', { cost_usd: 0, is_byok: true });
    a.push('error', { message: 'boom' });
    const f = a.finalize();
    expect(f.usage.is_byok).toBe(true);
    expect(f.error).toBe('boom');
  });
});

describe('makeSSEParser', () => {
  it('parses named events with JSON data across chunk splits', () => {
    const p = makeSSEParser();
    const evts = [];
    evts.push(...p.feed('event: delta\ndata: {"content":"hi"}\n\nevent: do'));
    evts.push(...p.feed('ne\ndata: {"stop_reason":"end_turn"}\n\n'));
    expect(evts).toEqual([
      { event: 'delta', data: { content: 'hi' } },
      { event: 'done', data: { stop_reason: 'end_turn' } },
    ]);
  });

  it('ignores comment/heartbeat lines and CRLF', () => {
    const p = makeSSEParser();
    const evts = p.feed(': keep-alive\r\nevent: delta\r\ndata: {"content":"x"}\r\n\r\n');
    expect(evts).toEqual([{ event: 'delta', data: { content: 'x' } }]);
  });
});

// End-to-end through a fake fetch returning an SSE ReadableStream.
function fakeSSEResponse(chunks, { ok = true, status = 200 } = {}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(encoder.encode(c));
      controller.close();
    },
  });
  return { ok, status, body: stream, json: async () => ({}) };
}

describe('createOwnerProxy callModel', () => {
  it('returns a finalized assistant message and streams deltas', async () => {
    const deltas = [];
    const fetchImpl = async () => fakeSSEResponse([
      'event: delta\ndata: {"content":"Found "}\n\n',
      'event: delta\ndata: {"content":"it."}\n\n',
      'event: usage\ndata: {"cost_usd":0,"is_byok":true}\n\n',
      'event: done\ndata: {"stop_reason":"end_turn"}\n\n',
    ]);
    const callModel = createOwnerProxy({ model: 'minimax-m3', fetchImpl, onDelta: (t) => deltas.push(t) });
    const res = await callModel([{ role: 'user', content: 'hi' }], []);
    expect(res.content).toBe('Found it.');
    expect(deltas).toEqual(['Found ', 'it.']);
    expect(res.usage.is_byok).toBe(true);
  });

  it('throws with status + detail on a non-ok response', async () => {
    const fetchImpl = async () => ({ ok: false, status: 402, json: async () => ({ error: 'budget_exceeded' }) });
    const callModel = createOwnerProxy({ model: 'glm-5.2', fetchImpl });
    await expect(callModel([{ role: 'user', content: 'x' }], [])).rejects.toMatchObject({ status: 402 });
  });
});
