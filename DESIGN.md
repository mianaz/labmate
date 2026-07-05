# LabMate Design System

> **Canonical system:** Bioinfospace **v2 — "Lab-Manual Brutalism × Sequence Telemetry"** (LOCKED 2026-07-04).
> The single source of truth for the shared design language is **`DESIGN-SPEC-V2.md`** in the Bioinfospace
> website repo (`/var/www/bioinfospace.com/docs/DESIGN-SPEC-V2.md`). This file documents how LabMate
> **realizes** that system in its own stack (React 19 + Vite 6 + **Tailwind v4**, no shadcn). Where the two
> ever disagree, the canonical spec wins for *language/intent*; the values below are authoritative for
> *LabMate's implementation* because they are transcribed from the live code.
>
> **Ground truth in code:** `src/styles/global.css` (tokens + component CSS) and `src/lib/styleConstants.js`
> (frozen inline-style objects). Treat those two files as the implementation of this doc — if you change a
> token, change it there and update this file to match.

The retired **v1 teal** system (Bricolage Grotesque / DM Sans, `hsl(161,69%,37%)` teal, `0.625rem` radius,
glass-morphism nav) is **gone**. Do not reintroduce teal, rounded corners, blur/glass, or the old fonts.

---

## 1. Direction

Swiss industrial-print substrate — matte documentation paper, carbon ink, one saturated accent, visible
structural rules — fused with a restrained terminal-telemetry layer (monospace as structural infrastructure,
ATCG base-coded micro-color). The accent is **signal green `#16B364`**, pulled from the FASTA-chevron brand
mark: simultaneously "molecular biology" (GFP / agar / gel bands) and "phosphor terminal." Radius is **0
everywhere** (circular things — status dots, spinners, well-plate wells — are the only exemption).

---

## 2. Typography

Three roles. All Google Fonts; CJK falls back to system gothics (no CJK webfont download).

| Role | Family (`--font-*`) | Weights | Usage |
|------|---------------------|---------|-------|
| Display / headings | **Space Grotesk** → IBM Plex Sans → system | 700 (500 light) | h1–h2, big numerals |
| Body / UI | **IBM Plex Sans** → system | 400 / 600 | paragraphs, labels, buttons, nav |
| Mono / structural | **JetBrains Mono** → ui-monospace | 400 / 700 | wordmark, eyebrows, nav, metadata, inputs, values, `.mono` |

Font tokens (`src/styles/global.css`):

```css
--font-heading: "Space Grotesk", "IBM Plex Sans", system-ui, sans-serif;
--font-body:    "IBM Plex Sans", system-ui, -apple-system, sans-serif;
--font-mono:    "JetBrains Mono", ui-monospace, "SF Mono", monospace;
```

**Heading behavior** (from global.css): `h1–h4` use `--font-heading`, weight 700, `letter-spacing:-0.02em`,
`line-height:1.2`. Note two deliberate overrides — `h3.font-semibold/​.font-bold` drop to **body** font at
0.875rem/600 (they're really UI subheads), and `h4.font-bold/.text-sm` become **mono** 0.68rem/700 uppercase
muted (section eyebrows). **zh disables uppercase + tracking** on those eyebrows
(`:lang(zh) h4.font-bold { text-transform:none; letter-spacing:0 }`).

**Wordmark:** chevron mark + `Bioinfospace` in JetBrains Mono 700, tri-color split `Bio`(ink) `info`(green)
`space`(ink) — lowercase "space", **not** capital-S "Space" (brand rule, see `src/components/Logo.tsx` in the
website repo; LabMate's header wordmark follows the same split). Base font size **16px**, body line-height 1.65.

---

## 3. Color tokens

All values live in `:root` (light) and `[data-theme="dark"]` (dark) in `global.css`. Theme is controlled
**exclusively by the `data-theme` attribute** + toggle button — `prefers-color-scheme` is intentionally *not*
used. Original CSS-var names are preserved for JSX compatibility (do not rename).

### Core — Light (`:root`) / Dark (`[data-theme="dark"]`)

| Token | Light | Dark | Usage |
|-------|-------|------|-------|
| `--bg` | `#F0EEE6` | `#0D0F0C` | page — matte paper / deactivated-CRT near-black |
| `--bg-2` | `#E6E3D8` | `#1B1F19` | secondary surfaces, chips, input fill |
| `--card` | `#FBFAF5` | `#141712` | card surface |
| `--primary` | `#16B364` | `#24D67B` | signal green — **fills / active bg only** |
| `--primary-hover` | `#0B7A3E` | `#3DDC84` | hover |
| `--primary-light` | `#D8F0E1` | `#12281C` | pale green chip fill |
| `--accent` | `#0B7A3E` | `#3DDC84` | green **as text / links** (AA on paper) |
| `--text` | `#141712` | `#E8E9E2` | primary text (15.7:1 / 15.8:1) |
| `--text-muted` | `#57534A` | `#9B9D91` | secondary text (≥6.5:1) |
| `--border` | `#141712` | `#575B4F` | rules — ink (light) / ash hairline (dark) |
| `--border-strong` | `#141712` | `#8A8E80` | crisp structural outlines |
| `--nav-bg` | `#F0EEE6` | `#0D0F0C` | **opaque** nav — no glass |
| `--shadow-ink` | `#141712` | `rgba(203,212,194,.70)` | hard offset shadow color |
| `--on-primary` | `#141712` | `#0D0F0C` | text on green fill (6.6:1 / 10.1:1) |

> **Contrast rule baked into `styleConstants.js`:** `--primary` (#16B364) is a *fill* color and fails AA as
> small text on paper. For green text/links use **`--accent`** (`S_PRIMARY` = `{color:'var(--accent)'}`).

### Semantic & categorical

- **Warning** `--warning-bg/border/text` · **Danger** `--danger-bg/border/text` (`--on-danger` for fill text).
- **ATCG base micro-accents** — `--base-a`(green) `--base-t`(red) `--base-c`(blue) `--base-g`(amber). Use for
  category coding / index letters / sequence strips. Never full-bleed; never >4 together outside a strip.
- **Recipe categories** `--cat-buffer/protocol/staining/media(-bg)`.
- **Inventory sample types** — 9-way theme-aware pairs `--samp-{cell-line,plasmid,antibody,primer,protein,
  reagent,tissue,virus,other}-{bg,text}`.

---

## 4. Shape, shadow, motion

- **Radius:** `--radius: 0`. Tailwind's entire radius scale is zeroed in `@theme`
  (`--radius-xs … --radius-3xl: 0`). `rounded-full` stays circular (dots / spinners / wells) — the only exemption.
- **Shadows:** hard offset, zero blur — `--shadow-sm: 3px 3px 0 var(--shadow-ink)`, `--shadow: 4px 4px 0`,
  `--shadow-lg: 6px 6px 0`. Tailwind's `shadow-*` scale is repointed to the same hard-offset ink in `@theme`.
- **Borders:** default **2px** solid `--border`; use `--border-strong` for outer structural outlines (esp. dark).
- **Motion tokens:** `--ease-out: cubic-bezier(.23,1,.32,1)`, `--ease-snap: cubic-bezier(.2,.85,.15,1)`;
  durations `--duration-fast 120ms / -base 180ms / -slow 260ms`. CSS-first only (transform/opacity). All
  motion must have a `prefers-reduced-motion: reduce` fallback.

---

## 5. Component patterns (LabMate specifics)

- **Nav (desktop):** flat paper, `border-bottom: 2px solid var(--border-strong)`, **no** blur/glass; sticky top,
  z-40. Tab indicator = solid 2px `--primary` ink bar (no gradient/glow), animated via `--ease-out`.
- **Bottom nav (mobile, `< lg`):** `src/components/BottomNav.jsx` — fixed, `lg:hidden`, z-40, 2px top rule.
  Desktop keeps the top tab bar. ⚠️ **Gotcha:** never set `display` in an inline `style={}` on an element that
  relies on `lg:hidden` — inline style beats the utility class and the element leaks onto desktop. Put `flex`
  in `className` instead. (Same rule for `MoreSheet.jsx`, `InstallPrompt.jsx`.)
- **Mobile shell tokens:** `--bottom-nav-h: 56px`; `--fab-b` = safe-area + 1rem on desktop, +nav-height below
  1024px. `main` gets bottom padding to clear the nav on `< lg`. **z-scale:** nav / FAB / TimerBar = 40 ·
  modals & sheets = 50 · toast = 9000 · decorative grain = 9999.
- **Cards:** `bg:var(--card)`, `border:2px solid var(--border)`, radius 0, hard offset shadow.
- **Inputs:** mono font, 2px border, radius 0, green focus ring; **≥16px font on `< 768px`** (iOS zoom-on-focus
  guard, `global.css`). Desktop input size (0.875rem) is untouched by that rule.
- **Filter pills / badges:** `S_PILL_PRIMARY` / `S_PILL_ACCENT` — 2px border, square, mono.
- **Well plate:** circular wells (radius exemption), 2.5px green outline when selected.
- **Protocol timeline:** left ink rule + dot markers.

**Inline-style discipline:** reuse the frozen objects in `src/lib/styleConstants.js` (`S_MUTED`, `S_TEXT`,
`S_PRIMARY`, `S_BORDER`, `S_PILL_*`, `S_BG2`, …) instead of re-creating `{color:'var(--…)'}` per render.

---

## 6. Cross-platform constraint (do not break)

Desktop (**≥ 1024px**) is the promoted-to-production baseline and must stay visually stable. Mobile work is
gated with `useIsMobile()` (`max-width: 767px`, `src/hooks/useMediaQuery.js`), `lg:` Tailwind prefixes, or
`@media (max-width: 1023px)` — **never** ship an ungated style change that also lands on desktop.

---

*LabMate conforms to Bioinfospace DESIGN-SPEC-V2. Tokens transcribed from `src/styles/global.css` — keep them in sync.*
