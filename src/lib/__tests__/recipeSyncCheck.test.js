import { describe, it, expect } from 'vitest';
import { checkPublishedLibrary } from '../recipeSyncCheck.js';

const enc = (v) => new TextEncoder().encode(JSON.stringify(v));
async function sha(bytes) {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const ok = async () => ({ ok: true, version: 7 });

describe('checkPublishedLibrary (what the app’s Refresh would do)', () => {
  it('accepts a published library that contains every bundled recipe', async () => {
    const bundle = enc([{ id: 'a' }, { id: 'b' }]);
    const remote = enc([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    const res = await checkPublishedLibrary({ bundleBytes: bundle, remoteBytes: remote, manifest: { sha256: await sha(remote) }, verify: ok });
    expect(res).toMatchObject({ ok: true, version: 7, missing: [], added: ['c'], identical: false });
  });

  it('says when the bundle is byte-for-byte the published library', async () => {
    const bytes = enc([{ id: 'a' }]);
    const res = await checkPublishedLibrary({ bundleBytes: bytes, remoteBytes: bytes, manifest: { sha256: await sha(bytes) }, verify: ok });
    expect(res).toMatchObject({ ok: true, identical: true, added: [] });
  });

  it('fails when the bundle has recipes the published library lacks (the drift that broke sync)', async () => {
    const res = await checkPublishedLibrary({
      bundleBytes: enc([{ id: 'a' }, { id: 'new_in_app_only' }]), remoteBytes: enc([{ id: 'a' }]), manifest: { sha256: 'x' }, verify: ok,
    });
    expect(res).toMatchObject({ ok: false, reason: 'behind', missing: ['new_in_app_only'] });
  });

  it('fails when the published library does not verify', async () => {
    const res = await checkPublishedLibrary({
      bundleBytes: enc([]), remoteBytes: enc([]), manifest: {}, verify: async () => ({ ok: false, reason: 'bad_signature' }),
    });
    expect(res).toMatchObject({ ok: false, reason: 'unverified', detail: 'bad_signature' });
  });

  it('fails on a payload that is not a recipe list', async () => {
    const res = await checkPublishedLibrary({ bundleBytes: enc([]), remoteBytes: enc({ not: 'a list' }), manifest: {}, verify: ok });
    expect(res).toMatchObject({ ok: false, reason: 'bad_payload' });
  });
});
