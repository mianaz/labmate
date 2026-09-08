import { describe, it, expect, vi } from 'vitest';
import { fetchByokModels, testByokConnection } from '../providers/byokProbe.js';

const jsonRes = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('fetchByokModels', () => {
  it('GETs {baseUrl}/models with a Bearer header and maps data[].id', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ data: [{ id: 'llama-3.3-70b' }, { id: 'qwen-2.5' }] }));
    const models = await fetchByokModels({
      baseUrl: 'https://api.groq.com/openai/v1/', apiKey: 'gsk_test', fetchImpl,
    });
    expect(models).toEqual(['llama-3.3-70b', 'qwen-2.5']);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/models'); // trailing slash collapsed
    expect(opts.headers.Authorization).toBe('Bearer gsk_test');
  });

  it('omits the Authorization header when there is no key (local endpoints)', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ data: [{ id: 'llama3' }] }));
    await fetchByokModels({ baseUrl: 'http://localhost:11434/v1', fetchImpl });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it('uses /v1/models and Anthropic headers for anthropicDirect', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ data: [{ id: 'claude-sonnet-5' }] }));
    const models = await fetchByokModels({
      baseUrl: 'https://api.anthropic.com', apiKey: 'sk-ant-x', provider: 'anthropicDirect', fetchImpl,
    });
    expect(models).toEqual(['claude-sonnet-5']);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/models');
    expect(opts.headers['x-api-key']).toBe('sk-ant-x');
    expect(opts.headers['anthropic-version']).toBeTruthy();
    expect(opts.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    expect(opts.headers.Authorization).toBeUndefined();
  });

  it('tolerates a {models:[{name}]} shape (some local servers)', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ models: [{ name: 'mistral' }] }));
    expect(await fetchByokModels({ baseUrl: 'http://localhost:1234/v1', fetchImpl })).toEqual(['mistral']);
  });

  it('throws with .status on a non-2xx response', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ error: 'bad key' }, 401));
    await expect(fetchByokModels({ baseUrl: 'https://x.test/v1', apiKey: 'k', fetchImpl }))
      .rejects.toMatchObject({ status: 401 });
  });
});

describe('testByokConnection', () => {
  it('POSTs a 1-token chat/completions probe and reports ok', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ choices: [] }));
    const r = await testByokConnection({
      baseUrl: 'https://openrouter.ai/api/v1', apiKey: 'sk-or', model: 'meta-llama/llama-3.3-70b', fetchImpl,
    });
    expect(r.ok).toBe(true);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const body = JSON.parse(opts.body);
    expect(body).toMatchObject({ model: 'meta-llama/llama-3.3-70b', max_tokens: 1, stream: false });
  });

  it('POSTs /v1/messages for anthropicDirect', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ content: [] }));
    const r = await testByokConnection({
      baseUrl: 'https://api.anthropic.com', apiKey: 'sk-ant', model: 'claude-sonnet-5',
      provider: 'anthropicDirect', fetchImpl,
    });
    expect(r.ok).toBe(true);
    const [url, opts] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(JSON.parse(opts.body).max_tokens).toBe(1);
    expect(opts.headers['x-api-key']).toBe('sk-ant');
  });

  it('returns ok:false with status + provider message on an HTTP error', async () => {
    const fetchImpl = vi.fn(async () => jsonRes({ error: { message: 'invalid api key' } }, 401));
    const r = await testByokConnection({ baseUrl: 'https://x.test/v1', apiKey: 'bad', model: 'm', fetchImpl });
    expect(r).toEqual({ ok: false, status: 401, message: 'invalid api key' });
  });

  it('returns ok:false with the thrown message on a network failure', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('Failed to fetch'); });
    const r = await testByokConnection({ baseUrl: 'http://localhost:11434/v1', model: 'llama3', fetchImpl });
    expect(r.ok).toBe(false);
    expect(r.message).toBe('Failed to fetch');
    expect(r.status).toBeUndefined();
  });
});
