# LabMate Agent — Implementation Plan

> Status: design, ready-to-execute. Owner decisions in `## 0` are LOCKED — build around them, do not relitigate.
> Grounded against the real codebase as of 2026-07-05. Every tool below names the exact existing function it wraps; anything new is flagged **[NEW]**.

---

## 0. Locked owner decisions (recap)

1. **Two key modes.** DEFAULT = owner key via server-side proxy (Bioinfospace API :3001, systemd `bioinfospace-api.service`, nginx rate-limit zones, Redis on `localhost:6379`) with strict per-session/IP limits, cheap/free model allowlist, hard monthly spend cap (<$10/mo budget). **BYOK** = user key, client-side only, browser→provider direct, never touches our server. Optional **local LLM** (Ollama / LM Studio on localhost).
2. **Trust model (Biomni-style):** open-source client; in BYOK mode the key is never proxied and calls are visible in the browser Network tab.
3. **Agent behavior:** a chatbox that clarifies → retrieves from the curated recipe library → generates an editable/downloadable protocol → schedules experiments in the calendar → auto-pulls reagent locations from inventory → later runs a deterministic one-click analysis on uploaded raw data.
4. **HARD RED LINE — bio content is retrieval-only.** The LLM NEVER invents biology/protocols; it only retrieves from the curated library and orchestrates existing app functions. Numeric analysis (e.g. qPCR ΔΔCt) is done by a deterministic calculator, NOT the LLM.
5. **Tool-calling loop over EXISTING app functions.**
6. **Permissions:** agent may auto-write, user sets per-tool `auto | ask | off`; default `ask`.
7. **Web stays LIGHTWEIGHT.** Heavy features → Capacitor **APP** version (`origin/desktop` branch, already scaffolded: `capacitor.config.ts`, `android/`, `ios/`).
8. **Privacy copy stays HONEST.** Proxy mode transits our server (disclose; we don't log/store). BYOK = direct to provider. Local = fully on-device.

---

## 1. Overview & goals

LabMate is a client-only PWA (React 19 + Vite 6 + Tailwind v4 + Dexie/IndexedDB + react-router-dom v7). The agent adds a **conversational orchestration layer** on top of the tools the app already has — recipes, calculators, inventory, notebook, calendar — without changing the offline-first, local-data-only guarantee.

**Goals**
- G1. A chatbox that turns a natural-language intent ("3D culture, collect RNA at 24/48/72 h for qPCR — plan it") into: clarifying Qs → retrieved protocol(s) → an editable/downloadable protocol → scheduled calendar events → inventory-resolved reagent locations → later, a deterministic analysis of uploaded data.
- G2. Three key modes with honest privacy posture: **owner-proxy** (default), **BYOK**, **local**.
- G3. Zero fabricated biology. The model is a *router/retriever/orchestrator*, never a source of protocol facts or numbers.
- G4. Stay inside the <$10/mo budget via allowlist + Redis rate limits + monthly spend cap.
- G5. Preserve offline-first: agent degrades gracefully with no network (local tools still run; only LLM turn is unavailable unless local LLM is configured).

**Non-goals (web):** local-LLM bundling, heavy on-device analysis, filesystem auto-backup, OS-keychain storage — all deferred to the app (see §10).

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  LabMate PWA (browser, client-only)                                            │
│                                                                                │
│  ┌────────────────────────┐        ┌──────────────────────────────────────┐   │
│  │  Chatbox UI            │        │  Agent loop (src/lib/agent/loop.js)   │   │
│  │  AgentPanel.jsx        │◄──────►│  - build system prompt + grounding    │   │
│  │  (slide-over drawer)   │  msgs  │  - call LLM (adapter)                 │   │
│  │  states: idle/clarify/ │        │  - parse tool_calls                   │   │
│  │  planning/executing/   │        │  - permission gate (auto|ask|off)     │   │
│  │  awaiting-permission   │        │  - execute tool → feed result back    │   │
│  └────────────────────────┘        │  - loop until no tool_calls / done    │   │
│             ▲                       └───────────────┬──────────────────────┘   │
│             │                                       │                          │
│             │                        ┌──────────────┴───────────────┐          │
│             │                        │  Provider adapter (chosen mode)│         │
│             │                        └───┬───────────┬───────────┬───┘          │
│             │                            │           │           │              │
│   ┌─────────┴─────────┐        (A) owner │   (B) BYOK│   (C) local│             │
│   │ AgentToolsContext │                  │           │           │              │
│   │ execute(tool,args)│                  ▼           ▼           ▼              │
│   └─────────┬─────────┘        ┌──────────────┐  browser→   browser→           │
│             │                   │ our proxy    │  provider   localhost          │
│             ▼                   │ /api/labmate/│  (Anthropic/ (Ollama /         │
│  ┌────────────────────────┐    │  agent/chat  │  OpenAI/     LM Studio)         │
│  │  Tool layer            │    │  :3001       │  DeepSeek)   :11434/:1234       │
│  │  src/lib/agent/tools.js│    └──────┬───────┘                                 │
│  │  searchProtocols       │           │  (owner key + Redis rate-limit          │
│  │  getProtocol           │           │   + model allowlist + $ cap)            │
│  │  queryInventory        │           ▼                                         │
│  │  runCalculator         │     ANTHROPIC_API_KEY / DEEPSEEK_API_KEY (env)      │
│  │  createExperiment      │                                                     │
│  │  scheduleCalendarEvent │                                                     │
│  │  exportProtocol        │                                                     │
│  │  analyzeData           │                                                     │
│  └───────────┬────────────┘                                                     │
│              ▼                                                                  │
│  ┌────────────────────────────────────────────────────────────────────────┐   │
│  │  Existing app data layer                                                 │   │
│  │  • RecipeProvider (recipes.json + GitHub)  useRecipes()                  │   │
│  │  • Dexie 'labmate' (src/lib/db.js): settings, customRecipes,             │   │
│  │    customProtocols, inventory, favorites, stepProgress, experiments      │   │
│  │  • calculators.js (pure math)  • inventoryUtils.js  • backup.js          │   │
│  └────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Key architectural choice:** the tool layer runs **entirely client-side** in all three modes. The proxy is a *dumb, stateless relay* for the LLM turn only — it never executes tools, never sees IndexedDB, never touches user lab data. This keeps BYOK's trust story clean (identical tool code path) and keeps the proxy's attack surface to "chat completions with an allowlist."

---

## 3. Tool schema

Tools are defined once in **`src/lib/agent/tools.js` [NEW]** as `{ schema, handler }` pairs. `schema` is the JSON function-calling definition sent to the LLM; `handler(args, ctx)` is an async fn that calls the real app function. `ctx` is supplied by **`AgentToolsContext` [NEW]** (a provider mounted in `App.jsx` that closes over the live hooks: `useRecipes()`, `useExperiments()`, toast, lang). Write tools return a `{ preview }` for the permission dialog before committing.

Schemas below use the OpenAI/Anthropic-compatible `function` shape (adapters translate to Anthropic `input_schema` — same JSON Schema body).

### 3.1 `searchProtocols` (read) — **needs [NEW] pure fn**
Wraps: no existing search API. Add **`searchRecipes(recipes, query, opts)` [NEW]** in `src/lib/agent/retrieval.js`, modeled on the inline filter in `src/features/notebook/ProtocolSelector.jsx` (matches `name`, `nameCn`, `tags`) plus `discipline`/`category` facets from the recipe schema. Source data = `useRecipes().recipes` (already loaded from `recipes.json`; 215 entries; categories `buffer|media|staining|protocol`).
```json
{
  "name": "searchProtocols",
  "description": "Search the curated LabMate recipe/protocol library. Returns id, name, category, discipline, tags, and a one-line summary. This is the ONLY source of protocol content — you must not invent protocols.",
  "parameters": {
    "type": "object",
    "properties": {
      "query": { "type": "string", "description": "Keywords: technique, reagent, tags, or Chinese name." },
      "category": { "type": "string", "enum": ["protocol","buffer","media","staining","any"], "default": "any" },
      "discipline": { "type": "string", "description": "Optional facet, e.g. 'Molecular','Cell Biology'." },
      "limit": { "type": "integer", "default": 8 }
    },
    "required": ["query"]
  }
}
```

### 3.2 `getProtocol` (read)
Wraps: `useRecipes().recipeById[id]` (RecipeProvider builds this map). Returns full recipe incl. `components[]` (each `{name, note?:{en,zh}}` — for protocols these are the ordered steps), `prepSteps`, `notes`, `ref`, `usage`, `storage`, `relatedProtocols`, `materials?`. **Flag:** `NotebookTab`/`CalendarTab` currently read `recipe.briefSteps || recipe.detailedSteps` which do **not** exist in `recipes.json` (steps live in `components[].name`). The agent's `getProtocol` must normalize steps from `components`; also fix the two tabs to fall back to `components` (see §11 checklist).
```json
{
  "name": "getProtocol",
  "description": "Fetch one full protocol by id from the curated library, including ordered steps and reagents.",
  "parameters": { "type": "object",
    "properties": { "id": { "type": "string" } }, "required": ["id"] }
}
```

### 3.3 `queryInventory` (read) — **needs [NEW] pure fn**
Wraps: **`queryInventory(data, filters)` [NEW]** in `src/lib/agent/retrieval.js`, over the object returned by `loadInventoryAsync()` (`src/features/inventory/inventoryUtils.js`) which yields `{ locations, boxes, samples, nextId }`. Reuse the sample→box→location join already written in `invExportAllCsv`. Filter by name substring / `sampleType` (`VALID_SAMPLE_TYPES`) / tag. Returns matched samples with resolved `location`, `box`, `position`.
```json
{
  "name": "queryInventory",
  "description": "Look up reagents/samples in the user's local inventory and return their storage location (freezer/box/position). Never invents stock the user does not have.",
  "parameters": { "type": "object",
    "properties": {
      "name": { "type": "string" },
      "sampleType": { "type": "string", "enum": ["cell_line","plasmid","antibody","primer","protein","reagent","tissue","virus","other"] },
      "tag": { "type": "string" }
    } }
}
```

### 3.4 `runCalculator` (read/compute)
Wraps: the pure fns in `src/lib/calculators.js` — `dilution`, `massCalc`, `molarityCalc`, `percentCalc`, `deadVolume`, `unitConvert`, `temperatureConvert`, `calcGel`. Handler is a dispatch on `kind`. This is deterministic math — the LLM supplies inputs, the code computes.
```json
{
  "name": "runCalculator",
  "description": "Run a deterministic lab calculation. The model provides numeric inputs; the app computes the result. Use for dilutions, mass/molarity, percent solutions, dead volume, unit conversion, and SDS-PAGE gel recipes.",
  "parameters": { "type": "object",
    "properties": {
      "kind": { "type": "string", "enum": ["dilution","mass","molarity","percent","deadVolume","unitConvert","gel"] },
      "args": { "type": "object", "description": "Params for the chosen calculator, matching calculators.js signatures (e.g. dilution: {c1,v1,c2,v2,...,solveFor})." }
    }, "required": ["kind","args"] }
}
```

### 3.5 `createExperiment` (WRITE) — needs [NEW] imperative helper
Wraps: `createEmptyExperiment(date, startTime)` + persistence. **Flag:** `useExperiments().save()` is a React hook; the agent runs outside components. Add **`saveExperimentRecord(entry)` [NEW]** in `src/lib/experiments.js` = `await db.experiments.put({...entry, updatedAt: Date.now()})`, and have `AgentToolsContext` call the hook's `reload()` after each write so open Notebook/Calendar tabs refresh. Populates `plan`, `materials.reagents` (with `location` filled from a prior `queryInventory` result), `procedure.protocolSteps` (from `getProtocol` `components`).
```json
{
  "name": "createExperiment",
  "description": "Create an editable notebook experiment entry from a retrieved protocol. Writes to local storage only. Requires user permission unless set to auto.",
  "parameters": { "type": "object",
    "properties": {
      "title": { "type": "string" },
      "titleZh": { "type": "string" },
      "protocolRef": { "type": "string", "description": "Recipe id from getProtocol." },
      "date": { "type": "string", "description": "YYYY-MM-DD" },
      "objectives": { "type": "string" },
      "steps": { "type": "array", "items": { "type": "string" }, "description": "Ordered step texts copied verbatim from the retrieved protocol — do NOT author new steps." },
      "reagents": { "type": "array", "items": { "type": "object",
        "properties": { "name": {"type":"string"}, "amount": {"type":"string"}, "unit": {"type":"string"}, "location": {"type":"string"} } } }
    }, "required": ["title","protocolRef"] }
}
```

### 3.6 `scheduleCalendarEvent` (WRITE)
Wraps: same `experiments` Dexie store (Notebook & Calendar share it — see `CalendarTab` `save`/`createEmptyExperiment`). For the "24/48/72 h" flow, one call may create **multiple** dated occurrences. Handler loops `createEmptyExperiment(date, startTime)` → set `status:'planned'`, `duration`, `protocolRef`, `title` → `saveExperimentRecord`.
```json
{
  "name": "scheduleCalendarEvent",
  "description": "Schedule one or more timepoints on the local calendar for an experiment. Writes local experiment records with dates/times.",
  "parameters": { "type": "object",
    "properties": {
      "title": { "type": "string" },
      "protocolRef": { "type": "string" },
      "occurrences": { "type": "array", "items": { "type": "object",
        "properties": { "date": {"type":"string"}, "startTime": {"type":"string"}, "durationMin": {"type":"integer"}, "label": {"type":"string"} },
        "required": ["date"] } }
    }, "required": ["title","occurrences"] }
}
```

### 3.7 `exportProtocol` (WRITE-ish: triggers download) — needs [NEW] extracted fn
Wraps: the markdown builder currently **inline** in `NotebookTab.exportMarkdown`. Extract to **`experimentToMarkdown(entry)` [NEW]** + **`downloadText(text, filename, mime)` [NEW]** in `src/lib/agent/exportProtocol.js`, and refactor `NotebookTab` to import them (no behavior change). Agent uses it to emit a `.md` the user can download.
```json
{
  "name": "exportProtocol",
  "description": "Render an experiment/protocol as downloadable Markdown for the user.",
  "parameters": { "type": "object",
    "properties": { "experimentId": { "type": "string" }, "filename": { "type": "string" } },
    "required": ["experimentId"] }
}
```

### 3.8 `analyzeData` (compute) — **[NEW] deterministic analyzers**
Wraps: NO LLM math. Two deterministic paths:
- **qPCR ΔΔCt** — **`analyzeDDCt({ rows, refGene, controlSample })` [NEW]** in `src/lib/analysis/qpcr.js`. Implements Livak 2^(−ΔΔCt) (already cited in `src/data/references.js` id 17; MIQE id 16). Returns per-sample fold-change + mean/SD. (Today ΔΔCt lives in the external `apps.bioinfospace.com/qpcr-analysis` tool linked from `ToolsTab.jsx` — we bring a minimal version in-app so it's offline + tool-callable.)
- **Plate reader** — reuse existing pure parsers in `src/features/plate/plateReaderParser.js`: `parsePlateReaderCSV`, `toLongFormat`, `summarizeBySample`.

The LLM's only role is to (a) pick the analyzer, (b) map columns, (c) narrate the returned numbers — never to compute them.
```json
{
  "name": "analyzeData",
  "description": "Run a deterministic analysis on user-uploaded raw data. The app computes all numbers; you only select the method and explain the output. Never compute statistics yourself.",
  "parameters": { "type": "object",
    "properties": {
      "method": { "type": "string", "enum": ["qpcr_ddct","plate_summary"] },
      "config": { "type": "object", "description": "e.g. qpcr_ddct: {refGene, controlSample}. Data is passed via the uploaded-file handle, not inline." }
    }, "required": ["method"] }
}
```

### 3.9 Tool summary table

| Tool | R/W | Wraps (file · symbol) | New code? |
|---|---|---|---|
| searchProtocols | R | RecipeProvider `recipes` + **retrieval.js `searchRecipes`** | **NEW fn** |
| getProtocol | R | RecipeProvider `recipeById` (normalize `components`) | small [NEW] normalizer |
| queryInventory | R | inventoryUtils `loadInventoryAsync` + **retrieval.js `queryInventory`** | **NEW fn** |
| runCalculator | R | calculators.js (`dilution`,`massCalc`,…,`calcGel`) | dispatch only |
| createExperiment | W | experiments.js `createEmptyExperiment` + **`saveExperimentRecord`** | **NEW helper** |
| scheduleCalendarEvent | W | experiments.js (same store) | uses NEW helper |
| exportProtocol | W | **`experimentToMarkdown`/`downloadText`** (extracted from NotebookTab) | **NEW (extract)** |
| analyzeData | C | **qpcr.js `analyzeDDCt`** + plateReaderParser.js | **NEW analyzer** |

---

## 4. Owner-key proxy design

Lives in the existing backend: new route **`src/routes/agent.js` [NEW]** under `/var/www/bioinfospace.com/backend/`, registered in `server.js` (`app.use('/api/labmate/agent', agentRoutes)`). Reuses the provider-selection pattern already in `services/claudeSummarizer.js` (`getProvider()` reads `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` from env). Redis client is **[NEW]** (`ioredis` — not yet a backend dep; add it; Redis is up on `localhost:6379`).

### 4.1 Endpoints
- `GET /api/labmate/agent/models` → `{ models: [{id,label,ctx}], defaultModel }` — the allowlist, so the client can render the model picker.
- `POST /api/labmate/agent/chat` → **SSE stream** of a single assistant turn. Body: `{ model, messages, tools, temperature? }`. The proxy validates `model` ∈ allowlist, forwards to the provider (Anthropic `/messages` or OpenAI-compatible `/chat/completions`, matching the two branches already in `claudeSummarizer.js`), and streams deltas back. Tool *definitions* pass through; tool *execution* happens client-side, so the client re-POSTs with the appended `tool` result messages — proxy stays stateless.

### 4.2 Request / response shape
```
POST /api/labmate/agent/chat
Headers: Content-Type: application/json
         X-LabMate-Session: <uuid>          // anonymous, generated client-side, stored in db.settings
Body:    { "model": "deepseek-chat",
           "messages": [ {role, content|tool_calls|tool_call_id}... ],
           "tools":    [ <schemas from §3> ] }

200 text/event-stream:
  event: delta   data: {"content":"…"}                 // token stream
  event: tool    data: {"tool_calls":[{id,name,arguments}]}
  event: usage   data: {"input_tokens":…, "output_tokens":…, "cost_usd":…}
  event: done    data: {"stop_reason":"tool_use|end_turn"}

429 Too Many Requests:  Retry-After: <seconds>
                        { "error":"rate_limited","scope":"session|ip","retryAfter":N }
402 Payment Required:   { "error":"budget_exceeded","month":"2026-07",
                          "message":"Owner budget reached — switch to BYOK or local." }
400: { "error":"model_not_allowed", "allowed":[...] }
```

### 4.3 Model allowlist (cheap/free only)
Hard-coded server-side; env keys never exposed to client:
```
deepseek-chat            (DeepSeek — cheapest, preferred default)
claude-3-5-haiku-latest  (Anthropic Haiku)
gpt-4o-mini              (OpenAI)
```
Any other id → 400. Verify current per-token pricing before shipping the cap (see claude-api skill for Anthropic rates). Default surfaced to client = `deepseek-chat`.

### 4.4 Rate-limit strategy (per-IP + per-session token bucket in Redis)
Two independent gates, both must pass:
1. **Per-IP** — reuse `express-rate-limit` (already imported in `server.js`; nginx `api_zone` 20 r/s also fronts it). Add a dedicated limiter on the agent router, e.g. 15 req / 5 min / IP.
2. **Per-session token bucket (Redis)** — key `labmate:agent:rl:<session>` with a sliding/leaky bucket: e.g. **20 msgs/hour, 120 msgs/day**. Also cap **input tokens/day** per session (e.g. 200k) to stop context-stuffing. On depletion → `429 + Retry-After` (seconds to next refill). Implementation: `INCR` + `EXPIRE`, or a small Lua leaky-bucket script for atomicity.

### 4.5 Monthly spend cap
- Redis counter `labmate:agent:spend:<YYYY-MM>` (float USD), `EXPIRE` ~40 days.
- After each provider call, estimate cost from returned `usage` × per-model price table → `INCRBYFLOAT`.
- Soft cap at **$8** → start returning `402 budget_exceeded` for owner-proxy chat (reads/tools still work; user prompted to switch to BYOK/local). Keeps <$10/mo with headroom.
- `GET /api/labmate/agent/models` also returns `{ budget: { softCapUsd, spentUsd, month } }` so the client can pre-warn near the cap.

### 4.6 Client discovers rate-limit state
- `429` + `Retry-After` → chatbox shows a non-blocking banner: "Owner-key limit reached, retry in N s — or switch to your own key / local model." with a one-tap deep link to key settings.
- `402` → same banner, budget wording.
- Optional soft signal: proxy echoes `X-RateLimit-Remaining` / `X-Budget-Remaining` headers; client shows a subtle meter when low.

### 4.7 Privacy at the proxy
- `morgan` must **not** log request bodies for this route (log method/status/latency only). Add a route-scoped skip.
- No persistence of `messages` anywhere (no DB, no file, no Redis value — Redis stores only counters keyed by session/IP).
- Disclosed in privacy copy (§9): messages transit our server in transit only; not stored/logged.

---

## 5. BYOK + local-LLM client design

All client LLM I/O goes through **`src/lib/agent/providers/` [NEW]** with a common interface `createChat({messages, tools, model, signal}) → AsyncIterable<delta>`:

- **`ownerProxy.js`** — POSTs to `/api/labmate/agent/chat` (§4).
- **`openaiCompat.js`** — one adapter for **OpenAI, DeepSeek, LM Studio, and Ollama's `/v1`** endpoint (all speak `/chat/completions` with `tools`). Config: `{ baseUrl, apiKey, model }`. LM Studio default `http://localhost:1234/v1`, Ollama `http://localhost:11434/v1`, DeepSeek `https://api.deepseek.com/v1`.
- **`anthropic.js`** — Anthropic direct from the browser. Requires header `anthropic-dangerous-direct-browser-access: true` plus `x-api-key` and `anthropic-version`. Uses `/v1/messages` + `tools` (Anthropic tool_use blocks). Model e.g. `claude-3-5-haiku-latest`.
- **`ollama.js`** (optional native) — `http://localhost:11434/api/chat` for models whose tool-calling is smoother on the native endpoint; otherwise `openaiCompat` covers it.

### 5.1 Mode & key storage
- Mode + BYOK config stored in Dexie `settings` (see `src/lib/db.js` `settings: 'key'`):
  - `agent_mode` = `'owner' | 'byok' | 'local'` (default `'owner'`).
  - `agent_byok` = `{ provider, baseUrl, model, apiKey, remember }` — **client-side only**, never sent to our server.
  - `agent_session` = anonymous UUID for proxy rate-limiting.
- **Key never leaves the browser except to the provider the user chose.** Owner proxy is never called in BYOK/local mode.
- Two persistence options in the UI: **"Remember on this device"** (writes `apiKey` into IndexedDB — warn: plaintext in browser DB) vs **"This session only"** (kept in memory, `remember:false`, dropped on reload). OS-keychain storage is app-only (§10).

### 5.2 "Clear key" UX
- Settings row: masked key (`sk-…last4`) + **Clear key** button → `db.settings.delete('agent_byok')` and wipe in-memory copy → toast "Key removed from this device."
- Switching mode away from BYOK does **not** auto-delete the key (user may return); an explicit "Clear key" does.

### 5.3 Trust guarantees (documented, Biomni-style)
- **Open source:** the entire client, including every adapter, is in the public repo (`github.com/mianaz/labmate`).
- **BYOK is un-proxied:** in BYOK/local mode the request goes `browser → provider` directly. Verifiable: open DevTools → Network; the only LLM host is the provider's, never `bioinfospace.com`.
- **Local is offline:** local-LLM mode talks only to `localhost`; works with the network cable unplugged.
- **Owner mode is honest:** messages transit our proxy (needed to hold the owner key); we don't log/store them (§4.7). Users who want zero third-party transit use BYOK or local.

---

## 6. Chatbox UX (Lab-Manual Brutalism × Sequence Telemetry)

**Placement:** a **right-side slide-over drawer** (`AgentPanel.jsx`), not a new bottom-nav tab — keeps the 9 existing tabs intact and lets the user watch the Notebook/Calendar update live behind the panel. Trigger = a persistent **"◇ Agent" launcher button** (fixed bottom-right, above `QuickTimerButton`), plus a `More` sheet entry. Optional `⌘/Ctrl+J` shortcut (mirrors the existing `⌘K` search wiring in `App.jsx`).

**Design tokens (from `src/styles/global.css` / `styleConstants.js`):** paper `--bg #F0EEE6`, ink `--text #141712`, signal green `--primary #16B364`, `--accent #0B7A3E` for text/links, `--bg-2 #E6E3D8` surfaces, **2px `--border-strong` ink borders, `--radius-*: 0` (hard corners), hard offset shadows, no glass.** Reuse `invBtnStyle` / `invBtnSecStyle` from `inventoryUtils.js` for buttons. Fonts: Space Grotesk (headings), IBM Plex Sans (body), JetBrains Mono (tool call / code / numbers).

**Components [NEW]** under `src/features/agent/`:
- `AgentPanel.jsx` — drawer shell, header (mode pill + model picker + close), message list, composer.
- `AgentMessage.jsx` — user / assistant / tool bubbles; assistant text in Plex Sans, tool calls in a mono "telemetry" card with a `► TOOL` label.
- `ToolCallCard.jsx` — renders a pending/awaiting/confirmed/failed tool call with args (mono) and result summary.
- `PermissionDialog.jsx` — confirm-before-write (§7).
- `AgentComposer.jsx` — textarea + send + file-drop (for `analyzeData` uploads) + "stop" while streaming.
- `KeyModeSettings.jsx` — mode switch (owner/BYOK/local), provider/model pickers, key field, clear-key, privacy copy (§9).

**States** (drive header chip + composer):
- `idle` — empty state with 3 example prompts ("Plan a 3D culture RNA/qPCR timecourse", "Make 500 mL 1× TBST", "Analyze my qPCR Cq table").
- `clarifying` — assistant asked questions; composer focused; chip "◇ CLARIFYING".
- `planning` — retrieving + drafting; show streamed tokens + spinner on active `ToolCallCard`; chip "◇ PLANNING".
- `executing` — running tools; each `ToolCallCard` flips pending→done with a green tick.
- `awaiting-permission` — a write tool is gated; `PermissionDialog` overlays the composer; chip "◇ NEEDS OK".
- `error` / `rate-limited` — banner (§4.6) with switch-mode CTA.

**Live-reflection:** because tools write to the shared Dexie `experiments`/`inventory` stores and `AgentToolsContext` calls the tab hooks' `reload()`, opening Notebook/Calendar after an agent write shows the new entries with no manual refresh.

---

## 7. Permission system

**Data model:** Dexie `settings` key `agent_permissions` = per-tool map:
```json
{
  "searchProtocols": "auto", "getProtocol": "auto", "queryInventory": "auto",
  "runCalculator": "auto",  "analyzeData": "auto",
  "createExperiment": "ask", "scheduleCalendarEvent": "ask", "exportProtocol": "ask"
}
```
- Read/compute tools default **auto**; every WRITE tool defaults **ask** (owner decision 6). Each tool can be `auto | ask | off`.
- Editable in `KeyModeSettings.jsx` → "Tool permissions" section (a table of tool × radio).
- Loaded once into `AgentToolsContext`; the loop consults it before executing.

**Enforcement in the loop (`src/lib/agent/loop.js`):**
1. LLM returns `tool_calls`.
2. For each: look up mode. `off` → return a synthetic tool result "user disabled this tool" (model adapts). `auto` → execute immediately. `ask` → set state `awaiting-permission`, render `PermissionDialog` with a **human preview** (from the tool's `handler` dry-run: e.g. "Create 3 calendar events on Jul 8/9/10, 09:00, linked to protocol trizol_extraction").
3. User picks **Allow once / Allow & remember (auto) / Deny**. "Allow & remember" flips that tool to `auto` in `agent_permissions`.
4. Result (or denial) is fed back as the `tool` message; loop continues.

**Confirm-before-write UI:** brutalist modal, ink border, mono diff-style preview of exactly what will be written (store + record summary), Allow/Deny buttons using `invBtnStyle` / `invBtnDangerStyle`.

---

## 8. Clarify-then-plan conversation design

**System prompt strategy (`src/lib/agent/prompt.js` [NEW]):** a fixed system prompt that hard-codes the red line and the workflow:
- Role: "You are LabMate's planning assistant. You **orchestrate the app's tools**; you do **not** provide biology or protocol content from your own knowledge."
- Grounding rule: "Protocol steps, reagents, and volumes must come **only** from `getProtocol`/`searchProtocols` results. If the library has no matching protocol, say so and offer to search by different terms — never fabricate steps." 
- Numbers rule: "All calculations and data analysis go through `runCalculator`/`analyzeData`. Never compute ΔΔCt, dilutions, or stats yourself."
- Copy-verbatim rule: when calling `createExperiment.steps`, copy step text from the retrieved protocol; do not paraphrase into new instructions.
- Clarify-first rule: "Before writing anything, ask concise clarifying questions when the request is under-specified (organism/cell type, timepoints, replicates, readout, start date)."
- Locale: respond in the user's `lang` (en/zh from context).

**Eliciting clarifying questions:** the first turn is sent with the write tools present but the prompt instructs the model to prefer a short clarifying question set when key slots are missing. A light **slot check** in `loop.js` can also force a clarify turn if the user's message lacks a date (needed for scheduling) — cheaper than a model round-trip.

**Retrieval grounding (anti-fabrication):**
- The model cannot see the library except through `searchProtocols`/`getProtocol`. `recipes.json` is never dumped into the prompt (215 entries, ~1 MB — too big and would invite paraphrase).
- `createExperiment`/`scheduleCalendarEvent` handlers **validate** `protocolRef` against `recipeById`; an unknown id is rejected with an error result, forcing the model to retrieve first.
- Optional hardening: `createExperiment` handler checks that each `steps[i]` has high token overlap with the referenced protocol's `components[]`; low overlap → warn/append "(agent-edited)" provenance so users see deviations.

**Worked example (owner's flow):**
1. User: "3D culture, collect RNA at 24/48/72 h for qPCR — plan it."
2. Agent (clarify): cell type? scaffold/matrix? start date? biological replicates? housekeeping gene?
3. `searchProtocols("RNA extraction TRIzol qPCR")` → `getProtocol("trizol_extraction")`, `getProtocol("qpcr_protocol")`.
4. `createExperiment` (ask) → notebook entry with retrieved steps + objectives.
5. `scheduleCalendarEvent` (ask) → 3 dated occurrences at +24/48/72 h.
6. `queryInventory("TRIzol")`, `queryInventory("GAPDH", primer)` → fills reagent `location`s.
7. `exportProtocol` → downloadable `.md`.
8. Later: user drops a Cq CSV → `analyzeData(method:"qpcr_ddct", {refGene:"GAPDH", controlSample:"0h"})` → deterministic fold-changes; agent narrates, never computes.

---

## 9. Honest privacy copy (exact i18n strings)

Add to `src/i18n/translations.js` (object of `key: { en, zh }`, consumed via `t(key, lang)`). Strings below are ready to paste:

```js
// ── Agent: key modes & privacy ──────────────────────────────────────────────
agentTitle: { en: 'LabMate Agent', zh: 'LabMate 智能助手' },
agentIntro: { en: 'Plans experiments by retrieving from the curated protocol library and running the app’s own tools. It never invents protocols or numbers.', zh: '通过检索精选方案库并调用应用自带工具来规划实验。它不会编造方案或数据。' },

agentModeOwner: { en: 'Shared key (via our server)', zh: '共享密钥（经我们的服务器）' },
agentModeOwnerDesc: { en: 'Uses the maintainer’s key through the Bioinfospace proxy. Your messages pass through our server in transit so the request can be signed — we do not log or store them. Strict rate limits and a monthly budget apply, and only low-cost models are available. For zero third-party transit, use your own key or a local model below.', zh: '通过 Bioinfospace 代理使用维护者的密钥。你的消息会经由我们的服务器转发以完成签名——我们不会记录或存储这些内容。此模式有严格的速率限制和每月预算，且仅提供低成本模型。若不希望消息经过任何第三方，请使用下方的自有密钥或本地模型。' },

agentModeByok: { en: 'Your own key (BYOK)', zh: '自有密钥（BYOK）' },
agentModeByokDesc: { en: 'Your API key is stored only on this device and never sent to our server. Requests go straight from your browser to the provider you choose — you can verify this in the browser Network tab. LabMate is open source.', zh: '你的 API 密钥仅存储在本设备，绝不会发送到我们的服务器。请求直接从你的浏览器发往你所选择的服务商——你可以在浏览器的网络（Network）面板中核实这一点。LabMate 是开源项目。' },

agentModeLocal: { en: 'Local model (on-device)', zh: '本地模型（设备端）' },
agentModeLocalDesc: { en: 'Connects to Ollama or LM Studio on localhost. Fully offline — no data leaves your computer. Nothing is sent to our server or any provider.', zh: '连接到本机 localhost 上的 Ollama 或 LM Studio。完全离线——没有任何数据离开你的电脑，也不会发送到我们的服务器或任何服务商。' },

agentKeyStoreRemember: { en: 'Remember on this device (stored unencrypted in browser storage)', zh: '在本设备记住（以未加密形式存储于浏览器）' },
agentKeyStoreSession: { en: 'This session only (forgotten on reload)', zh: '仅本次会话（刷新后清除）' },
agentClearKey: { en: 'Clear key', zh: '清除密钥' },
agentKeyCleared: { en: 'Key removed from this device.', zh: '已从本设备移除密钥。' },

agentRateLimited: { en: 'Shared-key limit reached. Retry shortly, or switch to your own key / a local model.', zh: '共享密钥已达上限。请稍后重试，或切换到自有密钥 / 本地模型。' },
agentBudgetExceeded: { en: 'The shared monthly budget is used up. Switch to your own key or a local model to continue.', zh: '本月共享预算已用尽。请切换到自有密钥或本地模型以继续使用。' },

agentRedLine: { en: 'Bio content is retrieval-only: steps and reagents come from the curated library, and all calculations run in deterministic app functions — not from the language model.', zh: '生物内容仅来自检索：步骤与试剂取自精选库，所有计算均由确定性的应用函数完成——而非语言模型。' },

// ── Agent: permissions ──────────────────────────────────────────────────────
agentPermTitle: { en: 'Tool permissions', zh: '工具权限' },
agentPermAuto: { en: 'Auto', zh: '自动' },
agentPermAsk: { en: 'Ask', zh: '询问' },
agentPermOff: { en: 'Off', zh: '关闭' },
agentPermConfirm: { en: 'The agent wants to:', zh: '助手想要执行：' },
agentAllowOnce: { en: 'Allow once', zh: '允许一次' },
agentAllowRemember: { en: 'Allow & remember', zh: '允许并记住' },
agentDeny: { en: 'Deny', zh: '拒绝' },
```

---

## 10. Web-lite vs App-rich split

| Capability | Web (this repo) | Capacitor app (`origin/desktop`) | Why |
|---|---|---|---|
| Chatbox + agent loop | ✅ | ✅ | Core UX, cheap |
| Owner-proxy mode | ✅ (default) | ✅ | Shared budget is the point |
| BYOK (cloud provider) | ✅ | ✅ | Client-only, no server cost |
| Local LLM (Ollama/LM Studio on localhost) | ⚠️ connect-only (user runs it) | ✅ **bundle/manage** | Web can't ship a model; app can bundle/launch |
| Key storage | IndexedDB (plaintext) / session-only | **OS keychain** (secure) | Keychain needs native APIs |
| Retrieval / calculators / scheduling / notebook writes | ✅ | ✅ | All pure/local already |
| qPCR ΔΔCt + plate summary | ✅ (small, deterministic) | ✅ | Lightweight math is fine on web |
| Heavy data analysis (large CSV, plots, stats libs) | ❌ deferred | ✅ | Memory/CPU + bundle size vs web-lite budget |
| Filesystem auto-backup of notebook/inventory | ❌ (manual export via `backup.js`) | ✅ | Needs native FS access |
| Background scheduling / OS notifications for timepoints | ❌ (in-app only) | ✅ | Needs native notifications |
| Proxy spend exposure | capped, shared | n/a in BYOK/local | Protects <$10/mo budget |

Rule of thumb: **web = orchestration + light deterministic analysis on shared or BYO keys; app = anything that needs a bundled model, secure storage, native FS, or heavy compute.**

---

## 11. Phased milestones (+ acceptance tests)

**Phase 0 — plumbing (no LLM).** Add `AgentToolsContext`, tool layer, retrieval helpers, `saveExperimentRecord`, extracted `experimentToMarkdown`. Fix `briefSteps/detailedSteps`→`components` fallback in Notebook/Calendar.
- *Accept:* unit tests (Vitest, `src/lib/agent/__tests__`) — `searchRecipes` finds `trizol_extraction`; `getProtocol` returns normalized steps from `components`; `queryInventory` resolves a seeded sample's box/location; `createExperiment` handler writes a record readable via `db.experiments.get`.

**Phase 1 — MVP chatbox (owner proxy, read + plan).** `AgentPanel`, loop, `ownerProxy` adapter, backend `agent.js` with allowlist + per-session Redis limit (spend cap stubbed). Tools: search/get/queryInventory/runCalculator/createExperiment/scheduleCalendarEvent/exportProtocol. All writes gated `ask`.
- *Accept:* the owner flow (§8 steps 1–7) runs end-to-end against `deepseek-chat`; a notebook entry + 3 calendar events appear and are visible in the Notebook/Calendar tabs; `429` shows the switch-mode banner; asking for a protocol not in the library yields a "not found, no fabrication" reply (manual red-line check).

**Phase 2 — permissions + BYOK/local.** `agent_permissions` model + `PermissionDialog`; `KeyModeSettings` with owner/BYOK/local; `openaiCompat` + `anthropic` adapters; privacy copy (§9).
- *Accept:* setting `createExperiment: ask` shows the confirm dialog with an accurate preview; "Allow & remember" flips it to `auto`; in BYOK mode DevTools Network shows requests only to the provider host (never `bioinfospace.com`); local mode works with the site offline + Ollama running; "Clear key" removes it from IndexedDB.

**Phase 3 — deterministic data analysis.** `analyzeData` + `qpcr.js analyzeDDCt` + plate reuse; file-drop in composer.
- *Accept:* uploading a Cq CSV with a known answer produces the exact `2^(−ΔΔCt)` fold-changes computed by `analyzeDDCt` (compare to a hand-checked fixture); the LLM's narration contains no numbers the function didn't return (spot-check); disabling network still runs the analysis (deterministic, local).

**Phase 4 — app/local-LLM hardening (on `desktop`).** OS-keychain key storage, bundled/managed local model, native FS auto-backup, timepoint notifications. Enforce full spend-cap ($8 soft) + per-day token cap on the proxy.
- *Accept:* app build stores the key in the OS keychain (not IndexedDB); proxy returns `402` once the month counter passes the soft cap; a scheduled timepoint fires a native notification.

---

## 12. File-by-file change checklist

**New — client (`src/lib/agent/`)**
- `tools.js` — tool `{schema, handler}` registry (§3).
- `retrieval.js` — `searchRecipes()`, `queryInventory()` pure fns.
- `loop.js` — agent turn loop: LLM call → parse tool_calls → permission gate → execute → feed back.
- `prompt.js` — system prompt + red-line rules (§8).
- `exportProtocol.js` — `experimentToMarkdown()`, `downloadText()` (extracted from `NotebookTab`).
- `providers/ownerProxy.js`, `providers/openaiCompat.js`, `providers/anthropic.js`, `providers/ollama.js` (optional), `providers/index.js` (mode→adapter).
- `permissions.js` — load/save `agent_permissions` from `db.settings`; defaults.
- `session.js` — get/create `agent_session` UUID in `db.settings`.
- `__tests__/…` — Vitest for retrieval, tools, qpcr.

**New — client (`src/lib/analysis/`)**
- `qpcr.js` — `analyzeDDCt()` (deterministic; cites references 16/17).

**New — client (`src/features/agent/`)**
- `AgentPanel.jsx`, `AgentMessage.jsx`, `ToolCallCard.jsx`, `PermissionDialog.jsx`, `AgentComposer.jsx`, `KeyModeSettings.jsx`, `AgentContext.jsx` (the `AgentToolsContext` provider).

**Edited — client**
- `src/App.jsx` — mount `<AgentToolsContext>` around `AppInner`; render `<AgentPanel>` + launcher button; add `⌘/Ctrl+J` handler (mirror existing `⌘K` block).
- `src/lib/experiments.js` — add `saveExperimentRecord(entry)` (imperative Dexie write).
- `src/features/notebook/NotebookTab.jsx` — import `experimentToMarkdown`/`downloadText` (dedupe inline `exportMarkdown`); fix step source to `components` fallback.
- `src/features/calendar/CalendarTab.jsx` — same `components` fallback in `handleProtocolImport`.
- `src/i18n/translations.js` — add all keys from §9.
- `src/components/MoreSheet.jsx` — add "Agent" entry (optional secondary launcher).
- `src/lib/db.js` — no schema change needed (`settings`, `experiments` already exist); new settings keys are just rows.

**New — backend (`/var/www/bioinfospace.com/backend/src/`)**
- `routes/agent.js` — `GET /models`, `POST /chat` (SSE), allowlist, Redis rate-limit + spend cap; reuse `services/claudeSummarizer.js` provider pattern.
- `services/agentProxy.js` (optional) — provider call + usage→cost estimation, kept out of the route file.
- `utils/redisClient.js` — `ioredis` singleton to `localhost:6379`.

**Edited — backend**
- `src/server.js` — `import agentRoutes` + `app.use('/api/labmate/agent', agentRoutes)`; add route-scoped `morgan` body-skip; add agent-specific `express-rate-limit`.
- `package.json` — add `ioredis` (Anthropic/OpenAI/DeepSeek reached via `fetch`, no SDK needed — matches existing `claudeSummarizer.js`).
- `.env` (chmod 600, not committed) — ensure `DEEPSEEK_API_KEY` (and/or `ANTHROPIC_API_KEY`) present; add `AGENT_MONTHLY_CAP_USD=8`, `AGENT_MODEL_ALLOWLIST=deepseek-chat,claude-3-5-haiku-latest,gpt-4o-mini`.

**Ops**
- nginx: agent route sits under existing `/api/` `api_zone` (20 r/s) — confirm SSE isn't buffered (`proxy_buffering off;` for the `/api/labmate/agent/chat` location).
- CORS: `CORS_ORIGINS` already includes the LabMate origin (`apps.bioinfospace.com`); confirm.

---

## 13. Security & failure modes

- **Key leakage (BYOK).** Never send the key to our server; only to the user-chosen provider. Warn that "Remember" writes plaintext to IndexedDB (any script on-origin could read it) — mitigated by same-origin + open-source + optional session-only mode; OS-keychain is the app-only fix. Redact key in all UI (`sk-…last4`) and never in logs/toasts.
- **Key leakage (owner).** Env-only server-side; never returned by `/models`; proxy never echoes it. `.env` stays chmod 600 (per CLAUDE.md hardening).
- **Prompt injection via recipe content.** Curated library is trusted-ish but treat retrieved text as data: (a) retrieved protocol text is passed as tool *results*, not as system instructions; (b) the loop ignores any "instructions" embedded in recipe fields for control-flow — tools are only invoked from the model's `tool_calls`, and every write is `protocolRef`-validated against `recipeById`; (c) write tools default `ask`, so an injected "delete everything" can't execute silently (and there is no delete tool). User-authored `customRecipes` are the higher-injection-risk surface — same containment applies.
- **Rate-limit abuse / cost blow-up.** Anonymous session UUID is spoofable, so per-IP `express-rate-limit` + nginx `api_zone` back it up, and the **monthly spend cap is the true backstop** (global, not per-session): once `spend:<month>` passes the soft cap, owner mode returns `402` regardless of session churn. Model allowlist prevents someone forcing an expensive model. Cap input tokens/session/day to stop context-stuffing.
- **Offline behavior.** Tools (retrieval, calculators, analysis, writes) are all local and work offline. Owner/BYOK cloud turns fail cleanly with a "no network" banner; local-LLM mode continues fully. Recipe library is already cached (`recipes.json` bundled + SW). No agent action can corrupt data offline (writes go through the same Dexie paths as manual edits).
- **Determinism red-line enforcement.** `analyzeData`/`runCalculator` are the only numeric sources; the loop never asks the model to return computed statistics, and Phase-3 acceptance explicitly diffs model narration against function output. If the library lacks a protocol, the model must say so — verified by the Phase-1 red-line test.
- **Data-loss safety.** No agent tool deletes experiments/inventory. `createExperiment`/`scheduleCalendarEvent` only insert. Existing 7-day backup reminder (`App.jsx`) still applies; encourage export before large agent-driven sessions.

---

## 14. Open questions for the owner

1. **Default proxy model:** `deepseek-chat` (cheapest) vs `claude-3-5-haiku-latest` (better tool-calling)? Affects budget math.
2. **Auth for owner mode:** anonymous session UUID (frictionless, spoofable) vs require the existing `authenticateToken` (ties usage to accounts, higher friction). Plan assumes anonymous + IP + global cap.
3. **Spend cap value:** $8 soft cap assumed — confirm, and whether to hard-stop or degrade to BYOK-only prompt.
4. **qPCR analyzer scope:** in-app minimal `analyzeDDCt` vs deep-link to the existing external `apps.bioinfospace.com/qpcr-analysis`. Plan brings a minimal version in-app for offline + tool-calling.
5. **BYOK key persistence default:** default to session-only (safer) or remember (convenient)? Plan defaults to session-only.
