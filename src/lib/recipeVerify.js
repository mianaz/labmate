// Fail-closed verifier for the remote recipe library.
// ────────────────────────────────────────────────────
// The recipes repo publishes dist/recipes.json + dist/manifest.json, where the
// manifest is an ed25519 detached signature over a domain-tagged message that
// binds the version, timestamp, and SHA-256 of the RAW recipe bytes:
//
//     labmate-recipes.v1\n<version>\n<generatedAt>\n<sha256hex>
//
// We recompute that message from the manifest, verify the signature against the
// pinned public key, and independently check that SHA-256 of the fetched bytes
// matches the signed sha256. Any deviation → not ok. The caller must fall back
// to the trusted same-origin bundled library. See RecipeProvider.refresh().

import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha512';
import { RECIPE_PUBKEY_HEX } from './recipeSigningKey.js';

// @noble/ed25519 v2 needs a sha512 implementation wired for synchronous verify.
ed.etc.sha512Sync = (...m) => sha512(ed.etc.concatBytes(...m));

const DOMAIN = 'labmate-recipes.v1';

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex) {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
  return out;
}

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

// recipesBytes: Uint8Array of the raw recipes.json payload.
// manifest: the parsed dist/manifest.json object.
// Returns { ok: true, version } or { ok: false, reason }.
export async function verifyRecipeManifest(recipesBytes, manifest) {
  if (!manifest || manifest.alg !== 'ed25519' || typeof manifest.sig !== 'string' ||
      typeof manifest.sha256 !== 'string' || typeof manifest.version !== 'number' ||
      typeof manifest.generatedAt !== 'string') {
    return { ok: false, reason: 'bad_manifest' };
  }
  // Independent payload-integrity check (defends against a body swap under a
  // replayed manifest — the sha256 is itself inside the signed message).
  const digestHex = await sha256Hex(recipesBytes);
  if (digestHex !== manifest.sha256) return { ok: false, reason: 'hash_mismatch' };

  const message = `${DOMAIN}\n${manifest.version}\n${manifest.generatedAt}\n${manifest.sha256}`;
  let sigOk = false;
  try {
    sigOk = ed.verify(base64ToBytes(manifest.sig), new TextEncoder().encode(message), hexToBytes(RECIPE_PUBKEY_HEX));
  } catch {
    sigOk = false;
  }
  if (!sigOk) return { ok: false, reason: 'bad_signature' };
  return { ok: true, version: manifest.version };
}
