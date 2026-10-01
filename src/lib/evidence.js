// ──────────────────────────────────────────────────────────────────────────────
// Evidence maps — the logic behind a research plan as a graph of propositions.
// ──────────────────────────────────────────────────────────────────────────────
//
// A map holds nodes (one proposition each) and typed, directed links between
// them. The researcher splits a draft into nodes, sharpens each one, connects
// them by hand — a link that will not connect is a logic check in itself — and
// the map then says which claims stand on evidence, which rest on nothing, and
// which experiments still have to be run. Experiment nodes hand off to the
// Notebook; a finished notebook entry comes back as evidence.
//
// Everything in this file is pure (maps in, new maps out) so the logic is
// unit-tested without IndexedDB and usable by the agent's tools; persistence
// lives in evidenceStore.js.
//
// Map:   { id, title, description, nodes: Node[], edges: Edge[], createdAt, updatedAt }
// Node:  { id, kind, text, note, origin, reviewed, sourceQuote, createdAt, updatedAt,
//          ...kind fields (see KIND_FIELDS) }
// Edge:  { id, from, to, rel }   — read "from <rel> to": "E1 supports C2"
// ──────────────────────────────────────────────────────────────────────────────

import { toProcedureSteps, toReagents } from './protocolImport.js';

export const NODE_KINDS = ['question', 'claim', 'assumption', 'evidence', 'experiment'];

// Short labels: C1, E2, X3… stable within a map (order of creation within a kind).
export const KIND_PREFIX = { question: 'Q', claim: 'C', assumption: 'A', evidence: 'E', experiment: 'X' };

// Which kinds each relation may join. Anything else is refused by connect().
export const RELATIONS = {
  supports:    { from: ['evidence', 'claim'], to: ['claim', 'assumption'] },
  contradicts: { from: ['evidence', 'claim'], to: ['claim', 'assumption'] },
  premise:     { from: ['assumption'], to: ['claim'] },
  tests:       { from: ['experiment'], to: ['claim', 'assumption'] },
  yields:      { from: ['experiment'], to: ['evidence'] },
  answers:     { from: ['claim'], to: ['question'] },
};
export const RELATION_IDS = Object.keys(RELATIONS);

// Kind-specific fields and their defaults.
const KIND_FIELDS = {
  question: {},
  claim: {},
  assumption: {},
  // source: 'literature' | 'own' | 'observation'. experimentId links a notebook
  // entry; inconclusive marks a recorded result that backs neither side.
  evidence: { source: 'literature', citation: '', experimentId: null, inconclusive: false },
  // What would we see if the claim holds / if it does not, and the controls that
  // make the difference interpretable. experimentId = the notebook entry.
  experiment: { protocolRef: null, predictIfTrue: '', predictIfFalse: '', controls: '', experimentId: null },
};

const rid = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function createEmptyMap(patch = {}) {
  const now = Date.now();
  return { id: rid('emap'), title: '', description: '', nodes: [], edges: [], createdAt: now, updatedAt: now, ...patch };
}

export function createNode(kind, patch = {}) {
  const k = NODE_KINDS.includes(kind) ? kind : 'claim';
  const now = Date.now();
  return {
    id: rid('n'),
    text: '',
    note: '',
    origin: 'user', // 'user' | 'import' (split from pasted text) | 'ai' (assistant split)
    reviewed: true,
    sourceQuote: '',
    ...KIND_FIELDS[k],
    createdAt: now,
    updatedAt: now,
    ...patch,
    kind: k,
  };
}

/** Relations allowed from a node of kind `fromKind` to one of kind `toKind`. */
export function allowedRelations(fromKind, toKind) {
  return RELATION_IDS.filter((r) => RELATIONS[r].from.includes(fromKind) && RELATIONS[r].to.includes(toKind));
}

/**
 * Every way node `a` and node `b` can be linked, in either direction:
 * [{ from, to, rel }]. Used by the link pickers, which offer "E1 supports C2"
 * whichever of the two the user started from.
 */
export function linkOptions(a, b) {
  if (!a || !b || a.id === b.id) return [];
  return [
    ...allowedRelations(a.kind, b.kind).map((rel) => ({ from: a.id, to: b.id, rel })),
    ...allowedRelations(b.kind, a.kind).map((rel) => ({ from: b.id, to: a.id, rel })),
  ];
}

export function isValidEdge(map, edge) {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const from = byId.get(edge.from);
  const to = byId.get(edge.to);
  return !!(from && to && from.id !== to.id && allowedRelations(from.kind, to.kind).includes(edge.rel));
}

const touch = (map) => ({ ...map, updatedAt: Date.now() });

export function addNode(map, node) {
  return touch({ ...map, nodes: [...map.nodes, node] });
}

/**
 * Patch a node. A kind change fills in the new kind's fields and drops the
 * links that are no longer valid for it.
 */
export function updateNode(map, id, patch) {
  const nodes = map.nodes.map((n) => {
    if (n.id !== id) return n;
    const kind = NODE_KINDS.includes(patch?.kind) ? patch.kind : n.kind;
    return { ...KIND_FIELDS[kind], ...n, ...patch, kind, id, updatedAt: Date.now() };
  });
  const next = { ...map, nodes };
  return touch({ ...next, edges: map.edges.filter((e) => isValidEdge(next, e)) });
}

export function removeNode(map, id) {
  return touch({
    ...map,
    nodes: map.nodes.filter((n) => n.id !== id),
    edges: map.edges.filter((e) => e.from !== id && e.to !== id),
  });
}

/**
 * Link two nodes. One link per ordered pair: connecting A→B again with another
 * relation replaces the old one ("supports" becomes "contradicts").
 * @returns {{ map, error?: 'self'|'missing'|'invalid' }}
 */
export function connect(map, from, to, rel) {
  if (from === to) return { map, error: 'self' };
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  if (!byId.has(from) || !byId.has(to)) return { map, error: 'missing' };
  if (!allowedRelations(byId.get(from).kind, byId.get(to).kind).includes(rel)) return { map, error: 'invalid' };
  const edges = map.edges.filter((e) => !(e.from === from && e.to === to));
  return { map: touch({ ...map, edges: [...edges, { id: rid('l'), from, to, rel }] }) };
}

export function disconnect(map, edgeId) {
  return touch({ ...map, edges: map.edges.filter((e) => e.id !== edgeId) });
}

/** Move a node one place among the nodes of its kind (the narrative order). */
export function moveNode(map, id, dir) {
  const idx = map.nodes.findIndex((n) => n.id === id);
  if (idx < 0) return map;
  const kind = map.nodes[idx].kind;
  const step = dir < 0 ? -1 : 1;
  let j = idx + step;
  while (j >= 0 && j < map.nodes.length && map.nodes[j].kind !== kind) j += step;
  if (j < 0 || j >= map.nodes.length) return map;
  const nodes = [...map.nodes];
  [nodes[idx], nodes[j]] = [nodes[j], nodes[idx]];
  return touch({ ...map, nodes });
}

/** { nodeId: 'C1' } — numbered per kind in map order. */
export function nodeLabels(map) {
  const counters = {};
  const out = {};
  for (const n of map.nodes) {
    counters[n.kind] = (counters[n.kind] || 0) + 1;
    out[n.id] = `${KIND_PREFIX[n.kind] || '?'}${counters[n.kind]}`;
  }
  return out;
}

// ── Analysis ───────────────────────────────────────────────────────────────────

/**
 * Status of each claim/assumption, from the links pointing at it:
 *   supported   evidence (or a supported claim) for it, none against
 *   contested   both for and against
 *   refuted     only against
 *   testing     nothing yet, but an experiment is planned to test it
 *   gap         nothing at all — it rests on no evidence and no planned test
 * A claim supported only by another claim inherits that claim's standing, so a
 * chain is only as good as its weakest link. Cycles count as no support.
 */
export function claimStatuses(map) {
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const incoming = new Map();
  for (const e of map.edges) {
    if (!incoming.has(e.to)) incoming.set(e.to, []);
    incoming.get(e.to).push(e);
  }
  const memo = new Map();
  const visiting = new Set();
  const statusOf = (id) => {
    if (memo.has(id)) return memo.get(id);
    if (visiting.has(id)) return 'gap';
    visiting.add(id);
    let sup = 0;
    let con = 0;
    let pending = false;
    for (const e of incoming.get(id) || []) {
      const src = byId.get(e.from);
      if (!src) continue;
      if (e.rel === 'tests') { pending = true; continue; }
      if (e.rel !== 'supports' && e.rel !== 'contradicts') continue;
      let counts = true;
      if (src.kind !== 'evidence') {
        const s = statusOf(src.id);
        counts = s === 'supported';
        if (s === 'testing') pending = true;
      }
      if (counts) { if (e.rel === 'supports') sup += 1; else con += 1; }
    }
    visiting.delete(id);
    const status = sup && con ? 'contested' : con ? 'refuted' : sup ? 'supported' : pending ? 'testing' : 'gap';
    memo.set(id, status);
    return status;
  };
  const out = {};
  for (const n of map.nodes) if (n.kind === 'claim' || n.kind === 'assumption') out[n.id] = statusOf(n.id);
  return out;
}

// Circular reasoning: cycles through supports / contradicts / premise links.
function findCycles(map) {
  const adj = new Map();
  for (const e of map.edges) {
    if (!['supports', 'contradicts', 'premise'].includes(e.rel)) continue;
    if (!adj.has(e.from)) adj.set(e.from, []);
    adj.get(e.from).push(e.to);
  }
  const color = new Map(); // 1 = on stack, 2 = done
  const stack = [];
  const cycles = [];
  const seen = new Set();
  const dfs = (u) => {
    color.set(u, 1);
    stack.push(u);
    for (const v of adj.get(u) || []) {
      if (color.get(v) === 1) {
        const cyc = stack.slice(stack.indexOf(v));
        const key = [...cyc].sort().join('|');
        if (!seen.has(key)) { seen.add(key); cycles.push(cyc); }
      } else if (!color.get(v)) dfs(v);
    }
    stack.pop();
    color.set(u, 2);
  };
  for (const n of map.nodes) if (!color.get(n.id)) dfs(n.id);
  return cycles;
}

const SEVERITY_RANK = { danger: 0, warn: 1, info: 2 };

/**
 * Logic check + experiment plan for a map.
 * @param {object} map
 * @param {{ experimentsById?: Record<string, object> }} [opts] notebook entries,
 *   to read the status of the entry each experiment node points at
 * @returns {{ statuses, issues, experiments, gaps, counts }}
 *   issues: [{ code, severity, nodeId, nodeIds? }] sorted most severe first
 */
export function analyzeMap(map, opts = {}) {
  const experimentsById = opts.experimentsById || {};
  const statuses = claimStatuses(map);
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const out = (id, rel) => map.edges.filter((e) => e.from === id && (!rel || e.rel === rel));
  const inc = (id, rel) => map.edges.filter((e) => e.to === id && (!rel || e.rel === rel));
  const issues = [];
  const push = (code, severity, nodeId, extra) => issues.push({ code, severity, nodeId, ...extra });

  for (const cyc of findCycles(map)) push('cycle', 'danger', cyc[0], { nodeIds: cyc });

  for (const n of map.nodes) {
    if (n.origin !== 'user' && !n.reviewed) push('unreviewed', 'info', n.id);
    if (!String(n.text || '').trim()) push('empty', 'warn', n.id);

    if (n.kind === 'question') {
      if (!inc(n.id, 'answers').length) push('question_unanswered', 'info', n.id);
    } else if (n.kind === 'claim' || n.kind === 'assumption') {
      const s = statuses[n.id];
      // Premises and sub-claims this one leans on that do not stand themselves.
      const weak = n.kind !== 'claim' ? [] : [...inc(n.id, 'premise'), ...inc(n.id, 'supports')]
        .map((e) => byId.get(e.from))
        .filter((src) => src && src.kind !== 'evidence' && ['gap', 'refuted', 'contested'].includes(statuses[src.id]));
      if (s === 'refuted') push('claim_refuted', 'danger', n.id);
      else if (s === 'contested') push('claim_contested', 'warn', n.id);
      else if (weak.length) push('premise_weak', 'warn', n.id, { nodeIds: weak.map((w) => w.id) });
      else if (s === 'gap') push(n.kind === 'claim' ? 'claim_gap' : 'assumption_untested', n.kind === 'claim' ? 'warn' : 'info', n.id);
      if (n.kind === 'assumption' && !out(n.id, 'premise').length) push('assumption_unused', 'info', n.id);
    } else if (n.kind === 'evidence') {
      const backs = out(n.id).filter((e) => e.rel === 'supports' || e.rel === 'contradicts');
      if (!backs.length && !n.inconclusive) push('evidence_dangling', 'info', n.id);
      if (n.source === 'literature' && !String(n.citation || '').trim()) push('evidence_no_source', 'info', n.id);
    } else if (n.kind === 'experiment') {
      if (!out(n.id, 'tests').length) push('exp_no_target', 'warn', n.id);
      if (!String(n.predictIfTrue || '').trim() || !String(n.predictIfFalse || '').trim()) push('exp_no_prediction', 'warn', n.id);
      if (!String(n.controls || '').trim()) push('exp_no_controls', 'info', n.id);
      const entry = n.experimentId ? experimentsById[n.experimentId] : null;
      if (entry?.status === 'completed' && !out(n.id, 'yields').length) push('exp_done_no_outcome', 'warn', n.id);
    }
  }
  issues.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const experiments = map.nodes.filter((n) => n.kind === 'experiment').map((n) => {
    const entry = n.experimentId ? experimentsById[n.experimentId] || null : null;
    return {
      node: n,
      targets: out(n.id, 'tests').map((e) => e.to),
      results: out(n.id, 'yields').map((e) => e.to),
      entry,
      // 'none' = not in the notebook yet; 'missing' = its entry was deleted.
      stage: !n.experimentId ? 'none' : !entry ? 'missing' : entry.status || 'planned',
      designed: !!(String(n.predictIfTrue || '').trim() && String(n.predictIfFalse || '').trim()),
    };
  });

  const gaps = map.nodes.filter((n) => statuses[n.id] === 'gap').map((n) => n.id);

  const counts = { nodes: map.nodes.length, links: map.edges.length };
  for (const k of NODE_KINDS) counts[k] = map.nodes.filter((n) => n.kind === k).length;
  for (const s of ['supported', 'contested', 'refuted', 'testing', 'gap']) {
    counts[`claims_${s}`] = map.nodes.filter((n) => n.kind === 'claim' && statuses[n.id] === s).length;
  }
  counts.experimentsOpen = experiments.filter((x) => !x.results.length && x.stage !== 'cancelled').length;

  return { statuses, issues, experiments, gaps, counts };
}

// ── Splitting a draft into propositions ────────────────────────────────────────

const ABBREVIATIONS = /(?:\bet al|\be\.g|\bi\.e|\bvs|\bcf|\bFig|\bFigs|\bRef|\bRefs|\bapprox|\bca|\bDr|\bSupp|\bSuppl|\bEq|\bvol)\.$/i;

/** Sentences of a draft, Chinese and English punctuation alike. */
export function splitSentences(text) {
  const out = [];
  for (const para of String(text || '').split(/\n\s*\n|\r?\n(?=\s*(?:[-*•·]|\d+[.)、]))/)) {
    let buf = '';
    const chars = [...para.replace(/\s*\r?\n\s*/g, ' ')];
    for (let i = 0; i < chars.length; i++) {
      const ch = chars[i];
      buf += ch;
      if ('。！？；'.includes(ch)) {
        // keep a closing quote/bracket with its sentence
        while (i + 1 < chars.length && '”’」』）)】'.includes(chars[i + 1])) buf += chars[++i];
        out.push(buf); buf = '';
      } else if ('.!?'.includes(ch)) {
        const next = chars[i + 1];
        const after = chars.slice(i + 1).join('').trimStart();
        const endsHere = next === undefined || (/\s/.test(next) && /^[A-Z0-9"“'([一-鿿]/.test(after));
        if (endsHere && !(ch === '.' && ABBREVIATIONS.test(buf.trimEnd()))) { out.push(buf); buf = ''; }
      }
    }
    if (buf.trim()) out.push(buf);
  }
  return out.map((s) => s.replace(/^\s*(?:[-*•·]|\d+[.)、])\s+/, '').trim()).filter((s) => s.replace(/[\s\p{P}]/gu, '').length >= 4);
}

const CITATION_RES = [
  /\bdoi:?\s*10\.\d{4,9}\/[^\s,;)\]]+/i,
  /\b10\.\d{4,9}\/[^\s,;)\]]+/,
  /\bPMID:?\s*\d{5,9}\b/i,
  // (Smith et al., 2020) — also in full-width brackets, as Chinese text writes it
  /[(（](?:[A-Z][\p{L}'-]+)(?:\s+et\s+al\.?|\s+(?:and|&)\s+[A-Z][\p{L}'-]+)?[,，]?\s*(?:19|20)\d{2}[a-z]?(?:[;；,，][^)）]*)?[)）]/u,
  // （张三等，2020）
  /[(（]\p{Script=Han}{1,8}(?:等人?)?[,，]\s*(?:19|20)\d{2}[a-z]?[)）]/u,
  /\[\d+(?:\s*[,–-]\s*\d+)*\]/,
];

/** The first citation-looking span in a sentence ('' if none). */
export function findCitation(sentence) {
  for (const re of CITATION_RES) {
    const m = String(sentence || '').match(re);
    if (m) return m[0].replace(/^[(（]|[)）]$/g, '').trim();
  }
  return '';
}

/**
 * A first guess at what kind of proposition a sentence is. Only a suggestion —
 * the split dialog shows it as an editable choice per sentence.
 */
export function guessKind(sentence) {
  const s = String(sentence || '').trim();
  if (/[?？]$/.test(s) || /^(whether|how|why|what|which|does|do|is|are|can|could)\b/i.test(s) || /是否|如何|为什么|为何|吗[？?]?$/.test(s)) return 'question';
  if (/\b(we (?:will|plan to|propose to|aim to)|to test whether|will be (?:tested|measured|assessed))\b/i.test(s) || /^(?:我们)?(?:将|拟|计划)|拟通过|将通过/.test(s)) return 'experiment';
  if (/\b(assum(?:e|es|ed|ing|ption)|presumably|given that|provided that)\b/i.test(s) || /假设|假定|前提是|默认/.test(s)) return 'assumption';
  if (findCitation(s) || /\b(we (?:found|observed|detected|measured)|(?:was|were) (?:observed|detected|measured)|data show|our data)\b/i.test(s) || /发现|观察到|检测到|数据显示|结果显示|测得/.test(s)) return 'evidence';
  return 'claim';
}

/** Draft → candidate nodes [{ text, kind, citation }] for the split dialog. */
export function splitIntoPropositions(text) {
  return splitSentences(text).map((s) => ({ text: s, kind: guessKind(s), citation: findCitation(s) }));
}

/**
 * Nodes for propositions split from a draft — marked unreviewed until the
 * researcher has checked each one, and keeping the sentence each came from.
 * @param {Array<{kind, text, quote?, citation?}>} items
 * @param {'import'|'ai'} origin
 */
export function nodesFromSplit(items, origin = 'import') {
  return (items || []).map((it) => {
    const citation = it.kind === 'evidence' ? String(it.citation || '').trim() : '';
    return createNode(it.kind, {
      text: String(it.text || '').trim(),
      sourceQuote: String(it.quote ?? it.text ?? '').trim(),
      origin,
      reviewed: false,
      ...(it.kind === 'evidence' ? { citation, source: citation ? 'literature' : 'observation' } : {}),
    });
  });
}

// ── Notebook round trip ────────────────────────────────────────────────────────

const clip = (s, n) => { const t = String(s || '').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/**
 * A notebook entry for an experiment node: the tested claims, predictions and
 * controls go into the objectives — all of it the researcher's own text — and a
 * linked library protocol brings its steps and reagents exactly as the
 * Notebook's own "Import protocol" would.
 */
export function experimentEntrySeed(map, nodeId, { lang = 'en', recipe = null } = {}) {
  const node = map.nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const zh = lang === 'zh';
  const labels = nodeLabels(map);
  const targets = map.edges.filter((e) => e.from === nodeId && e.rel === 'tests')
    .map((e) => map.nodes.find((n) => n.id === e.to)).filter(Boolean);
  const lines = [
    ...targets.map((tg) => `${zh ? '检验' : 'Tests'} ${labels[tg.id]}: ${tg.text}`),
    node.predictIfTrue && `${zh ? '若成立，预期' : 'If it holds, expect'}: ${node.predictIfTrue}`,
    node.predictIfFalse && `${zh ? '若不成立，预期' : 'If not, expect'}: ${node.predictIfFalse}`,
    node.controls && `${zh ? '对照' : 'Controls'}: ${node.controls}`,
  ].filter(Boolean);
  const entry = {
    title: clip(node.text, 120),
    status: 'planned',
    protocolRef: node.protocolRef || null,
    plan: { objectives: lines.join('\n'), notes: node.note || '' },
    evidenceLink: { mapId: map.id, nodeId, mapTitle: map.title || '', label: labels[nodeId] },
  };
  if (recipe) {
    const steps = toProcedureSteps(recipe, lang);
    if (steps.length) entry.procedure = { mode: 'template', protocolSteps: steps, freeText: '' };
    if (recipe.materials) {
      entry.materials = { reagents: toReagents(recipe), equipment: [], plateLayout: null, checklist: [] };
    }
    if (Number.isFinite(recipe.duration)) entry.duration = recipe.duration; // minutes
  }
  return entry;
}

/**
 * Record what an experiment showed: a new evidence node from the experiment
 * ("yields"), linked to the claims it tested as support or contradiction. An
 * inconclusive result is kept as evidence that backs neither side.
 * @returns {{ map, evidenceId }}
 */
export function recordOutcome(map, expNodeId, { outcome, text, targets } = {}) {
  const exp = map.nodes.find((n) => n.id === expNodeId);
  if (!exp) return { map, evidenceId: null };
  const tested = map.edges.filter((e) => e.from === expNodeId && e.rel === 'tests').map((e) => e.to);
  const chosen = Array.isArray(targets) ? targets.filter((t) => tested.includes(t)) : tested;
  const ev = createNode('evidence', {
    text: String(text || '').trim(),
    source: 'own',
    experimentId: exp.experimentId || null,
    inconclusive: outcome === 'inconclusive',
  });
  let next = addNode(map, ev);
  next = connect(next, expNodeId, ev.id, 'yields').map;
  if (outcome === 'supports' || outcome === 'contradicts') {
    for (const t of chosen) next = connect(next, ev.id, t, outcome).map;
  }
  return { map: next, evidenceId: ev.id };
}

// ── Markdown outline ───────────────────────────────────────────────────────────

const STATUS_TEXT = {
  en: { supported: 'supported', contested: 'contested', refuted: 'refuted', testing: 'being tested', gap: 'no evidence yet' },
  zh: { supported: '已有证据支持', contested: '证据相互矛盾', refuted: '被证据反驳', testing: '待实验检验', gap: '尚无证据' },
};
const STAGE_TEXT = {
  en: { none: 'not in the notebook yet', missing: 'notebook entry deleted', planned: 'planned', 'in-progress': 'in progress', completed: 'completed', cancelled: 'cancelled' },
  zh: { none: '尚未加入实验记录本', missing: '实验记录已删除', planned: '已计划', 'in-progress': '进行中', completed: '已完成', cancelled: '已取消' },
};

/**
 * The map as a readable outline — question, then each claim with what backs it,
 * what it rests on and how it is being tested; then the experiments still to
 * run. Deterministic: it reorders and labels the researcher's own text, it
 * never adds any.
 */
export function mapToMarkdown(map, { lang = 'en', experimentsById = {}, protocolName = () => '' } = {}) {
  const zh = lang === 'zh';
  const L = (en, z) => (zh ? z : en);
  const { statuses, experiments, issues } = analyzeMap(map, { experimentsById });
  const labels = nodeLabels(map);
  const byId = new Map(map.nodes.map((n) => [n.id, n]));
  const ref = (id) => `${labels[id]} ${byId.get(id)?.text || ''}`.trim();
  const from = (id, rel) => map.edges.filter((e) => e.to === id && e.rel === rel).map((e) => e.from);
  const to = (id, rel) => map.edges.filter((e) => e.from === id && e.rel === rel).map((e) => e.to);
  const evLine = (id) => {
    const n = byId.get(id);
    if (!n) return '';
    if (n.kind !== 'evidence') return `${ref(id)} (${STATUS_TEXT[lang]?.[statuses[id]] || statuses[id]})`;
    const src = n.source === 'own' ? L('own data', '自有数据') : n.source === 'observation' ? L('observation', '观察') : L('literature', '文献');
    return `${ref(id)} — ${src}${n.citation ? `: ${n.citation}` : ''}`;
  };
  const md = [];
  md.push(`# ${map.title || L('Evidence map', '证据链')}`, '');
  if (map.description) md.push(map.description, '');

  const questions = map.nodes.filter((n) => n.kind === 'question');
  const claims = map.nodes.filter((n) => n.kind === 'claim');
  if (questions.length) {
    md.push(`## ${L('Question', '研究问题')}`, '');
    for (const q of questions) md.push(`- **${labels[q.id]}** ${q.text}`);
    md.push('');
  }
  // Claims that answer a question lead, in map order; the rest follow.
  const main = claims.filter((c) => to(c.id, 'answers').length);
  const rest = claims.filter((c) => !to(c.id, 'answers').length);
  if (claims.length) {
    md.push(`## ${L('Argument', '论证')}`, '');
    for (const c of [...main, ...rest]) {
      md.push(`### ${labels[c.id]} ${c.text}`, '');
      md.push(`*${L('Status', '状态')}: ${STATUS_TEXT[lang]?.[statuses[c.id]] || statuses[c.id]}*`, '');
      if (c.note) md.push(`${L('Conditions / scope', '条件与范围')}: ${c.note}`, '');
      const answers = to(c.id, 'answers');
      if (answers.length) md.push(`- ${L('Answers', '回答')}: ${answers.map((id) => labels[id]).join(', ')}`);
      const sup = from(c.id, 'supports');
      const con = from(c.id, 'contradicts');
      const pre = from(c.id, 'premise');
      const tst = from(c.id, 'tests');
      if (sup.length) { md.push(`- ${L('Evidence for', '支持证据')}:`); sup.forEach((id) => md.push(`  - ${evLine(id)}`)); }
      if (con.length) { md.push(`- ${L('Evidence against', '反面证据')}:`); con.forEach((id) => md.push(`  - ${evLine(id)}`)); }
      if (pre.length) { md.push(`- ${L('Rests on', '依赖前提')}:`); pre.forEach((id) => md.push(`  - ${evLine(id)}`)); }
      if (tst.length) md.push(`- ${L('Tested by', '检验实验')}: ${tst.map((id) => labels[id]).join(', ')}`);
      md.push('');
    }
  }
  const assumptions = map.nodes.filter((n) => n.kind === 'assumption');
  if (assumptions.length) {
    md.push(`## ${L('Assumptions', '前提假设')}`, '');
    for (const a of assumptions) md.push(`- **${labels[a.id]}** ${a.text} — ${STATUS_TEXT[lang]?.[statuses[a.id]] || statuses[a.id]}`);
    md.push('');
  }
  if (experiments.length) {
    md.push(`## ${L('Experiments', '实验计划')}`, '');
    for (const x of experiments) {
      const n = x.node;
      const done = x.results.length > 0;
      md.push(`- [${done ? 'x' : ' '}] **${labels[n.id]}** ${n.text}`);
      if (x.targets.length) md.push(`  - ${L('Tests', '检验')}: ${x.targets.map((id) => labels[id]).join(', ')}`);
      if (n.predictIfTrue) md.push(`  - ${L('If it holds', '若成立')}: ${n.predictIfTrue}`);
      if (n.predictIfFalse) md.push(`  - ${L('If not', '若不成立')}: ${n.predictIfFalse}`);
      if (n.controls) md.push(`  - ${L('Controls', '对照')}: ${n.controls}`);
      const proto = n.protocolRef ? protocolName(n.protocolRef) || n.protocolRef : '';
      if (proto) md.push(`  - ${L('Protocol', '实验方案')}: ${proto}`);
      md.push(`  - ${L('Notebook', '实验记录')}: ${STAGE_TEXT[lang]?.[x.stage] || x.stage}${x.entry?.date ? ` (${x.entry.date})` : ''}`);
      if (done) md.push(`  - ${L('Result', '结果')}: ${x.results.map((id) => labels[id]).join(', ')}`);
    }
    md.push('');
  }
  const gaps = claims.filter((c) => statuses[c.id] === 'gap');
  if (gaps.length || issues.some((i) => i.code === 'cycle')) {
    md.push(`## ${L('Open gaps', '待补的缺口')}`, '');
    for (const c of gaps) md.push(`- ${labels[c.id]} ${c.text}`);
    for (const i of issues.filter((x) => x.code === 'cycle')) {
      md.push(`- ${L('Circular reasoning', '循环论证')}: ${i.nodeIds.map((id) => labels[id]).join(' → ')} → ${labels[i.nodeIds[0]]}`);
    }
    md.push('');
  }
  md.push('---', `*${L('Exported from LabMate', '导出自 LabMate')} · ${new Date().toISOString().slice(0, 10)}*`, '');
  return md.join('\n');
}

export function mapFilename(map) {
  const slug = String(map.title || 'evidence-map').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'evidence-map';
  return `${slug}.md`;
}

// ── Graph layout ───────────────────────────────────────────────────────────────
//
// Auto layout: columns read left to right the way an argument is built:
// experiments → the evidence they yield, and the assumptions claims rest on →
// claims (sub-claims before the claims they support) → questions. Rows are
// ordered to cut down crossings (barycentre); a link that skips a column arcs
// over the nodes in it. Once the researcher drags a node, the map switches to
// a manual layout that keeps every node where it was put.

export const GRAPH = { nodeW: 188, gapX: 52, gapY: 12, pad: 16, lineH: 18, maxLines: 4 };
const ARC_ROOM = 36; // room above/below the nodes for links that arc around a column

// Rough text width in px at the graph's 13px body size (CJK ≈ 1em, Latin ≈ .55em).
function textWidth(s) {
  let w = 0;
  for (const ch of String(s || '')) w += /[⺀-鿿＀-￯]/.test(ch) ? 13 : 7.1;
  return w;
}

export function nodeHeight(node) {
  const lines = Math.min(GRAPH.maxLines, Math.max(1, Math.ceil(textWidth(node.text || ' ') / (GRAPH.nodeW - 22))));
  return 34 + lines * GRAPH.lineH;
}

function autoLayout(map) {
  const { nodeW, gapX, gapY, pad } = GRAPH;
  const claims = map.nodes.filter((n) => n.kind === 'claim');
  const claimIds = new Set(claims.map((c) => c.id));
  // Claim depth = longest chain of claim→claim links ahead of it.
  const outClaims = new Map(claims.map((c) => [c.id, []]));
  for (const e of map.edges) if (claimIds.has(e.from) && claimIds.has(e.to)) outClaims.get(e.from).push(e.to);
  const rank = new Map();
  const visiting = new Set();
  const rankOf = (id) => {
    if (rank.has(id)) return rank.get(id);
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const r = Math.max(-1, ...outClaims.get(id).map(rankOf)) + 1;
    visiting.delete(id);
    rank.set(id, r);
    return r;
  };
  claims.forEach((c) => rankOf(c.id));
  const maxRank = Math.max(0, ...rank.values());

  const slot = (n) => {
    switch (n.kind) {
      case 'experiment': return 0;
      case 'evidence':
      case 'assumption': return 1;
      case 'claim': return 2 + (maxRank - (rank.get(n.id) || 0));
      default: return 3 + maxRank; // question
    }
  };
  // Drop empty columns.
  const used = [...new Set(map.nodes.map(slot))].sort((a, b) => a - b);
  const colOf = new Map(map.nodes.map((n) => [n.id, used.indexOf(slot(n))]));
  const columns = used.map(() => []);
  map.nodes.forEach((n) => columns[colOf.get(n.id)].push(n));

  const neighbours = new Map(map.nodes.map((n) => [n.id, []]));
  for (const e of map.edges) {
    if (neighbours.has(e.from) && neighbours.has(e.to)) {
      neighbours.get(e.from).push(e.to);
      neighbours.get(e.to).push(e.from);
    }
  }
  const pos = new Map();
  const index = () => columns.forEach((col) => col.forEach((n, i) => pos.set(n.id, i / Math.max(1, col.length - 1))));
  index();
  const sweep = (order) => {
    for (const ci of order) {
      const col = columns[ci];
      const key = new Map(col.map((n) => {
        const ns = neighbours.get(n.id).filter((m) => colOf.get(m) !== ci);
        return [n.id, ns.length ? ns.reduce((s, m) => s + pos.get(m), 0) / ns.length : pos.get(n.id)];
      }));
      col.sort((a, b) => key.get(a.id) - key.get(b.id));
      col.forEach((n, i) => pos.set(n.id, i / Math.max(1, col.length - 1)));
    }
  };
  const fwd = columns.map((_, i) => i);
  for (let k = 0; k < 3; k++) { sweep(fwd.slice(1)); sweep([...fwd].reverse().slice(1)); }

  const heights = columns.map((col) => col.reduce((s, n) => s + nodeHeight(n), 0) + gapY * Math.max(0, col.length - 1));
  const tallest = Math.max(0, ...heights);
  const top = pad + ARC_ROOM;
  const boxes = new Map();
  columns.forEach((col, ci) => {
    let y = top + (tallest - heights[ci]) / 2;
    for (const n of col) {
      const h = nodeHeight(n);
      boxes.set(n.id, { id: n.id, x: pad + ci * (nodeW + gapX), y, w: nodeW, h, col: ci });
      y += h + gapY;
    }
  });
  return {
    boxes,
    width: pad * 2 + Math.max(1, columns.length) * nodeW + Math.max(0, columns.length - 1) * gapX,
    height: top + tallest + pad + ARC_ROOM / 2,
  };
}

// Auto layout: left to right, column to column.
function autoEdgePath(a, b, boxes) {
  const sx = a.x + a.w;
  const sy = a.y + a.h / 2;
  const tx = b.x;
  const ty = b.y + b.h / 2;
  const span = b.col - a.col;
  // A link that skips a column would run behind the nodes standing in it:
  // send it over (or under) the whole column instead, whichever is shorter.
  const between = span > 1 ? [...boxes.values()].filter((bx) => bx.col > a.col && bx.col < b.col) : [];
  const blocked = between.some((bx) => bx.y - 6 < Math.max(sy, ty) && bx.y + bx.h + 6 > Math.min(sy, ty));
  if (blocked) {
    const dx = (tx - sx) / 2;
    const y0 = (sy + ty) / 2;
    const over = Math.min(...between.map((bx) => bx.y)) - 12;
    const under = Math.max(...between.map((bx) => bx.y + bx.h)) + 12;
    const peak = y0 - over <= under - y0 ? over : under;
    const cy = y0 + (peak - y0) / 0.75; // a cubic reaches ¾ of the way to its control points
    return `M${sx},${sy} C${sx + dx},${cy} ${tx - dx},${cy} ${tx},${ty}`;
  }
  if (span >= 1) {
    const dx = (tx - sx) / 2;
    return `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`;
  }
  // Same or earlier column (a cycle, or a link the layering could not order):
  // loop out to the right and come back in from the left.
  const bend = GRAPH.gapX * 0.8;
  return `M${sx},${sy} C${sx + bend},${sy} ${tx - bend},${ty} ${tx},${ty}`;
}

// Manual layout: nodes can sit anywhere, so leave from the side that faces the
// other node — left/right when they are further apart sideways, else top/bottom.
function manualEdgePath(a, b) {
  const acx = a.x + a.w / 2;
  const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2;
  const bcy = b.y + b.h / 2;
  const gapH = Math.abs(bcx - acx) - (a.w + b.w) / 2;
  const gapV = Math.abs(bcy - acy) - (a.h + b.h) / 2;
  if (gapH >= gapV) {
    const dir = bcx >= acx ? 1 : -1;
    const sx = dir > 0 ? a.x + a.w : a.x;
    const tx = dir > 0 ? b.x : b.x + b.w;
    const bend = Math.max(36, Math.abs(tx - sx) / 2);
    return `M${sx},${acy} C${sx + dir * bend},${acy} ${tx - dir * bend},${bcy} ${tx},${bcy}`;
  }
  const dir = bcy >= acy ? 1 : -1;
  const sy = dir > 0 ? a.y + a.h : a.y;
  const ty = dir > 0 ? b.y : b.y + b.h;
  const bend = Math.max(28, Math.abs(ty - sy) / 2);
  return `M${acx},${sy} C${acx},${sy + dir * bend} ${bcx},${ty - dir * bend} ${bcx},${ty}`;
}

const validPos = (p) => !!p && Number.isFinite(p.x) && Number.isFinite(p.y);

/**
 * Where every node and link goes. Auto layout unless the researcher has
 * arranged the map by hand (map.manualLayout, node.pos); a node added after
 * that lands under everything, in its auto column.
 * @returns {{ boxes: Map<id,{x,y,w,h,col}>, edges: Array, width, height, manual }}
 */
export function layoutGraph(map) {
  const { nodeW, gapY, pad } = GRAPH;
  const auto = autoLayout(map);
  const manual = !!map.manualLayout;
  let { boxes, width, height } = auto;
  if (manual) {
    boxes = new Map();
    const placed = map.nodes.filter((n) => validPos(n.pos));
    for (const n of placed) {
      boxes.set(n.id, { id: n.id, x: Math.max(0, n.pos.x), y: Math.max(0, n.pos.y), w: nodeW, h: nodeHeight(n), col: -1 });
    }
    const floor = Math.max(pad, ...[...boxes.values()].map((b) => b.y + b.h)) + gapY * 2;
    const nextY = new Map();
    for (const n of map.nodes) {
      if (boxes.has(n.id)) continue;
      const a = auto.boxes.get(n.id);
      const y = nextY.get(a.x) ?? floor;
      boxes.set(n.id, { id: n.id, x: a.x, y, w: nodeW, h: a.h, col: -1 });
      nextY.set(a.x, y + a.h + gapY);
    }
    const all = [...boxes.values()];
    width = Math.max(pad * 2 + nodeW, ...all.map((b) => b.x + b.w + pad));
    height = Math.max(pad * 2, ...all.map((b) => b.y + b.h + pad));
  }
  const edges = map.edges.filter((e) => boxes.has(e.from) && boxes.has(e.to)).map((e) => {
    const a = boxes.get(e.from);
    const b = boxes.get(e.to);
    return { ...e, path: manual ? manualEdgePath(a, b) : autoEdgePath(a, b, boxes) };
  });
  return { boxes, edges, width, height, manual };
}

/**
 * Move one node by hand. The first move freezes every node where the auto
 * layout had it, so arranging one node never shuffles the rest.
 */
export function setNodePosition(map, id, x, y) {
  const { boxes } = layoutGraph(map);
  const snap = (v) => Math.max(0, Math.round(v / 4) * 4);
  const nodes = map.nodes.map((n) => {
    if (n.id === id) return { ...n, pos: { x: snap(x), y: snap(y) } };
    if (map.manualLayout && validPos(n.pos)) return n;
    const b = boxes.get(n.id);
    return b ? { ...n, pos: { x: b.x, y: b.y } } : n;
  });
  return touch({ ...map, manualLayout: true, nodes });
}

/** Drop every hand-placed position and go back to the auto layout. */
export function resetLayout(map) {
  // eslint-disable-next-line no-unused-vars
  return touch({ ...map, manualLayout: false, nodes: map.nodes.map(({ pos, ...n }) => n) });
}
