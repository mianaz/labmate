// ──────────────────────────────────────────────────────────────────────────────
// Agent tool registry — { schema, kind, handler, preview } per tool.
// ──────────────────────────────────────────────────────────────────────────────
//
// `schema`   OpenAI/Anthropic-compatible function-calling definition (sent to the LLM).
// `kind`     'read' | 'compute' | 'write' — drives the default permission tier.
// `handler`  async (args, ctx) => result. Reads use ctx's data; writes go through
//            ctx.saveExperiment / ctx.download so this module never imports Dexie
//            or the DOM directly (keeps handlers unit-testable with a fake ctx).
// `preview`  (args, ctx) => string. WRITE tools only — a human-readable summary
//            the permission dialog shows BEFORE the write commits.
//
// ctx shape (supplied by AgentContext):
//   { recipes, lang, loadInventory(), saveExperiment(entry), getExperiment(id),
//     download(text, filename, mime) }
//
// Bio-content rule: tools retrieve or transform EXISTING data. `steps` on
// createExperiment are copied verbatim from a retrieved protocol — the model is
// instructed never to author protocol content (see prompt.js red-lines).
// ──────────────────────────────────────────────────────────────────────────────

import { searchRecipes, getProtocol, queryInventory } from './retrieval.js';
import { experimentToMarkdown, experimentFilename } from './exportProtocol.js';
import {
  dilution, massCalc, molarityCalc, percentCalc, deadVolume, unitConvert, calcGel,
} from '../calculators.js';

// ── read: searchProtocols ───────────────────────────────────────────────────────
const searchProtocols = {
  kind: 'read',
  schema: {
    name: 'searchProtocols',
    description:
      'Search the curated LabMate recipe/protocol library. Returns id, name, category, and tags. This is the ONLY source of protocol content — you must not invent protocols.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keywords: technique, reagent, tags, or Chinese name.' },
        category: { type: 'string', enum: ['protocol', 'buffer', 'media', 'staining', 'any'], default: 'any' },
        discipline: { type: 'string', description: "Optional facet, e.g. 'Molecular','Cell Biology'." },
        limit: { type: 'integer', default: 8 },
      },
      required: ['query'],
    },
  },
  async handler(args, ctx) {
    const { query = '', category = 'any', discipline = '', limit = 8 } = args || {};
    let hits = searchRecipes(ctx.recipes, query, {
      category: category && category !== 'any' ? category : null,
      limit: discipline ? 200 : limit,
    });
    if (discipline) {
      const d = discipline.toLowerCase();
      const byId = new Map((ctx.recipes || []).map((r) => [r.id, r]));
      hits = hits
        .filter((h) => String(byId.get(h.id)?.discipline || '').toLowerCase().includes(d))
        .slice(0, limit);
    }
    return { count: hits.length, results: hits };
  },
};

// ── read: getProtocol ────────────────────────────────────────────────────────────
const getProtocolTool = {
  kind: 'read',
  schema: {
    name: 'getProtocol',
    description: 'Fetch one full protocol by id from the curated library, including ordered steps and reagents.',
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  async handler(args, ctx) {
    const p = getProtocol(ctx.recipes, args?.id, ctx.lang);
    if (!p) return { error: 'not_found', id: args?.id, message: 'No such protocol in the curated library.' };
    // Drop the raw recipe object from the tool result to keep payloads lean.
    const { recipe, ...rest } = p; // eslint-disable-line no-unused-vars
    return rest;
  },
};

// ── read: queryInventory ─────────────────────────────────────────────────────────
const queryInventoryTool = {
  kind: 'read',
  egress: 'local', // result carries the user's private stock + freezer locations — redact before it leaves the device
  schema: {
    name: 'queryInventory',
    description:
      "Look up reagents/samples in the user's local inventory and return their storage location (freezer/box/position). Never invents stock the user does not have.",
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        sampleType: {
          type: 'string',
          enum: ['cell_line', 'plasmid', 'antibody', 'primer', 'protein', 'reagent', 'tissue', 'virus', 'other'],
        },
        tag: { type: 'string' },
      },
    },
  },
  async handler(args, ctx) {
    const inv = await ctx.loadInventory();
    const hits = queryInventory(inv, {
      name: args?.name || '',
      sampleType: args?.sampleType || '',
      tag: args?.tag || '',
    });
    return { count: hits.length, results: hits };
  },
};

// ── compute: runCalculator ───────────────────────────────────────────────────────
const CALC_DISPATCH = {
  dilution: (a) => dilution(a),
  mass: (a) => massCalc(a),
  molarity: (a) => molarityCalc(a),
  percent: (a) => percentCalc(a),
  deadVolume: (a) => deadVolume(a),
  unitConvert: (a) => unitConvert(a.value, a.fromUnit, a.toUnit, a.category),
  gel: (a) => calcGel(a.percentage, a.totalVolume, a.type),
};
const runCalculator = {
  kind: 'compute',
  schema: {
    name: 'runCalculator',
    description:
      'Run a deterministic lab calculation. The model provides numeric inputs; the app computes the result. Use for dilutions, mass/molarity, percent solutions, dead volume, unit conversion, and SDS-PAGE gel recipes.',
    parameters: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          enum: ['dilution', 'mass', 'molarity', 'percent', 'deadVolume', 'unitConvert', 'gel'],
        },
        args: { type: 'object', description: 'Params for the chosen calculator, matching calculators.js signatures.' },
      },
      required: ['kind', 'args'],
    },
  },
  async handler(args) {
    const fn = CALC_DISPATCH[args?.kind];
    if (!fn) return { error: 'unknown_calculator', kind: args?.kind };
    const result = fn(args.args || {});
    if (result == null) return { error: 'invalid_inputs', kind: args.kind };
    return { kind: args.kind, result };
  },
};

// ── write: createExperiment ──────────────────────────────────────────────────────
function buildExperimentEntry({ title, titleZh, protocolRef, date, objectives, steps, reagents, provenance }) {
  const stepList = Array.isArray(steps) ? steps.filter((s) => String(s).trim()) : [];
  return {
    title: title || '',
    titleZh: titleZh || '',
    protocolRef: protocolRef || null,
    date: date || undefined,
    status: 'planned',
    provenance: provenance || null,
    plan: { objectives: objectives || '', notes: '' },
    materials: {
      reagents: (Array.isArray(reagents) ? reagents : []).map((r) => ({
        name: r.name || '', amount: r.amount || '', unit: r.unit || '', location: r.location || '', inventoryRef: null,
      })),
      equipment: [], plateLayout: null, checklist: [],
    },
    procedure: stepList.length
      ? { mode: 'template', protocolSteps: stepList.map((t) => ({ stepText: t, completed: false, deviation: '', actualParams: '' })), freeText: '' }
      : { mode: 'freetext', protocolSteps: [], freeText: '' },
  };
}
const createExperiment = {
  kind: 'write',
  schema: {
    name: 'createExperiment',
    description:
      'Create an editable notebook experiment entry from a retrieved protocol. Steps and reagents are taken from the curated library entry (by protocolRef) — you supply only metadata (title, date, objectives), never protocol content. Writes to local storage only. Requires user permission unless set to auto.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        titleZh: { type: 'string' },
        protocolRef: { type: 'string', description: 'Recipe id from searchProtocols/getProtocol. Its steps and reagents are used verbatim from the library — you do not (and cannot) supply them.' },
        date: { type: 'string', description: 'YYYY-MM-DD' },
        objectives: { type: 'string', description: "The user's goal for this run (free-text metadata, not protocol content)." },
      },
      required: ['title', 'protocolRef'],
    },
  },
  // Preview derives the REAL protocol title, step count, and reagent names from
  // the library so the permission dialog shows what will actually be written —
  // not model-supplied counts the user cannot inspect.
  preview(args, ctx) {
    const ref = args?.protocolRef;
    const proto = ref && ctx?.recipes ? getProtocol(ctx.recipes, ref, ctx.lang) : null;
    if (proto) {
      const reagents = (proto.materials || []).map((m) => (typeof m === 'string' ? m : m?.name || '')).filter(Boolean);
      const rl = reagents.slice(0, 4).join(', ') + (reagents.length > 4 ? '…' : '');
      return `Create notebook entry “${args?.title || proto.title}”${args?.date ? ' on ' + args.date : ''} from “${proto.title}” — ${(proto.steps || []).length} step(s) from the library${reagents.length ? ' · reagents: ' + rl : ''}.`;
    }
    return `Create notebook entry “${args?.title || 'Untitled'}”${args?.date ? ' on ' + args.date : ''}.`;
  },
  async handler(args, ctx) {
    const ref = args?.protocolRef;
    const bad = invalidProtocolRef(ref, ctx);
    if (bad) return bad;
    // Materialize protocol content from the library — the model never authors
    // steps or reagents, so a persisted entry can only contain curated content.
    const proto = getProtocol(ctx.recipes, ref, ctx.lang);
    if (!proto) {
      return { error: 'unknown_protocolRef', protocolRef: ref, message: 'No such protocol in the curated library — call searchProtocols/getProtocol first.' };
    }
    const steps = proto.steps || [];
    const reagents = (proto.materials || []).map((m) => ({
      name: typeof m === 'string' ? m : (m?.name || ''), amount: '', unit: '', location: '',
    })).filter((r) => r.name);
    const saved = await ctx.saveExperiment(buildExperimentEntry({
      title: args?.title, titleZh: args?.titleZh, protocolRef: ref,
      date: args?.date, objectives: args?.objectives, steps, reagents,
      provenance: { source: 'library', protocolRef: ref, verified: true },
    }));
    return { id: saved.id, title: saved.title, date: saved.date, status: saved.status, source: 'library', stepCount: steps.length };
  },
};

// Enforce retrieve-first: reject a protocolRef the library doesn't know, so the
// model must call searchProtocols/getProtocol rather than invent an id. Custom
// protocols (customProtocols store) aren't in ctx.recipes, so we only reject
// when recipes are loaded and the id is genuinely absent.
function invalidProtocolRef(ref, ctx) {
  if (!ref) return null;
  const recipes = ctx?.recipes;
  if (!Array.isArray(recipes) || recipes.length === 0) return null;
  if (recipes.some((r) => r.id === ref)) return null;
  return { error: 'unknown_protocolRef', protocolRef: ref, message: 'Unknown protocol id — call searchProtocols/getProtocol first; do not invent ids.' };
}

// ── write: scheduleCalendarEvent ─────────────────────────────────────────────────
const scheduleCalendarEvent = {
  kind: 'write',
  schema: {
    name: 'scheduleCalendarEvent',
    description:
      'Schedule one or more timepoints on the local calendar for an experiment. Writes local experiment records with dates/times.',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        protocolRef: { type: 'string' },
        occurrences: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' }, startTime: { type: 'string' }, durationMin: { type: 'integer' }, label: { type: 'string' },
            },
            required: ['date'],
          },
        },
      },
      required: ['title', 'occurrences'],
    },
  },
  preview(args) {
    const occ = Array.isArray(args?.occurrences) ? args.occurrences : [];
    const when = occ.map((o) => `${o.date}${o.startTime ? ' ' + o.startTime : ''}${o.label ? ' (' + o.label + ')' : ''}`).join(', ');
    return `Schedule ${occ.length} timepoint(s) for “${args?.title || 'Untitled'}”: ${when}.`;
  },
  async handler(args, ctx) {
    const bad = invalidProtocolRef(args?.protocolRef, ctx);
    if (bad) return bad;
    const occ = Array.isArray(args?.occurrences) ? args.occurrences : [];
    const created = [];
    for (const o of occ) {
      if (!o?.date) continue;
      const saved = await ctx.saveExperiment({
        title: o.label ? `${args.title} — ${o.label}` : args.title,
        protocolRef: args.protocolRef || null,
        date: o.date,
        startTime: o.startTime || '09:00',
        duration: o.durationMin || 60,
        status: 'planned',
      });
      created.push({ id: saved.id, date: saved.date });
    }
    return { created: created.length, events: created };
  },
};

// ── write-ish: exportProtocol (triggers a download) ──────────────────────────────
const exportProtocol = {
  kind: 'write',
  schema: {
    name: 'exportProtocol',
    description: 'Render an experiment/protocol as downloadable Markdown for the user.',
    parameters: {
      type: 'object',
      properties: { experimentId: { type: 'string' }, filename: { type: 'string' } },
      required: ['experimentId'],
    },
  },
  preview(args) {
    return `Download experiment “${args?.experimentId}” as Markdown${args?.filename ? ' → ' + args.filename : ''}.`;
  },
  async handler(args, ctx) {
    const entry = await ctx.getExperiment(args?.experimentId);
    if (!entry) return { error: 'not_found', experimentId: args?.experimentId };
    const md = experimentToMarkdown(entry);
    const filename = args?.filename || experimentFilename(entry);
    ctx.download(md, filename, 'text/markdown');
    return { downloaded: true, filename, bytes: md.length };
  },
};

// ── registry ─────────────────────────────────────────────────────────────────────
export const TOOLS = {
  searchProtocols,
  getProtocol: getProtocolTool,
  queryInventory: queryInventoryTool,
  runCalculator,
  createExperiment,
  scheduleCalendarEvent,
  exportProtocol,
};

/** JSON function-calling schemas for the LLM (OpenAI `tools` array shape). */
export function getToolSchemas() {
  return Object.values(TOOLS).map((t) => ({ type: 'function', function: t.schema }));
}

/** True if the tool mutates local data / triggers a download (needs permission). */
export function isWriteTool(name) {
  return TOOLS[name]?.kind === 'write';
}

/**
 * Egress policy for a tool's RESULT: 'local' = contains the user's private data
 * (inventory, notebook, raw analyzer data) and must be redacted before it
 * reaches a non-local model provider; 'shareable' (default) = safe to send
 * (curated library content, calculations, write confirmations).
 */
export function toolEgress(name) {
  return TOOLS[name]?.egress || 'shareable';
}

/** Human-readable preview for a write tool's args (for the permission dialog). */
export function previewTool(name, args, ctx) {
  const t = TOOLS[name];
  if (!t || typeof t.preview !== 'function') return '';
  try { return t.preview(args, ctx); } catch { return ''; }
}

/**
 * Execute a tool by name. Unknown tool → structured error (never throws for a
 * bad name). Handler exceptions are caught and returned as { error }.
 */
export async function executeTool(name, args, ctx) {
  const t = TOOLS[name];
  if (!t) return { error: 'unknown_tool', name };
  try {
    return await t.handler(args || {}, ctx || {});
  } catch (err) {
    return { error: 'tool_failed', name, message: String(err?.message || err).slice(0, 200) };
  }
}
