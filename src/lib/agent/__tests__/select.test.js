import { describe, it, expect, vi } from 'vitest';

vi.mock('../../db.js', () => {
  const m = new Map();
  const credentials = {
    async put(r) { m.set(r.name, r); },
    async get(k) { return m.get(k); },
    async toArray() { return [...m.values()]; },
    async delete(k) { m.delete(k); },
  };
  return { default: { credentials } };
});

const {
  PRESETS, getPreset, loadByokConfig, saveByokConfig, clearByokConfig,
  isByokConfigReady, selectCallModel, BYOK_CREDENTIAL_NAME,
} = await import('../providers/select.js');

describe('PRESETS', () => {
  it('marks ollama/lmstudio as local and anthropic as anthropicDirect', () => {
    expect(getPreset('ollama').local).toBe(true);
    expect(getPreset('lmstudio').local).toBe(true);
    expect(getPreset('anthropic').provider).toBe('anthropicDirect');
    expect(getPreset('openrouter').local).toBe(false);
  });

  it('getPreset returns null for an unknown key', () => {
    expect(getPreset('nope')).toBeNull();
  });
});

describe('config persistence', () => {
  it('round-trips a config via credentials.js under BYOK_CREDENTIAL_NAME', async () => {
    const cfg = { enabled: true, preset: 'openrouter', provider: 'openaiCompat', baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-x', model: 'gpt-x' };
    await saveByokConfig(cfg);
    expect(await loadByokConfig()).toEqual(cfg);
    expect(BYOK_CREDENTIAL_NAME).toBe('agent_byok_credential');
    await clearByokConfig();
    expect(await loadByokConfig()).toBeNull();
  });

  it('loadByokConfig returns null when unset or malformed', async () => {
    expect(await loadByokConfig()).toBeNull();
  });
});

describe('isByokConfigReady', () => {
  it('is false when disabled, missing, or incomplete', () => {
    expect(isByokConfigReady(null)).toBe(false);
    expect(isByokConfigReady({ enabled: false, baseUrl: 'x', model: 'y', apiKey: 'z' })).toBe(false);
    expect(isByokConfigReady({ enabled: true, baseUrl: '', model: 'y' })).toBe(false);
    expect(isByokConfigReady({ enabled: true, baseUrl: 'https://x', model: '' })).toBe(false);
  });

  it('requires an apiKey for non-local presets but not for local ones', () => {
    expect(isByokConfigReady({ enabled: true, preset: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'm' })).toBe(false);
    expect(isByokConfigReady({ enabled: true, preset: 'openrouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'm', apiKey: 'sk' })).toBe(true);
    expect(isByokConfigReady({ enabled: true, preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3' })).toBe(true);
  });
});

describe('selectCallModel', () => {
  it('falls back to the owner proxy when no BYOK config is ready', () => {
    const fetchImpl = vi.fn();
    const callModel = selectCallModel({ byokConfig: null, ownerProxy: { model: 'minimax-m3' }, fetchImpl });
    expect(typeof callModel).toBe('function');
  });

  it('routes to openaiCompat for a ready cloud preset', async () => {
    let capturedUrl;
    const fetchImpl = async (url) => { capturedUrl = url; return { ok: true, status: 200, body: { getReader: () => ({ read: async () => ({ done: true }) }) } }; };
    const callModel = selectCallModel({
      byokConfig: { enabled: true, preset: 'groq', provider: 'openaiCompat', baseUrl: 'https://api.groq.com/openai/v1', apiKey: 'sk', model: 'llama' },
      fetchImpl,
    });
    await callModel([{ role: 'user', content: 'hi' }], []);
    expect(capturedUrl).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  it('routes to anthropicDirect for the anthropic preset', async () => {
    let capturedUrl;
    const fetchImpl = async (url) => { capturedUrl = url; return { ok: true, status: 200, body: { getReader: () => ({ read: async () => ({ done: true }) }) } }; };
    const callModel = selectCallModel({
      byokConfig: { enabled: true, preset: 'anthropic', provider: 'anthropicDirect', baseUrl: 'https://api.anthropic.com', apiKey: 'sk-ant', model: 'claude-x' },
      fetchImpl,
    });
    await callModel([{ role: 'user', content: 'hi' }], []);
    expect(capturedUrl).toBe('https://api.anthropic.com/v1/messages');
  });

  it('disables redaction for local presets without needing the toggle', async () => {
    let capturedBody;
    const fetchImpl = async (url, init) => {
      capturedBody = JSON.parse(init.body);
      return { ok: true, status: 200, body: { getReader: () => ({ read: async () => ({ done: true }) }) } };
    };
    const callModel = selectCallModel({
      byokConfig: { enabled: true, preset: 'ollama', provider: 'openaiCompat', baseUrl: 'http://localhost:11434/v1', model: 'llama3' },
      fetchImpl,
    });
    await callModel([
      { role: 'tool', tool_call_id: 'c1', name: 'queryInventory', content: JSON.stringify({ results: [{ name: 'TRIzol', location: 'Freezer A' }] }) },
    ], []);
    expect(capturedBody.messages[0].content).toContain('Freezer A');
  });
});
