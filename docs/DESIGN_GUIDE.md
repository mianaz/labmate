# BioLab Toolkit — UI Design Guide

_For engineers adding features to `/lab_toolkit/index.html`.  
Single-file React app (in-browser Babel) — no build step, no bundler._

---

## Stack

| Layer | Technology |
|---|---|
| UI | React 18 (CDN UMD) + in-browser Babel |
| Styles | Tailwind CSS (CDN) + custom CSS variables |
| Fonts | Bricolage Grotesque · DM Sans · JetBrains Mono |
| State | `useState` / `useLocalStorage` hook |
| i18n | `t(key, lang)` with `I` dictionary object |
| Persistence | `localStorage` via `useLocalStorage` hook (prefix: `biolab_`) |

---

## Color System

**Always use CSS variables. Never hardcode hsl/hex values in JSX.**

| Variable | Role | Value (light) |
|---|---|---|
| `--bg` | Page background | `hsl(40, 20%, 99%)` |
| `--bg-2` | Sidebar / subtle section bg | `hsl(170, 20%, 95%)` |
| `--card` | Card / panel background | `hsl(40, 15%, 98%)` |
| `--primary` | Brand teal — active states, links | `hsl(168, 55%, 26%)` |
| `--primary-hover` | Primary hover tint | `hsl(168, 55%, 32%)` |
| `--primary-light` | Teal tint bg (badges, highlights) | `hsl(170, 20%, 95%)` |
| `--accent` | Secondary dark teal (used sparingly) | `hsl(168, 55%, 22%)` |
| `--accent-light` | Accent tint bg | `hsl(170, 30%, 94%)` |
| `--text` | Primary text | `hsl(200, 25%, 10%)` |
| `--text-muted` | Captions, secondary labels | `hsl(200, 12%, 44%)` |
| `--border` | Dividers, card borders | `hsl(200, 15%, 90%)` |
| `--shadow` | Default card elevation | see `:root` |
| `--shadow-lg` | Modal / elevated overlay | see `:root` |
| `--nav-bg` | Frosted glass nav | `hsla(40, 20%, 99%, 0.85)` |
| `--grad-primary` | Brand gradient (logo, accents) | teal → cyan |
| `--grad-tab` | Tab indicator gradient | teal → cyan |
| `--font-heading` | Bricolage Grotesque family stack | — |
| `--font-body` | DM Sans family stack | — |
| `--font-mono` | JetBrains Mono family stack | — |
| `--radius` | Base border radius | `0.625rem` |

Dark mode flips automatically via `[data-theme="dark"]` and `@media (prefers-color-scheme: dark)`.  
**Never write separate dark-mode overrides — all variables flip automatically.**

```jsx
// ✅ Correct
<div style={{ background: 'var(--card)', color: 'var(--text)' }}>

// ❌ Wrong — never hardcode colours
<div className="bg-white text-gray-900">
<div style={{ background: '#f5f5f0' }}>
```

---

## Typography

```jsx
// Headings — Bricolage Grotesque, tight tracking
fontFamily: 'var(--font-heading)'
letterSpacing: '-0.03em'   // always tighten headings
fontVariationSettings: '"opsz" 32'  // use optical sizing where possible

// Body — DM Sans (inherited, no need to set)

// Numbers / code / formulas
fontFamily: 'var(--font-mono)'
className="font-mono"
```

Font size scale:
- `text-[10px]` / `text-xs` — badges, metadata, kbd shortcuts
- `text-sm` — body, list items, recipe steps (14px)
- `text-base` — inputs, prose (16px)
- `text-xl` / `text-2xl` — tab section headings
- `text-3xl+` — only for hero calculator results

---

## Emoji Policy

**No emoji in UI chrome.** This includes:
- Nav labels, tab names, section headings
- Button labels, placeholder text
- Status messages, empty states
- Any text visible to the user in the interface

**Permitted exceptions:**
- `★ / ☆` for the favorites toggle (functional, no text alternative)
- `⚠️` embedded inside protocol *content text* (scientific warning annotation)
- `icon:` fields in external-tool data objects (never rendered in headings)

**How to add icons to buttons:** Use inline SVG, not emoji.  
Template (download arrow):
```jsx
<svg width="11" height="11" viewBox="0 0 12 12" fill="none"
  stroke="currentColor" strokeWidth="2.2"
  strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
  <path d="M6 1v7M3 6l3 3 3-3"/><line x1="1" y1="11" x2="11" y2="11"/>
</svg>
```

---

## i18n Rules

Every user-visible string goes through `t(key, lang)`.

```js
// 1. Add to the I object (top of script, alphabetical within section):
myNewKey: { en: 'English text', zh: '中文' },

// 2. Consume:
{t('myNewKey', lang)}           // JSX
const s = t('myNewKey', lang)   // JS string context

// 3. Get lang:
const lang = useLang();         // always use the hook, never read localStorage directly
```

**Bilingual data fields** (objects within recipe data):
```js
// Data:  { en: '...', zh: '...' }
// Usage: field[lang] || field.en
```

**`nameCn` display rule** — show only in zh mode:
```jsx
{lang === 'zh' && <p className="text-sm" style={{color:'var(--text-muted)'}}>{recipe.nameCn}</p>}
```

**Notes/tips** — English via `NOTES_EN` lookup, Chinese from `recipe.notes`:
```jsx
{lang === 'en' && NOTES_EN[recipe.id] ? NOTES_EN[recipe.id] : recipe.notes}
```

**Storage conditions** — render without emoji, with "Storage:" label prefix:
```jsx
{t('storageLabel', lang)}: {recipe.storage.label[lang] || recipe.storage.label.zh}
```

**Tags** — keep English-only in data arrays (`'WB'`, `'PCR'`, `'electrophoresis'`).  
**No Chinese tags.** They are used for search matching and display.

---

## Component Patterns

### Card
```jsx
<div className="card p-5">{/* content */}</div>
```
`.card` = `background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow)`.  
Use `p-4`, `p-5`, or `p-6` — not custom values.

### Primary button / DownloadBtn
```jsx
<DownloadBtn label={t('exportAll', lang)} onClick={fn} />
<DownloadBtn small label={t('downloadTxt', lang)} onClick={fn} />
```
Renders with an SVG download arrow. Always use `DownloadBtn` for file actions — don't build ad-hoc download buttons.

### Ghost / secondary button
```jsx
<button style={{ background: 'var(--bg-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
```

### Input
```jsx
<input className="w-full" style={{ fontFamily: 'var(--font-body)' }} />
```
Global input styles set in CSS — don't override border/padding/radius.

### Badge / tag pill
```jsx
<span className="recipe-tag text-[10px]"
  style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
  label
</span>
```

### Category colour map (recipe categories — use these exact values)
```js
const catColors = {
  buffer:   { bg: '#e0f2ef', text: '#0b6e63' },
  protocol: { bg: '#f3e8ff', text: '#7c3aed' },
  staining: { bg: '#fef0ec', text: '#d4552a' },
  media:    { bg: '#eff6ff', text: '#2563eb' },
};
```

### Tip / note box
```jsx
{noteText && (
  <div className="mt-3 p-3 rounded-lg bg-amber-50 border border-amber-200">
    <p className="text-xs text-amber-800">
      <strong>{t('tip', lang)}:</strong> {noteText}
    </p>
  </div>
)}
```

### Two-panel desktop layout (Recipes pattern)
```jsx
<div className="hidden lg:grid lg:grid-cols-12 gap-6">
  <div className="lg:col-span-5"> {/* list */} </div>
  <div className="lg:col-span-7 sticky" style={{ top: '7rem' }}> {/* detail */} </div>
</div>
```
Mobile drill-down:
```jsx
<div className="lg:hidden">
  {!showDetail ? <ListView /> : <DetailView onBack={() => setShowDetail(false)} />}
</div>
```
**Always implement both layouts for new tabs.**

### Section numbering (Guide tab pattern)
```jsx
<span className="text-xs font-mono font-semibold px-2 py-0.5 rounded"
  style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
  0{i + 1}
</span>
```

---

## Adding a New Recipe

```js
{
  id: 'unique_snake_id',          // required — key for all lookups
  name: 'English Name',           // primary label, shown in both modes
  nameCn: '中文名称',             // shown ONLY in zh mode
  category: 'buffer',             // buffer | protocol | staining | media
  tags: ['WB', 'common'],         // English only; used for search + filter
  defaultVolume: 1000,
  unit: 'mL',
  ph: '7.4',                      // optional
  storage: {
    temp: 'RT',                   // RT | 4°C | -20°C | -80°C | N/A
    duration: '12 months',
    icon: '🏠',                   // kept in data only — never rendered
    label: {
      en: 'Room temp, 12 months (autoclave)',
      zh: '室温, 12 个月 (高压灭菌)',
    },
  },
  components: [
    { name: 'Reagent', amount: 5, unit: 'mL', note: 'final conc. 50 mM' },
  ],
  ref: 'Author et al. (Year) Journal...',
  notes: 'Chinese prep notes (shown in zh mode).',
},
```

Then add English notes to the `NOTES_EN` map:
```js
NOTES_EN['unique_snake_id'] = 'English prep notes shown in EN mode.';
```

**Storage label format** — plain text, no emoji, no abbreviations:
- `'Room temp, 12 months'` not `'RT, 1 yr 🏠'`
- `'4°C, prepare fresh'` not `'❄️ Fresh only'`
- `'-20°C aliquots, 6 months; avoid freeze-thaw'`

---

## Adding a New Tab

1. Add key to `tabKeys` array in `Header`
2. Add label key to `tabLabels` + add `{ en: '...', zh: '...' }` to `I`
3. Write `function MyTab() { const lang = useLang(); ... }`
4. Wrap in `<div className="fade-in">` for entrance animation
5. Add to `App` render switch: `{activeTab === 'mytab' && <MyTab />}`
6. Implement both desktop and mobile layouts

---

## Tab Index

| Key | Component | Label (EN) |
|---|---|---|
| `recipes` | `RecipesTab` | Recipes |
| `gel` | `GelTab` | Gel Calculator |
| `calc` | `CalcTab` | Calculator |
| `plate` | `PlateTab` | Plate Designer |
| `tools` | `ToolsTab` | Tools |
| `refs` | `RefsTab` | Guide |

The **Guide** tab (formerly "References") contains usage documentation for each tool section. Literature references are shown inline within each recipe's detail view via `recipe.ref`, not in a separate listing.

---

## Don'ts

| ❌ Don't | ✅ Do instead |
|---|---|
| Hardcode hsl/hex colours | Use `var(--primary)`, `var(--card)`, etc. |
| Use Tailwind colour classes (`bg-green-600`) for brand | Use CSS vars |
| Add emoji to any UI label, heading, or button | Use SVG icons |
| Hardcode any user-visible string | Add to `I` and use `t()` |
| Use Chinese tags in recipe data | Use English-only tags |
| Add new font families | Use the three defined fonts |
| Read `localStorage` directly | Use `useLocalStorage('key', default)` |
| Render `recipe.nameCn` unconditionally | Guard with `{lang === 'zh' && ...}` |
| Render `recipe.storage.icon` | Use `t('storageLabel', lang): recipe.storage.label[lang]` |
| Use `z-index > z-50` without checking modal stack | Audit z-index stack first |
| Add storage icons as emoji in labels | Write plain descriptive text |

---

_Last updated: 2026-03-12_
