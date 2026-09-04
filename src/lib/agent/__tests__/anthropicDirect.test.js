/* global ReadableStream */
import { describe, it, expect } from 'vitest';
import {
  makeAssembler, makeSSEParser, toAnthropicTools, toAnthropicMessages, createAnthropicDirect,
} from '../providers/anthropicDirect.js';

describe('toAnthropicTools', () => {
  it('maps OpenAI function schema to Anthropic input_schema', () => {
    const out = toAnthropicTools([
      { type: 'function', function: { name: 'searchProtocols', description: 'search', parameters: { type: 'object', properties: {} } } },
    ]);
    expect(out).toEqual([
      { name: 'searchProtocols', description: 'search', input_schema: { type: 'object', properties: {} } },
    ]);
  });

  it('returns undefined for no tools', () => {
    expect(toAnthropicTools(undefined)).toBeUndefined();
  });
});

describe('toAnthropicMessages', () => {
  it('pulls the system message out into a top-level field', () => {
    const { system, messages } = toAnthropicMessages([
      { role: 'system', content: 'be helpful' },
      { role: 'user', content: 'hi' },
    ]);
    expect(system).toBe('be helpful');
    expect(messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('translates assistant tool_calls into tool_use blocks', () => {
    const { messages } = toAnthropicMessages([
      { role: 'assistant', content: '', tool_calls: [{ id: 'call_a', type: 'function', function: { name: 'searchProtocols', arguments: '{"query":"trizol"}' } }] },
    ]);
    expect(messages).toEqual([
      { role: 'assistant', content: [{ type: 'tool_use', id: 'call_a', name: 'searchProtocols', input: { query: 'trizol' } }] },
    ]);
  });

  it('translates role:tool results into a user message with tool_result blocks, merging consecutive ones', () => {
    const { messages } = toAnthropicMessages([
      { role: 'tool', tool_call_id: 'call_a', name: 'searchProtocols', content: '{"count":1}' },
      { role: 'tool', tool_call_id: 'call_b', name: 'getProtocol', content: '{"id":"x"}' },
    ]);
    expect(messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'call_a', content: '{"count":1}' },
          { type: 'tool_result', tool_use_id: 'call_b', content: '{"id":"x"}' },
        ],
      },
    ]);
  });
});

describe('makeAssembler', () => {
  it('accumulates text deltas', () => {
    const a = makeAssembler();
    a.push('content_block_start', { index: 0, content_block: { type: 'text' } });
    a.push('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'Hel' } });
    a.push('content_block_delta', { index: 0, delta: { type: 'text_delta', text: 'lo' } });
    a.push('message_delta', { delta: { stop_reason: 'end_turn' } });
    const f = a.finalize();
    expect(f.content).toBe('Hello');
    expect(f.tool_calls).toEqual([]);
    expect(f.stopReason).toBe('end_turn');
  });

  it('reassembles a streamed tool_use block into a tool call', () => {
    const a = makeAssembler();
    a.push('content_block_start', { index: 0, content_block: { type: 'tool_use', id: 'call_a', name: 'searchProtocols' } });
    a.push('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: '{"query":' } });
    a.push('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: '"trizol"}' } });
    a.push('message_delta', { delta: { stop_reason: 'tool_use' } });
    const f = a.finalize();
    expect(f.tool_calls).toHaveLength(1);
    expect(f.tool_calls[0].id).toBe('call_a');
    expect(f.tool_calls[0].function.name).toBe('searchProtocols');
    expect(JSON.parse(f.tool_calls[0].function.arguments)).toEqual({ query: 'trizol' });
    expect(f.stopReason).toBe('tool_calls');
  });

  it('captures usage from message_start and message_delta, and error', () => {
    const a = makeAssembler();
    a.push('message_start', { message: { usage: { input_tokens: 10, output_tokens: 0 } } });
    a.push('message_delta', { delta: {}, usage: { input_tokens: 10, output_tokens: 5 } });
    a.push('error', { error: { message: 'boom' } });
    const f = a.finalize();
    expect(f.usage).toEqual({ input_tokens: 10, output_tokens: 5 });
    expect(f.error).toBe('boom');
  });
});

describe('makeSSEParser', () => {
  it('parses named events with JSON data across chunk splits', () => {
    const p = makeSSEParser();
    const evts = [];
    evts.push(...p.feed('event: content_block_delta\ndata: {"index":0,"delta":{"type":"text_delta","text":"hi"}}\n\nevent: message_st'));
    evts.push(...p.feed('op\ndata: {}\n\n'));
    expect(evts).toEqual([
      { event: 'content_block_delta', data: { index: 0, delta: { type: 'text_delta', text: 'hi' } } },
      { event: 'message_stop', data: {} },
    ]);
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

describe('createAnthropicDirect callModel', () => {
  it('returns a finalized assistant message, streams deltas, and sends required headers', async () => {
    const deltas = [];
    let capturedHeaders;
    let capturedBody;
    const fetchImpl = async (url, init) => {
      capturedHeaders = init.headers;
      capturedBody = JSON.parse(init.body);
      return fakeSSEResponse([
        'event: content_block_start\ndata: {"index":0,"content_block":{"type":"text"}}\n\n',
        'event: content_block_delta\ndata: {"index":0,"delta":{"type":"text_delta","text":"Found "}}\n\n',
        'event: content_block_delta\ndata: {"index":0,"delta":{"type":"text_delta","text":"it."}}\n\n',
        'event: message_delta\ndata: {"delta":{"stop_reason":"end_turn"},"usage":{"input_tokens":5,"output_tokens":2}}\n\n',
        'event: message_stop\ndata: {}\n\n',
      ]);
    };
    const callModel = createAnthropicDirect({ apiKey: 'sk-ant-test', model: 'claude-x', fetchImpl, onDelta: (t) => deltas.push(t) });
    const res = await callModel([
      { role: 'system', content: 'be helpful' },
      { role: 'user', content: 'hi' },
    ], []);
    expect(res.content).toBe('Found it.');
    expect(deltas).toEqual(['Found ', 'it.']);
    expect(res.usage).toEqual({ input_tokens: 5, output_tokens: 2 });
    expect(capturedHeaders['x-api-key']).toBe('sk-ant-test');
    expect(capturedHeaders['anthropic-version']).toBe('2023-06-01');
    expect(capturedHeaders['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(capturedBody.system).toBe('be helpful');
    expect(capturedBody.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });

  it('redacts local tool results by default', async () => {
    let capturedBody;
    const fetchImpl = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return fakeSSEResponse(['event: message_stop\ndata: {}\n\n']);
    };
    const callModel = createAnthropicDirect({ apiKey: 'k', model: 'claude-x', fetchImpl });
    const messages = [
      { role: 'tool', tool_call_id: 'c1', name: 'queryInventory', content: JSON.stringify({ count: 1, results: [{ name: 'TRIzol', location: 'Freezer A shelf 2' }] }) },
    ];
    await callModel(messages, []);
    const toolResult = capturedBody.messages[0].content[0];
    expect(toolResult.content).not.toContain('Freezer A');
  });

  it('throws with status + detail on a non-ok response', async () => {
    const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid x-api-key' } }) });
    const callModel = createAnthropicDirect({ apiKey: 'bad', model: 'claude-x', fetchImpl });
    await expect(callModel([{ role: 'user', content: 'x' }], [])).rejects.toMatchObject({ status: 401 });
  });
});
