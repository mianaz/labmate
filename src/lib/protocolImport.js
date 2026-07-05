// ──────────────────────────────────────────────────────────────────────────────
// Protocol → experiment-record normalization
// ──────────────────────────────────────────────────────────────────────────────
//
// Shared, pure helpers for importing a library/custom recipe into a Notebook
// entry or Calendar event. Kept side-effect-free so they can be unit-tested and
// (later) reused by the agent's `getProtocol` tool.
//
// Recipe step shapes in the wild:
//   • Library protocols   → `briefSteps` is a SINGLE "→"-joined summary line;
//                            `detailedSteps` is the real per-step list, whose
//                            items are localized objects { en, zh, isHeader?,
//                            time?, temp? }. Section headers carry isHeader:true.
//   • Custom recipes       → `briefSteps` is an array of plain strings (already
//                            localized at author time); no `detailedSteps`.
// Localized name lives on `nameCn` (NOT `nameZh`).
// ──────────────────────────────────────────────────────────────────────────────

// Pull the display string for one step in the active language, tolerating both
// object ({ en, zh }) and plain-string forms.
function stepText(step, lang) {
  if (step == null) return '';
  if (typeof step === 'string') return step;
  return step[lang] || step.en || step.zh || step.text || step.step || '';
}

/**
 * Normalize a recipe's procedure into an ordered list of step strings.
 * Prefers `detailedSteps` (the true per-step list), dropping section headers;
 * falls back to `briefSteps` when there is no detailed list (custom recipes).
 * @returns {string[]} non-empty step texts in the given language
 */
export function normalizeProtocolSteps(recipe, lang = 'en') {
  if (!recipe) return [];

  const detailed = Array.isArray(recipe.detailedSteps) ? recipe.detailedSteps : [];
  const actionSteps = detailed.filter((s) => typeof s === 'string' || !s.isHeader);
  const source = actionSteps.length > 0
    ? actionSteps
    : (Array.isArray(recipe.briefSteps) ? recipe.briefSteps : []);

  return source.map((s) => stepText(s, lang)).filter((t) => t.trim().length > 0);
}

/**
 * Normalize a recipe's steps into the `procedure.protocolSteps` records the
 * experiment model expects.
 */
export function toProcedureSteps(recipe, lang = 'en') {
  return normalizeProtocolSteps(recipe, lang).map((text) => ({
    stepText: text,
    completed: false,
    deviation: '',
    actualParams: '',
  }));
}

/**
 * Normalize a recipe's `materials` (array of { name, amount?, unit?, note? } or
 * plain strings) into the reagent records the experiment model expects.
 */
export function toReagents(recipe) {
  const materials = Array.isArray(recipe?.materials) ? recipe.materials : [];
  return materials.map((m) => ({
    name: typeof m === 'string' ? m : (m.name || m.reagent || ''),
    amount: (m && m.amount) || '',
    unit: (m && m.unit) || '',
    location: '',
    inventoryRef: null,
  }));
}

/** Language-aware display title for a recipe. */
export function recipeTitle(recipe, lang = 'en') {
  if (!recipe) return '';
  return lang === 'zh' ? (recipe.nameCn || recipe.name || '') : (recipe.name || '');
}
