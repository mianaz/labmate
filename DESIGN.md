# LabMate Design System

> **Canonical system:** Bioinfospace **v2 — "Lab-Manual Brutalism × Sequence Telemetry"** (LOCKED 2026-07-04).
> The single source of truth for the shared design *language* is **`DESIGN-SPEC-V2.md`** in the Bioinfospace
> website repo (`/var/www/bioinfospace.com/docs/DESIGN-SPEC-V2.md`). This file documents how LabMate
> **realizes** that system in its own stack (React 19 + Vite 6 + **Tailwind v4**, no component library).
>
> **Ground truth in code:** `src/styles/global.css` (tokens, component classes, shell) and the shared
> components in `src/components/` (`Sidebar`, `MobileTopBar`, `BottomNav`, `MoreSheet`, `PageHeader`,
> `UtilityPanel`, `icons.jsx`). If you change a token or a component class, update this file to match.

The retired **v1 teal** system (Bricolage Grotesque / DM Sans, teal, rounded corners, glass nav) is gone.
Do not reintroduce teal, rounded corners, blur/glass, or the old fonts.

---

## 1. Direction

Swiss industrial-print substrate — matte documentation paper, carbon ink, one saturated accent, visible
structural rules — fused with a restrained terminal-telemetry layer (monospace as structural
infrastructure, ATCG base-coded micro-colour). The accent is **signal green `#16B364`**, pulled from the
FASTA-chevron brand mark. Radius is **0 everywhere** (circular things — status dots, well-plate wells —
are the only exemption).

### 2026-09 refinement (LabMate)

The September 2026 redesign keeps the brand intact and changes how densely it is applied. An app you
use at the bench all day needs calmer surfaces than a marketing site:

| Before | Now |
|---|---|
| Every card: 2px ink frame + 4px hard shadow, lifts on hover | Panels: flat, **1px ink frame**, no shadow. Hard offset shadows are reserved for the primary action (`.btn-primary`) and things that float (popovers, dialogs, toasts, floating timers). |
| All rules ink (`--border: #141712`) in light mode | Three-tier rules: **ink** frames structure (`--border-strong`), **graphite** outlines controls (`--border`, 3.2:1 on paper), **hairlines** divide content (`--rule`, decorative). Dark mode already worked this way. |
| 9-tab mono top bar + stacked FABs | Grouped **sidebar** on desktop; top bar + bottom nav + More sheet on phones; timer / quick calculator / assistant docked in the shell instead of floating over content. |
| Each page styled ad hoc (inline styles, 1.85rem in-card titles) | Every page starts with `PageHeader`; one set of component classes (§5). |
| Global CSS hacks inflating Tailwind spacing (`.space-y-*`, pill padding, `nav button`) | Removed. Tailwind utilities are true to scale again. |

If these refinements are adopted site-wide they belong in `DESIGN-SPEC-V2.md`; until then they are
LabMate-specific.

---

## 2. Typography

| Role | Family (`--font-*`) | Weights | Usage |
|------|---------------------|---------|-------|
| Display / headings | **Space Grotesk** → IBM Plex Sans → system | 700 (500 light) | page titles, document titles, big numerals |
| Body / UI | **IBM Plex Sans** → system | 400 / 600 | paragraphs, labels, buttons, list titles |
| Mono / structural | **JetBrains Mono** → ui-monospace | 400 / 700 | wordmark, nav, eyebrows, metadata, inputs, values, units, positions, dates |

- Page title (`.page-title`): Grotesk 700, 1.875rem desktop / 1.5rem mobile, `-0.025em`.
- Section title (`.section-title`): Grotesk 700, 1.0625rem.
- Eyebrows (`.eyebrow`, `.panel-title`, `.page-eyebrow`, `label`, `th`, `dt`): mono 700, 0.6875rem, uppercase,
  `0.08–0.12em` tracking, `--text-muted`. **zh disables uppercase + tracking** on all of them.
- Legacy convention kept: `<h4 className="text-sm font-bold">` renders as a mono eyebrow.
- Numbers that are compared or scaled use `.tabular` (tabular figures).
- Wordmark: chevron mark + `labmate` (mono 700); `bio`(ink) `info`(green) `space`(ink), all lowercase.

---

## 3. Color tokens

All values live in `:root` (light) and `[data-theme="dark"]` in `global.css`. Theme is controlled
**exclusively by the `data-theme` attribute** (seeded from the bioinfospace.com `bis_theme` cookie or
`prefers-color-scheme` on first visit, then the user's choice). CSS-var names are shared with the JSX — do
not rename them.

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--bg` | `#F0EEE6` | `#0D0F0C` | page — matte paper / deactivated-CRT black |
| `--bg-2` | `#E6E3D8` | `#1B1F19` | wells, chips, hover |
| `--bg-3` | `#DCD8CB` | `#242922` | pressed |
| `--card` | `#FBFAF5` | `#141712` | panels, dialogs |
| `--primary` | `#16B364` | `#24D67B` | signal green — **fills only** |
| `--primary-light` | `#D8F0E1` | `#12281C` | selected rows, info notices, readouts |
| `--accent` | `#0B7A3E` | `#3DDC84` | green **as text / links** (AA on paper) |
| `--on-primary` | `#141712` | `#0D0F0C` | text on green |
| `--text` | `#141712` | `#E8E9E2` | primary text |
| `--text-muted` | `#57534A` | `#9B9D91` | secondary text (≥6.5:1) |
| `--border-strong` | `#141712` | `#8A8E80` | structural frames (panels, shell edges, table headers) |
| `--border` | `#8A8578` | `#62665A` | control outlines (3:1 non-text contrast) |
| `--rule` | `#D5D1C5` | `#272B24` | decorative interior dividers (rows, cells) |
| `--shadow-ink` | `#141712` | `rgba(203,212,194,.55)` | hard offset shadow colour |

> **Contrast rule:** `--primary` fails AA as small text on paper. Green text/links use **`--accent`**
> (`S_PRIMARY` in `styleConstants.js`).

Semantic and categorical tokens are unchanged: `--warning-*`, `--danger-*` (`--on-danger`), ATCG
micro-accents `--base-a/t/c/g`, recipe categories `--cat-{buffer,protocol,staining,media}(-bg)`, and
the nine theme-aware inventory sample pairs `--samp-*-{bg,text}`.

---

## 4. Shape, shadow, motion

- **Radius:** 0. Tailwind's radius scale is zeroed in `@theme`; `rounded-full` stays circular.
- **Borders:** 1px. Ink (`--border-strong`) for panels and dialogs; 2px only for the shell's structural
  edges (sidebar right edge, top bar, bottom nav).
- **Shadows:** hard offset, zero blur — `--shadow-sm 2px`, `--shadow 3px`, `--shadow-lg 5px`. Use them
  only on `.btn-primary` (2px, presses in on click), popovers/dialogs (`--shadow-lg`), toasts
  (3px green) and floating timers. Never on ordinary panels or list items.
- **Motion:** `--ease-out`, `--ease-snap`; `--duration-fast 120ms / -base 180ms / -slow 260ms`.
  Transform/opacity only, with a global `prefers-reduced-motion` fallback.

---

## 5. Component classes

Defined in `@layer components` (so Tailwind utilities can adjust them). Prefer these to inline styles.

| Need | Class |
|---|---|
| Page header | `<PageHeader tab title description actions meta />` — eyebrow comes from the nav group |
| Framed surface | `.panel` (+ `.panel-head`, `.panel-title`, `.panel-body`); `.card` = panel with 1.25rem padding |
| Buttons | `.btn` (secondary), `.btn-primary` (one per view), `.btn-ghost`, `.btn-danger`; `.btn-sm`, `.btn-lg`, `.btn-icon` (needs `aria-label`), `.btn-block` |
| Filters / toggles | `.chip` + `aria-pressed`, inside `.chip-row` (`.is-scroll` for one scrolling row) |
| 2–4 option switch | `.seg` > `button[aria-pressed]` (active = ink block) |
| Labels | `.badge` (+ `.badge-green/-warn/-danger`, or `--badge-fg/--badge-bg`), `.dot`, `kbd` |
| Lists | `.list` > `.list-row` (`.is-selected`), `.list-row-title/-sub/-meta` |
| Empty states | `.empty` > `.empty-icon`, `.empty-title`, `.empty-desc`, optional button |
| Callouts | `.notice` + `.notice-info/-warn/-danger`, `.notice-title` |
| Computed values | `.readout` > `.readout-label`, `.readout-value` (`.unit`), `.readout-sub`; `.is-empty` |
| Facts | `<dl class="meta-grid">` with `<div><dt/><dd/></div>` cells |
| Layout helpers | `.toolbar`, `.toolbar-spacer`, `.search-field`, `.doc-section(-head)`, `.stat`, `.link` |
| Dialogs | `.overlay-backdrop` + `.dialog` (centred ≥640px, bottom sheet below); `.sheet`; `.popover` |

**Form controls** (`input`, `select`, `textarea`) and `label` are styled globally and unlayered: mono,
1px ink border, green focus ring, ≥36px tall (≥40px on touch), 16px text below 768px (iOS zoom guard).
Opt out with `.input-bare`.

**Tables** are styled globally: mono uppercase headers over a 1px ink rule, `--rule` row lines, mono
for non-first columns (`.table-plain` keeps the body font).

### Cascade layering gotcha

Unlayered CSS beats every Tailwind utility. The shell classes (`.app-*`, `.sidebar-*`, `.nav-*`,
`.bottom-nav*`, `.library*`) are unlayered, so **don't combine them with responsive `hidden` /
`lg:hidden` utilities** — control their visibility in `global.css` (as `.app-sidebar`, `.app-topbar` and
`.bottom-nav` do). Component classes are layered and do work with those utilities. Likewise, never set
`display` in an inline `style` on an element that relies on a responsive class.

---

## 6. App shell

| Width | Navigation | Tools (timer · quick calc · assistant) |
|---|---|---|
| **≥ 1024px** | `Sidebar`: brand, search (⌘K), groups **Library** (Recipes, Protocols) · **Tools** (Calculator, Plate designer, Links) · **My lab** (Inventory, Notebook, Calendar) · **Help** (Guide); settings (EN/中文, theme, refresh) and backup status pinned at the bottom | Tool buttons in the sidebar; panels open as a non-modal popover beside it; running timers dock in the sidebar |
| **< 1024px** | `MobileTopBar` (brand, search, tools) + `BottomNav` (Recipes, Protocols, Calc, Plate, More) + `MoreSheet` (remaining sections, settings, backup) | Icon buttons in the top bar; panels open as bottom sheets; running timers float above the bottom nav |

- Section config (paths, labels, icons, groups) lives in `src/lib/nav.jsx` — the sidebar, bottom nav and
  More sheet all read from it. Navigation items are real links (`aria-current="page"`).
- Re-tapping the active bottom-nav item returns to that section's top level (e.g. list from a detail).
- Backup reminder: shown when the last export is older than 7 days; **Later** snoozes for 7 days
  (`labmate_backupSnoozedAt`) without faking an export. Desktop: sidebar notice; phones: slim banner.
- z-scale: shell bars / floating timers = 40 · dialogs, sheets, popovers = 50–51 · toasts = 9000 ·
  decorative grain = 9999.
- Content column: max 1320px, 40px side padding on desktop, 16–24px on phones.

---

## 7. Page patterns

- **Library (Recipes / Protocols)** — `src/features/library/LibraryView.jsx`: sticky filterable list
  (search, All/★/Custom scope, discipline select, recents) + document-style detail (category eyebrow,
  title, lede, "Used in" links, facts grid, sections with inline controls: scale presets for recipes,
  Brief/Detailed + step checklist + one-tap timers for protocols). Phones: list → detail drill-down in a
  single tree.
- **Calculators** share one anatomy: panel head (name + formula), labelled inputs with unit selects,
  a `.readout` for the result, a `.notice-info` preparation summary.
- **Dialogs** use `.dialog` with a `.panel-head` (title + close) and a footer (Cancel, then the primary
  action). Escape closes.
- **Empty states** explain what the section is for and offer the first action.

---

*LabMate conforms to Bioinfospace DESIGN-SPEC-V2, with the 2026-09 refinements above. Tokens transcribed
from `src/styles/global.css` — keep them in sync.*
