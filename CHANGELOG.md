# Changelog

All notable changes to LabMate will be documented in this file.

## [Unreleased]

**UI redesign.** The Bioinfospace v2 "Lab-Manual Brutalism" identity is kept (paper and ink, signal green, square
corners, Space Grotesk / IBM Plex Sans / JetBrains Mono) and refined for an all-day bench tool. See
`DESIGN.md`.

### Changed
- **Navigation:** grouped sidebar on desktop (Library · Tools · My lab · Help) with search, counts,
  quick timer / calculator / assistant, running timers, backup status and language / theme / refresh.
  Phones get a top bar, a bottom bar (re-tap pops back to the list) and a regrouped More sheet. The
  stacked floating buttons are gone; the timer and calculator open as a popover (desktop) or bottom
  sheet (phones).
- **Design system:** flat 1px panels, soft interior hairlines, hard shadows only on primary actions and
  floating surfaces; one set of component classes (buttons, chips, segmented controls, badges, lists,
  empty states, notices, readouts, facts grids, dialogs) and a shared `PageHeader` and `Dialog`.
  Removed global CSS hacks that inflated Tailwind spacing.
- **Recipes & Protocols:** one shared master–detail view — filterable list (search includes reagents,
  All / ★ / Custom, discipline, recents) and a document-style detail with a facts grid, ×½–×5 scale
  presets, a step checklist with progress and one-tap timers.
- **Every other section** (Calculator, Plate designer, Links, Inventory, Notebook, Calendar, Guide) and
  the search, onboarding and custom-recipe dialogs follow the same patterns, in light and dark, at every
  width from 360px up. The "Tools" section is now called **Links**.
- **Global search** is a command palette with ↑ / ↓ / Enter navigation.

### Added
- **Evidence map** *(beta)* (My lab → Evidence map): the logic behind a paper, grant aim or hypothesis as a graph
  of questions, claims, assumptions, evidence and experiments.
  - **Split** a pasted draft into one node per sentence (Chinese and English; citations such as
    author–year, `[n]`, DOI and PMID are picked up), with a suggested type you confirm per sentence.
  - **Connect** nodes by hand, in the Graph (select → Connect → pick the other node) or from a node's
    links. Only relations that make sense for the two types are offered: evidence *supports* /
    *contradicts* a claim, an assumption is a *premise* of a claim, an experiment *tests* a claim and
    *yields* evidence, a claim *answers* a question.
  - **Logic check**: claims resting on no evidence, claims leaning on a premise or sub-claim that does
    not stand, contested and refuted claims, circular reasoning, untested assumptions, evidence
    without a reference, and experiments without predictions (if it holds / if not) or controls.
  - **Experiments**: what still needs evidence and the experiments planned for it. An experiment
    becomes a Notebook entry (its predictions and controls in the objectives, its library protocol's
    steps and reagents in the procedure); once the entry is completed, record the result and it
    comes back as evidence for or against the claims it tested. Notebook entries link back to the map.
  - Outline, Graph and Experiments views; included in the unified backup (backup `schemaVersion` 3).
  - **Manual layout** in the Graph: drag nodes to arrange them (positions are saved; the first move
    keeps every other node where it was), drag the selected node's handle onto another node to link
    them, nudge with the arrow keys (Shift for bigger steps); **Auto layout** resets, with Undo. On
    touch, a node drags once selected, so a swipe still scrolls the canvas.
  - **Export**: a Markdown outline for people, or **AI-native JSON** (`labmate.evidence-map` v1):
    short node ids (C1, E2…), links that read as sentences, each claim's status, the logic check's
    findings and a built-in guide to the kinds, relations and how to propose edits, so a model can
    read the map or return a revised one. Copy to clipboard or download.
  - **Import JSON** (paste, ```json fences accepted, or a file) as a new map, with a preview first.
    Links not allowed between two kinds are skipped. Each exported node carries a content hash: nodes
    unchanged since export keep their review state, nodes that are new or were edited elsewhere
    (by a person or a model) come back marked **To review**.
  - Assistant: `splitIntoEvidenceMap` splits a pasted draft into unreviewed nodes. Every node must quote
    the user's own text (checked against what the user typed) and the tool makes no links and no
    experiments: connecting the propositions stays with the researcher.
- Inventory: move a sample to another box/position (undoable), delete toasts with Undo, import dialog
  with a box picker, keyboard navigation in box grids.
- Notebook: read-only document view with an explicit Edit mode; Notebook ↔ Calendar links.
- "Last backup" status in the sidebar and More sheet; "Later" snoozes the reminder for a week.
- **Keep screen on** toggle in recipes and protocols (remembered) for working at the bench. On phones and
  tablets the screen also stays on while a timer runs.

### Fixed
- **Timers** only counted down while the page had CPU time, so they fell minutes behind or stopped in a
  background tab or on a locked phone, and a reload lost them. They now run against their end time,
  catch up the moment the page is visible again, survive a reload and stay in sync across tabs (they are
  left out of backups). When a timer finished in Chrome on Android with notifications allowed, the whole
  app went blank; notifications now go through the service worker. Permission is asked when you start a
  timer, not when it finishes (Safari and Firefox ignored that request). A finished timer's card flashes
  its background instead of fading its text below AA contrast.
- "Backup Now" in the reminder opened the Links page instead of downloading a backup.
- Toasts printed their type ("info", "success") before the message; search results showed the raw
  i18n key `searchContains`.
- Custom protocols never displayed their steps or materials.
- Calendar used the UTC date for "today", new items, week view and .ics export (a day off outside UTC);
  week view hid events outside 07:00–19:00; calendar delete had no confirmation.
- Notebook could drop a pending auto-save when switching entries quickly.
- Plate designer: relabelled wells stayed in their old label group; labels were merged across mismatched
  plate sizes; large heatmap values were truncated.
- Inventory: tap-to-select toggled twice on touch devices; Ctrl/Cmd+Z hijacked text undo in inputs.
- Scientific calculator swallowed Enter everywhere while open; its keyboard handler was registered twice.
- Units in uppercase labels could render "µM" as "ΜM"; several contrast failures (axe: no WCAG 2.1 A/AA
  violations remain); favourite buttons were labelled "Added to favorites" before toggling; duplicate
  paper-grain overlay; hovering a list row dropped its category label below AA contrast.

## [2.2.0] - 2026-05-12

### Added
- **Plate Reader Import** — new sub-mode inside the Plate tab that auto-detects 6/12/24/48/96/384-well grids from Tecan / BioTek / SpectraMax CSV/TSV exports, pivots to long-format (tidy) data with `well, row, col, value, sample` columns
  - Skips metadata header rows (date/wavelength/title) above the grid
  - Tolerates `OVRFLW`, `<0.001` and other non-numeric markers
  - Optional merge with sample labels assigned in the Plate Designer
  - Heatmap preview, per-sample mean/SD/CV% summary, download CSV / copy to clipboard
- 19 new parser unit tests covering grid detection, header peeling, error cases, and CSV serialization

### Fixed
- **CI lint failure**: duplicate `deadVolDesc` key in `i18n/translations.js` no longer fails `npm run lint`

### Changed
- Test count: 77 → 96 (added `plateReaderParser.test.js`)
- Docs (`apps/labmate.md`) refreshed to describe the new Reader Import flow

## [2.1.0] - 2026-04-13

### Added
- Experiment Notebook tab — structured lab records with protocol import, materials, procedure, results
- Experiment Calendar tab — monthly/weekly views, .ics export, status tracking
- Link to main bioinfospace.com site in header and footer
- "What's New" section in Guide tab
- Dark mode support for backup reminder banner
- Shared backup module (`src/lib/backup.js`) — single source of truth for export/import

### Fixed
- Discipline filter now works (deployed 215 recipes with discipline tags)
- GitHub Actions deploy pipeline — pinned `ssh-deploy` to v4
- Hardcoded version `v0.1.0` in exports replaced with dynamic `__APP_VERSION__`
- Backup reminder renders correctly in dark mode (uses CSS variables)

### Changed
- Production now serves Vite build (was still old 8800-line monolith)
- Hashed assets get immutable 1-year cache via nginx
- OnboardingModal converted from React.createElement to JSX
- Removed labmate-dev staging environment (single canonical `/labmate/` URL)

### Removed
- Legacy `vendor/` CDN libs (babel, react, tailwind) — bundled by Vite
- 13 `index.html.bak.*` deployment artifacts from repo
- Empty icon spans in nav tabs and corresponding CSS hide rule
- `dist-preview/` build artifacts from repo

## [2.0.0] - 2026-04-01

### Changed
- Complete rewrite: monolith decomposed into 52 React modules
- Migrated from CDN React 18 + Babel to Vite 6 + React 19 + Tailwind CSS v4
- Data storage migrated from localStorage-only to IndexedDB (Dexie) with localStorage fallback
- Service worker updated for Vite hashed assets
- CI/CD via GitHub Actions (lint, build, test on push; deploy on merge to main)

### Added
- 215 recipes (up from 159): 97 buffers, 99 protocols, 11 media, 8 staining
- Discipline-based filtering (Protein, Cell Biology, Molecular, RNA/DNA, Immunology, Microbiology, Genomics)
- MW Calculator and Interactive Periodic Table
- Dead Volume Calculator and Percent Solution Calculator
- 77 calculator unit tests (Vitest)
- Recipe syncing from GitHub (mianaz/labmate-recipes)
- Cross-navigation between related recipes and protocols
- Sidebar hide/fullscreen mode for buffers and protocols
- Global search (Cmd+K / Ctrl+K)
- Bilingual onboarding tour (6 slides)
- Auto-backup reminder (7-day threshold)
- Code splitting with React.lazy for 5 tabs + 2 modals

## [0.1.0] - 2026-03-18

### Added
- Initial release — single HTML file (~8800 lines)
- React 18 via CDN with Babel runtime compilation
- Buffers & Recipes tab (50+ formulas)
- Protocols tab with step tracking
- Calculator (Dilution, Mass, Molarity)
- SDS-PAGE Gel Calculator
- Plate Designer (6, 12, 24, 48, 96-well)
- Sample Inventory with storage tree and box grids
- Tools tab with external bioinformatics links
- Guide tab with export/import
- Bilingual interface (EN/ZH)
- localStorage-based data persistence
