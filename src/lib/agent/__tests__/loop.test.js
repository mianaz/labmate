import { describe, it, expect, vi } from 'vitest';
import recipes from '../../../../recipes.json';
import { runAgentTurn } from '../loop.js';

function makeCtx() {
  const store = new Map();
  return {
    recipes,
    lang: 'en',
    async loadInventory() { return { locations: [], boxes: [], samples: [] }; },
    async saveExperiment(entry) { const id = entry.id || `exp_${store.size + 1}`; const r = { ...entry, id }; store.set(id, r); return r; },
    async getExperiment(id) { return store.get(id); },
    download() {},
    _store: store,
  };
}

// A fake model driven by a scripted queue of assistant messages.
function scriptedModel(script) {
  const calls = [];
  const fn = vi.fn(async (messages, tools) => {
    calls.push({ messages: messages.length, tools: tools.length });
    return script.shift() ?? { content: 'done' };
  });
  fn.calls = calls;
  return fn;
}

const toolCall = (id, name, args) => ({
  content: '', tool_calls: [{ id, function: { name, arguments: JSON.stringify(args) } }],
});

describe('runAgentTurn — read flow', () => {
  it('executes a tool call then returns final text', async () => {
    const callModel = scriptedModel([
      toolCall('c1', 'searchProtocols', { query: 'trizol' }),
      { content: 'Found TRIzol RNA Extraction.' },
    ]);
    const events = [];
    const res = await runAgentTurn({
      messages: [{ role: 'user', content: 'find trizol' }],
      callModel, ctx: makeCtx(), onEvent: (e) => events.push(e.type),
    });
    expect(res.finalText).toBe('Found TRIzol RNA Extraction.');
    expect(res.stopReason).toBe('end_turn');
    expect(callModel).toHaveBeenCalledTimes(2);
    // a tool result message was fed back to the model
    expect(res.messages.some((m) => m.role === 'tool' && m.name === 'searchProtocols')).toBe(true);
    expect(events).toContain('tool_result');
  });
});

describe('runAgentTurn — write permission gate', () => {
  const script = () => [
    toolCall('w1', 'createExperiment', { title: 'X', protocolRef: 'trizol_extraction', steps: ['a'] }),
    { content: 'created' },
  ];

  it('executes the write when permission is granted once', async () => {
    const ctx = makeCtx();
    const requestPermission = vi.fn(async () => 'once');
    const res = await runAgentTurn({
      messages: [{ role: 'user', content: 'plan it' }],
      callModel: scriptedModel(script()), ctx, requestPermission,
    });
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(ctx._store.size).toBe(1);
    expect(res.finalText).toBe('created');
  });

  it('blocks the write and feeds back permission_denied when denied', async () => {
    const ctx = makeCtx();
    const res = await runAgentTurn({
      messages: [{ role: 'user', content: 'plan it' }],
      callModel: scriptedModel(script()), ctx, requestPermission: async () => 'deny',
    });
    expect(ctx._store.size).toBe(0);
    const toolMsg = res.messages.find((m) => m.role === 'tool' && m.name === 'createExperiment');
    expect(JSON.parse(toolMsg.content).error).toBe('permission_denied');
  });

  it('remembers the grant via onPermissionChange', async () => {
    const onPermissionChange = vi.fn();
    await runAgentTurn({
      messages: [{ role: 'user', content: 'plan it' }],
      callModel: scriptedModel(script()), ctx: makeCtx(),
      requestPermission: async () => 'remember', onPermissionChange,
    });
    expect(onPermissionChange).toHaveBeenCalledWith('createExperiment', 'auto');
  });

  it('auto permission skips the prompt', async () => {
    const requestPermission = vi.fn();
    const ctx = makeCtx();
    await runAgentTurn({
      messages: [{ role: 'user', content: 'plan it' }],
      callModel: scriptedModel(script()), ctx,
      permissions: { createExperiment: 'auto' }, requestPermission,
    });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(ctx._store.size).toBe(1);
  });

  it('off permission blocks without prompting', async () => {
    const requestPermission = vi.fn();
    const ctx = makeCtx();
    await runAgentTurn({
      messages: [{ role: 'user', content: 'plan it' }],
      callModel: scriptedModel(script()), ctx,
      permissions: { createExperiment: 'off' }, requestPermission,
    });
    expect(requestPermission).not.toHaveBeenCalled();
    expect(ctx._store.size).toBe(0);
  });
});

describe('runAgentTurn — safety rails', () => {
  it('stops at maxSteps when the model never stops calling tools', async () => {
    // model always asks for another tool call
    const callModel = vi.fn(async () => toolCall('loop', 'searchProtocols', { query: 'x' }));
    const res = await runAgentTurn({
      messages: [{ role: 'user', content: 'go' }], callModel, ctx: makeCtx(), maxSteps: 3,
    });
    expect(res.steps).toBe(3);
    expect(res.stopReason).toBe('max_steps');
  });
});

describe('runAgentTurn — abort (Stop button)', () => {
  it('halts cleanly with stopReason "aborted" when the model call is aborted', async () => {
    const controller = new AbortController();
    const callModel = vi.fn(async () => {
      controller.abort();
      const e = new Error('aborted'); e.name = 'AbortError'; throw e;
    });
    const res = await runAgentTurn({
      messages: [{ role: 'user', content: 'go' }], callModel, ctx: makeCtx(),
      signal: controller.signal,
    });
    expect(res.stopReason).toBe('aborted');
    // History stays well-formed: no dangling assistant/tool messages were appended.
    expect(res.messages).toHaveLength(1);
    expect(res.messages[0].role).toBe('user');
  });

  it('never starts a turn when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    const callModel = vi.fn(async () => ({ content: 'should not run' }));
    const res = await runAgentTurn({
      messages: [{ role: 'user', content: 'go' }], callModel, ctx: makeCtx(),
      signal: controller.signal,
    });
    expect(callModel).not.toHaveBeenCalled();
    expect(res.stopReason).toBe('aborted');
  });

  it('re-throws non-abort errors instead of swallowing them', async () => {
    const callModel = vi.fn(async () => { throw new Error('network down'); });
    await expect(runAgentTurn({
      messages: [{ role: 'user', content: 'go' }], callModel, ctx: makeCtx(),
    })).rejects.toThrow('network down');
  });
});
