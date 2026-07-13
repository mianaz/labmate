import { describe, it, expect, vi } from 'vitest';

vi.mock('../db.js', () => {
  const m = new Map();
  const credentials = {
    async put(r) { m.set(r.name, r); },
    async get(k) { return m.get(k); },
    async toArray() { return [...m.values()]; },
    async delete(k) { m.delete(k); },
  };
  return { default: { credentials } };
});

const { setCredential, getCredential, deleteCredential, listCredentialNames } = await import('../credentials.js');

describe('credential store', () => {
  it('round-trips a secret, lists names only, and deletes', async () => {
    await setCredential('openrouter', 'sk-123');
    expect(await getCredential('openrouter')).toBe('sk-123');
    expect(await listCredentialNames()).toEqual(['openrouter']);
    await deleteCredential('openrouter');
    expect(await getCredential('openrouter')).toBeNull();
  });

  it('missing credential reads back as null', async () => {
    expect(await getCredential('nope')).toBeNull();
  });
});
