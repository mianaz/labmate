// Evidence map — the logic behind a research plan, and the experiments it still
// needs. A draft is split into propositions; the researcher sharpens each node
// and connects them by hand; LabMate checks the logic (claims resting on
// nothing, circular support, experiments without predictions or controls) and
// turns the gaps into experiments that run through the Notebook and come back
// as evidence. See lib/evidence.js for the model.
import { useState, useMemo, useEffect, useCallback } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { useToast } from '../../components/Toast.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import BetaBadge from '../../components/BetaBadge.jsx';
import { useIsMobile } from '../../hooks/useMediaQuery.js';
import { useRecipes } from '../../lib/RecipeProvider.jsx';
import { useExperiments, saveExperimentRecord } from '../../lib/experiments.js';
import { downloadText } from '../../lib/agent/exportProtocol.js';
import { mapToJSONString, jsonFilename, mapFromJSON } from '../../lib/evidenceFormat.js';
import {
  createEmptyMap, addNode, updateNode, removeNode, connect, moveNode, linkOptions,
  nodeLabels, analyzeMap, nodesFromSplit, experimentEntrySeed, recordOutcome, mapToMarkdown, mapFilename,
  setNodePosition, resetLayout,
} from '../../lib/evidence.js';
import { useEvidenceMaps } from '../../lib/evidenceStore.js';
import NodeDialog, { KindTag } from './NodeDialog.jsx';
import EvidenceGraph from './EvidenceGraph.jsx';
import { SplitDialog, OutcomeDialog, RelationChooser, MapDetailsDialog, ExportDialog, ImportDialog } from './EvidenceDialogs.jsx';
import { tx, STATUS_META, SEVERITY_META, relPhrase } from './evidenceText.js';
import {
  IconPlus, IconSearch, IconDownload, IconEdit, IconChevronLeft, IconChevronDown, IconNotebook,
  IconLink, IconFile, IconArrowRight, IconAlert, IconCheck, IconGraph, IconUpload, IconInfo, IconClose,
} from '../../components/icons.jsx';

// Cross-tab hand-offs (same sessionStorage convention as Notebook ↔ Calendar).
const NOTEBOOK_FOCUS_KEY = 'labmate_notebook_focus';
const EVIDENCE_FOCUS_KEY = 'labmate_evidence_focus';
const VIEW_KEY = 'labmate_evidence_view';
const BETA_NOTE_KEY = 'labmate_evidence_beta_seen';
function takeHandoff(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    window.sessionStorage.removeItem(key);
    const value = raw ? JSON.parse(raw) : null;
    return value && Date.now() - (value.at || 0) < 60000 ? value : null;
  } catch { return null; }
}
function giveHandoff(key, value) {
  try { window.sessionStorage.setItem(key, JSON.stringify({ ...value, at: Date.now() })); } catch { /* storage off */ }
}
function readPref(key, fallback) {
  try { return window.localStorage.getItem(key) || fallback; } catch { return fallback; }
}
function writePref(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* storage off */ }
}

const pad2 = (n) => String(n).padStart(2, '0');
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function formatDay(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
const clip = (s, n) => { const v = String(s || '').trim(); return v.length > n ? `${v.slice(0, n - 1)}…` : v; };

const STAGE_KEY = { planned: 'nbStatusPlanned', 'in-progress': 'nbStatusInProgress', completed: 'nbStatusCompleted', cancelled: 'nbStatusCancelled' };
const STAGE_TONE = {
  none: { fg: 'var(--text-muted)', bg: 'transparent' },
  missing: { fg: 'var(--danger-text)', bg: 'var(--danger-bg)' },
  planned: { fg: 'var(--base-c)', bg: 'var(--cat-media-bg)' },
  'in-progress': { fg: 'var(--warning-text)', bg: 'var(--warning-bg)' },
  completed: { fg: 'var(--accent)', bg: 'var(--primary-light)' },
  cancelled: { fg: 'var(--text-muted)', bg: 'var(--bg-2)' },
};

function StatusBadge({ status, lang }) {
  const m = STATUS_META[status];
  if (!m) return null;
  return (
    <span className="badge" style={{ '--badge-fg': m.fg, '--badge-bg': m.bg, borderStyle: m.dashed ? 'dashed' : 'solid', flexShrink: 0 }}>
      {tx(`status_${status}`, lang)}
    </span>
  );
}

// A split or imported node the researcher has not checked yet.
function ReviewMark({ lang }) {
  return <span className="badge badge-warn" style={{ borderStyle: 'dashed', flexShrink: 0 }}>{tx('toReview', lang)}</span>;
}

function StageBadge({ stage, lang }) {
  const m = STAGE_TONE[stage] || STAGE_TONE.none;
  const label = STAGE_KEY[stage] ? t(STAGE_KEY[stage], lang) : tx(`stage_${stage}`, lang);
  return <span className="badge" style={{ '--badge-fg': m.fg, '--badge-bg': m.bg, flexShrink: 0 }}>{label}</span>;
}

// One node, referenced from elsewhere in the outline: tag, text, and a detail.
function NodeRef({ node, label, lang, onOpen, extra }) {
  if (!node) return null;
  return (
    <button type="button" onClick={() => onOpen(node.id)} className="flex items-start gap-2 w-full text-left py-1"
      style={{ fontSize: '0.8125rem', lineHeight: 1.45 }}>
      <KindTag kind={node.kind} label={label} lang={lang} />
      <span className="min-w-0 flex-1" style={{ overflowWrap: 'anywhere' }}>
        {node.text || '—'}
        {node.kind === 'evidence' && (node.citation || node.source === 'own') && (
          <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.6875rem' }}>
            {' · '}{node.source === 'own' ? tx('src_own', lang) : node.citation}
          </span>
        )}
      </span>
      {extra}
    </button>
  );
}

export default function EvidenceTab({ onNavigateNotebook, agentAvailable = false }) {
  const lang = useLang();
  const zh = lang === 'zh';
  const toast = useToast();
  const isMobile = useIsMobile();
  const { maps, loading, save, remove } = useEvidenceMaps();
  const { entries: notebookEntries, reload: reloadNotebook } = useExperiments();
  const { recipeById } = useRecipes();
  const experimentsById = useMemo(() => Object.fromEntries(notebookEntries.map((e) => [e.id, e])), [notebookEntries]);

  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [mobileView, setMobileView] = useState('list');
  const [view, setViewState] = useState(() => readPref(VIEW_KEY, 'outline'));
  const [dialog, setDialog] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [connectFrom, setConnectFrom] = useState(null);
  const [allIssues, setAllIssues] = useState(false);
  const [freshMapId, setFreshMapId] = useState(null);
  const [betaNote, setBetaNote] = useState(() => readPref(BETA_NOTE_KEY, '') !== '1');
  const dismissBeta = () => { setBetaNote(false); writePref(BETA_NOTE_KEY, '1'); };

  const setView = useCallback((v) => { setViewState(v); writePref(VIEW_KEY, v); setConnectFrom(null); }, []);

  // Notebook entries change elsewhere (Notebook tab, assistant): keep stages fresh.
  useEffect(() => {
    const onChange = () => reloadNotebook();
    window.addEventListener('labmate:experiments-changed', onChange);
    return () => window.removeEventListener('labmate:experiments-changed', onChange);
  }, [reloadNotebook]);

  // Arriving from a notebook entry's "Open map".
  useEffect(() => {
    const focus = takeHandoff(EVIDENCE_FOCUS_KEY);
    if (!focus?.mapId) return;
    setSelectedId(focus.mapId);
    setMobileView('map');
    if (focus.nodeId) { setViewState('plan'); setSelectedNode(focus.nodeId); }
  }, []);

  // Desktop: open the most recent map rather than an empty pane.
  useEffect(() => {
    if (isMobile || loading) return;
    if (!selectedId || !maps.some((m) => m.id === selectedId)) setSelectedId(maps[0]?.id || null);
  }, [isMobile, loading, maps, selectedId]);

  const map = useMemo(() => maps.find((m) => m.id === selectedId) || null, [maps, selectedId]);
  const analysis = useMemo(() => (map ? analyzeMap(map, { experimentsById }) : null), [map, experimentsById]);
  const labels = useMemo(() => (map ? nodeLabels(map) : {}), [map]);
  const nodeById = useMemo(() => new Map((map?.nodes || []).map((n) => [n.id, n])), [map]);

  // Escape leaves connect mode.
  useEffect(() => {
    if (!connectFrom) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !dialog) setConnectFrom(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [connectFrom, dialog]);

  const commit = useCallback((next) => save(next), [save]);
  const protocolName = useCallback((ref) => {
    const r = ref ? recipeById[ref] : null;
    return r ? (zh ? r.nameCn || r.name : r.name) : '';
  }, [recipeById, zh]);

  // ── Map-level actions ──
  const openMap = (id) => {
    setSelectedId(id);
    setSelectedNode(null);
    setConnectFrom(null);
    setAllIssues(false);
    if (isMobile) { setMobileView('map'); window.scrollTo(0, 0); }
  };
  const newMap = async (then) => {
    const m = await save(createEmptyMap());
    setFreshMapId(m.id);
    openMap(m.id);
    setDialog(then === 'split' ? { type: 'split' } : { type: 'details' });
  };
  const closeDetails = () => {
    // Cancelling the details of a map just created, still empty, discards it.
    if (map && map.id === freshMapId && !map.nodes.length && !map.title) {
      remove(map.id);
      setSelectedId(null);
      if (isMobile) setMobileView('list');
    }
    setFreshMapId(null);
    setDialog(null);
  };
  const saveDetails = ({ title, description }) => {
    commit({ ...map, title, description });
    setFreshMapId(null);
    setDialog(null);
  };
  const deleteMap = async () => {
    await remove(map.id);
    setSelectedId(null);
    setDialog(null);
    if (isMobile) setMobileView('list');
    toast.show(tx('mapDeleted', lang));
  };
  const exportMarkdown = () => {
    downloadText(mapToMarkdown(map, { lang, experimentsById, protocolName }), mapFilename(map));
    toast.show(tx('downloaded', lang));
  };
  // AI-native JSON (lib/evidenceFormat.js): every node, link, status and
  // logic-check finding, plus a guide to the format, for a model or a tool.
  const exportJson = () => {
    downloadText(mapToJSONString(map, { experimentsById, protocolName }), jsonFilename(map), 'application/json');
    toast.show(tx('downloaded', lang));
  };
  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(mapToJSONString(map, { experimentsById, protocolName }));
      toast.show(tx('copied', lang), '✓');
    } catch {
      toast.show(tx('copyFailed', lang));
    }
  };
  const importJson = async (text) => {
    const { map: imported, report } = mapFromJSON(text);
    // Notebook entries live in this browser only; drop links to ones that aren't here.
    const known = (id) => (id && experimentsById[id] ? id : null);
    const cleaned = { ...imported, nodes: imported.nodes.map((n) => (n.experimentId ? { ...n, experimentId: known(n.experimentId) } : n)) };
    const saved = await save(cleaned);
    setDialog(null);
    openMap(saved.id);
    toast.show(tx('importedMap', lang, { title: saved.title || tx('untitledMap', lang), n: report.nodes }), '✓');
  };

  // ── Node actions ──
  const openNode = (id) => setDialog({ type: 'node', nodeId: id });
  const newNode = (kind, edges) => setDialog({ type: 'node', create: { kind, edges } });
  const saveNode = (next, id) => { commit(next); setSelectedNode(id); setDialog(null); };
  const deleteNode = (id) => {
    commit(removeNode(map, id));
    if (selectedNode === id) setSelectedNode(null);
    if (connectFrom === id) setConnectFrom(null);
    setDialog(null);
    toast.show(tx('nodeDeleted', lang));
  };
  const addSplit = (items) => {
    const nodes = nodesFromSplit(items, 'import');
    commit(nodes.reduce((m, n) => addNode(m, n), map));
    setDialog(null);
    toast.show(tx('nodesAdded', lang, { n: nodes.length }));
  };
  const move = (id, dir) => commit(moveNode(map, id, dir));

  // `origin` is the node the user started from; the other end ends up selected.
  const applyLink = (opt, origin) => {
    const r = connect(map, opt.from, opt.to, opt.rel);
    if (!r.error) {
      commit(r.map);
      toast.show(tx('linked', lang, { phrase: relPhrase(opt.rel, labels[opt.from], labels[opt.to], lang) }));
    }
    setConnectFrom(null);
    setSelectedNode(opt.from === origin ? opt.to : opt.from);
    setDialog(null);
  };
  // Link two nodes picked by hand (Connect mode, or a handle dragged onto a node).
  const tryConnect = (fromId, toId) => {
    const a = nodeById.get(fromId);
    const b = nodeById.get(toId);
    if (!a || !b || a.id === b.id) { setConnectFrom(null); return; }
    const options = linkOptions(a, b);
    if (!options.length) {
      toast.show(tx('cantLink', lang, { a: tx(`kind_${a.kind}`, lang).toLowerCase(), b: tx(`kind_${b.kind}`, lang).toLowerCase() }));
      return;
    }
    if (options.length === 1) applyLink(options[0], fromId);
    else setDialog({ type: 'relation', options, origin: fromId });
  };
  const graphClick = (id) => {
    if (!connectFrom) { setSelectedNode((cur) => (cur === id ? null : id)); return; }
    if (id === connectFrom) { setConnectFrom(null); return; }
    tryConnect(connectFrom, id);
  };
  const moveNodeTo = (id, x, y) => commit(setNodePosition(map, id, x, y));
  const autoLayout = () => {
    const before = map;
    commit(resetLayout(map));
    toast.show(tx('layoutReset', lang), '', { actionLabel: tx('undo', lang), onAction: () => commit(before) });
  };

  // ── Notebook round trip ──
  const openEntry = (entryId) => {
    giveHandoff(NOTEBOOK_FOCUS_KEY, { id: entryId });
    onNavigateNotebook?.();
  };
  const createEntry = async (nodeId) => {
    const node = nodeById.get(nodeId);
    const seed = experimentEntrySeed(map, nodeId, { lang, recipe: node?.protocolRef ? recipeById[node.protocolRef] : null });
    if (!seed) return;
    const saved = await saveExperimentRecord({ ...seed, date: localToday() });
    try { window.dispatchEvent(new window.CustomEvent('labmate:experiments-changed')); } catch { /* no window */ }
    await reloadNotebook();
    commit(updateNode(map, nodeId, { experimentId: saved.id }));
    toast.show(tx('entryCreated', lang), '✓', { actionLabel: tx('openEntry', lang), onAction: () => openEntry(saved.id) });
  };
  const saveOutcome = (nodeId, data) => {
    const { map: next } = recordOutcome(map, nodeId, data);
    commit(next);
    setDialog(null);
    toast.show(tx('resultRecorded', lang));
  };

  // ── Pieces ──
  const issueText = (issue) => {
    const ref = (id) => `${labels[id] || '?'} “${clip(nodeById.get(id)?.text, 48)}”`;
    if (issue.code === 'cycle') return tx('issue_cycle', lang, { path: [...issue.nodeIds, issue.nodeIds[0]].map((id) => labels[id]).join(' → ') });
    if (issue.code === 'unreviewed_many') return tx('issue_unreviewed_many', lang, { k: issue.nodeIds.length, list: issue.nodeIds.map((id) => labels[id]).join(zh ? '、' : ', ') });
    return tx(`issue_${issue.code}`, lang, {
      n: ref(issue.nodeId),
      m: (issue.nodeIds || []).map((id) => labels[id]).join(', '),
    });
  };

  const ref = (id, extra) => <NodeRef key={id} node={nodeById.get(id)} label={labels[id]} lang={lang} onOpen={openNode} extra={extra} />;

  const linkGroup = (labelKey, ids, render) => (ids.length ? (
    <div className="grid gap-x-3 grid-cols-[5.5rem_minmax(0,1fr)] items-start" style={{ marginTop: '0.25rem' }}>
      <span className="eyebrow" style={{ paddingTop: '0.4rem', fontSize: '0.625rem' }}>{tx(labelKey, lang)}</span>
      <div>{ids.map((id) => (render ? render(id) : ref(id)))}</div>
    </div>
  ) : null);

  const inIds = (id, rel) => map.edges.filter((e) => e.to === id && e.rel === rel).map((e) => e.from);
  const outIds = (id, rel) => map.edges.filter((e) => e.from === id && e.rel === rel).map((e) => e.to);
  const stageOf = (id) => analysis.experiments.find((x) => x.node.id === id)?.stage || 'none';

  // ── Outline view ──
  const renderClaim = (n, siblings) => {
    const idx = siblings.indexOf(n.id);
    const sup = inIds(n.id, 'supports');
    const con = inIds(n.id, 'contradicts');
    const pre = inIds(n.id, 'premise');
    const tst = inIds(n.id, 'tests');
    const premiseOf = outIds(n.id, 'premise');
    const empty = !sup.length && !con.length && !pre.length && !tst.length;
    return (
      <li key={n.id} style={{ borderTop: '1px solid var(--rule)', padding: '0.875rem 0' }}>
        <div className="flex items-start gap-2.5">
          <KindTag kind={n.kind} label={labels[n.id]} lang={lang} />
          <button type="button" className="flex-1 min-w-0 text-left" onClick={() => openNode(n.id)}
            style={{ fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere', color: n.text ? 'var(--text)' : 'var(--text-muted)' }}>
            {n.text || '—'}
          </button>
          {n.origin !== 'user' && !n.reviewed && <ReviewMark lang={lang} />}
          <StatusBadge status={analysis.statuses[n.id]} lang={lang} />
          {siblings.length > 1 && (
            <span className="hidden sm:flex flex-none" style={{ marginTop: -4 }}>
              <button type="button" className="btn-ghost btn-icon btn-sm" disabled={idx <= 0} onClick={() => move(n.id, -1)} aria-label={`${tx('moveUp', lang)} ${labels[n.id]}`}>
                <IconChevronDown size={14} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <button type="button" className="btn-ghost btn-icon btn-sm" disabled={idx >= siblings.length - 1} onClick={() => move(n.id, 1)} aria-label={`${tx('moveDown', lang)} ${labels[n.id]}`}>
                <IconChevronDown size={14} />
              </button>
            </span>
          )}
        </div>
        {n.note && <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem', paddingLeft: '0.125rem', overflowWrap: 'anywhere' }}>{n.note}</p>}
        <div style={{ marginTop: '0.375rem' }}>
          {linkGroup('grpFor', sup)}
          {linkGroup('grpAgainst', con)}
          {linkGroup('grpRestsOn', pre, (id) => ref(id, <StatusBadge status={analysis.statuses[id]} lang={lang} />))}
          {linkGroup('grpTestedBy', tst, (id) => ref(id, <StageBadge stage={stageOf(id)} lang={lang} />))}
          {n.kind === 'assumption' && premiseOf.length > 0 && (
            <p className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
              {premiseOf.map((id) => relPhrase('premise', labels[n.id], labels[id], lang)).join(' · ')}
            </p>
          )}
          {empty && <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{tx('nothingYet', lang)}</p>}
        </div>
        <div className="flex flex-wrap gap-1.5" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="btn btn-sm" onClick={() => newNode('evidence', [{ from: '@new', to: n.id, rel: 'supports' }])}>
            <IconPlus size={13} />{tx('addEvidence', lang)}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => newNode('experiment', [{ from: '@new', to: n.id, rel: 'tests' }])}>
            <IconPlus size={13} />{tx('planExperiment', lang)}
          </button>
        </div>
      </li>
    );
  };

  const section = (title, count, body, key) => (
    <section key={key || title} className="doc-section" style={{ marginTop: '1.5rem' }}>
      <div className="doc-section-head">
        <div className="flex items-baseline gap-2.5 min-w-0">
          <h3 className="section-title">{title}</h3>
          {count != null && <span className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{count}</span>}
        </div>
      </div>
      {body}
    </section>
  );

  const renderOutline = () => {
    const kind = (k) => map.nodes.filter((n) => n.kind === k);
    const questions = kind('question');
    const claims = kind('claim');
    const claimIds = claims.map((c) => c.id);
    const answering = new Set(map.edges.filter((e) => e.rel === 'answers').map((e) => e.from));
    const loose = claims.filter((c) => !answering.has(c.id));
    const assumptions = kind('assumption');
    const looseEvidence = kind('evidence').filter((n) => !map.edges.some((e) => e.from === n.id && (e.rel === 'supports' || e.rel === 'contradicts')));
    const looseExperiments = kind('experiment').filter((n) => !outIds(n.id, 'tests').length);
    const out = [];
    for (const q of questions) {
      const answers = inIds(q.id, 'answers');
      out.push(section(
        <span className="flex items-baseline gap-2"><KindTag kind="question" label={labels[q.id]} lang={lang} />
          <button type="button" className="text-left" onClick={() => openNode(q.id)} style={{ overflowWrap: 'anywhere' }}>{q.text || '—'}</button>
        </span>,
        null,
        <>
          {answers.length ? (
            <ul>{claims.filter((c) => answers.includes(c.id)).map((c) => renderClaim(c, claimIds))}</ul>
          ) : (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>{tx('issue_question_unanswered', lang, { n: labels[q.id] })}</p>
          )}
          <button type="button" className="btn btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => newNode('claim', [{ from: '@new', to: q.id, rel: 'answers' }])}>
            <IconPlus size={13} />{tx('startClaim', lang)}
          </button>
        </>,
        q.id,
      ));
    }
    if (loose.length || !questions.length) {
      out.push(section(questions.length ? tx('secOtherClaims', lang) : tx('secClaims', lang), loose.length,
        loose.length ? <ul>{loose.map((c) => renderClaim(c, claimIds))}</ul>
          : <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{tx('noClaimsYet', lang)}</p>,
        'claims'));
    }
    if (assumptions.length) {
      out.push(section(tx('secAssumptions', lang), assumptions.length,
        <ul>{assumptions.map((a) => renderClaim(a, assumptions.map((x) => x.id)))}</ul>, 'assumptions'));
    }
    if (looseEvidence.length) {
      out.push(section(tx('secLooseEvidence', lang), looseEvidence.length,
        <div>{looseEvidence.map((n) => ref(n.id, n.inconclusive ? <span className="badge">{tx('inconclusive', lang)}</span> : null))}</div>, 'loose-ev'));
    }
    if (looseExperiments.length) {
      out.push(section(tx('secLooseExperiments', lang), looseExperiments.length,
        <div>{looseExperiments.map((n) => ref(n.id, <StageBadge stage={stageOf(n.id)} lang={lang} />))}</div>, 'loose-x'));
    }
    return out;
  };

  // ── Experiments view ──
  const renderPlan = () => {
    const gaps = analysis.gaps.map((id) => nodeById.get(id)).filter(Boolean);
    const exps = [...analysis.experiments].sort((a, b) => (a.results.length > 0) - (b.results.length > 0));
    return (
      <>
        {section(tx('planGaps', lang), gaps.length, gaps.length ? (
          <>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{tx('planGapsDesc', lang)}</p>
            <ul>
              {gaps.map((n) => (
                <li key={n.id} className="flex flex-wrap items-start gap-2 py-2.5" style={{ borderTop: '1px solid var(--rule)' }}>
                  <div className="flex-1 min-w-[12rem]">{ref(n.id)}</div>
                  <span className="flex gap-1.5 flex-none">
                    <button type="button" className="btn btn-sm" onClick={() => newNode('evidence', [{ from: '@new', to: n.id, rel: 'supports' }])}>
                      <IconPlus size={13} />{tx('addEvidence', lang)}
                    </button>
                    <button type="button" className="btn-primary btn-sm" onClick={() => newNode('experiment', [{ from: '@new', to: n.id, rel: 'tests' }])}>
                      <IconPlus size={13} />{tx('planExperiment', lang)}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="flex items-center gap-2" style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}><IconCheck size={14} />{tx('planNoGaps', lang)}</p>
        ), 'gaps')}
        {section(tx('planExperiments', lang), exps.length, exps.length ? (
          <ul>
            {exps.map((x) => {
              const n = x.node;
              const done = x.results.length > 0;
              const hl = selectedNode === n.id;
              return (
                <li key={n.id} className="py-3.5" style={{ borderTop: '1px solid var(--rule)', ...(hl ? { background: 'var(--primary-light)', margin: '0 -0.75rem', padding: '0.875rem 0.75rem' } : null) }}>
                  <div className="flex items-start gap-2.5">
                    <KindTag kind="experiment" label={labels[n.id]} lang={lang} />
                    <button type="button" className="flex-1 min-w-0 text-left" onClick={() => openNode(n.id)}
                      style={{ fontSize: '0.9375rem', fontWeight: 600, lineHeight: 1.4, overflowWrap: 'anywhere' }}>
                      {n.text || '—'}
                    </button>
                    {n.origin !== 'user' && !n.reviewed && <ReviewMark lang={lang} />}
                    <StageBadge stage={x.stage} lang={lang} />
                  </div>
                  <div style={{ marginTop: '0.375rem' }}>
                    {linkGroup('grpTests', x.targets, (id) => ref(id, <StatusBadge status={analysis.statuses[id]} lang={lang} />))}
                    <dl className="meta-grid grid-cols-1 @lg:grid-cols-2 mt-2">
                      <div><dt>{tx('ifHolds', lang)}</dt><dd style={n.predictIfTrue ? undefined : { color: 'var(--warning-text)' }}>{n.predictIfTrue || tx('predictionMissing', lang)}</dd></div>
                      <div><dt>{tx('ifNot', lang)}</dt><dd style={n.predictIfFalse ? undefined : { color: 'var(--warning-text)' }}>{n.predictIfFalse || tx('predictionMissing', lang)}</dd></div>
                      <div><dt>{tx('controls', lang)}</dt><dd style={n.controls ? undefined : { color: 'var(--text-muted)' }}>{n.controls || '—'}</dd></div>
                      <div><dt>{tx('protocol', lang)}</dt><dd style={n.protocolRef ? undefined : { color: 'var(--text-muted)' }}>{protocolName(n.protocolRef) || n.protocolRef || '—'}</dd></div>
                    </dl>
                    {done && linkGroup('result', x.results, (id) => {
                      const backs = map.edges.filter((e) => e.from === id && (e.rel === 'supports' || e.rel === 'contradicts'));
                      return ref(id, (
                        <span className="mono flex-none" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                          {nodeById.get(id)?.inconclusive ? tx('inconclusive', lang) : backs.map((e) => relPhrase(e.rel, '', labels[e.to], lang).trim()).join(' · ')}
                        </span>
                      ));
                    })}
                  </div>
                  <div className="flex flex-wrap gap-1.5" style={{ marginTop: '0.625rem' }}>
                    {x.entry ? (
                      <button type="button" className="btn btn-sm" onClick={() => openEntry(x.entry.id)}><IconNotebook size={13} />{tx('openEntry', lang)}</button>
                    ) : (
                      <button type="button" className={`${done ? 'btn' : 'btn-primary'} btn-sm`} onClick={() => createEntry(n.id)}><IconNotebook size={13} />{tx('createEntry', lang)}</button>
                    )}
                    <button type="button" className={`${x.stage === 'completed' && !done ? 'btn-primary' : 'btn'} btn-sm`}
                      onClick={() => setDialog({ type: 'outcome', nodeId: n.id })}>
                      <IconCheck size={13} />{tx('recordResult', lang)}
                    </button>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => openNode(n.id)}><IconEdit size={13} />{tx('edit', lang)}</button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{tx('planNoExperiments', lang)}</p>
        ), 'exps')}
      </>
    );
  };

  // ── Graph view ──
  const renderGraph = () => {
    const sel = selectedNode ? nodeById.get(selectedNode) : null;
    const from = connectFrom ? nodeById.get(connectFrom) : null;
    return (
      <div style={{ marginTop: '1.25rem' }}>
        <div className="flex flex-wrap items-center gap-2 mb-2.5" style={{ minHeight: '2.25rem' }} aria-live="polite">
          {from ? (
            <>
              <span className="flex items-center gap-2 min-w-0" style={{ fontSize: '0.8125rem' }}>
                <IconLink size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                <span>{tx('connectBar', lang, { label: labels[from.id] })}</span>
              </span>
              <button type="button" className="btn btn-sm ml-auto" onClick={() => setConnectFrom(null)}>{tx('cancel', lang)}</button>
            </>
          ) : sel ? (
            <>
              <KindTag kind={sel.kind} label={labels[sel.id]} lang={lang} />
              <span className="min-w-0 flex-1 truncate" style={{ fontSize: '0.8125rem' }}>{sel.text}</span>
              <span className="flex gap-1.5 flex-none">
                <button type="button" className="btn-primary btn-sm" onClick={() => setConnectFrom(sel.id)}><IconLink size={13} />{tx('connect', lang)}</button>
                <button type="button" className="btn btn-sm" onClick={() => openNode(sel.id)}><IconEdit size={13} />{tx('edit', lang)}</button>
              </span>
            </>
          ) : (
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{tx('graphHint', lang)}</span>
          )}
        </div>
        <EvidenceGraph lang={lang} map={map} statuses={analysis.statuses} labels={labels}
          selectedId={selectedNode} connectFrom={connectFrom} onNodeClick={graphClick} onNodeOpen={openNode}
          onMoveNode={moveNodeTo} onConnectDrop={tryConnect} onAutoLayout={autoLayout} />
      </div>
    );
  };

  // ── Logic check + stats ──
  const renderSummary = () => {
    const c = analysis.counts;
    // Nodes still waiting for review after a split read as one row, not one each.
    // They lead the informational rows: after a split or an import, review comes first.
    const unreviewed = analysis.issues.filter((i) => i.code === 'unreviewed');
    const review = unreviewed.length > 1
      ? [{ code: 'unreviewed_many', severity: 'info', nodeId: unreviewed[0].nodeId, nodeIds: unreviewed.map((i) => i.nodeId) }]
      : unreviewed;
    const rest = analysis.issues.filter((i) => i.code !== 'unreviewed');
    const issues = [...rest.filter((i) => i.severity !== 'info'), ...review, ...rest.filter((i) => i.severity === 'info')];
    const shown = allIssues ? issues : issues.slice(0, 5);
    const stat = (value, label, tone) => (
      <div className="stat" style={{ border: 0, background: 'var(--card)' }}>
        <div className="stat-value" style={tone ? { color: tone } : undefined}>{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    );
    return (
      <>
        <div className="grid grid-cols-2 @xl:grid-cols-4 mt-4" style={{ gap: 1, background: 'var(--rule)', border: '1px solid var(--rule)' }}>
          {stat(`${c.claims_supported}/${c.claim}`, tx('statSupported', lang))}
          {stat(c.claims_gap, tx('statGaps', lang), c.claims_gap ? 'var(--warning-text)' : null)}
          {stat(c.experimentsOpen, tx('statOpen', lang))}
          {stat(issues.length, tx('statIssues', lang), issues.some((i) => i.severity === 'danger') ? 'var(--danger-text)' : null)}
        </div>
        <section className="mt-4" aria-label={tx('logicCheck', lang)}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="eyebrow">{tx('logicCheck', lang)}</span>
            {issues.length > 0 && (
              <span className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                {issues.length === 1 ? tx('issuesOne', lang) : tx('issuesN', lang, { n: issues.length })}
              </span>
            )}
          </div>
          {issues.length === 0 ? (
            <p className="flex items-center gap-2" style={{ fontSize: '0.8125rem', color: 'var(--accent)' }}><IconCheck size={14} />{tx('logicOk', lang)}</p>
          ) : (
            <>
              <ul>
                {shown.map((issue, i) => (
                  <li key={`${issue.code}-${issue.nodeId}-${i}`}>
                    <button type="button" className="flex items-start gap-2 w-full text-left py-1.5" onClick={() => openNode(issue.nodeId)}
                      style={{ fontSize: '0.8125rem', lineHeight: 1.45, borderTop: i ? '1px solid var(--rule)' : 0 }}>
                      {issue.severity === 'info'
                        ? <span className="dot" aria-hidden="true" style={{ color: SEVERITY_META.info.fg, marginTop: '0.4rem' }} />
                        : <IconAlert size={14} style={{ color: SEVERITY_META[issue.severity].fg, flexShrink: 0, marginTop: 2 }} />}
                      <span className="min-w-0 flex-1" style={{ overflowWrap: 'anywhere' }}>{issueText(issue)}</span>
                      <IconArrowRight size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 3 }} />
                    </button>
                  </li>
                ))}
              </ul>
              {issues.length > 5 && (
                <button type="button" className="link" style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }} onClick={() => setAllIssues((v) => !v)}>
                  {allIssues ? tx('showLess', lang) : tx('showAll', lang, { n: issues.length })}
                </button>
              )}
            </>
          )}
        </section>
      </>
    );
  };

  const renderEmptyMap = () => (
    <div className="mt-6">
      <div className="eyebrow">{tx('emptyMapTitle', lang)}</div>
      <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{tx('emptyMapDesc', lang)}</p>
      <div className="grid gap-3 mt-4 @lg:grid-cols-3">
        {[
          ['startSplit', 'startSplitDesc', IconFile, () => setDialog({ type: 'split' })],
          ['startQuestion', 'startQuestionDesc', IconSearch, () => newNode('question')],
          ['startClaim', 'startClaimDesc', IconPlus, () => newNode('claim')],
        ].map(([title, desc, Icon, onClick], i) => (
          <button key={title} type="button" onClick={onClick} className={`card card-link text-left${i === 0 ? ' raised' : ''}`} style={{ padding: '1rem' }}>
            <Icon size={18} style={{ color: 'var(--accent)' }} />
            <div style={{ fontWeight: 700, marginTop: '0.5rem', fontSize: '0.9375rem' }}>{tx(title, lang)}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{tx(desc, lang)}</div>
          </button>
        ))}
      </div>
    </div>
  );

  // ── Workspace (one map) ──
  const workspace = map ? (
    <article className="panel min-w-0 @container" aria-label={map.title || tx('untitledMap', lang)}>
      <div className="panel-head sticky z-[2] top-[calc(var(--topbar-h)_+_env(safe-area-inset-top,0px))] lg:top-0"
        style={{ background: 'var(--card)', padding: '0.5rem 0.75rem', minHeight: '3rem' }}>
        <div className="toolbar w-full" style={{ gap: '0.375rem' }}>
          {isMobile && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => { setMobileView('list'); window.scrollTo(0, 0); }} style={{ paddingLeft: '0.25rem' }}>
              <IconChevronLeft size={16} />{tx('back', lang)}
            </button>
          )}
          {map.nodes.length > 0 && (
            <div className="seg" role="group" aria-label={tx('views', lang)}>
              {['outline', 'graph', 'plan'].map((v) => (
                <button key={v} type="button" aria-pressed={view === v} onClick={() => setView(v)}>
                  {tx(v === 'outline' ? 'viewOutline' : v === 'graph' ? 'viewGraph' : 'viewPlan', lang)}
                </button>
              ))}
            </div>
          )}
          <span className="toolbar-spacer" />
          <button type="button" className="btn btn-sm hidden @lg:inline-flex" onClick={() => setDialog({ type: 'split' })}><IconFile size={14} />{tx('splitText', lang)}</button>
          <button type="button" className="btn btn-sm hidden @lg:inline-flex" onClick={() => newNode('claim')}><IconPlus size={14} />{tx('addNode', lang)}</button>
          <button type="button" className="btn btn-sm hidden @lg:inline-flex" onClick={() => setDialog({ type: 'export' })} disabled={!map.nodes.length}><IconDownload size={14} />{tx('export', lang)}</button>
          <button type="button" className="btn-ghost btn-icon btn-sm @lg:hidden" onClick={() => setDialog({ type: 'split' })} aria-label={tx('splitText', lang)} title={tx('splitText', lang)}><IconFile size={16} /></button>
          <button type="button" className="btn-ghost btn-icon btn-sm @lg:hidden" onClick={() => newNode('claim')} aria-label={tx('addNode', lang)} title={tx('addNode', lang)}><IconPlus size={16} /></button>
          <button type="button" className="btn-ghost btn-icon btn-sm @lg:hidden" onClick={() => setDialog({ type: 'export' })} disabled={!map.nodes.length} aria-label={tx('export', lang)} title={tx('export', lang)}><IconDownload size={16} /></button>
          <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => setDialog({ type: 'details' })} aria-label={tx('editDetails', lang)} title={tx('editDetails', lang)}><IconEdit size={16} /></button>
        </div>
      </div>
      <div className="px-4 pt-5 pb-7 @lg:px-7 @lg:pt-6 @lg:pb-8">
        <header>
          <div className="eyebrow flex items-center gap-1.5">
            <span>{t('tabEvidence', lang)}</span>
            {map.nodes.length > 0 && <><span aria-hidden="true">·</span><span>{tx('nodes', lang, { n: map.nodes.length })}</span></>}
          </div>
          <h2 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, marginTop: '0.3rem', overflowWrap: 'anywhere', color: map.title ? 'var(--text)' : 'var(--text-muted)' }}>
            {map.title || tx('untitledMap', lang)}
          </h2>
          {map.description && <p style={{ marginTop: '0.3rem', fontSize: '0.9375rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{map.description}</p>}
        </header>
        {map.nodes.length === 0 ? renderEmptyMap() : (
          <>
            {renderSummary()}
            {view === 'graph' ? renderGraph() : view === 'plan' ? renderPlan() : renderOutline()}
          </>
        )}
      </div>
    </article>
  ) : (
    <div className="panel flex items-center justify-center" style={{ minHeight: 420 }}>
      <div className="empty">
        <div className="empty-icon"><IconGraph size={22} /></div>
        <div className="empty-title">{tx('firstTitle', lang)}</div>
      </div>
    </div>
  );

  // ── Map list ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return maps;
    return maps.filter((m) => (m.title || '').toLowerCase().includes(q) || (m.description || '').toLowerCase().includes(q)
      || m.nodes.some((n) => (n.text || '').toLowerCase().includes(q)));
  }, [maps, search]);
  const listMeta = (m) => {
    const a = analyzeMap(m, { experimentsById });
    return [
      tx('nodes', lang, { n: m.nodes.length }),
      a.counts.claim ? `${a.counts.claims_supported}/${a.counts.claim} ${zh ? '有证据' : 'supported'}` : null,
      a.counts.experimentsOpen ? `${a.counts.experimentsOpen} ${zh ? '待做实验' : 'to run'}` : null,
    ].filter(Boolean);
  };
  const listPanel = (
    <section className="panel flex flex-col min-w-0 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)]" aria-label={t('tabEvidence', lang)}>
      <div className="p-3 flex-none" style={{ borderBottom: '1px solid var(--rule)' }}>
        <div className="search-field">
          <IconSearch size={15} />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tx('searchMaps', lang)} aria-label={tx('searchMaps', lang)} />
        </div>
      </div>
      <div className="flex items-center px-3.5 flex-none" style={{ minHeight: '2rem', borderBottom: '1px solid var(--rule)' }}>
        <span className="panel-title" aria-live="polite">{maps.length === 1 ? tx('mapsCountOne', lang) : tx('mapsCount', lang, { n: maps.length })}</span>
      </div>
      {filtered.length === 0 ? (
        <div className="empty" style={{ padding: '2rem 1.25rem' }}>
          <div className="empty-icon"><IconSearch size={20} /></div>
          <div className="empty-title">{tx('noMatch', lang)}</div>
        </div>
      ) : (
        <div className="list flex-1 min-h-0 overflow-y-auto">
          {filtered.map((m) => {
            const isSel = m.id === selectedId;
            return (
              <button key={m.id} type="button" onClick={() => openMap(m.id)} className={`list-row${isSel ? ' is-selected' : ''}`} aria-current={isSel ? 'true' : undefined}>
                <span className="flex-1 min-w-0">
                  <span className="list-row-title block truncate" style={m.title ? undefined : { color: 'var(--text-muted)', fontWeight: 500 }}>{m.title || tx('untitledMap', lang)}</span>
                  <span className="list-row-meta">
                    {listMeta(m).map((s, i) => <span key={i}>{i > 0 && <span aria-hidden="true">· </span>}{s}</span>)}
                    <span aria-hidden="true">·</span><span>{formatDay(m.updatedAt)}</span>
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  // ── First run ──
  const firstRun = (
    <div className="panel">
      <div className="empty" style={{ padding: '3rem 1.5rem 2.5rem' }}>
        <div className="empty-icon"><IconGraph size={22} /></div>
        <div className="empty-title">{tx('firstTitle', lang)}</div>
        <div className="empty-desc" style={{ maxWidth: '58ch' }}>{tx('firstDesc', lang)}</div>
        <div className="flex flex-wrap justify-center gap-2" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="btn-primary" style={{ marginTop: 0 }} onClick={() => newMap('split')}><IconFile size={15} />{tx('startSplit', lang)}</button>
          <button type="button" className="btn" style={{ marginTop: 0 }} onClick={() => newMap()}><IconPlus size={15} />{tx('newMap', lang)}</button>
          <button type="button" className="btn" style={{ marginTop: 0 }} onClick={() => setDialog({ type: 'import' })}><IconUpload size={15} />{tx('importJson', lang)}</button>
        </div>
      </div>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 1, background: 'var(--rule)', borderTop: '1px solid var(--rule)' }}>
        {[['01', 'step1', 'step1Desc'], ['02', 'step2', 'step2Desc'], ['03', 'step3', 'step3Desc'], ['04', 'step4', 'step4Desc']].map(([num, key, desc]) => (
          <li key={key} className="px-4 py-3.5" style={{ background: 'var(--card)' }}>
            <div className="flex items-baseline gap-2">
              <span className="mono" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent)' }}>{num}</span>
              <span className="eyebrow" style={{ color: 'var(--text)' }}>{tx(key, lang)}</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.45 }}>{tx(desc, lang)}</p>
          </li>
        ))}
      </ol>
    </div>
  );

  // ── Dialogs ──
  const renderDialog = () => {
    if (!dialog) return null;
    if (dialog.type === 'import') {
      return <ImportDialog lang={lang} onImport={importJson} onClose={() => setDialog(null)} />;
    }
    if (dialog.type === 'details' && map) {
      return <MapDetailsDialog lang={lang} map={map} onSave={saveDetails} onDelete={deleteMap} onClose={closeDetails} />;
    }
    if (!map) return null;
    if (dialog.type === 'node') {
      return (
        <NodeDialog lang={lang} map={map} nodeId={dialog.nodeId} create={dialog.create} notebookEntries={notebookEntries}
          onSave={saveNode} onDelete={deleteNode} onClose={() => setDialog(null)} />
      );
    }
    if (dialog.type === 'split') {
      return <SplitDialog lang={lang} agentAvailable={agentAvailable} onAdd={addSplit} onClose={() => setDialog(null)} />;
    }
    if (dialog.type === 'relation') {
      return <RelationChooser lang={lang} options={dialog.options} labels={labels} onPick={(o) => applyLink(o, dialog.origin)} onClose={() => setDialog(null)} />;
    }
    if (dialog.type === 'export') {
      return <ExportDialog lang={lang} onMarkdown={exportMarkdown} onJson={exportJson} onCopyJson={copyJson} onClose={() => setDialog(null)} />;
    }
    if (dialog.type === 'outcome') {
      const x = analysis.experiments.find((e) => e.node.id === dialog.nodeId);
      if (!x) return null;
      return (
        <OutcomeDialog lang={lang} label={labels[x.node.id]}
          targets={x.targets.map((id) => ({ id, label: labels[id], text: nodeById.get(id)?.text || '' }))}
          initialText={x.entry?.results?.summary || ''}
          onSave={(data) => saveOutcome(x.node.id, data)} onClose={() => setDialog(null)} />
      );
    }
    return null;
  };

  const showFirstRun = !loading && maps.length === 0;
  const pageTitle = <span className="inline-flex items-center gap-2.5">{t('tabEvidence', lang)}<BetaBadge lang={lang} /></span>;
  const betaNotice = betaNote && !(isMobile && mobileView === 'map') ? (
    <div className="notice mb-4" role="note" style={{ alignItems: 'center', borderLeftColor: 'var(--cat-protocol)' }}>
      <IconInfo size={15} style={{ color: 'var(--cat-protocol)', flexShrink: 0 }} />
      <span className="flex-1 min-w-0">{tx('betaNote', lang)}</span>
      <button type="button" className="btn-ghost btn-icon btn-sm flex-none" onClick={dismissBeta} aria-label={tx('betaDismiss', lang)}>
        <IconClose size={14} />
      </button>
    </div>
  ) : null;
  const mobileDetail = isMobile && mobileView === 'map' && map;

  return (
    <div>
      {mobileDetail ? (
        <PageHeader tab="evidence" title={pageTitle} />
      ) : (
        <PageHeader tab="evidence" title={pageTitle} description={tx('pageDesc', lang)}
          meta={maps.length ? (maps.length === 1 ? tx('mapsCountOne', lang) : tx('mapsCount', lang, { n: maps.length })) : null}
          actions={maps.length ? (
            <>
              <button type="button" className="btn" onClick={() => setDialog({ type: 'import' })} aria-label={tx('importJson', lang)}>
                <IconUpload size={15} /><span className="hidden sm:inline">{tx('importJson', lang)}</span>
              </button>
              <button type="button" className="btn-primary" onClick={() => newMap()}><IconPlus size={15} />{tx('newMap', lang)}</button>
            </>
          ) : null} />
      )}
      {betaNotice}

      {loading && maps.length === 0 ? (
        <div className="panel"><div className="empty"><span className="mono" style={{ fontSize: '0.75rem' }}>{tx('loading', lang)}</span></div></div>
      ) : showFirstRun ? firstRun : isMobile ? (
        mobileDetail ? workspace : listPanel
      ) : (
        <div className="grid gap-4 items-start md:grid-cols-[260px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)]">
          {listPanel}
          {workspace}
        </div>
      )}
      {renderDialog()}
    </div>
  );
}
