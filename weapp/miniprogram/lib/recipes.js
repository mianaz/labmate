// Recipe library access: the bundled library (data/recipes.js, generated from the
// web app's recipes.json) plus the user's custom recipes/protocols, and the row
// helpers the web app keeps in RecipeRow.jsx / LibraryView.jsx.
const LIBRARY = require('../data/recipes.js');
const { CATEGORY_DISPLAY, PROTOCOL_SUBCAT_BY_ID, BUFFER_CATEGORIES } = require('../shared/data.js');
const { t } = require('../shared/i18n.js');
const storage = require('./storage');
const bus = require('./bus');

const CUSTOM_RECIPES_KEY = 'labmate_customRecipes';
const CUSTOM_PROTOCOLS_KEY = 'labmate_customProtocols';

const BY_ID = {};
LIBRARY.forEach((r) => { BY_ID[r.id] = r; });
const BUFFERS = LIBRARY.filter((r) => BUFFER_CATEGORIES.includes(r.category));
const PROTOCOLS = LIBRARY.filter((r) => r.category === 'protocol');

const DISC_KEYS = {
  molecular: 'discMolecular', cell: 'discCell', protein: 'discProtein', rna_dna: 'discRnaDna',
  immunology: 'discImmunology', microbiology: 'discMicrobiology', biochemistry: 'discBiochemistry',
  histology: 'discHistology', genomics: 'discGenomics', general: 'discGeneral',
};

// Discipline filters offered by each library (BuffersTab / ProtocolsTab).
const DISCIPLINES = {
  buffers: ['molecular', 'cell', 'protein', 'rna_dna', 'immunology', 'microbiology', 'general'],
  protocols: ['protein', 'cell', 'molecular', 'rna_dna', 'immunology', 'microbiology', 'genomics'],
};

const CAT_COLOR_VARS = {
  buffer: 'var(--cat-buffer)',
  protocol: 'var(--cat-protocol)',
  staining: 'var(--cat-staining)',
  media: 'var(--cat-media)',
};

// ── Custom entries ──────────────────────────────────────────────────────────
function loadCustomRecipes() {
  const v = storage.get(CUSTOM_RECIPES_KEY, []);
  return Array.isArray(v) ? v : [];
}
function saveCustomRecipes(arr) {
  storage.set(CUSTOM_RECIPES_KEY, arr);
  bus.emit('custom');
}
function loadCustomProtocols() {
  const v = storage.get(CUSTOM_PROTOCOLS_KEY, []);
  return Array.isArray(v) ? v : [];
}
function saveCustomProtocols(arr) {
  storage.set(CUSTOM_PROTOCOLS_KEY, arr);
  bus.emit('custom');
}

// Same normalization as BuffersTab / ProtocolsTab.
function customBuffers() {
  return loadCustomRecipes()
    .filter((r) => BUFFER_CATEGORIES.includes(r.category))
    .map((r) => Object.assign({}, r, { _isCustom: true }));
}
function customProtocols() {
  return loadCustomProtocols().map((r) => Object.assign({}, r, { _isCustom: true, category: 'protocol' }));
}

// kind: 'buffers' | 'protocols'
function libraryItems(kind) {
  return kind === 'protocols'
    ? PROTOCOLS.concat(customProtocols())
    : BUFFERS.concat(customBuffers());
}

function allItems() {
  return LIBRARY.concat(customBuffers(), customProtocols());
}

// Library entry, or a custom one (custom ids are prefixed `custom_`).
function getById(id) {
  if (!id) return null;
  if (BY_ID[id]) return BY_ID[id];
  return customBuffers().find((r) => r.id === id) || customProtocols().find((r) => r.id === id) || null;
}

function isProtocol(recipe) {
  return !!recipe && recipe.category === 'protocol';
}

// ── Row helpers (RecipeRow.jsx) ─────────────────────────────────────────────
function categoryLabel(recipe, lang) {
  const displayCat = recipe.category === 'protocol' ? (PROTOCOL_SUBCAT_BY_ID[recipe.id] || 'protocol') : recipe.category;
  const label = CATEGORY_DISPLAY[displayCat];
  return label ? (label[lang] || label.en) : displayCat;
}

function matchesDiscipline(recipe, id) {
  const d = recipe.discipline;
  if (!d) return false;
  return Array.isArray(d) ? d.includes(id) : String(d).toLowerCase().includes(id);
}

function disciplineLabel(recipe, lang) {
  const d = recipe.discipline;
  if (!d) return null;
  if (Array.isArray(d)) return d[0] && DISC_KEYS[d[0]] ? t(DISC_KEYS[d[0]], lang) : null;
  const known = Object.keys(DISC_KEYS).find((id) => String(d).toLowerCase().includes(id));
  if (known) return t(DISC_KEYS[known], lang);
  const text = String(d);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function recipeFacts(recipe) {
  const facts = [];
  const s = recipe.storage || {};
  if (recipe.category === 'protocol') {
    if (s.duration && s.duration !== 'N/A') facts.push(s.duration);
  } else {
    const temp = s.temp || s.temperature;
    if (temp && temp !== 'N/A') facts.push(temp);
    if (recipe.ph) facts.push('pH ' + recipe.ph);
  }
  return facts;
}

// Library list filter (LibraryView.matchesQuery): name, Chinese name, tags,
// reagent names for recipes, material names for protocols.
function matchesQuery(r, q) {
  if (!q) return true;
  if (String(r.name || '').toLowerCase().includes(q) || String(r.nameCn || '').includes(q)) return true;
  if ((r.tags || []).some((tag) => String(tag).toLowerCase().includes(q))) return true;
  const parts = r.category === 'protocol' ? (r.materials || []) : (r.components || []);
  return parts.some((c) => String((c && c.name) || c || '').toLowerCase().includes(q));
}

// Compact view model for one list row — only what the template renders.
function toRow(r, lang, favSet) {
  const isProt = r.category === 'protocol';
  const meta = [];
  const disc = disciplineLabel(r, lang);
  if (disc) meta.push(disc);
  recipeFacts(r).forEach((f) => meta.push(f));
  return {
    id: r.id,
    name: r.name,
    nameCn: lang === 'zh' && r.nameCn && r.nameCn !== r.name ? r.nameCn : '',
    cat: isProt ? '' : categoryLabel(r, lang),
    catColor: CAT_COLOR_VARS[r.category] || CAT_COLOR_VARS.buffer,
    meta: meta.join(' · '),
    custom: !!r._isCustom,
    fav: favSet ? favSet.has(r.id) : false,
  };
}

// ── Global search (GlobalSearchModal.jsx) ───────────────────────────────────
let searchIndex = null;
function buildIndex() {
  const text = (v) => (!v ? '' : typeof v === 'string' ? v : [v.en, v.zh].filter(Boolean).join(' '));
  return allItems().map((r) => ({
    r,
    name: String(r.name || '').toLowerCase(),
    cn: String(r.nameCn || ''),
    tags: (r.tags || []).map((x) => String(x).toLowerCase()),
    comps: (r.components || []).concat(r.materials || [])
      .map((c) => String((c && c.name) || (typeof c === 'string' ? c : '')).toLowerCase()),
    notes: text(r.notes).toLowerCase(),
  }));
}
bus.on('custom', () => { searchIndex = null; });

function search(query, limit) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return [];
  if (!searchIndex) searchIndex = buildIndex();
  return searchIndex.map((e) => {
    let score = 0;
    const nameMatch = e.name.includes(q);
    const compMatch = e.comps.some((c) => c.includes(q));
    const tagMatch = e.tags.some((x) => x.includes(q));
    if (nameMatch) score += 10;
    if (e.cn.includes(q)) score += 8;
    if (tagMatch) score += 5;
    if (compMatch) score += 6;
    if (e.notes.includes(q)) score += 2;
    return { recipe: e.r, score, nameMatch, compMatch, tagMatch };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit || 30);
}

module.exports = {
  LIBRARY, BUFFERS, PROTOCOLS, BY_ID, DISC_KEYS, DISCIPLINES, CAT_COLOR_VARS, BUFFER_CATEGORIES,
  loadCustomRecipes, saveCustomRecipes, loadCustomProtocols, saveCustomProtocols,
  customBuffers, customProtocols, libraryItems, allItems, getById, isProtocol,
  categoryLabel, matchesDiscipline, disciplineLabel, recipeFacts, matchesQuery, toRow, search,
};
