// CloudBackupCard — Cloud backup via GitHub Gist (encrypted sync)
import React from 'react';
import { t } from '../../i18n/index.js';
import { S_MUTED } from '../../lib/styleConstants.js';
import db from '../../lib/db.js';

// ═══════════════════════════════════════════════
// CRYPTO HELPERS — Gist encrypted sync
// ═══════════════════════════════════════════════

const _gistCryptoSalt = new TextEncoder().encode('labmate-gist-v1');

export async function _gistDeriveKey(passphrase) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: _gistCryptoSalt, iterations: 310000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function _gistEncrypt(plaintext, passphrase) {
  const key = await _gistDeriveKey(passphrase);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext));
  const buf = new Uint8Array(iv.length + ct.byteLength);
  buf.set(iv, 0);
  buf.set(new Uint8Array(ct), iv.length);
  return btoa(String.fromCharCode(...buf));
}

export async function _gistDecrypt(base64, passphrase) {
  const raw = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const iv = raw.slice(0, 12);
  const ct = raw.slice(12);
  const key = await _gistDeriveKey(passphrase);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return new TextDecoder().decode(pt);
}

// ═══════════════════════════════════════════════
// DATA COLLECTOR
// ═══════════════════════════════════════════════

export function _gistCollectData() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('labmate_') || key.startsWith('biolab_') || key.startsWith('stepProgress_') || ['favs', 'lang', 'theme'].includes(key)) {
      try { data[key] = JSON.parse(localStorage.getItem(key)); }
      catch { data[key] = localStorage.getItem(key); }
    }
  }
  return JSON.stringify({ exportedAt: new Date().toISOString(), appVersion: 'v0.1.0', data });
}

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════

function CloudBackupCard({ lang }) {
  // Cloud sync infrastructure kept — UI replaced with coming-soon placeholder
  return (
    <div className="card p-5 mt-4" style={{background:'var(--bg-2)', borderLeft:'3px solid var(--primary)'}}>
      <div className="flex items-start gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>
        <div>
          <h3 className="text-sm font-bold mb-1">{t('cloudBackup', lang)}</h3>
          <p className="text-xs leading-relaxed" style={S_MUTED}>{lang === 'zh' ? '通过 Google Drive / GitHub OAuth 云同步 — 即将推出' : 'Cloud sync via Google Drive / GitHub OAuth — coming soon'}</p>
        </div>
      </div>
    </div>
  );
}

export default CloudBackupCard;
