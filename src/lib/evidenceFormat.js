// ──────────────────────────────────────────────────────────────────────────────
// Evidence map ⇄ JSON: a self-describing, AI-native exchange format.
// ──────────────────────────────────────────────────────────────────────────────
//
// The export is meant to be handed to a model (or any tool) as-is: nodes carry
// short ids (C1, E2…) instead of internal ones, links read as sentences, every
// claim carries its status and the logic check's findings ride along, and a
// `guide` block explains the kinds, the relations allowed between them and
// how to propose changes. It imports back as a new map.
//
// Provenance survives the round trip: each node carries a `hash` of its
// content. On import, a node whose content still matches its hash keeps its
// review state; a node that is new or was changed outside LabMate (by a person
// or a model) comes back marked for review. The hash is a change detector,
// not a signature.
//
// Pure: no Dexie, no DOM.
// ──────────────────────────────────────────────────────────────────────────────

import {
  NODE_KINDS, RELATIONS, RELATION_IDS, createEmptyMap, createNode, addNode, connect, nodeLabels, analyzeMap,
} from './evidence.js';

export const EVIDENCE_FORMAT = 'labmate.evidence-map';
export const EVIDENCE_FORMAT_VERSION = 1;

const MAX_NODES = 500;
const MAX_LINKS = 2000;
const MAX_TEXT = 4000;

const GUIDE = {
  purpose: 'The argument behind a research plan: propositions (nodes) joined by typed, directed links. Read every link as "<from> <rel> <to>", e.g. "E1 supports C2". Ids are short labels: Q = question, C = claim, A = assumption, E = evidence, X = experiment.',
  nodeKinds: {
    question: 'What the argument sets out to answer.',
    claim: 'A statement that can be true or false. `conditions` holds when it is meant to hold (cell type, dose, timepoint…).',
    assumption: 'Something the argument takes for granted, e.g. that an antibody or a knockdown is specific.',
    evidence: 'A finding — what was observed or reported, not what it means. `source` is literature, own (own data, may point at a notebook entry) or observation; `citation` is the reference as the researcher gave it.',
    experiment: 'A planned test of a claim or assumption, with the result expected if it holds (`expectIfHolds`), if it does not (`expectIfNot`), its `controls` and an optional library `protocol`.',
  },
  relations: Object.fromEntries(RELATION_IDS.map((r) => [r, {
    from: RELATIONS[r].from,
    to: RELATIONS[r].to,
    meaning: {
      supports: 'is a reason to believe the target',
      contradicts: 'is a reason to doubt the target',
      premise: 'must hold for the target claim to hold',
      tests: 'is designed to decide whether the target holds',
      yields: 'produced this evidence',
      answers: 'is a proposed answer to the question',
    }[r],
  }])),
  statuses: {
    supported: 'evidence (or a supported claim) for it, none against',
    contested: 'evidence both for and against',
    refuted: 'only evidence against',
    testing: 'no evidence yet, but an experiment is planned to test it',
    gap: 'no evidence and no planned test — it rests on nothing yet',
  },
  issueCodes: {
    cycle: 'circular reasoning through supports/contradicts/premise links (nodes list the loop)',
    unreviewed: 'split from a draft or imported, not yet checked by the researcher',
    empty: 'node has no text',
    question_unanswered: 'no claim answers this question',
    claim_refuted: 'only evidence against this claim',
    claim_contested: 'evidence both for and against this claim',
    premise_weak: 'the claim leans on a premise or sub-claim (listed) that does not stand',
    claim_gap: 'the claim rests on no evidence and no planned experiment',
    assumption_untested: 'the assumption has no evidence and no test',
    assumption_unused: 'the assumption is not a premise of any claim',
    evidence_dangling: 'the evidence supports or contradicts nothing',
    evidence_no_source: 'literature evidence without a reference',
    exp_no_target: 'the experiment tests no claim',
    exp_no_prediction: 'the experiment lacks an expected result for "holds" and/or "does not hold"',
    exp_no_controls: 'the experiment lists no controls',
    exp_done_no_outcome: 'the notebook entry is completed but no result was recorded',
  },
  editing: 'To propose changes, return this same JSON with nodes and links edited. Keep `id` and `hash` on nodes you leave unchanged; give new nodes a new id (e.g. "C9") and no hash. Use only the relations above, between the kinds they allow. Never invent evidence, results or citations: a claim without evidence should stay without evidence, and the logic check will flag it. Changed and new nodes are marked for the researcher to review on import.',
};

// ── Content hash (change detection) ───────────────────────────────────────────

// cyrb53 — small, fast, well-distributed 53-bit string hash.
function cyrb53(str) {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, '0');
}

const CONTENT_FIELDS = {
  evidence: ['source', 'citation'],
  experiment: ['predictIfTrue', 'predictIfFalse', 'controls', 'protocolRef'],
};

/** Hash of what a node says (not where it sits or whether it was reviewed). */
export function contentHash(node) {
  const v = (x) => String(x ?? '').trim();
  const parts = [node.kind, v(node.text), v(node.note), ...(CONTENT_FIELDS[node.kind] || []).map((f) => v(node[f]))];
  return cyrb53(JSON.stringify(parts));
}

// ── Export ─────────────────────────────────────────────────────────────────────

/**
 * @param {object} map
 * @param {{ experimentsById?: object, protocolName?: (ref) => string }} [opts]
 * @returns {object} plain JSON-serialisable object
 */
export function mapToJSON(map, { experimentsById = {}, protocolName = () => '' } = {}) {
  const labels = nodeLabels(map);
  const { statuses, issues, experiments, gaps } = analyzeMap(map, { experimentsById });
  const L = (id) => labels[id] || id;
  const put = (o, k, v) => { if (v !== undefined && v !== null && v !== '') o[k] = v; };

  const nodes = map.nodes.map((n) => {
    const o = { id: L(n.id), kind: n.kind, text: n.text || '' };
    put(o, 'conditions', n.note);
    put(o, 'status', statuses[n.id]);
    if (n.kind === 'evidence') {
      o.source = n.source || 'literature';
      put(o, 'citation', n.citation);
      if (n.inconclusive) o.inconclusive = true;
      put(o, 'notebookEntryId', n.experimentId);
    }
    if (n.kind === 'experiment') {
      put(o, 'expectIfHolds', n.predictIfTrue);
      put(o, 'expectIfNot', n.predictIfFalse);
      put(o, 'controls', n.controls);
      if (n.protocolRef) o.protocol = { id: n.protocolRef, ...(protocolName(n.protocolRef) ? { name: protocolName(n.protocolRef) } : {}) };
      const x = experiments.find((e) => e.node.id === n.id);
      if (n.experimentId) {
        o.notebook = { entryId: n.experimentId, stage: x?.stage || 'none' };
        if (x?.entry?.date) o.notebook.date = x.entry.date;
      }
    }
    if (n.sourceQuote && n.sourceQuote !== n.text) o.sourceQuote = n.sourceQuote;
    o.origin = n.origin || 'user';
    o.reviewed = n.reviewed !== false;
    if (map.manualLayout && n.pos) o.position = { x: n.pos.x, y: n.pos.y };
    o.hash = contentHash(n);
    return o;
  });

  const links = map.edges.map((e) => ({
    from: L(e.from), rel: e.rel, to: L(e.to), reads: `${L(e.from)} ${e.rel === 'premise' ? 'is a premise of' : e.rel} ${L(e.to)}`,
  }));

  return {
    format: EVIDENCE_FORMAT,
    version: EVIDENCE_FORMAT_VERSION,
    stability: 'beta', // the format may still change between LabMate releases
    exportedAt: new Date().toISOString(),
    generator: 'LabMate',
    guide: GUIDE,
    map: {
      title: map.title || '',
      ...(map.description ? { description: map.description } : {}),
      layout: map.manualLayout ? 'manual' : 'auto',
    },
    nodes,
    links,
    analysis: {
      gaps: gaps.map(L),
      experimentsToRun: experiments.filter((x) => !x.results.length && x.stage !== 'cancelled').map((x) => L(x.node.id)),
      issues: issues.map((i) => ({ code: i.code, severity: i.severity, nodes: [...new Set([i.nodeId, ...(i.nodeIds || [])])].map(L) })),
    },
  };
}

export function mapToJSONString(map, opts) {
  return JSON.stringify(mapToJSON(map, opts), null, 2);
}

export function jsonFilename(map) {
  const slug = String(map.title || 'evidence-map').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'evidence-map';
  return `${slug}.evidence.json`;
}

// ── Import ─────────────────────────────────────────────────────────────────────

export class EvidenceImportError extends Error {
  constructor(code, message) {
    super(message || code);
    this.code = code; // 'parse' | 'format' | 'empty'
  }
}

const str = (v, max = MAX_TEXT) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/**
 * Parse an exported (or model-edited) evidence map into a NEW map.
 * @param {string|object} input JSON text or the parsed object
 * @returns {{ map, report: { nodes, links, needsReview, droppedNodes, droppedLinks } }}
 * @throws {EvidenceImportError}
 */
export function mapFromJSON(input) {
  let data = input;
  if (typeof input === 'string') {
    // Models often wrap JSON in a ```json fence — accept that.
    const text = input.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
    try { data = JSON.parse(text); } catch { throw new EvidenceImportError('parse', 'Not valid JSON.'); }
  }
  if (!data || typeof data !== 'object' || !Array.isArray(data.nodes)) {
    throw new EvidenceImportError('format', 'Not an evidence map: expected a "nodes" array.');
  }
  if (data.format && data.format !== EVIDENCE_FORMAT) {
    throw new EvidenceImportError('format', `Unknown format "${data.format}".`);
  }

  let map = createEmptyMap({
    title: str(data.map?.title ?? data.title, 200),
    description: str(data.map?.description ?? data.description, 2000),
  });
  const idOf = new Map(); // file id → internal id
  let droppedNodes = 0;
  let needsReview = 0;
  let positioned = 0;

  for (const raw of data.nodes.slice(0, MAX_NODES)) {
    const kind = NODE_KINDS.includes(raw?.kind) ? raw.kind : null;
    const fileId = raw?.id != null ? String(raw.id) : '';
    if (!kind || !fileId || idOf.has(fileId)) { droppedNodes += 1; continue; }
    const patch = { text: str(raw.text), note: str(raw.conditions ?? raw.note) };
    if (kind === 'evidence') {
      patch.source = ['literature', 'own', 'observation'].includes(raw.source) ? raw.source : 'literature';
      patch.citation = str(raw.citation, 500);
      patch.inconclusive = raw.inconclusive === true;
      patch.experimentId = str(raw.notebookEntryId, 100) || null;
    }
    if (kind === 'experiment') {
      patch.predictIfTrue = str(raw.expectIfHolds ?? raw.predictIfTrue);
      patch.predictIfFalse = str(raw.expectIfNot ?? raw.predictIfFalse);
      patch.controls = str(raw.controls);
      patch.protocolRef = str(raw.protocol?.id ?? raw.protocolRef, 200) || null;
      patch.experimentId = str(raw.notebook?.entryId, 100) || null;
    }
    const quote = str(raw.sourceQuote);
    if (quote) patch.sourceQuote = quote;
    if (raw.position && Number.isFinite(raw.position.x) && Number.isFinite(raw.position.y)) {
      patch.pos = { x: Math.max(0, Math.round(raw.position.x)), y: Math.max(0, Math.round(raw.position.y)) };
      positioned += 1;
    }
    const node = createNode(kind, patch);
    // Unchanged since LabMate exported it → keep its review state; anything
    // new or edited elsewhere goes back to the researcher for review.
    const intact = typeof raw.hash === 'string' && raw.hash === contentHash(node);
    if (intact) {
      node.origin = ['user', 'import', 'ai'].includes(raw.origin) ? raw.origin : 'user';
      node.reviewed = raw.reviewed !== false;
    } else {
      node.origin = 'import';
      node.reviewed = false;
    }
    if (!node.reviewed) needsReview += 1;
    idOf.set(fileId, node.id);
    map = addNode(map, node);
  }
  if (!map.nodes.length) throw new EvidenceImportError('empty', 'No usable nodes in this file.');

  let droppedLinks = 0;
  for (const raw of (Array.isArray(data.links) ? data.links : Array.isArray(data.edges) ? data.edges : []).slice(0, MAX_LINKS)) {
    const from = idOf.get(String(raw?.from ?? ''));
    const to = idOf.get(String(raw?.to ?? ''));
    const r = from && to ? connect(map, from, to, raw?.rel) : { error: 'missing' };
    if (r.error) { droppedLinks += 1; continue; }
    map = r.map;
  }
  if (data.map?.layout === 'manual' || positioned > 0) map = { ...map, manualLayout: true };

  return { map, report: { nodes: map.nodes.length, links: map.edges.length, needsReview, droppedNodes, droppedLinks } };
}
