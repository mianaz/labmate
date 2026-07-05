// ──────────────────────────────────────────────────────────────────────────────
// Retrieval helpers (pure) — the read side of the agent tool layer.
// ──────────────────────────────────────────────────────────────────────────────
//
// These take data in explicitly (recipe array, inventory object) rather than
// reaching into providers/DB, so they are trivially unit-testable and reusable
// by both the UI and the agent's `searchProtocols` / `queryInventory` tools.
//
// Bio-content rule: retrieval only. These functions surface EXISTING library /
// user data; they never synthesize protocol content.
// ──────────────────────────────────────────────────────────────────────────────

import { normalizeProtocolSteps, recipeTitle } from '../protocolImport.js';

const norm = (s) => String(s == null ? '' : s).toLowerCase();

/**
 * Search a recipe array by free-text query across name / nameCn / tags / usage.
 * @param {Array} recipes  full recipe list (from RecipeProvider)
 * @param {string} query   free text; empty → category-filtered list
 * @param {{category?:string, limit?:number}} [opts]
 * @returns {Array<{id,name,nameCn,category,tags}>} lightweight matches
 */
export function searchRecipes(recipes, query = '', opts = {}) {
  const { category = null, limit = 20 } = opts;
  const list = Array.isArray(recipes) ? recipes : [];
  const q = norm(query).trim();

  const scored = [];
  for (const r of list) {
    if (category && r.category !== category) continue;
    if (!q) { scored.push({ r, score: 0 }); continue; }

    const name = norm(r.name);
    const nameCn = norm(r.nameCn);
    const tags = (r.tags || []).map(norm);
    const usage = norm(r.usage);

    let score = 0;
    if (name === q || nameCn === q) score = 100;
    else if (name.startsWith(q)) score = 80;
    else if (name.includes(q) || nameCn.includes(q)) score = 60;
    else if (tags.some((t) => t.includes(q))) score = 40;
    else if (usage.includes(q)) score = 20;

    if (score > 0) scored.push({ r, score });
  }

  scored.sort((a, b) => b.score - a.score || norm(a.r.name).localeCompare(norm(b.r.name)));
  return scored.slice(0, limit).map(({ r }) => ({
    id: r.id,
    name: r.name,
    nameCn: r.nameCn || '',
    category: r.category,
    tags: r.tags || [],
  }));
}

/**
 * Fetch one recipe by id and return it with normalized (language-aware) steps.
 * @returns {null | {id,name,title,category,steps:string[],materials,notes,ref,recipe}}
 */
export function getProtocol(recipes, id, lang = 'en') {
  const list = Array.isArray(recipes) ? recipes : [];
  const recipe = list.find((r) => r.id === id);
  if (!recipe) return null;
  return {
    id: recipe.id,
    name: recipe.name,
    title: recipeTitle(recipe, lang),
    category: recipe.category,
    steps: normalizeProtocolSteps(recipe, lang),
    materials: recipe.materials || [],
    notes: recipe.notes || '',
    ref: recipe.ref || '',
    recipe,
  };
}

/**
 * Search inventory samples and resolve each hit's human-readable box +
 * location + position. `query` may be either:
 *   • a free-text string → substring match on name / type / tag / owner, or
 *   • a filter object { name?, sampleType?, tag? } → each field ANDed
 *     (name/tag substring, sampleType exact). An empty object matches all.
 * @param {{locations?:Array, boxes?:Array, samples?:Array}} inv
 * @param {string|{name?:string,sampleType?:string,tag?:string}} query
 * @param {{limit?:number}} [opts]
 * @returns {Array<{id,name,sampleType,position,box,location,quantity,concentration,tags}>}
 */
export function queryInventory(inv, query = '', opts = {}) {
  const { limit = 25 } = opts;
  const samples = inv?.samples || [];
  const boxes = inv?.boxes || [];
  const locations = inv?.locations || [];
  const boxById = new Map(boxes.map((b) => [b.id, b]));
  const locById = new Map(locations.map((l) => [l.id, l]));

  const filters = query && typeof query === 'object' ? query : null;
  const q = filters ? '' : norm(query).trim();

  const matches = samples.filter((s) => {
    if (filters) {
      if (filters.name && !norm(s.name).includes(norm(filters.name))) return false;
      if (filters.sampleType && norm(s.sampleType) !== norm(filters.sampleType)) return false;
      if (filters.tag && !(s.tags || []).some((t) => norm(t).includes(norm(filters.tag)))) return false;
      return true;
    }
    if (!q) return true;
    if (norm(s.name).includes(q)) return true;
    if (norm(s.sampleType).includes(q)) return true;
    if ((s.tags || []).some((t) => norm(t).includes(q))) return true;
    if (norm(s.owner).includes(q)) return true;
    return false;
  });

  return matches.slice(0, limit).map((s) => {
    const box = boxById.get(s.boxId) || null;
    const loc = box ? locById.get(box.locationId) || null : null;
    return {
      id: s.id,
      name: s.name || '',
      sampleType: s.sampleType || 'other',
      position: s.position || '',
      box: box ? box.name : '',
      location: loc ? loc.name : '',
      quantity: s.quantity || '',
      concentration: s.concentration || '',
      tags: s.tags || [],
    };
  });
}
