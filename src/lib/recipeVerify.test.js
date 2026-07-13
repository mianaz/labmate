import { describe, it, expect, beforeAll, vi } from 'vitest';
import { sign, createHash, createPrivateKey, webcrypto } from 'node:crypto';

// A STATIC, test-only ed25519 keypair (protects nothing) pinned as the app's
// signing key, so we can exercise the real verifier end-to-end without the
// production private key. Kept as literals to stay ESM/lint-clean.
const TEST_PUBHEX = '629a8576ed72f2bfd0c632cd198232c8afcc0a775409267a55ebaf345b9103ce';
const TEST_PRIV_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIBjUwxj1poTrwvzis+6e7ZEjNkAqAOlLN22CqWjZULLj
-----END PRIVATE KEY-----`;

vi.mock('./recipeSigningKey.js', () => ({ RECIPE_PUBKEY_HEX: '629a8576ed72f2bfd0c632cd198232c8afcc0a775409267a55ebaf345b9103ce' }));

import { verifyRecipeManifest } from './recipeVerify.js';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto; // ensure SHA-256 available
});

function bytesToB64(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}

function signManifest(recipesBytes, over = {}) {
  const version = over.version ?? Date.now();
  const generatedAt = over.generatedAt ?? new Date().toISOString();
  const sha256 = over.sha256 ?? createHash('sha256').update(recipesBytes).digest('hex');
  const message = `labmate-recipes.v1\n${version}\n${generatedAt}\n${sha256}`;
  const sig = new Uint8Array(sign(null, new TextEncoder().encode(message), createPrivateKey(TEST_PRIV_PEM)));
  return { alg: 'ed25519', version, generatedAt, sha256, sig: bytesToB64(sig) };
}

describe('verifyRecipeManifest', () => {
  const bytes = new TextEncoder().encode('[{"id":"p1"},{"id":"p2"}]');

  it('accepts a correctly signed manifest', async () => {
    const res = await verifyRecipeManifest(bytes, signManifest(bytes));
    expect(res.ok).toBe(true);
    expect(typeof res.version).toBe('number');
  });

  it('rejects a tampered payload (hash mismatch)', async () => {
    const res = await verifyRecipeManifest(new TextEncoder().encode('[{"id":"EVIL"}]'), signManifest(bytes));
    expect(res).toEqual({ ok: false, reason: 'hash_mismatch' });
  });

  it('rejects a tampered signature', async () => {
    const m = signManifest(bytes);
    m.sig = bytesToB64(new Uint8Array(64)); // all-zero, wrong signature
    const res = await verifyRecipeManifest(bytes, m);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('bad_signature');
  });

  it('rejects a body swap even when its self-reported sha256 matches (signature covers sha256)', async () => {
    const evil = new TextEncoder().encode('[{"id":"EVIL"}]');
    const m = signManifest(bytes);                                   // signed over the good hash
    m.sha256 = createHash('sha256').update(evil).digest('hex');      // repoint at evil hash
    const res = await verifyRecipeManifest(evil, m);                 // payload hash now matches sha256...
    expect(res.ok).toBe(false);                                      // ...but the signed message no longer does
    expect(res.reason).toBe('bad_signature');
  });

  it('rejects a malformed manifest', async () => {
    expect((await verifyRecipeManifest(bytes, null)).reason).toBe('bad_manifest');
    expect((await verifyRecipeManifest(bytes, { alg: 'rsa', sig: 'x', sha256: 'y', version: 1, generatedAt: 'z' })).reason).toBe('bad_manifest');
    expect((await verifyRecipeManifest(bytes, { alg: 'ed25519', sig: 'x', sha256: 'y', version: 'notnum', generatedAt: 'z' })).reason).toBe('bad_manifest');
  });
});
