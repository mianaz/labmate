// ──────────────────────────────────────────────────────────────────────────────
// useAgentAvailability — decides whether to surface the LabMate agent at all.
// ──────────────────────────────────────────────────────────────────────────────
//
// The agent UI calls an owner-key backend proxy (POST /api/labmate/agent/chat).
// That proxy is deployed + keyed separately from this static app, so the frontend
// must not show a launcher that would only ever answer "Request failed". We probe
// the proxy's cheap GET /models once on mount and reveal the agent ONLY when the
// backend is live AND has a key configured.
//
// Build-time override VITE_AGENT_ENABLED:
//   '1' / 'true'  → force ON  (owner knows the backend is up; also used for local
//                              preview/testing without a backend)
//   '0' / 'false' → force OFF (kill switch)
//   unset / other → probe the backend (the safe production default)
// ──────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';

export const AGENT_API_BASE = '/api/labmate/agent';

function readFlag() {
  const v = String(import.meta.env?.VITE_AGENT_ENABLED ?? '').toLowerCase().trim();
  if (v === '1' || v === 'true') return 'on';
  if (v === '0' || v === 'false') return 'off';
  return 'probe';
}

export function useAgentAvailability(apiBase = AGENT_API_BASE) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    const flag = readFlag();
    if (flag === 'on') { setAvailable(true); return; }
    if (flag === 'off') { setAvailable(false); return; }

    // Probe the backend. Aborts on unmount and after a short timeout so an
    // unreachable proxy (offline PWA, unconfigured server) fails fast and quiet.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    let alive = true;

    (async () => {
      try {
        const res = await fetch(`${apiBase}/models`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (alive && data && data.keyConfigured) setAvailable(true);
      } catch {
        /* 404 / offline / not configured → stay hidden */
      } finally {
        clearTimeout(timer);
      }
    })();

    return () => { alive = false; clearTimeout(timer); controller.abort(); };
  }, [apiBase]);

  return available;
}
