/* global ReadableStream */
import { describe, it, expect } from 'vitest';
import { makeAssembler, makeDataLineParser, createOpenAICompat } from '../providers/openaiCompat.js';

describe('makeAssembler', () => {
  it('accumulates content deltas across chunks', () => {
    const a = makeAssembler();
    a.push({ choices: [{ delta: { content: 'Hel' } }] });
    a.push({ choices: [{ delta: { content: 'lo' } }] });
    a.push({ choices: [{ delta: {}, finish_reason: 'stop' }] });
    const f = a.finalize();
    expect(f.content).toBe('Hello');
    expect(f.tool_calls).toEqual([]);
    expect(f.stopReason).toBe('end_turn');
  });

  it('reassembles indexed tool-call fragments (name + streamed arguments)', () => {
    const a = makeAssembler();
    a.push({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_a', function: { name: 'searchProtocols' } }] } }] });
    a.push({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"query":' } }] } }] });
    a.push({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"trizol"}' } }] } }] });
    a.push({ choices: [{ delta: {}, finish_reason: 'tool_calls' }] });
    const f = a.finalize();
    expect(f.tool_calls).toHaveLength(1);
    expect(f.tool_calls[0].id).toBe('call_a');
    expect(f.tool_calls[0].function.name).toBe('searchProtocols');
    expect(JSON.parse(f.tool_calls[0].function.arguments)).toEqual({ query: 'trizol' });
    expect(f.stopReason).toBe('tool_calls');
  });

  it('captures usage from the final chunk', () => {
    const a = makeAssembler();
    a.push({ choices: [{ delta: { content: 'hi' } }] });
    a.push({ choices: [{ delta: {}, finish_reason: 'stop' }], usage: { prompt_tokens: 10, completion_tokens: 2 } });
    const f = a.finalize();
    expect(f.usage).toEqual({ input_tokens: 10, output_tokens: 2 });
  });
});

describe('makeDataLineParser', () => {
  it('parses data: lines split across chunks and ignores [DONE]', () => {
    const p = makeDataLineParser();
    const out = [];
    out.push(...p.feed('data: {"choices":[{"delta":{"content":"h'));
    out.push(...p.feed('i"}}]}\n\ndata: [DONE]\n\n'));
    expect(out).toEqual([{ choices: [{ delta: { content: 'hi' } }] }]);
  });

  it('ignores comment/heartbeat lines and CRLF', () => {
    const p = makeDataLineParser();
    const out = p.feed(': keep-alive\r\ndata: {"choices":[{"delta":{"content":"x"}}]}\r\n\r\n');
    expect(out).toEqual([{ choices: [{ delta: { content: 'x' } }] }]);
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

describe('createOpenAICompat callModel', () => {
  it('returns a finalized assistant message and streams deltas', async () => {
    const deltas = [];
    let capturedBody;
    const fetchImpl = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return fakeSSEResponse([
        'data: {"choices":[{"delta":{"content":"Found "}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"it."}}]}\n\n',
        'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\n',
        'data: [DONE]\n\n',
      ]);
    };
    const callModel = createOpenAICompat({
      baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-test', model: 'gpt-x',
      fetchImpl, onDelta: (t) => deltas.push(t),
    });
    const res = await callModel([{ role: 'user', content: 'hi' }], []);
    expect(res.content).toBe('Found it.');
    expect(deltas).toEqual(['Found ', 'it.']);
    expect(capturedBody.stream).toBe(true);
    expect(capturedBody.model).toBe('gpt-x');
  });

  it('redacts local tool results by default (non-local adapter)', async () => {
    let capturedBody;
    const fetchImpl = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return fakeSSEResponse(['data: [DONE]\n\n']);
    };
    const callModel = createOpenAICompat({ baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'k', model: 'm', fetchImpl });
    const messages = [
      { role: 'user', content: 'where is my trizol' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'queryInventory', arguments: '{}' } }] },
      { role: 'tool', tool_call_id: 'c1', name: 'queryInventory', content: JSON.stringify({ count: 1, results: [{ name: 'TRIzol', location: 'Freezer A shelf 2', qty: '3x50mL' }] }) },
    ];
    await callModel(messages, []);
    const toolMsg = capturedBody.messages.find((m) => m.role === 'tool');
    expect(toolMsg.content).not.toContain('Freezer A');
  });

  it('does not redact when disableRedaction is set (local lane)', async () => {
    let capturedBody;
    const fetchImpl = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return fakeSSEResponse(['data: [DONE]\n\n']);
    };
    const callModel = createOpenAICompat({ baseUrl: 'http://localhost:11434/v1', model: 'llama3', disableRedaction: true, fetchImpl });
    const messages = [
      { role: 'tool', tool_call_id: 'c1', name: 'queryInventory', content: JSON.stringify({ count: 1, results: [{ name: 'TRIzol', location: 'Freezer A shelf 2' }] }) },
    ];
    await callModel(messages, []);
    const toolMsg = capturedBody.messages.find((m) => m.role === 'tool');
    expect(toolMsg.content).toContain('Freezer A');
  });

  it('omits Authorization header when no apiKey (Ollama/LM Studio)', async () => {
    let capturedHeaders;
    const fetchImpl = async (url, init) => {
      capturedHeaders = init.headers;
      return fakeSSEResponse(['data: [DONE]\n\n']);
    };
    const callModel = createOpenAICompat({ baseUrl: 'http://localhost:11434/v1', model: 'llama3', fetchImpl });
    await callModel([{ role: 'user', content: 'hi' }], []);
    expect(capturedHeaders.Authorization).toBeUndefined();
  });

  it('throws with status + detail on a non-ok response', async () => {
    const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'invalid api key' } }) });
    const callModel = createOpenAICompat({ baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'bad', model: 'm', fetchImpl });
    await expect(callModel([{ role: 'user', content: 'x' }], [])).rejects.toMatchObject({ status: 401 });
  });
});
