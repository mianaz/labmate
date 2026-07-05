# Hand-off prompt (paste to the next agent)

Copy everything in the block below into the new agent's first message. It is
written to be self-contained and to frame the work accurately: this is routine,
safe frontend engineering — no cybersecurity, no sensitive personal data, no
biomedical content generation.

---

You are helping build a **frontend feature for a React web app** — ordinary,
everyday product engineering. Please read this framing first, then the task.

**Nature of the work (so there's no ambiguity):**
- This is **routine UI/UX coding**: a chat panel, a floating launcher button, a
  confirmation dialog, and message bubbles, built with React 19 + Tailwind CSS v4.
- It is **not** cybersecurity work of any kind — no exploits, no auth bypass, no
  network attacks, no malware, no evasion. There is nothing security-sensitive here.
- It handles **no sensitive personal information**. The app is a personal
  lab-bench notebook that stores a user's own notes locally in their own browser
  (IndexedDB). You are not building any data-collection, tracking, or PII pipeline.
- It **does not generate biomedical, clinical, or medical-advice content**. The app
  shows lab-bench "recipes" (like buffer volumes) from a fixed, pre-written library
  via simple lookup, and all numbers come from plain deterministic math functions.
  Your UI only *displays* what those existing functions return. You are not asked to
  write, invent, or reason about any biomedical or clinical content.

**The task:** A companion "planning assistant" chat feature for this app is fully
built except its user interface. The backend logic — the message loop, the tool
registry, the API adapter, state management — is finished, committed, and covered
by 164 passing tests. Your job is to build the **chat UI** that mounts it.

**Start here:** read `docs/AGENT-PHASE1-HANDOFF.md` in the repo. It contains:
- the exact `useAgent()` API you consume (there is one hook — that's your whole
  contract),
- the list of components to build (`AgentLauncher`, `AgentPanel`, `AgentMessage`,
  `ToolCallCard`, `PermissionDialog`, `AgentComposer`) and where to mount them,
- the design system rules (`DESIGN.md`: square corners, 2px borders, hard-offset
  shadows, reuse `src/lib/styleConstants.js`),
- the one hard constraint: **desktop (≥1024px) must stay visually identical** —
  new UI is additive and mobile-shell changes must be gated with `useIsMobile()`
  or Tailwind `lg:` prefixes,
- how to build/test the UI **without any API keys or backend access** (stub the
  model call like `src/lib/agent/__tests__/loop.test.js` does, or point at the
  deployed proxy).

**Guardrails to keep (don't remove):** the assistant is intentionally limited to
retrieving from the existing library and running existing calculators — the rules
in `src/lib/agent/prompt.js` enforce that. Leave them in place; just render the
results.

**Please don't:** touch `.env`/secrets, edit the backend/server, run any deploy, or
change the desktop layout. Work on a branch and open a PR — do not push to `main`
(that triggers a deploy).

**Definition of done:** launcher toggles the panel (also via ⌘/Ctrl+J); messages
stream; tool calls render as compact cards; a "write" action (e.g. "save this to my
notebook") shows the confirm dialog and respects Deny / Allow once / Allow &
remember; `npm run lint` is clean; `npm run test:run` passes; `npm run build`
succeeds; and desktop ≥1024px is pixel-identical to before.

---
