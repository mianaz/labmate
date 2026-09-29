#!/usr/bin/env node
// Static checks for the mini program, runnable without WeChat DevTools:
//   • every .json parses; app.json pages/subpackages/tab bar/components resolve
//   • WXML (+ WXS) and WXSS compile with WeChat's own compilers (wcc / wcsc,
//     shipped in the miniprogram-compiler package)
//   • every JS file parses and every relative require() resolves
//   • every i18n key used in templates and JS exists
//   • package sizes stay under WeChat's limits (2 MB main, 2 MB per subpackage)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEAPP = path.resolve(HERE, '..');
const MP = path.join(WEAPP, 'miniprogram');

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const rel = (p) => path.relative(MP, p).split(path.sep).join('/');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const files = walk(MP);
const byExt = (ext) => files.filter((f) => f.endsWith(ext));

// ── JSON ────────────────────────────────────────────────────────────────────
const json = {};
for (const f of byExt('.json')) {
  try { json[rel(f)] = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { err(`${rel(f)}: invalid JSON (${e.message})`); }
}
const app = json['app.json'];
if (!app) { console.error('app.json missing'); process.exit(1); }

const pages = [...app.pages];
const subRoots = [];
for (const sub of app.subPackages || app.subpackages || []) {
  subRoots.push(sub.root.replace(/\/$/, ''));
  for (const p of sub.pages) pages.push(`${sub.root.replace(/\/$/, '')}/${p}`);
}

function checkComponentFiles(base, kind) {
  for (const ext of ['.js', '.wxml', '.json']) {
    if (!fs.existsSync(path.join(MP, base + ext))) err(`${kind} ${base}: missing ${ext}`);
  }
}

for (const p of pages) checkComponentFiles(p, 'page');
for (const item of (app.tabBar && app.tabBar.list) || []) {
  if (!app.pages.includes(item.pagePath)) err(`tabBar page ${item.pagePath} must be in the main package`);
}
if (app.tabBar && app.tabBar.custom) checkComponentFiles('custom-tab-bar/index', 'custom tab bar');

// usingComponents resolve (absolute from the mini program root, or relative).
const components = new Set(['custom-tab-bar/index']);
for (const [file, content] of Object.entries(json)) {
  const using = content && content.usingComponents;
  if (!using) continue;
  for (const [tag, target] of Object.entries(using)) {
    if (target.startsWith('plugin://')) continue;
    const base = target.startsWith('/') ? target.slice(1) : path.posix.join(path.posix.dirname(file), target);
    const norm = path.posix.normalize(base);
    if (!fs.existsSync(path.join(MP, norm + '.js'))) { err(`${file}: component <${tag}> → ${target} not found`); continue; }
    components.add(norm);
    const cj = json[norm + '.json'];
    if (!cj || cj.component !== true) err(`${norm}.json must declare "component": true (used by ${file})`);
    // Main-package code may not reach into a subpackage.
    const inSub = (p) => subRoots.find((r) => p === r || p.startsWith(r + '/'));
    const fromSub = inSub(file);
    const toSub = inSub(norm);
    if (toSub && toSub !== fromSub) err(`${file}: component ${target} lives in subpackage ${toSub}`);
  }
}
for (const c of components) checkComponentFiles(c, 'component');

// ── WXML / WXS (wcc) and WXSS (wcsc) ───────────────────────────────────────
const { wxmlToJs } = require('miniprogram-compiler');
let gwx = null;
try {
  const code = wxmlToJs(MP, { maxBuffer: 64 * 1024 * 1024 });
  const sandbox = { console, Math, Date, JSON, Object, Array, String, Number, Boolean, RegExp, Error };
  sandbox.window = sandbox;
  sandbox.global = {};
  gwx = vm.runInNewContext(`(function (global) {\n${code}\n})`, sandbox)({});
} catch (e) {
  err('WXML compile failed:\n' + String(e.message || e).slice(0, 4000));
}
if (gwx) {
  for (const f of byExt('.wxml')) {
    try {
      const gen = gwx(rel(f));
      if (typeof gen !== 'function') err(`${rel(f)}: not produced by wcc`);
    } catch (e) { err(`${rel(f)}: ${e.message}`); }
  }
}
{
  const wcsc = require('miniprogram-compiler/src/wcsc');
  const list = byExt('.wxss').map((f) => rel(f).replace(/\.wxss$/, ''));
  const out = wcsc(MP, list, { maxBuffer: 64 * 1024 * 1024 });
  if (out instanceof Error) err('WXSS compile failed:\n' + String(out.message).slice(0, 4000));
}

// ── JS: syntax + relative requires ─────────────────────────────────────────
for (const f of byExt('.js')) {
  const src = fs.readFileSync(f, 'utf8');
  try {
    new vm.Script(`(function (require, module, exports, Page, Component, App, Behavior, wx, getApp, getCurrentPages) {\n${src}\n})`, { filename: rel(f) });
  } catch (e) {
    err(`${rel(f)}: ${e.message}`);
    continue;
  }
  for (const m of src.matchAll(/require\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    const spec = m[1];
    if (!spec.startsWith('.') && !spec.startsWith('/')) continue;
    const base = spec.startsWith('/') ? path.join(MP, spec) : path.resolve(path.dirname(f), spec);
    const target = [base, base + '.js', path.join(base, 'index.js')].find((p) => fs.existsSync(p) && fs.statSync(p).isFile());
    if (!target) { err(`${rel(f)}: require('${spec}') not found`); continue; }
    if (!target.startsWith(MP)) err(`${rel(f)}: require('${spec}') leaves the mini program root`);
    const inSub = (p) => subRoots.find((r) => rel(p).startsWith(r + '/'));
    if (inSub(target) && inSub(target) !== inSub(f)) err(`${rel(f)}: requires ${rel(target)} from another package`);
  }
}

// ── i18n keys ──────────────────────────────────────────────────────────────
const i18n = require(path.join(MP, 'shared/i18n.js'));
const missing = new Set();
for (const f of [...byExt('.wxml'), ...byExt('.js')]) {
  if (rel(f).startsWith('shared/') || rel(f).startsWith('data/')) continue;
  const src = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const patterns = f.endsWith('.wxml')
    ? [/\bi\.[tn]\(\s*'([A-Za-z0-9_]+)'/g]
    : [/\b(?:this\.)?t\(\s*'([A-Za-z0-9_]+)'/g, /\b(?:this\.)?tf\(\s*'([A-Za-z0-9_]+)'/g];
  for (const re of patterns) {
    for (const m of src.matchAll(re)) if (!i18n.has(m[1])) missing.add(`${rel(f)}: ${m[1]}`);
  }
}
for (const m of missing) err(`unknown i18n key — ${m}`);

// ── Package sizes ──────────────────────────────────────────────────────────
const LIMIT = 2 * 1024 * 1024;
const sizes = { main: 0 };
for (const r of subRoots) sizes[r] = 0;
for (const f of files) {
  const r = rel(f);
  if (r.endsWith('.md')) continue;
  const sub = subRoots.find((s) => r.startsWith(s + '/'));
  sizes[sub || 'main'] += fs.statSync(f).size;
}
let total = 0;
for (const [pkg, size] of Object.entries(sizes)) {
  total += size;
  const kb = (size / 1024).toFixed(0);
  if (size > LIMIT) err(`package ${pkg} is ${kb} KB (limit 2048 KB)`);
  else if (size > LIMIT * 0.9) warnings.push(`package ${pkg} is ${kb} KB — close to the 2048 KB limit`);
  console.log(`  ${pkg.padEnd(16)} ${kb.padStart(6)} KB`);
}
console.log(`  ${'total'.padEnd(16)} ${(total / 1024).toFixed(0).padStart(6)} KB`);

for (const w of warnings) console.warn('warning: ' + w);
if (errors.length) {
  console.error(`\n${errors.length} problem(s):`);
  for (const e of errors) console.error(' ✗ ' + e);
  process.exit(1);
}
console.log(`\n✓ ${pages.length} pages, ${components.size} components, ${byExt('.wxml').length} wxml, ${byExt('.wxss').length} wxss, ${byExt('.js').length} js — all checks passed`);
