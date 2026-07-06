// ──────────────────────────────────────────────────────────────────────────────
// Presentational helpers for the agent chat UI (pure, no JSX / no DOM).
// ──────────────────────────────────────────────────────────────────────────────
//
// Two jobs, both unit-tested (agentFormat.test.js):
//   • parseInline(text)  — a tiny, XSS-safe markup tokenizer for **bold** and
//     `code`. Returns tokens the component maps to <strong>/<code>/text — we never
//     inject HTML, so there is no dangerouslySetInnerHTML anywhere in the agent UI.
//   • summarizeToolResult(name, args, result, lang) — turns a tool's JSON result
//     into a compact { tone, title, lines[] } card summary instead of raw JSON.
// ──────────────────────────────────────────────────────────────────────────────

/** Localized, human-readable label for a tool name. */
export function toolLabel(name, lang) {
  const L = TOOL_LABELS[name];
  if (!L) return name;
  return lang === 'zh' ? L.zh : L.en;
}

const TOOL_LABELS = {
  searchProtocols:      { en: 'Searched library',    zh: '检索方案库' },
  getProtocol:          { en: 'Fetched protocol',    zh: '读取方案' },
  queryInventory:       { en: 'Queried inventory',   zh: '查询库存' },
  runCalculator:        { en: 'Ran calculator',      zh: '运行计算器' },
  createExperiment:     { en: 'Created entry',       zh: '创建实验记录' },
  scheduleCalendarEvent:{ en: 'Scheduled timepoints',zh: '安排时间点' },
  exportProtocol:       { en: 'Exported Markdown',   zh: '导出 Markdown' },
};

const CALC_LABELS = {
  dilution: { en: 'dilution', zh: '稀释' },
  mass: { en: 'mass', zh: '质量' },
  molarity: { en: 'molarity', zh: '摩尔浓度' },
  percent: { en: 'percent', zh: '百分比' },
  deadVolume: { en: 'dead-volume', zh: '损耗体积' },
  unitConvert: { en: 'unit-conversion', zh: '单位换算' },
  gel: { en: 'SDS-PAGE gel', zh: 'SDS-PAGE 配胶' },
};

const t2 = (lang, en, zh) => (lang === 'zh' ? zh : en);

/**
 * Compact summary for a tool result.
 * @returns {{ tone:'ok'|'error'|'muted', title:string, lines:string[] }}
 */
export function summarizeToolResult(name, args = {}, result = {}, lang = 'en') {
  const title = toolLabel(name, lang);
  const r = result && typeof result === 'object' ? result : {};

  // ── error / no-result states ──────────────────────────────────────────────
  if (r.error) {
    if (r.error === 'permission_denied') {
      return { tone: 'muted', title, lines: [t2(lang, 'Not run — permission denied.', '未执行——权限被拒绝。')] };
    }
    if (r.error === 'not_found') {
      return { tone: 'muted', title, lines: [t2(lang, 'Not found in the curated library.', '精选库中未找到。')] };
    }
    if (r.error === 'unknown_protocolRef') {
      return { tone: 'error', title, lines: [t2(lang, 'Unknown protocol id — must retrieve first.', '未知方案 id——需先检索。')] };
    }
    const msg = r.message || r.error;
    return { tone: 'error', title, lines: [String(msg)] };
  }

  switch (name) {
    case 'searchProtocols': {
      const n = r.count ?? (Array.isArray(r.results) ? r.results.length : 0);
      const names = (r.results || []).map((h) => h.name).filter(Boolean);
      const lines = [
        args?.query
          ? t2(lang, `“${args.query}” — ${n} result(s)`, `“${args.query}” — ${n} 条结果`)
          : t2(lang, `${n} result(s)`, `${n} 条结果`),
      ];
      if (names.length) lines.push(joinCapped(names, 3, lang));
      return { tone: n ? 'ok' : 'muted', title, lines };
    }
    case 'getProtocol': {
      const steps = Array.isArray(r.steps) ? r.steps.length : 0;
      const label = r.title || r.name || args?.id || '';
      return {
        tone: 'ok', title,
        lines: [label, t2(lang, `${steps} step(s)`, `${steps} 个步骤`)].filter(Boolean),
      };
    }
    case 'queryInventory': {
      const n = r.count ?? (Array.isArray(r.results) ? r.results.length : 0);
      const first = (r.results || [])[0];
      const lines = [t2(lang, `${n} match(es)`, `${n} 条匹配`)];
      if (first) {
        const loc = [first.location, first.box, first.position].filter(Boolean).join(' · ');
        if (first.name) lines.push(loc ? `${first.name} — ${loc}` : first.name);
      }
      return { tone: n ? 'ok' : 'muted', title, lines };
    }
    case 'runCalculator': {
      const kind = r.kind || args?.kind;
      const kLabel = kind && CALC_LABELS[kind] ? t2(lang, CALC_LABELS[kind].en, CALC_LABELS[kind].zh) : kind || '';
      return {
        tone: 'ok',
        title: t2(lang, `Ran ${kLabel} calculator`, `运行${kLabel}计算器`),
        lines: [compactValue(r.result)].filter(Boolean),
      };
    }
    case 'createExperiment': {
      const label = r.title || args?.title || '';
      const when = r.date ? ` · ${r.date}` : '';
      return { tone: 'ok', title, lines: [t2(lang, `“${label}”${when}`, `“${label}”${when}`)] };
    }
    case 'scheduleCalendarEvent': {
      const n = r.created ?? (Array.isArray(r.events) ? r.events.length : 0);
      const dates = (r.events || []).map((e) => e.date).filter(Boolean);
      const lines = [t2(lang, `${n} timepoint(s) scheduled`, `已安排 ${n} 个时间点`)];
      if (dates.length) lines.push(joinCapped(dates, 4, lang));
      return { tone: 'ok', title, lines };
    }
    case 'exportProtocol': {
      return { tone: 'ok', title, lines: [r.filename || ''].filter(Boolean) };
    }
    default:
      return { tone: 'ok', title, lines: [] };
  }
}

// Join a list, capping at `max` items with a localized "+N more" suffix.
function joinCapped(arr, max, lang) {
  const shown = arr.slice(0, max);
  const extra = arr.length - shown.length;
  const base = shown.join(', ');
  return extra > 0 ? base + t2(lang, ` +${extra} more`, ` 等 +${extra}`) : base;
}

// One-line rendering of a calculator result (number, string, or small object).
function compactValue(v) {
  if (v == null) return '';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    return Object.entries(v)
      .filter(([, val]) => val != null && typeof val !== 'object')
      .slice(0, 4)
      .map(([k, val]) => `${k}: ${val}`)
      .join(' · ');
  }
  return String(v);
}

/**
 * Tokenize one line of assistant text into safe inline spans.
 * Supports **bold** and `code`. Unmatched markers are treated as literal text.
 * @returns {Array<{ type:'text'|'bold'|'code', value:string }>}
 */
export function parseInline(text) {
  const str = String(text ?? '');
  if (!str) return [];
  const tokens = [];
  // Alternation: **bold**  |  `code`
  const re = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let m;
  while ((m = re.exec(str)) !== null) {
    if (m.index > last) tokens.push({ type: 'text', value: str.slice(last, m.index) });
    if (m[1] != null) tokens.push({ type: 'bold', value: m[1] });
    else if (m[2] != null) tokens.push({ type: 'code', value: m[2] });
    last = re.lastIndex;
  }
  if (last < str.length) tokens.push({ type: 'text', value: str.slice(last) });
  return tokens;
}
