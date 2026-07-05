# LabMate Agent — Phase 1 Handoff (build the chat UI)

**Status:** Phase 0 (the entire agent *logic layer*) is built, tested, and committed
(`dd4feef`, branch `main`, **not pushed**). Your job is **Phase 1: the chat UI** —
pure frontend React/Tailwind work that mounts the already-finished brain.

> This is routine frontend product work: a chat panel, a launcher button, a
> confirm dialog, message bubbles. It is **not** security work, handles **no**
> sensitive personal data, and **authors no** biomedical/clinical content — see
> "Scope & non-goals" below.

---

## 1. What LabMate is

A local-first (IndexedDB/Dexie) React 19 + Vite 6 + Tailwind v4 web app of bench
tools: a curated protocol/recipe library, calculators, an inventory tracker, an
experiment notebook, and a calendar. Everything runs in the browser; there is a
small Node/Express backend only for the shared LLM key proxy.

- Repo: `mianaz/labmate` · deploy: push to `main` → live at
  `apps.bioinfospace.com/labmate/` (base `/labmate/`).
- Dev: `npm run dev` · Test: `npm run test:run` · Lint: `npm run lint` ·
  Build: `npm run build`.

## 2. The feature you're finishing

An in-app **planning assistant**: the user describes an experiment, the assistant
retrieves matching protocols from the *existing* curated library, runs the app's
*existing* deterministic calculators, and (with the user's confirmation) creates
notebook entries / calendar timepoints. It never invents protocol content or
computes numbers itself — those come from library retrieval and pure functions.

**Phase 0 (done) = the brain.** **Phase 1 (you) = the face.**

## 3. What already exists (do not rebuild)

All under `src/lib/agent/` — pure, framework-light, and covered by 164 passing tests:

| File | What it gives you |
|---|---|
| `AgentContext.jsx` | `AgentProvider` + `useAgent()` — **the only API you need** (see §4). |
| `loop.js` | The turn loop (LLM → tool calls → permission gate → tool results → repeat). |
| `tools.js` | 7 tools (search/get protocols, query inventory, run calculator, create experiment, schedule calendar, export markdown). |
| `retrieval.js`, `exportProtocol.js`, `prompt.js` | Data helpers + system prompt. |
| `providers/ownerProxy.js` | SSE adapter to the backend key-proxy. |
| `permissions.js`, `session.js` | `db.settings`-backed tool policy + anon session id. |
| `../protocolImport.js` | Protocol→experiment normalization (shared with Notebook/Calendar). |

`AgentProvider` is **not mounted** yet, so none of this affects the running app.
That's intentional — the bundle is unchanged and desktop rendering is untouched
until you wire it in.

## 4. The `useAgent()` API (your entire contract)

Mount `<AgentProvider>` inside the existing providers (it needs `RecipeProvider`
and the `LangContext` above it — see `src/App.jsx`). Then any component calls:

```js
const {
  messages,          // Array<{role:'user'|'assistant'|'tool', content, tool_calls?, name?, _error?}>
  isRunning,         // boolean — a turn is in flight
  streamingText,     // string — live assistant text for the in-progress turn
  model, setModel,   // current model key + setter (default 'minimax-m3')
  sendMessage,       // async (text) => void — the main entry point
  clear,             // () => void — reset the conversation

  // permission flow (for the confirm dialog):
  pendingPermission, // null | { name, args, preview, resolve } when a write needs approval
  resolvePermission, // (decision:'once'|'remember'|'deny') => void
} = useAgent();
```

**Rendering messages:**
- `role:'user'` / `role:'assistant'` → chat bubbles. Assistant `content` may be empty
  when the turn only made tool calls.
- While `isRunning`, render `streamingText` as the live assistant bubble.
- `role:'tool'` messages carry a JSON string in `content` (the tool result). Render
  these as compact "tool ran" cards (see `ToolCallCard` below), not raw JSON.
- `_error:true` assistant messages are user-facing error copy (already localized).

**Permission flow (write tools):** when the agent wants to create an experiment,
schedule events, or export a file, and that tool is set to `ask`, `pendingPermission`
becomes `{ name, args, preview, resolve }`. Show a dialog with the human-readable
`preview` string and three buttons → call `resolvePermission('once'|'remember'|'deny')`.
`'remember'` flips that tool to auto for future turns.

## 5. Components to build (`src/features/agent/`)

- **`AgentLauncher.jsx`** — floating button that opens the panel.
- **`AgentPanel.jsx`** — the chat surface (message list + composer + model picker).
- **`AgentMessage.jsx`** — one user/assistant bubble (markdown-lite; the app has no
  markdown renderer — keep it plain text + line breaks, or add a tiny safe renderer).
- **`ToolCallCard.jsx`** — compact card summarizing a tool call + result.
- **`PermissionDialog.jsx`** — the confirm dialog driven by `pendingPermission`.
- **`AgentComposer.jsx`** — textarea + send button (Enter to send, Shift+Enter newline).

Then wire-up:
- **Mount** `<AgentProvider>` in `src/App.jsx` (inside `RecipeProvider`, inside
  `LangContext.Provider`) and render `<AgentLauncher/>` + `<AgentPanel/>`.
- **Shortcut:** add `⌘/Ctrl+J` to toggle the panel (mirror the existing `⌘K`
  handler already in `App.jsx`).
- **Mobile launcher:** also add an "Agent" entry to `src/components/MoreSheet.jsx`
  and/or `BottomNav.jsx`.
- **i18n:** paste the ready-made strings from `docs/AGENT-PLAN.md` §9 into
  `src/i18n/translations.js` (`agentTitle`, `agentIntro`, `agentPerm*`,
  `agentRateLimited`, etc.). Use `t(key, lang)`.
- **Cross-tab refresh:** after an agent write, the context dispatches a
  `window` event `labmate:experiments-changed`. Add a listener in
  `NotebookTab.jsx` and `CalendarTab.jsx` that calls their `reload()` so entries
  the agent created show up without a manual refresh.

## 6. Design system (must conform — `DESIGN.md`)

"Lab-Manual Brutalism": flat paper, **square corners** (`--radius: 0`; `rounded-full`
only for dots/spinners), **2px** solid borders (`--border` / `--border-strong`),
**hard-offset shadows** (`3px 3px 0`, no blur), mono font for inputs/badges. Reuse
the frozen inline-style objects in `src/lib/styleConstants.js` (`S_MUTED`, `S_TEXT`,
`S_PRIMARY`, `S_PILL_*`, …) rather than hand-rolling `{color:'var(--…)'}`.

**Launcher placement (important):** the app **already has a FAB** — the
`QuickTimerButton` at `bottom: var(--fab-b); right: …` (`src/components/Timer.jsx`).
Do **not** collide with it. Stack the agent FAB above it using the same offset the
timer popup/toast use: `bottom: calc(var(--fab-b) + 3.75rem)` on the right edge
(desktop and mobile — `--fab-b` already accounts for the mobile bottom-nav height).

**z-scale (from `global.css`):** nav / FAB / TimerBar = 40 · **modals & sheets = 50**
· toast = 9000 · grain = 9999. The panel/dialog belong at **z-50**.

**Inputs on mobile:** ≥16px font below 768px (iOS zoom guard) is already enforced
globally — don't override it.

## 7. THE hard constraint: desktop stays pixel-identical

Desktop (**≥1024px**) is the promoted production baseline. **Do not ship any
ungated style change that lands on desktop.** New UI is additive (a launcher +
an overlay panel), which is fine, but:
- Gate mobile-shell differences with `useIsMobile()` (`max-width:767px`) or `lg:`
  Tailwind prefixes.
- ⚠️ **Never** put `display` in an inline `style={}` on an element relying on
  `lg:hidden` — inline style beats the utility class and the element leaks onto
  desktop. Put layout in `className`. (This exact bug bit the mobile overhaul.)
- Verify at runtime (DOM probe / screenshot), not just by reading JSX.

## 8. Backend — leave it alone (owner-gated)

The LLM key proxy (`/api/labmate/agent/*`) lives in a **separate** backend repo and
is already built + verified. It is **not** part of this task. You do **not** need
keys, `.env` files, or server access to build or test the UI:
- In dev, point `AgentProvider`'s `apiBase` at the deployed proxy, **or** stub
  `sendMessage` with a fake `callModel` (see `loop.test.js` for the pattern) to
  build the UI without any network.
- Do not add API keys anywhere, do not edit backend/server files, do not deploy.

## 9. Acceptance (Phase 1)

- Launcher opens/closes the panel; `⌘/Ctrl+J` toggles it; mobile entry works.
- Typing a message shows a user bubble, then a streaming assistant bubble.
- A tool call renders as a `ToolCallCard`, not raw JSON.
- A write (e.g. "add this to my notebook") pops `PermissionDialog` with the
  `preview` text; "Deny" cancels, "Allow once" proceeds, "Allow & remember"
  proceeds and suppresses the next prompt for that tool.
- 429/402/503 responses render the localized banner copy (already in the error
  path — just style it).
- `npm run lint` → 0 errors; `npm run test:run` → all green (164 existing + any
  you add); `npm run build` clean.
- **Desktop ≥1024px pixel-identical** to before (probe + screenshot diff).

## 10. Scope & non-goals (read this)

- **This is ordinary UI/product engineering.** You are building a chat panel and a
  confirm dialog against a finished local API. Nothing here involves security
  tooling, exploits, authentication bypass, or user surveillance.
- **No sensitive personal data.** The app stores a scientist's own bench notes in
  their own browser. There is no PII pipeline, no third-party data sharing to add.
- **No biomedical content authored by you or the model.** Protocol steps come from
  a pre-existing curated JSON library via retrieval; all numbers come from
  deterministic calculator functions. Your UI just *displays* what those return.
  Do not add medical/clinical advice, and keep the model's retrieval-only guardrails
  (`prompt.js` `RED_LINES`) intact.
- **Don't touch:** secrets/`.env`, the backend/server, deploy pipelines, or the
  desktop layout. Keep everything local and reversible; open a PR, don't push `main`.
```
