#!/usr/bin/env node
// The app's bundled recipes.json is taken from the published, signed library
// in mianaz/labmate-recipes (dist/), never edited here.
//
//   npm run recipes:pull    download dist/, verify the signature, write recipes.json
//   npm run recipes:check   fail if the app's Refresh would reject the published
//                           library (bad signature, or it lacks a bundled recipe)
//
// Both use the app's own verifier and pinned key (src/lib/recipeVerify.js).
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { verifyRecipeManifest } from '../src/lib/recipeVerify.js';
import { REMOTE_BASE } from '../src/lib/recipeSource.js';
import { checkPublishedLibrary } from '../src/lib/recipeSyncCheck.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const BUNDLE = resolve(root, 'recipes.json');
const inCI = !!process.env.GITHUB_ACTIONS;
const say = (level, msg) => console.log(inCI && level !== 'info' ? `::${level}::${msg}` : msg);

async function fetchPublished() {
  for (let attempt = 1; ; attempt++) {
    try {
      const [m, r] = await Promise.all([fetch(REMOTE_BASE + 'manifest.json', { cache: 'no-store' }), fetch(REMOTE_BASE + 'recipes.json', { cache: 'no-store' })]);
      if (!m.ok || !r.ok) throw new Error(`HTTP ${m.status}/${r.status}`);
      return { manifest: await m.json(), remoteBytes: new Uint8Array(await r.arrayBuffer()) };
    } catch (err) {
      if (attempt >= 3) throw err;
      await new Promise((z) => setTimeout(z, 2000 * attempt));
    }
  }
}

async function main() {
  const cmd = process.argv[2];
  if (cmd !== 'pull' && cmd !== 'check') {
    console.error('usage: node scripts/recipes-sync.mjs pull|check');
    process.exit(2);
  }
  const { manifest, remoteBytes } = await fetchPublished();

  if (cmd === 'pull') {
    const v = await verifyRecipeManifest(remoteBytes, manifest);
    if (!v.ok) { say('error', `Published library failed verification (${v.reason}); recipes.json left unchanged.`); process.exit(1); }
    writeFileSync(BUNDLE, remoteBytes);
    const n = JSON.parse(new TextDecoder().decode(remoteBytes)).length;
    say('info', `recipes.json ← published library v${v.version} (${manifest.generatedAt}), ${n} recipes, verified.`);
    return;
  }

  const res = await checkPublishedLibrary({ bundleBytes: new Uint8Array(readFileSync(BUNDLE)), remoteBytes, manifest, verify: verifyRecipeManifest });
  if (res.reason === 'unverified' || res.reason === 'bad_payload') {
    say('error', `The published recipe library does not verify (${res.detail || res.reason}). The app's Refresh will reject it.`);
    process.exit(1);
  }
  if (res.reason === 'behind') {
    say('error', `recipes.json has ${res.missing.length} recipe(s) the published library lacks: ${res.missing.join(', ')}. ` +
      'The app\'s Refresh will reject the online library. Add them to mianaz/labmate-recipes (recipes/), let it publish, then run npm run recipes:pull.');
    process.exit(1);
  }
  if (res.identical) {
    say('info', `recipes.json is the published library v${res.version} (${res.added.length} newer recipes: none).`);
  } else {
    say('notice', `recipes.json differs from the published library v${res.version}` +
      (res.added.length ? ` (${res.added.length} newer recipe(s) online: ${res.added.slice(0, 8).join(', ')}${res.added.length > 8 ? '…' : ''})` : '') +
      '. Refresh still works; run npm run recipes:pull before a release to ship the latest library.');
  }
}

main().catch((err) => { say('error', `recipes-sync: ${err?.message || err}`); process.exit(1); });
