// ═══════════════════════════════════════════════
// Inventory — Reusable small components (JSX)
// ═══════════════════════════════════════════════
import React from 'react';
import { createPortal } from 'react-dom';
import { STORAGE_ICONS } from './inventoryUtils.js';

// ── StorageIcon ──────────────────────────────────────────────────────────────

export function StorageIcon({ type, size = 16 }) {
  const d = STORAGE_ICONS[type] || STORAGE_ICONS.shelf;
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={2}
      strokeLinecap="round" strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  );
}

// ── InvModal ─────────────────────────────────────────────────────────────────

export function InvModal({ open, onClose, title, children }) {
  if (!open) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.4)' }}
      />
      <div
        className="relative w-full max-w-md p-6"
        style={{
          background: 'var(--card)',
          border: '2px solid var(--border-strong)',
          boxShadow: 'var(--shadow-lg)',
          maxHeight: '85vh',
          overflowY: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h3
          className="text-lg font-semibold mb-4"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}
        >
          {title}
        </h3>
        {children}
      </div>
    </div>,
    document.body
  );
}

// ── InvInput ─────────────────────────────────────────────────────────────────

export function InvInput({ label, value, onChange, type = 'text', placeholder = '' }) {
  return (
    <div className="mb-3">
      <label
        className="block text-xs font-medium mb-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value || ''}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          outline: 'none',
        }}
      />
    </div>
  );
}

// ── InvSelect ────────────────────────────────────────────────────────────────

export function InvSelect({ label, value, onChange, options }) {
  return (
    <div className="mb-3">
      <label
        className="block text-xs font-medium mb-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          outline: 'none',
        }}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

// ── InvTextarea ──────────────────────────────────────────────────────────────

export function InvTextarea({ label, value, onChange, rows = 3 }) {
  return (
    <div className="mb-3">
      <label
        className="block text-xs font-medium mb-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </label>
      <textarea
        value={value || ''}
        rows={rows}
        onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-lg text-sm"
        style={{
          background: 'var(--bg-2)',
          border: '1px solid var(--border)',
          color: 'var(--text)',
          outline: 'none',
          resize: 'vertical',
        }}
      />
    </div>
  );
}
