/**
 * Web Crypto API utilities for local-first encrypted storage.
 * 
 * 二选一原则 (Either-Or Principle):
 * Data is either LOCAL (unencrypted in IndexedDB) or SYNCED (encrypted before upload).
 * Never store raw data on remote servers.
 */

const ALGO = 'AES-GCM'
const KEY_LENGTH = 256
const IV_LENGTH = 12

/** Derive an AES-256-GCM key from a user passphrase */
export async function deriveKey(
  passphrase: string,
  salt: Uint8Array,
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: 600_000, hash: 'SHA-256' },
    keyMaterial,
    { name: ALGO, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypt a string → base64 blob (iv + ciphertext) */
export async function encrypt(
  plaintext: string,
  key: CryptoKey,
): Promise<string> {
  const enc = new TextEncoder()
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const ciphertext = await crypto.subtle.encrypt(
    { name: ALGO, iv: iv as BufferSource },
    key,
    enc.encode(plaintext) as BufferSource,
  )
  // Prepend IV to ciphertext
  const combined = new Uint8Array(iv.length + new Uint8Array(ciphertext).length)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

/** Decrypt a base64 blob (iv + ciphertext) → string */
export async function decrypt(
  blob: string,
  key: CryptoKey,
): Promise<string> {
  const raw = Uint8Array.from(atob(blob), c => c.charCodeAt(0))
  const iv = raw.slice(0, IV_LENGTH)
  const ciphertext = raw.slice(IV_LENGTH)
  const plaintext = await crypto.subtle.decrypt(
    { name: ALGO, iv: iv as BufferSource },
    key,
    ciphertext as BufferSource,
  )
  return new TextDecoder().decode(plaintext)
}

/** Generate a random salt for key derivation */
export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(16))
}
