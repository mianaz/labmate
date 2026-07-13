import { describe, it, expect, beforeAll, vi } from 'vitest';
import { sign, createHash, createPrivateKey, webcrypto } from 'node:crypto';

// Generate a throwaway ed25519 keypair and PIN it as the app's signing key, so we
// can exercise the real verifier end-to-end without the production private key.
const { TEST_PUBHEX, privateKeyPem } = vi.hoisted(() => {
  const { generateKeyPairSync } = require('node:crypto');
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const spki = publicKey.export({ type: 'spki', format: 'der' });
  return {
    TEST_PUBHEX: Buffer.from(spki.subarray(spki.length - 32)).toString('hex'),
    privateKeyPem: privateKey.export({ type: 'pkcs8', format: 'pem' }),
  };
});
vi.mock('./recipeSigningKey.js', () => ({ RECIPE_PUBKEY_HEX: TEST_PUBHEX }));

import { verifyRecipeManifest } from './recipeVerify.js';

beforeAll(() => {
  if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto; // ensure SHA-256 available
});

function signManifest(recipesBytes, over = {}) {
  const version = over.version ?? Date.now();
  const generatedAt = over.generatedAt ?? new Date().toISOString();
  const sha256 = over.sha256 ?? createHash('sha256').update(recipesBytes).digest('hex');
  const message = `labmate-recipes.v1\n${version}\n${generatedAt}\n${sha256}`;
  const sig = sign(null, Buffer.from(message, 'utf8'), createPrivateKey(privateKeyPem)).toString('base64');
  return { alg: 'ed25519', version, generatedAt, sha256, sig };
}

describe('verifyRecipeManifest', () => {
  const bytes = new TextEncoder().encode('[{"id":"p1"},{"id":"p2"}]');

  it('accepts a correctly signed manifest', async () => {
    const res = await verifyRecipeManifest(bytes, signManifest(bytes));
    expect(res.ok).toBe(true);
    expect(typeof res.version).toBe('number');
  });

  it('rejects a tampered payload (hash mismatch)', async () => {
    const m = signManifest(bytes);
    const res = await verifyRecipeManifest(new TextEncoder().encode('[{"id":"EVIL"}]'), m);
    expect(res).toEqual({ ok: false, reason: 'hash_mismatch' });
  });

  it('rejects a tampered signature', async () => {
    const m = signManifest(bytes);
    m.sig = Buffer.from('x'.repeat(64)).toString('base64'); // wrong-length/garbage sig
    const res = await verifyRecipeManifest(bytes, m);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('bad_signature');
  });

  it('rejects a manifest whose signed sha256 does not match the bytes even if self-consistent', async () => {
    // Attacker swaps recipes AND recomputes sha256, but can't re-sign → signature fails.
    const evil = new TextEncoder().encode('[{"id":"EVIL"}]');
    const m = signManifest(bytes); // signed over the good bytes' hash
    m.sha256 = createHash('sha256').update(evil).digest('hex'); // now points at evil hash
    const res = await verifyRecipeManifest(evil, m);
    // hash matches evil, but the signed message no longer matches sha256 → bad_signature
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('bad_signature');
  });

  it('rejects a malformed manifest', async () => {
    expect((await verifyRecipeManifest(bytes, null)).reason).toBe('bad_manifest');
    expect((await verifyRecipeManifest(bytes, { alg: 'rsa', sig: 'x', sha256: 'y', version: 1, generatedAt: 'z' })).reason).toBe('bad_manifest');
    expect((await verifyRecipeManifest(bytes, { alg: 'ed25519', sig: 'x', sha256: 'y', version: 'notnum', generatedAt: 'z' })).reason).toBe('bad_manifest');
  });
});
