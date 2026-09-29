#!/usr/bin/env node
// Approximate screenshot of a page, without WeChat DevTools: renders the page
// with miniprogram-simulate (WeChat's own wcc compiles the WXML), inlines the
// WXSS (page → root element, rpx → px) and screenshots it in headless Chromium
// at phone width. Good for layout review; the real renderer is DevTools.
//
//   node scripts/preview.cjs pages/recipes/index
//   node scripts/preview.cjs pages/detail/index --query id=pbs_10x --dark --out /tmp/x.png
//   node scripts/preview.cjs pages/timer/index --setup test/previews/timers.cjs
//
// --setup module: module.exports = { seed(wx) {...}, async run(comp, ctx) {...} }
//   seed runs before the page loads (write storage); run after (tap, scroll…).
// --full      full-page screenshot (default: one 375×812 screen)
// --height N  viewport height
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const args = process.argv.slice(2);
const pagePath = args.find((a) => !a.startsWith('--') && !isFlagValue(a));
function isFlagValue(a) {
  const i = args.indexOf(a);
  return i > 0 && ['--query', '--out', '--setup', '--height', '--executable'].includes(args[i - 1]);
}
function flag(name) { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; }
if (!pagePath) {
  console.error('usage: node scripts/preview.cjs <page path> [--query a=1&b=2] [--dark] [--full] [--out file.png] [--setup module]');
  process.exit(1);
}

const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { pretendToBeVisual: true, url: 'https://preview.local/' });
global.window = dom.window;
global.document = dom.window.document;
for (const k of ['Event', 'CustomEvent', 'Element', 'HTMLElement', 'Node', 'MutationObserver', 'getComputedStyle', 'DocumentFragment', 'Text', 'KeyboardEvent', 'MouseEvent', 'TouchEvent']) {
  if (dom.window[k]) global[k] = dom.window[k];
}
try { global.navigator = dom.window.navigator; } catch (e) { /* read-only in newer Node */ }

const { wxMock } = require('../test/helpers/setup.cjs');
const jComponent = require('j-component');

// Built-ins that carry visible state as properties: render it so it shows up.
const field = (tag) => ({
  id: tag, tagName: 'wx-' + tag,
  properties: { value: { type: null, value: '' }, placeholder: { type: String, value: '' }, password: { type: Boolean, value: false } },
  template: '<span class="__pv {{value === \'\' || value === undefined || value === null ? \'__ph\' : \'\'}}">{{value === \'\' || value === undefined || value === null ? placeholder : value}}</span>',
});
jComponent.register(field('input'));
jComponent.register(field('textarea'));
jComponent.register({ id: 'switch', tagName: 'wx-switch', properties: { checked: { type: Boolean, value: false } }, template: '<span class="__sw {{checked ? \'__on\' : \'\'}}"></span>' });
jComponent.register({ id: 'checkbox', tagName: 'wx-checkbox', properties: { checked: { type: Boolean, value: false } }, template: '<span class="__cb {{checked ? \'__on\' : \'\'}}"></span><slot/>' });
jComponent.register({ id: 'radio', tagName: 'wx-radio', properties: { checked: { type: Boolean, value: false } }, template: '<span class="__cb __rd {{checked ? \'__on\' : \'\'}}"></span><slot/>' });
jComponent.register({ id: 'slider', tagName: 'wx-slider', properties: { value: { type: Number, value: 0 }, min: { type: Number, value: 0 }, max: { type: Number, value: 100 } }, template: '<span class="__sl"></span>' });
jComponent.register({ id: 'progress', tagName: 'wx-progress', properties: { percent: { type: Number, value: 0 } }, template: '<span class="__pg"><span style="width:{{percent}}%"></span></span>' });

const mp = require('../test/helpers/mp.cjs');
const MP = mp.ROOT;

function readWxss(file, seen = new Set()) {
  if (seen.has(file) || !fs.existsSync(file)) return '';
  seen.add(file);
  let css = fs.readFileSync(file, 'utf8');
  css = css.replace(/@import\s+["']([^"']+)["'];?/g, (_, p) => readWxss(path.resolve(path.dirname(file), p), seen));
  return css;
}

function allWxss() {
  const out = [readWxss(path.join(MP, 'app.wxss'))];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.wxss') && p !== path.join(MP, 'app.wxss') && !p.includes(`${path.sep}styles${path.sep}`)) out.push(readWxss(p));
    }
  };
  walk(MP);
  return out.join('\n')
    .replace(/(^|[\s,}])page(\s*[{,])/g, '$1.mp-root$2')
    // WXSS tag selectors match the rendered wx-* elements.
    .replace(/(^|[\s,}>+~(])(view|text|input|textarea|scroll-view|picker|button|image|swiper|label|navigator|switch|slider|checkbox|radio)(?=[\s,{:.\[>+~)])/g, '$1wx-$2')
    .replace(/(-?\d*\.?\d+)rpx/g, (_, n) => (parseFloat(n) * 0.5) + 'px');
}

const BASE_CSS = `
html, body { margin: 0; padding: 0; }
body { width: 375px; }
.mp-root { min-height: 100vh; position: relative; }
wx-view, wx-scroll-view, wx-swiper, wx-swiper-item, wx-form, wx-picker-view, wx-movable-area, wx-cover-view, wx-rich-text { display: block; }
wx-scroll-view[scroll-x] { overflow-x: auto; }
wx-text, wx-label, wx-navigator, wx-icon { display: inline; }
wx-text { white-space: pre-wrap; }
wx-input, wx-textarea { display: block; overflow: hidden; white-space: nowrap; }
wx-textarea { white-space: pre-wrap; }
wx-input .__pv { display: flex; align-items: center; height: 100%; }
.__ph { color: var(--text-muted); opacity: .85; }
wx-button { display: block; }
wx-image { display: inline-block; width: 320px; height: 240px; background: var(--bg-2); }
wx-switch { display: inline-block; }
.__sw { display: inline-block; width: 44px; height: 24px; border-radius: 12px; background: var(--bg-3); position: relative; vertical-align: middle; }
.__sw::after { content: ''; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; border-radius: 10px; background: #fff; }
.__sw.__on { background: var(--primary); }
.__sw.__on::after { left: 22px; }
.__cb { display: inline-block; width: 18px; height: 18px; border: 1px solid var(--border); vertical-align: middle; margin-right: 6px; background: var(--card); }
.__cb.__on { background: var(--primary); }
.__rd { border-radius: 50%; }
wx-slider { display: block; padding: 10px 0; }
.__sl { display: block; height: 2px; background: var(--border); }
.__pg { display: block; height: 4px; background: var(--bg-2); } .__pg span { display: block; height: 100%; background: var(--primary); }
`;

function stripPrefixes(html) {
  return html.replace(/class="([^"]*)"/g, (_, cls) => 'class="' + cls.split(/\s+/).map((c) => c.replace(/^[a-z0-9-]+--/, '')).join(' ') + '"');
}

async function main() {
  const setupPath = flag('--setup');
  const setup = setupPath ? require(path.resolve(setupPath)) : {};
  wxMock.__reset();
  if (setup.seed) await setup.seed(wxMock);
  const query = {};
  const q = flag('--query');
  if (q) new URLSearchParams(q).forEach((v, k) => { query[k] = v; });

  const comp = await mp.page(pagePath, query);
  if (setup.run) await setup.run(comp, { mp, wx: wxMock });
  await mp.simulate.sleep(20);

  let html = stripPrefixes(comp.dom.outerHTML);
  const appJson = JSON.parse(fs.readFileSync(path.join(MP, 'app.json'), 'utf8'));
  const tabIndex = ((appJson.tabBar && appJson.tabBar.list) || []).findIndex((x) => x.pagePath === pagePath);
  if (tabIndex >= 0) {
    const bar = mp.load('custom-tab-bar/index');
    bar.setData({ selected: tabIndex });
    await mp.simulate.sleep(0);
    html += stripPrefixes(bar.dom.outerHTML);
  }

  const doc = `<!doctype html><html><head><meta charset="utf-8"><style>${BASE_CSS}\n${allWxss()}</style></head>
<body><div class="mp-root">${html}</div></body></html>`;
  const out = flag('--out') || path.join(require('os').tmpdir(), pagePath.replace(/[/\\]/g, '_') + (args.includes('--dark') ? '.dark' : '') + '.png');
  fs.writeFileSync(out.replace(/\.png$/, '.html'), doc);

  const { chromium } = require('playwright-core');
  const executablePath = flag('--executable') || process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const browser = await chromium.launch({ executablePath });
  const pageCtx = await browser.newPage({
    viewport: { width: 375, height: Number(flag('--height')) || 812 },
    deviceScaleFactor: 2,
    colorScheme: args.includes('--dark') ? 'dark' : 'light',
  });
  await pageCtx.setContent(doc, { waitUntil: 'load' });
  await pageCtx.screenshot({ path: out, fullPage: args.includes('--full') });
  await browser.close();
  console.log(out);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
