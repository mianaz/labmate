import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Guards against the class of data bug where a recipe's stored reagent amounts
// no longer match its defaultVolume — e.g. amounts computed for 100 mL while
// defaultVolume says 500 mL, so the displayed "Target Volume" and the reagent
// amounts (and their stated final concentrations) disagree.
//
// Strategy: parse the STOCK concentration from a component's name ("1M Tris",
// "10% SDS") and the TARGET concentration from its note ("Final concentration
// 50 mM"). The amount needed is (target/stock) × defaultVolume — if the stored
// amount disagrees, the recipe is internally inconsistent.

// recipes.json lives at the repo root, three levels up from this test file.
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const recipes = JSON.parse(readFileSync(resolve(repoRoot, 'recipes.json'), 'utf-8'));

function stockFromName(name) {
  let m = name.match(/(\d+(?:\.\d+)?)\s*M\b/);
  if (m) return { kind: 'M', value: parseFloat(m[1]) };
  m = name.match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return { kind: '%', value: parseFloat(m[1]) };
  return null;
}

function targetFromNote(note) {
  const text = typeof note === 'object' && note ? note.en || note.zh || '' : note || '';
  if (!text) return null;
  // Skip ranges ("15–25%", "0.1-0.5%") — ambiguous single target.
  if (/\d\s*[-–]\s*\d/.test(text)) return null;
  let m = text.match(/(\d+(?:\.\d+)?)\s*(mM|M|µM|nM|uM)\b/);
  if (m) {
    const f = { M: 1, mM: 1e-3, 'µM': 1e-6, uM: 1e-6, nM: 1e-9 }[m[2]];
    return { kind: 'M', value: parseFloat(m[1]) * f };
  }
  m = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (m) return { kind: '%', value: parseFloat(m[1]) };
  return null;
}

describe('recipes.json concentration ↔ defaultVolume consistency', () => {
  it('every reagent amount matches its noted final concentration at the recipe default volume', () => {
    const problems = [];
    for (const r of recipes) {
      const dv = r.defaultVolume;
      if (r.unit !== 'mL' || typeof dv !== 'number') continue;
      for (const c of r.components || []) {
        if (c.unit !== 'mL' || typeof c.amount !== 'number') continue;
        const stock = stockFromName(c.name || '');
        const target = targetFromNote(c.note);
        if (!stock || !target || stock.kind !== target.kind || stock.value === 0) continue;
        const expected = (target.value * dv) / stock.value;
        if (expected <= 0) continue;
        const rel = Math.abs(c.amount / expected - 1);
        if (rel > 0.02) {
          problems.push(
            `${r.id}: "${c.name}" stored ${c.amount} mL but needs ${expected.toFixed(3)} mL ` +
            `for its noted concentration at ${dv} mL`
          );
        }
      }
    }
    expect(problems, `\n${problems.join('\n')}\n`).toEqual([]);
  });

  it('for all-volumetric buffers, component volumes sum to the default volume', () => {
    const problems = [];
    for (const r of recipes) {
      if (r.category === 'protocol') continue;
      const cs = r.components || [];
      const dv = r.defaultVolume;
      if (r.unit !== 'mL' || typeof dv !== 'number' || cs.length === 0) continue;
      // Only recipes where every component is a numeric mL volume (a true mix).
      if (!cs.every((c) => c.unit === 'mL' && typeof c.amount === 'number')) continue;
      const total = cs.reduce((s, c) => s + c.amount, 0);
      if (Math.abs(total - dv) > Math.max(0.5, dv * 0.01)) {
        problems.push(`${r.id}: components sum to ${total.toFixed(2)} mL but defaultVolume is ${dv} mL`);
      }
    }
    expect(problems, `\n${problems.join('\n')}\n`).toEqual([]);
  });
});
