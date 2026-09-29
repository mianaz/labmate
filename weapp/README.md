# LabMate — WeChat Mini Program (微信小程序)

A native WeChat Mini Program port of LabMate: the recipe and protocol library,
calculators, plate designer, sample inventory, experiment notebook, calendar and
bench timers — bilingual (中文 / English), all data on the device, no server.
It works offline; the lab and tools sections are subpackages that WeChat
downloads once on first use (they are preloaded when the app opens).

It is a native mini program (WXML / WXSS / JS, no framework). The recipe library,
translations, calculators, plate-reader parser and the icon set are **generated
from the web app** in `../src` and `../recipes.json`, so both apps stay in step.

## Open it

1. Install [WeChat DevTools](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html).
2. **Import project** → choose this `weapp/` folder. The AppID in
   `project.config.json` is `touristappid` (test mode); put your own AppID there
   to preview on a phone or upload.
3. That's it — generated files are committed, so no build step is needed.

Before uploading, in the mini program admin console (mp.weixin.qq.com):

- **用户隐私保护指引** — declare *剪切板* (copying recipes, links, text) and
  *选择文件* (importing backups and plate-reader files from a chat).
- No server domains are needed: the mini program makes no network requests.

## What's in it

| Tab / page | Web equivalent | Notes |
| --- | --- | --- |
| 配方库 Recipes / 实验方案 Protocols | Library | Filter, favorites, recent, custom entries, detail page with volume scaling, step checklist, step timers, keep-screen-on, copy, share to chat |
| 计算 Calc | Calculator | All calculators + SDS-PAGE gel calculator |
| 孔板 Plate | Plate Designer | Layouts, templates, table view, reader import from a chat file |
| 更多 More | Sidebar / More sheet | Inventory, Notebook, Calendar, Links, Guide, language, backup |
| Search, Timer | ⌘K search, quick timer | |

Not ported: the AI Assistant (needs the Bioinfospace backend, whose domain would
have to be ICP-filed and whitelisted) and the signed remote recipe sync (same
reason) — the library ships inside the package and is refreshed by `npm run sync`.

**Backups are interchangeable with the web app**: *More → Backup* sends a
`labmate-backup-YYYY-MM-DD.json` to a chat; *Import* picks one from a chat. The
format and storage keys are the web app's, so a file exported in the browser
restores in WeChat and vice versa.

### Platform limits worth knowing

- **Storage**: WeChat gives a mini program 10 MB, at most 1 MB per key. Notebook
  entries are stored one per key; the inventory is one key (as in the web app),
  which fits a few thousand samples. A restore that doesn't fit says so.
- **Timers** keep exact time in the background, but WeChat suspends mini
  programs there, so the alarm (vibration + chime) fires when you come back.
  The screen stays on while a timer runs.
- **Links** can't be opened inside a mini program; they are copied instead.

## Develop

```bash
cd weapp
npm ci             # dev tools only (compiler, test runner) — nothing is bundled
npm run sync       # regenerate miniprogram/shared, data, styles/icons.wxss from ../src
npm run check      # compile every WXML/WXSS with WeChat's wcc/wcsc, resolve requires,
                   # check i18n keys and package sizes
npm test           # render pages with miniprogram-simulate and exercise them
npm run verify     # all of the above in CI mode (fails if generated files are stale)
node scripts/preview.cjs pages/recipes/index [--dark] [--query id=pbs_10x] [--full]
                   # approximate screenshot (headless Chromium) for layout review
```

After changing `../recipes.json`, `../src/i18n/translations.js`,
`../src/lib/calculators.js`, `../src/data/*` or `../src/components/icons.jsx`,
run `npm run sync` and commit the regenerated files.

### Layout

```
weapp/
  project.config.json      DevTools project (miniprogramRoot: miniprogram/)
  i18n/*.json              mini-program-only strings { key: { en, zh } }, merged by sync
  scripts/                 sync.mjs · check.mjs · preview.cjs
  test/                    vitest + miniprogram-simulate
  miniprogram/
    app.js / app.json / app.wxss / theme.json
    custom-tab-bar/        bottom navigation
    behaviors/             page.js (every page) · lang.js (every component)
    components/            page-header, library-view, timer-bar, …
    lib/                   storage, lang, recipes, favorites, timers, experiments,
                           backup, format, ui, bus, keep-awake
    shared/  data/  styles/icons.wxss      ← GENERATED, do not edit
    pages/                 main package: the 5 tabs + detail, search, timer, custom-form
    packages/lab/          subpackage: inventory, notebook, calendar
    packages/tools/        subpackage: links, guide
```

### Conventions

- **Pages are `Component()`s** with `behaviors: [require('…/behaviors/page')]`.
  Page lifecycle handlers go in `methods`. Don't define `onShow` — define
  `onPageShow()`; the behavior's `onShow` first syncs language, nav-bar title
  (`data.titleKey` or a `pageTitle()` method) and the tab bar (`data.tabIndex`).
- **Components** use `options: { styleIsolation: 'apply-shared' }` (so the
  global classes in `app.wxss` apply) and `behaviors: [require('…/behaviors/lang')]`.
- **Language**: every page/component has `data.lang` (`'en' | 'zh'`), kept current.
  Templates: `<wxs module="i" src="<relative>/shared/i18n.wxs"/>` then
  `{{i.t('key', lang)}}`, or `{{i.n('resultsCount', lang, n)}}` for `{n}`.
  JS: `this.t('key')`, `this.tf('key', { n })`. Reuse the web's keys
  (`../src/i18n/translations.js`); add new ones to `weapp/i18n/<feature>.json` and
  run `npm run sync`. One-off inline `lang === 'zh' ? '中文' : 'English'` is fine.
  Put `lang-{{lang}}` on the page root so eyebrow styles switch for Chinese.
- **Styles**: design tokens are CSS variables (`var(--text)`, `var(--primary)`,
  …), light and dark. Use the classes in `app.wxss` — `btn / btn-primary /
  btn-ghost / btn-danger / btn-sm / btn-icon / btn-block`, `chip`, `seg` +
  `seg-item`, `panel` / `panel-head` / `panel-title` / `panel-body`, `card`,
  `list` / `list-row`, `badge`, `notice`, `readout`, `meta-grid`, `field` /
  `field-label` / `input` / `textarea` / `picker` (+ `picker-host` on the
  `<picker>` element), `table` / `tr` / `td` / `th`, `timeline` / `step`,
  `sheet` / `mask`, `empty`, layout helpers (`row`, `gap-8`, `flex-1`, `mt-12`, …).
  Active state is `.is-active` (no `aria-pressed` in WXML); press feedback is
  `hover-class="is-pressed"`. Square corners everywhere except plate wells. Sizes in `px`.
- **Icons**: `<view class="icon i-star"></view>` — sized by `font-size`,
  coloured by `color`. Names come from the web's `icons.jsx`
  (`i-flask`, `i-timer`, `i-plus`, `i-trash`, `i-edit`, `i-copy`, …).
- **Storage** goes through `lib/storage.js` with the **web app's key names**
  (`labmate_*`, `biolab_*`, `stepTracker_*`) so backups interoperate.
  Notify other pages through `lib/bus.js`.
- **No DOM, no network.** Use `lib/ui.js`: `toast`, `confirm`, `copy`,
  `actionSheet`, `shareTextFile` (send a file to a chat — the web's download),
  `pickTextFile` (import a file from a chat — the web's file input).
- **Subpackages** may require main-package code (`lib/`, `shared/`, `components/`);
  the main package must never require subpackage code.
