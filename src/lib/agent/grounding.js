// ──────────────────────────────────────────────────────────────────────────────
// Grounding check — flag quantities the model STATES in prose that no tool gave.
// ──────────────────────────────────────────────────────────────────────────────
//
// Tool-side validation (tools.js) protects what gets PERSISTED, but the model
// can still type a fabricated number into the chat ("centrifuge at 12,000 rpm")
// that never came from a tool. This is the prose backstop: it extracts
// fabrication-prone quantities — a number bound to a unit, a ratio (1:1000), a
// temperature/time/volume/mass/molarity/percentage — and returns the ones absent
// from the grounding text (tool results + the user's own message). Bare integers
// (counts, dates, step numbers) are intentionally ignored to keep noise low.
//
// It FLAGS, never blocks — the UI shows a subtle "not from a tool" hint so the
// user double-checks. Heuristic by nature; pure and unit-tested.
// ──────────────────────────────────────────────────────────────────────────────

// A number bound to a unit. The trailing \b forces a full-unit match, so a
// single-char unit ('m','s','g') never swallows the head of a longer one
// ('min','sec') — the engine backtracks to the longer alternative.
const QTY_RE = /(\d+(?:[.,]\d+)?)\s?(µl|ul|ml|µg|ug|mg|ng|kg|µmol|umol|mmol|nmol|mol|mm|cm|nm|µm|um|kb|bp|kda|da|rpm|rcf|×g|xg|iu|°c|°f|°|%|mm?ol|mM|µM|uM|nM|pM|M|min|hrs|hr|hours|hour|sec|days|day|s|h|x|×|v|u|g|l)\b/gi;
const RATIO_RE = /\b\d+\s?:\s?\d+\b/g;

function normalize(tok) {
  return tok.toLowerCase().replace(/[\s,]/g, '');
}

/** Extract fabrication-prone quantities from text. Returns [{ raw, norm }]. */
export function extractQuantities(text) {
  const s = String(text ?? '');
  const out = [];
  const seen = new Set();
  for (const re of [QTY_RE, RATIO_RE]) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(s)) !== null) {
      const raw = m[0].trim();
      const norm = normalize(raw);
      if (norm && !seen.has(norm)) { seen.add(norm); out.push({ raw, norm }); }
    }
  }
  return out;
}

/**
 * Quantities present in `assistantText` but not in `sourceText` (tool results +
 * user input). Returns the raw display strings, de-duplicated.
 * @returns {string[]}
 */
export function findUngroundedQuantities(assistantText, sourceText) {
  const src = new Set(extractQuantities(sourceText).map((q) => q.norm));
  const out = [];
  const seen = new Set();
  for (const q of extractQuantities(assistantText)) {
    if (!src.has(q.norm) && !seen.has(q.norm)) { seen.add(q.norm); out.push(q.raw); }
  }
  return out;
}
