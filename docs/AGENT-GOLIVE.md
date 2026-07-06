# LabMate Agent — go-live checklist

The Phase-1 agent **UI is merged and deployed**, but it is **dark by default**. The
launcher, the ⌘J shortcut, and the mobile "LabMate Agent" row only appear when the
backend proxy is live *and* keyed. Until then, production looks exactly as it did
before — no broken button.

## How the gate works

On load the app makes one cheap `GET /api/labmate/agent/models` call
(`src/hooks/useAgentAvailability.js`). The agent is revealed only when that returns
`200` with `keyConfigured: true`. A 404 / offline / `keyConfigured:false` keeps it
hidden. So once the backend is wired (below), **the feature turns itself on with no
frontend redeploy**.

Build-time override `VITE_AGENT_ENABLED`:

| value            | effect                                             |
|------------------|----------------------------------------------------|
| unset (default)  | probe the backend — safe production default        |
| `1` / `true`     | force ON (owner override / local preview/testing)  |
| `0` / `false`    | kill switch                                         |

## Enabling it (owner, ~15 min)

The backend proxy is **not** in this repo — it lives in the website backend
(`/var/www/bioinfospace.com/backend`) as three currently-**untracked** files that
must be reviewed + committed first:

- `src/routes/agent.js` — the SSE relay (rate limits, spend cap, token cap, BYOK accounting)
- `src/config/agentModels.js` — model allowlist + budget config
- `src/utils/agentRateStore.js` — Redis-backed counters

Steps:

1. **Add the key** to `backend/.env` (chmod 600, never commit):
   ```
   LABMATE_OPENROUTER_API_KEY=sk-or-...
   LABMATE_AGENT_MONTHLY_CAP_USD=8      # optional, default 8
   ```

2. **Register the route** in the backend server entrypoint:
   ```js
   import agentRoutes from './routes/agent.js';
   app.use('/api/labmate/agent', agentRoutes);
   // and skip morgan body logging for this path (chat content is private)
   ```

3. **Proxy it in nginx** on `apps.bioinfospace.com` (SSE needs buffering off), mirroring
   the existing `/wb-api/` block:
   ```nginx
   location /api/labmate/agent/ {
       proxy_pass http://127.0.0.1:3001/api/labmate/agent/;
       proxy_http_version 1.1;
       proxy_set_header Connection '';
       proxy_set_header Host $host;
       proxy_set_header X-Real-IP $remote_addr;
       proxy_buffering off;            # stream SSE deltas immediately
       proxy_read_timeout 300s;
       chunked_transfer_encoding off;
   }
   ```
   Then `sudo nginx -t && sudo systemctl reload nginx`.

4. **Restart the backend** to load the key + route:
   `sudo systemctl restart bioinfospace-api`

5. **OpenRouter dashboard**: set an $8 hard spend limit on the key; to use the prepaid
   MiniMax plan, add the MiniMax BYOK integration and allow the MiniMax first-party
   provider (otherwise the default routes to a third-party host billed to credits — see
   the ⚠ notes in `agentModels.js`).

6. **Verify** — `curl -s https://apps.bioinfospace.com/api/labmate/agent/models` should
   return `"keyConfigured": true`. Reload LabMate: the launcher appears bottom-right,
   stacked above the timer FAB. Send a message and confirm the stream renders.

## Guardrails already in place

- **Cost**: shared monthly cap (default $8) blocks cap-counting models with `402`; the
  default MiniMax model bypasses the cap when billed to its prepaid plan.
- **Abuse**: per-IP 30 req / 5 min, per-session/tier rate limits (20 rpm / 200 rpd
  default; 10 rpm / 40 rpd premium), and a 200k input-token/day/session ceiling.
- **Safety**: the agent only retrieves from the curated library and runs the app's
  deterministic calculators — it never authors protocol content or computes numbers
  (`src/lib/agent/prompt.js` red-lines; `tools.js` protocolRef validation).
- **Stop**: an in-flight turn can be aborted from the composer (Stop button) — the
  request is cancelled client-side and the turn halts cleanly.
