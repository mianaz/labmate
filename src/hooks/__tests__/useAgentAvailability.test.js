import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('../../lib/agent/providers/select.js', () => ({
  loadByokConfig: vi.fn(),
  isByokConfigReady: vi.fn(),
}));

const { loadByokConfig, isByokConfigReady } = await import('../../lib/agent/providers/select.js');
const { useAgentAvailability } = await import('../useAgentAvailability.js');

describe('useAgentAvailability', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    loadByokConfig.mockResolvedValue(null);
    isByokConfigReady.mockReturnValue(false);
  });

  it('stays unavailable when neither owner-proxy nor BYOK is usable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useAgentAvailability());
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(result.current).toBe(false);
  });

  it('becomes available when the owner-proxy probe reports keyConfigured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ keyConfigured: true }) }));
    const { result } = renderHook(() => useAgentAvailability());
    await waitFor(() => expect(result.current).toBe(true));
  });

  it('becomes available when a ready BYOK config exists, even if the owner-proxy probe fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    loadByokConfig.mockResolvedValue({ enabled: true, preset: 'ollama', baseUrl: 'http://localhost:11434/v1', model: 'llama3' });
    isByokConfigReady.mockReturnValue(true);
    const { result } = renderHook(() => useAgentAvailability());
    await waitFor(() => expect(result.current).toBe(true));
  });
});
