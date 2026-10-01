import { useState, useMemo, useEffect, useCallback, useRef, useId } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { useToast } from '../../components/Toast.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { useIsMobile } from '../../hooks/useMediaQuery.js';
import { useExperiments, createEmptyExperiment, exportExperimentsJSON, importExperimentsJSON } from '../../lib/experiments.js';
import { useRecipes } from '../../lib/RecipeProvider.jsx';
import ProtocolSelector from './ProtocolSelector.jsx';
import Dialog from '../../components/Dialog.jsx';
import { toProcedureSteps, toReagents, recipeTitle } from '../../lib/protocolImport.js';
import { experimentToMarkdown, experimentFilename, downloadText } from '../../lib/agent/exportProtocol.js';
import {
  IconPlus, IconSearch, IconUpload, IconDownload, IconNotebook, IconEdit, IconTrash, IconCalendar,
  IconChevronLeft, IconChevronDown, IconClose, IconClipboard, IconCheck, IconGraph,
} from '../../components/icons.jsx';

// Status → label key + tone (shared visual language with the Calendar tab).
const STATUSES = [
  { id: 'planned', key: 'nbStatusPlanned', fg: 'var(--base-c)', bg: 'var(--cat-media-bg)' },
  { id: 'in-progress', key: 'nbStatusInProgress', fg: 'var(--warning-text)', bg: 'var(--warning-bg)' },
  { id: 'completed', key: 'nbStatusCompleted', fg: 'var(--accent)', bg: 'var(--primary-light)' },
  { id: 'cancelled', key: 'nbStatusCancelled', fg: 'var(--text-muted)', bg: 'var(--bg-2)' },
];
const STATUS_BY_ID = Object.fromEntries(STATUSES.map(s => [s.id, s]));
const PRIORITY_KEY = { high: 'nbPriorityHigh', medium: 'nbPriorityMedium', low: 'nbPriorityLow' };

// Cross-tab hand-off: "View in calendar" leaves the entry's date for the Calendar,
// the Calendar's "Open in Notebook" leaves an entry id for us (sessionStorage,
// read once on mount, ignored when stale).
const NOTEBOOK_FOCUS_KEY = 'labmate_notebook_focus';
const CALENDAR_FOCUS_KEY = 'labmate_calendar_focus';
const EVIDENCE_FOCUS_KEY = 'labmate_evidence_focus';
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

const clone = (o) => JSON.parse(JSON.stringify(o));
const pad2 = (n) => String(n).padStart(2, '0');
// Local calendar date (createEmptyExperiment's default is the UTC date).
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function addMinutes(time, minutes) {
  const [h, m] = (time || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const total = h * 60 + m + (Number(minutes) || 0);
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}
function formatStamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
const displayTitle = (e, lang) => (lang === 'zh' ? (e.titleZh || e.title) : (e.title || e.titleZh)) || '';

// Checkbox rows use label.label-inline (global): <label> is otherwise a mono
// uppercase field eyebrow. The item text sits in a span at list size.
const CHECK_TEXT = { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 };
const FIELD_TEXT = { fontSize: '0.9375rem', lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' };
const DOC_TITLE = { fontFamily: 'var(--font-heading)', fontSize: '1.625rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 };

function StatusBadge({ status, lang }) {
  const s = STATUS_BY_ID[status] || STATUS_BY_ID.planned;
  return <span className="badge" style={{ '--badge-fg': s.fg, '--badge-bg': s.bg }}>{t(s.key, lang)}</span>;
}

function NotebookTab({ onNavigateCalendar, onNavigateEvidence }) {
  const lang = useLang();
  const zh = lang === 'zh';
  const toast = useToast();
  const uid = useId();
  const isMobile = useIsMobile();
  const { entries, loading, save, remove, reload } = useExperiments();
  const { recipeById: RECIPE_BY_ID } = useRecipes();
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [draft, setDraft] = useState(null); // working copy of the selected entry
  const [editing, setEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showProtocolImport, setShowProtocolImport] = useState(false);
  const [mobileView, setMobileView] = useState('list');
  const [expandedSections, setExpandedSections] = useState({ plan: true, materials: true, procedure: true, results: true });
  const saveTimerRef = useRef(null);
  const pendingRef = useRef(null);
  const snapshotRef = useRef(null);
  const newEntryIdRef = useRef(null);
  const jsonInputRef = useRef(null);
  const listRef = useRef(null);
  const revealSelectedRef = useRef(false);
  const chipRowRef = useRef(null);
  const [chipFade, setChipFade] = useState({ left: false, right: false });

  // The status chips scroll sideways in the narrow list column; fade whichever
  // edge has more chips behind it.
  const updateChipFade = useCallback(() => {
    const el = chipRowRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setChipFade(prev => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);
  useEffect(() => { updateChipFade(); });
  useEffect(() => {
    window.addEventListener('resize', updateChipFade);
    return () => window.removeEventListener('resize', updateChipFade);
  }, [updateChipFade]);
  const chipMask = chipFade.left || chipFade.right
    ? `linear-gradient(to right, ${chipFade.left ? 'transparent, #000 2rem' : '#000'}, ${chipFade.right ? '#000 calc(100% - 2rem), transparent' : '#000'})`
    : null;

  // Refresh when the agent creates experiments (its writes go straight to Dexie via
  // a separate useExperiments instance; AgentContext emits this window event).
  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener('labmate:experiments-changed', onChange);
    return () => window.removeEventListener('labmate:experiments-changed', onChange);
  }, [reload]);

  // Arriving from the Calendar's "Open in Notebook": select that entry.
  useEffect(() => {
    const focus = takeHandoff(NOTEBOOK_FOCUS_KEY);
    if (!focus?.id) return;
    revealSelectedRef.current = true;
    setSelectedId(focus.id);
    setMobileView('editor');
  }, []);

  const selected = useMemo(() => entries.find(e => e.id === selectedId) || null, [entries, selectedId]);

  // Keep the working copy in step with the stored record (selection loaded, or an
  // outside write such as the agent or a JSON import) — but never over local
  // changes that are being edited or still waiting to auto-save.
  useEffect(() => {
    if (!selected) return;
    setDraft(prev => {
      if (!prev || prev.id !== selected.id) return clone(selected);
      if (editing || saveTimerRef.current) return prev;
      return prev.updatedAt === selected.updatedAt ? prev : clone(selected);
    });
  }, [selected, editing]);

  const doc = selected && draft && draft.id === selected.id ? draft : null;

  useEffect(() => {
    if (!doc || !revealSelectedRef.current) return;
    revealSelectedRef.current = false;
    const row = [...(listRef.current?.querySelectorAll('[data-entry-id]') || [])].find(el => el.dataset.entryId === doc.id);
    row?.scrollIntoView({ block: 'nearest' });
  }, [doc]);

  const counts = useMemo(() => {
    const c = { all: entries.length };
    STATUSES.forEach(s => { c[s.id] = 0; });
    entries.forEach(e => { if (c[e.status] != null) c[e.status] += 1; });
    return c;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.titleZh || '').toLowerCase().includes(q) ||
        (e.plan?.objectives || '').toLowerCase().includes(q) ||
        (e.date || '').includes(q)
      );
    }
    return list;
  }, [entries, statusFilter, search]);

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── Auto-save (debounced), plus explicit flush/discard for Save/Cancel/switching ──
  const autoSave = useCallback((entry) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    // A change to another entry must not swallow the one still waiting.
    if (pendingRef.current && pendingRef.current.id !== entry.id) save(pendingRef.current);
    pendingRef.current = entry;
    saveTimerRef.current = setTimeout(async () => {
      saveTimerRef.current = null;
      pendingRef.current = null;
      await save(entry);
      toast.show(t('nbAutoSaved', lang));
    }, 1500);
  }, [save, lang, toast]);

  const flushAutoSave = useCallback(() => {
    if (!saveTimerRef.current) return Promise.resolve();
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    const pending = pendingRef.current;
    pendingRef.current = null;
    return pending ? save(pending) : Promise.resolve();
  }, [save]);

  const discardAutoSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    pendingRef.current = null;
  }, []);

  // Leaving the tab mid-edit: store what's pending right away.
  useEffect(() => () => {
    if (!saveTimerRef.current) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    if (pendingRef.current) save(pendingRef.current);
    pendingRef.current = null;
  }, [save]);

  const updateField = useCallback((path, value) => {
    setDraft(prev => {
      if (!prev) return prev;
      // Copy only the containers along `path` (was a full JSON deep clone of the
      // whole experiment — steps, reagents, figures — on every keystroke).
      const keys = path.split('.');
      const next = Array.isArray(prev) ? [...prev] : { ...prev };
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        const cur = obj[keys[i]];
        obj[keys[i]] = Array.isArray(cur) ? [...cur] : { ...(cur || {}) };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      autoSave(next);
      return next;
    });
  }, [autoSave]);

  const openEntry = useCallback((entry) => {
    if (entry.id === selectedId && doc) {
      if (isMobile) { setMobileView('editor'); window.scrollTo(0, 0); }
      return;
    }
    flushAutoSave();
    newEntryIdRef.current = null;
    setEditing(false);
    setSelectedId(entry.id);
    setDraft(clone(entry));
    if (isMobile) { setMobileView('editor'); window.scrollTo(0, 0); }
  }, [selectedId, doc, isMobile, flushAutoSave]);

  const handleNewEntry = useCallback(async () => {
    await flushAutoSave();
    const saved = await save(createEmptyExperiment(localToday()));
    snapshotRef.current = clone(saved);
    newEntryIdRef.current = saved.id;
    setSelectedId(saved.id);
    setDraft(clone(saved));
    setEditing(true);
    // Make sure the new entry is visible in the list.
    setStatusFilter('all');
    setSearch('');
    if (isMobile) { setMobileView('editor'); window.scrollTo(0, 0); }
  }, [save, isMobile, flushAutoSave]);

  const startEdit = useCallback(() => {
    if (!draft) return;
    flushAutoSave();
    snapshotRef.current = clone(draft);
    setEditing(true);
  }, [draft, flushAutoSave]);

  const saveEdit = useCallback(async () => {
    if (!draft) return;
    discardAutoSave();
    newEntryIdRef.current = null;
    await save(draft);
    setEditing(false);
    toast.show(zh ? '记录已保存' : 'Entry saved');
  }, [draft, save, discardAutoSave, toast, zh]);

  const cancelEdit = useCallback(async () => {
    if (!draft) return;
    discardAutoSave();
    if (newEntryIdRef.current === draft.id) {
      // Cancelling a brand-new entry discards it.
      newEntryIdRef.current = null;
      await remove(draft.id);
      setEditing(false);
      setSelectedId(null);
      setDraft(null);
      if (isMobile) setMobileView('list');
      return;
    }
    const snap = snapshotRef.current;
    if (snap && snap.id === draft.id && JSON.stringify(snap) !== JSON.stringify(draft)) {
      setDraft(snap);
      await save(snap); // auto-save may already have stored some of the discarded edits
    }
    setEditing(false);
  }, [draft, discardAutoSave, remove, save, isMobile]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    discardAutoSave();
    newEntryIdRef.current = null;
    await remove(selectedId);
    setSelectedId(null);
    setDraft(null);
    setEditing(false);
    setShowDeleteConfirm(false);
    if (isMobile) setMobileView('list');
    toast.show(zh ? '记录已删除' : 'Entry deleted');
  }, [selectedId, remove, discardAutoSave, isMobile, toast, zh]);

  const handleImportProtocol = useCallback((recipe) => {
    if (!draft) return;
    const steps = toProcedureSteps(recipe, lang);
    const next = {
      ...draft,
      protocolRef: recipe.id,
      title: draft.title || recipeTitle(recipe, lang),
      titleZh: draft.titleZh || (recipe.nameCn || ''),
      duration: recipe.duration || draft.duration,
      procedure: { mode: 'template', protocolSteps: steps, freeText: draft.procedure?.freeText || '' }
    };
    if (recipe.materials) {
      next.materials = { ...next.materials, reagents: toReagents(recipe) };
    }
    setDraft(next);
    autoSave(next);
    setShowProtocolImport(false);
    toast.show(zh ? '已从方案导入' : 'Imported from protocol');
  }, [draft, lang, zh, autoSave, toast]);

  const exportMarkdown = useCallback(() => {
    if (!draft) return;
    downloadText(experimentToMarkdown(draft), experimentFilename(draft));
    toast.show(t('downloaded', lang));
  }, [draft, lang, toast]);

  const viewInCalendar = useCallback(() => {
    if (!draft) return;
    flushAutoSave();
    giveHandoff(CALENDAR_FOCUS_KEY, { id: draft.id, date: draft.date });
    onNavigateCalendar?.();
  }, [draft, flushAutoSave, onNavigateCalendar]);

  // Entries planned from an evidence map link back to the experiment node.
  const openEvidenceMap = useCallback(() => {
    if (!draft?.evidenceLink) return;
    flushAutoSave();
    giveHandoff(EVIDENCE_FOCUS_KEY, { mapId: draft.evidenceLink.mapId, nodeId: draft.evidenceLink.nodeId });
    onNavigateEvidence?.();
  }, [draft, flushAutoSave, onNavigateEvidence]);

  const handleExportJson = useCallback(async () => {
    const json = await exportExperimentsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `labmate_experiments_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.show(t('downloaded', lang));
  }, [lang, toast]);

  const handleImportJson = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importExperimentsJSON(text);
      await reload();
      toast.show((zh ? '已导入 ' : 'Imported ') + count + (zh ? ' 条记录' : ' entries'));
    } catch {
      toast.show(zh ? '导入失败' : 'Import failed');
    }
    e.target.value = '';
  }, [reload, zh, toast]);

  const backToList = () => { setMobileView('list'); window.scrollTo(0, 0); };
  const clearFilters = () => { setSearch(''); setStatusFilter('all'); };

  const protocolName = (ref) => {
    if (!ref) return '';
    const r = RECIPE_BY_ID[ref];
    if (!r) return ref;
    return zh ? (r.nameCn || r.name) : r.name;
  };
  const untitled = zh ? '未命名记录' : 'Untitled entry';
  const statusLabel = (s) => (s === 'all' ? t('nbAll', lang) : t(STATUS_BY_ID[s].key, lang));
  const removeBtn = (onClick) => (
    <button type="button" className="btn-ghost btn-icon btn-sm" onClick={onClick} aria-label={zh ? '删除' : 'Remove'}>
      <IconClose size={14} />
    </button>
  );
  const addBtn = (label, onClick) => (
    <button type="button" className="btn btn-sm" onClick={onClick}><IconPlus size={13} />{label}</button>
  );
  const emptyLine = (text) => (
    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
      {text}{' '}
      <button type="button" className="link" onClick={startEdit}>{zh ? '添加' : 'Add'}</button>
    </p>
  );
  const fieldBlock = (label, value) => (
    <div>
      <div className="eyebrow" style={{ marginBottom: '0.25rem' }}>{label}</div>
      <p className="detail-text" style={FIELD_TEXT}>{value}</p>
    </div>
  );

  // ── Document sections ──
  const renderSection = (key, num, labelKey, meta, body, actions) => {
    const open = expandedSections[key];
    return (
      <section className="doc-section" aria-labelledby={`${uid}-sec-${key}`}>
        <div className="doc-section-head">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <span className="mono" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent)' }}>{num}</span>
            <h3 id={`${uid}-sec-${key}`} className="section-title">{t(labelKey, lang)}</h3>
            {meta && <span className="mono truncate" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{meta}</span>}
          </div>
          <div className="flex items-center gap-1 flex-none">
            {open && actions}
            <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => toggleSection(key)}
              aria-expanded={open} aria-controls={`${uid}-body-${key}`}
              aria-label={`${t(labelKey, lang)} — ${open ? (zh ? '收起' : 'Collapse') : (zh ? '展开' : 'Expand')}`}>
              <IconChevronDown size={16} style={{ transform: open ? 'none' : 'rotate(-90deg)', transition: 'transform var(--duration-fast) ease' }} />
            </button>
          </div>
        </div>
        {open && <div id={`${uid}-body-${key}`}>{body}</div>}
      </section>
    );
  };

  const renderPlan = () => {
    const plan = doc.plan || {};
    const body = editing ? (
      <div className="space-y-3">
        <div>
          <label htmlFor={`${uid}-objectives`}>{t('nbObjectives', lang)}</label>
          <textarea id={`${uid}-objectives`} value={plan.objectives || ''} onChange={e => updateField('plan.objectives', e.target.value)}
            className="w-full" rows={3} placeholder={zh ? '描述实验目的...' : 'Describe experiment objectives...'} />
        </div>
        <div>
          <label htmlFor={`${uid}-notes`}>{t('nbNotes', lang)}</label>
          <textarea id={`${uid}-notes`} value={plan.notes || ''} onChange={e => updateField('plan.notes', e.target.value)}
            className="w-full" rows={2} placeholder={zh ? '其他备注...' : 'Additional notes...'} />
        </div>
      </div>
    ) : (plan.objectives || plan.notes) ? (
      <div className="space-y-4">
        {plan.objectives && fieldBlock(t('nbObjectives', lang), plan.objectives)}
        {plan.notes && fieldBlock(t('nbNotes', lang), plan.notes)}
      </div>
    ) : emptyLine(zh ? '尚未填写实验目的和备注。' : 'No objectives or notes yet.');
    return renderSection('plan', '01', 'nbPlan', null, body);
  };

  const renderMaterials = () => {
    const reagents = doc.materials?.reagents || [];
    const equipment = doc.materials?.equipment || [];
    const checklist = doc.materials?.checklist || [];
    const checked = checklist.filter(c => c.checked).length;
    const meta = [
      reagents.length ? (zh ? `试剂 ${reagents.length}` : `${reagents.length} reagent${reagents.length === 1 ? '' : 's'}`) : null,
      equipment.length ? (zh ? `设备 ${equipment.length}` : `${equipment.length} equipment`) : null,
      checklist.length ? (zh ? `清单 ${checked}/${checklist.length}` : `checklist ${checked}/${checklist.length}`) : null,
    ].filter(Boolean).join(' · ');

    const setChecked = (i, value) => {
      const next = [...checklist]; next[i] = { ...next[i], checked: value };
      updateField('materials.checklist', next);
    };

    if (!editing) {
      const empty = !reagents.length && !equipment.length && !checklist.length;
      const body = empty ? emptyLine(zh ? '尚未列出试剂、设备或检查清单。' : 'No reagents, equipment or checklist yet.') : (
        <div className="space-y-5">
          {reagents.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: '0.25rem' }}>{t('nbReagents', lang)}</div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 0 }}>{t('nbReagentName', lang)}</th>
                      <th>{t('nbAmount', lang)}</th>
                      <th>{t('nbLocation', lang)}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reagents.map((r, i) => (
                      <tr key={i}>
                        <td style={{ paddingLeft: 0 }}>{r.name || '—'}</td>
                        <td className="tabular" style={{ whiteSpace: 'nowrap' }}>{r.amount ? `${r.amount} ${r.unit || ''}` : '—'}</td>
                        <td style={{ color: r.location ? 'var(--text)' : 'var(--text-muted)' }}>{r.location || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {equipment.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: '0.25rem' }}>{t('nbEquipment', lang)}</div>
              <ul>
                {equipment.map((eq, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 py-2" style={{ borderTop: i ? '1px solid var(--rule)' : 0, fontSize: '0.875rem' }}>
                    <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>{eq.name || '—'}</span>
                    <span className={`badge ${eq.status === 'ready' ? 'badge-green' : 'badge-warn'}`}>
                      {eq.status === 'ready' ? t('nbReady', lang) : t('nbPending', lang)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {checklist.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: '0.25rem' }}>{t('nbChecklist', lang)}</div>
              <ul>
                {checklist.map((c, i) => (
                  <li key={i} style={{ borderTop: i ? '1px solid var(--rule)' : 0 }}>
                    <label className="label-inline flex gap-2.5 py-2" style={{ alignItems: 'flex-start' }}>
                      <input type="checkbox" checked={!!c.checked} onChange={e => setChecked(i, e.target.checked)} style={{ width: 16, height: 16, marginTop: 3, flexShrink: 0 }} />
                      <span style={{ ...CHECK_TEXT, color: c.checked ? 'var(--text-muted)' : 'var(--text)', textDecoration: c.checked ? 'line-through' : 'none' }}>
                        {c.item || '—'}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
      return renderSection('materials', '02', 'nbMaterials', meta, body);
    }

    const body = (
      <div className="space-y-5">
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="eyebrow">{t('nbReagents', lang)}</span>
            {addBtn(t('nbAddReagent', lang), () => updateField('materials.reagents', [...reagents, { name: '', amount: '', unit: '', location: '', inventoryRef: null }]))}
          </div>
          {reagents.length > 0 && (
            <div className="hidden @xl:grid gap-2 mb-1 grid-cols-[minmax(0,1fr)_5.5rem_4.5rem_9rem_2.25rem]" aria-hidden="true">
              {['nbReagentName', 'nbAmount', 'nbUnit', 'nbLocation'].map(k => (
                <span key={k} className="eyebrow" style={{ fontSize: '0.625rem' }}>{t(k, lang)}</span>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {reagents.map((r, i) => {
              const set = (field, value) => { const next = [...reagents]; next[i] = { ...next[i], [field]: value }; updateField('materials.reagents', next); };
              return (
                <div key={i} className="grid gap-2 items-center grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] @xl:grid-cols-[minmax(0,1fr)_5.5rem_4.5rem_9rem_2.25rem]">
                  <input type="text" value={r.name} placeholder={t('nbReagentName', lang)} aria-label={t('nbReagentName', lang)}
                    onChange={e => set('name', e.target.value)} className="w-full min-w-0 col-span-4 @xl:col-span-1" />
                  <input type="text" value={r.amount} placeholder={t('nbAmount', lang)} aria-label={t('nbAmount', lang)}
                    onChange={e => set('amount', e.target.value)} className="w-full min-w-0" />
                  <input type="text" value={r.unit} placeholder={t('nbUnit', lang)} aria-label={t('nbUnit', lang)}
                    onChange={e => set('unit', e.target.value)} className="w-full min-w-0" />
                  <input type="text" value={r.location} placeholder={t('nbLocation', lang)} aria-label={t('nbLocation', lang)}
                    onChange={e => set('location', e.target.value)} className="w-full min-w-0" />
                  {removeBtn(() => updateField('materials.reagents', reagents.filter((_, j) => j !== i)))}
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="eyebrow">{t('nbEquipment', lang)}</span>
            {addBtn(t('nbAddEquipment', lang), () => updateField('materials.equipment', [...equipment, { name: '', status: 'pending' }]))}
          </div>
          <div className="space-y-2">
            {equipment.map((eq, i) => (
              <div key={i} className="grid gap-2 items-center grid-cols-[minmax(0,1fr)_7.5rem_auto]">
                <input type="text" value={eq.name} placeholder={t('nbEquipmentName', lang)} aria-label={t('nbEquipmentName', lang)}
                  onChange={e => { const next = [...equipment]; next[i] = { ...next[i], name: e.target.value }; updateField('materials.equipment', next); }}
                  className="w-full min-w-0" />
                <select value={eq.status} aria-label={t('nbStatus', lang)} className="w-full min-w-0"
                  onChange={e => { const next = [...equipment]; next[i] = { ...next[i], status: e.target.value }; updateField('materials.equipment', next); }}>
                  <option value="ready">{t('nbReady', lang)}</option>
                  <option value="pending">{t('nbPending', lang)}</option>
                </select>
                {removeBtn(() => updateField('materials.equipment', equipment.filter((_, j) => j !== i)))}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="eyebrow">{t('nbChecklist', lang)}</span>
            {addBtn(t('nbAddCheckItem', lang), () => updateField('materials.checklist', [...checklist, { item: '', checked: false }]))}
          </div>
          <div className="space-y-2">
            {checklist.map((c, i) => (
              <div key={i} className="grid gap-2 items-center grid-cols-[auto_minmax(0,1fr)_auto]">
                <input type="checkbox" checked={!!c.checked} onChange={e => setChecked(i, e.target.checked)}
                  aria-label={zh ? '已完成' : 'Done'} style={{ width: 16, height: 16 }} />
                <input type="text" value={c.item} aria-label={t('nbChecklist', lang)}
                  onChange={e => { const next = [...checklist]; next[i] = { ...next[i], item: e.target.value }; updateField('materials.checklist', next); }}
                  className="w-full min-w-0" style={{ textDecoration: c.checked ? 'line-through' : 'none' }} />
                {removeBtn(() => updateField('materials.checklist', checklist.filter((_, j) => j !== i)))}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    return renderSection('materials', '02', 'nbMaterials', meta, body);
  };

  const renderProcedure = () => {
    const proc = doc.procedure || { mode: 'freetext', protocolSteps: [], freeText: '' };
    const steps = proc.protocolSteps || [];
    const done = steps.filter(s => s.completed).length;
    const isTemplate = proc.mode === 'template';
    const setStep = (i, patch) => {
      const next = [...steps]; next[i] = { ...next[i], ...patch };
      updateField('procedure.protocolSteps', next);
    };
    const importBtn = (
      <button type="button" className="btn btn-sm" onClick={() => setShowProtocolImport(true)}>
        <IconClipboard size={13} />{t('nbImportProtocol', lang)}
      </button>
    );
    const meta = isTemplate && steps.length
      ? (zh ? `已完成 ${done}/${steps.length}` : `${done}/${steps.length} done`)
      : (!isTemplate && proc.freeText ? t('nbFreetextMode', lang) : null);

    if (!editing) {
      let body;
      if (isTemplate && steps.length) {
        const pct = Math.round((done / steps.length) * 100);
        body = (
          <div>
            <div style={{ height: 3, background: 'var(--bg-2)', marginTop: '-0.25rem', marginBottom: '0.5rem' }} aria-hidden="true">
              <div style={{ height: '100%', width: `${pct}%`, background: 'var(--primary)', transition: 'width var(--duration-base) ease' }} />
            </div>
            <ol>
              {steps.map((s, i) => (
                <li key={i} className="flex items-start gap-3 py-2.5" style={{ borderTop: i ? '1px solid var(--rule)' : 0 }}>
                  <label className="label-inline flex-none" style={{ padding: 4, margin: '-2px -4px -4px' }}>
                    <input type="checkbox" checked={!!s.completed} onChange={e => setStep(i, { completed: e.target.checked })}
                      aria-label={zh ? `第 ${i + 1} 步已完成` : `Step ${i + 1} done`} style={{ width: 16, height: 16, display: 'block' }} />
                  </label>
                  <span className="mono flex-none" style={{ fontSize: '0.75rem', fontWeight: 700, lineHeight: '1.45rem', minWidth: '1.4rem', color: s.completed ? 'var(--text-muted)' : 'var(--accent)' }}>
                    {pad2(i + 1)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p style={{ ...FIELD_TEXT, fontSize: '0.9rem', lineHeight: 1.6, color: s.completed ? 'var(--text-muted)' : 'var(--text)', textDecoration: s.completed ? 'line-through' : 'none', textDecorationColor: 'var(--border)' }}>
                      {s.stepText}
                    </p>
                    {(s.deviation || s.actualParams) && (
                      <dl className="mt-1 space-y-0.5" style={{ fontSize: '0.75rem' }}>
                        {s.deviation && (
                          <div className="flex gap-2">
                            <dt className="mono flex-none" style={{ fontWeight: 700, color: 'var(--warning-text)' }}>{t('nbDeviation', lang)}</dt>
                            <dd className="mono" style={{ overflowWrap: 'anywhere' }}>{s.deviation}</dd>
                          </div>
                        )}
                        {s.actualParams && (
                          <div className="flex gap-2">
                            <dt className="mono flex-none" style={{ fontWeight: 700, color: 'var(--text-muted)' }}>{t('nbActualParams', lang)}</dt>
                            <dd className="mono" style={{ overflowWrap: 'anywhere' }}>{s.actualParams}</dd>
                          </div>
                        )}
                      </dl>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        );
      } else if (!isTemplate && proc.freeText) {
        body = <p className="detail-text" style={FIELD_TEXT}>{proc.freeText}</p>;
      } else {
        body = (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {zh ? '尚未记录步骤。可从方案导入，或' : 'No steps yet. Import them from a protocol or'}{' '}
              <button type="button" className="link" onClick={startEdit}>{zh ? '手动记录' : 'write them yourself'}</button>.
            </p>
            {importBtn}
          </div>
        );
      }
      return renderSection('procedure', '03', 'nbProcedure', meta, body);
    }

    const body = (
      <div className="space-y-3">
        <div className="flex gap-2 items-center flex-wrap">
          <div className="seg" role="group" aria-label={t('nbProcedure', lang)}>
            <button type="button" aria-pressed={isTemplate} onClick={() => updateField('procedure.mode', 'template')}>{t('nbTemplateMode', lang)}</button>
            <button type="button" aria-pressed={!isTemplate} onClick={() => updateField('procedure.mode', 'freetext')}>{t('nbFreetextMode', lang)}</button>
          </div>
          {isTemplate && importBtn}
        </div>
        {isTemplate ? (
          steps.length === 0 ? (
            <p className="py-3" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              {zh ? '点击"从方案导入"加载步骤' : 'Click "Import from Protocol" to load steps'}
            </p>
          ) : (
            <ol className="space-y-2">
              {steps.map((step, i) => (
                <li key={i} className="p-3" style={{ border: '1px solid var(--rule)', background: step.completed ? 'var(--bg-2)' : 'var(--card)' }}>
                  <div className="flex gap-3 items-start">
                    <input type="checkbox" checked={!!step.completed} onChange={e => setStep(i, { completed: e.target.checked })}
                      aria-label={zh ? `第 ${i + 1} 步已完成` : `Step ${i + 1} done`} style={{ width: 16, height: 16, marginTop: 3, flexShrink: 0 }} />
                    <span className="mono flex-none" style={{ fontSize: '0.75rem', fontWeight: 700, lineHeight: '1.4rem', color: 'var(--accent)' }}>{pad2(i + 1)}</span>
                    <p className="flex-1 min-w-0" style={{ fontSize: '0.875rem', lineHeight: 1.55, color: step.completed ? 'var(--text-muted)' : 'var(--text)', textDecoration: step.completed ? 'line-through' : 'none' }}>
                      {step.stepText}
                    </p>
                  </div>
                  <div className="grid gap-2 mt-2 @md:grid-cols-2" style={{ paddingLeft: '2.4rem' }}>
                    <input type="text" value={step.deviation || ''} placeholder={t('nbDeviation', lang)} aria-label={t('nbDeviation', lang)}
                      onChange={e => setStep(i, { deviation: e.target.value })} className="w-full min-w-0" />
                    <input type="text" value={step.actualParams || ''} placeholder={t('nbActualParams', lang)} aria-label={t('nbActualParams', lang)}
                      onChange={e => setStep(i, { actualParams: e.target.value })} className="w-full min-w-0" />
                  </div>
                </li>
              ))}
            </ol>
          )
        ) : (
          <textarea value={proc.freeText || ''} onChange={e => updateField('procedure.freeText', e.target.value)} aria-label={t('nbProcedure', lang)}
            className="w-full" rows={8} placeholder={zh ? '自由记录实验步骤...' : 'Record experiment procedure...'} />
        )}
      </div>
    );
    return renderSection('procedure', '03', 'nbProcedure', meta, body);
  };

  const renderResults = () => {
    const res = doc.results || { summary: '', dataProcessing: '', figures: [], backupStatus: '' };
    const figures = res.figures || [];
    const meta = figures.length ? (zh ? `图表 ${figures.length}` : `${figures.length} figure${figures.length === 1 ? '' : 's'}`) : null;

    if (!editing) {
      const empty = !res.summary && !res.dataProcessing && !figures.length && !res.backupStatus;
      const body = empty ? emptyLine(zh ? '尚未记录结果。' : 'No results recorded yet.') : (
        <div className="space-y-4">
          {res.summary && fieldBlock(t('nbSummary', lang), res.summary)}
          {res.dataProcessing && fieldBlock(t('nbDataProcessing', lang), res.dataProcessing)}
          {figures.length > 0 && (
            <div>
              <div className="eyebrow" style={{ marginBottom: '0.25rem' }}>{t('nbFigures', lang)}</div>
              <ol>
                {figures.map((f, i) => (
                  <li key={i} className="flex gap-3 py-2" style={{ borderTop: i ? '1px solid var(--rule)' : 0, fontSize: '0.875rem' }}>
                    <span className="mono flex-none" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', lineHeight: '1.3rem' }}>
                      {zh ? `图 ${i + 1}` : `Fig. ${i + 1}`}
                    </span>
                    <span className="min-w-0" style={{ overflowWrap: 'anywhere' }}>
                      {f.description || '—'}
                      {f.notes && <span style={{ color: 'var(--text-muted)' }}> · {f.notes}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {res.backupStatus && (
            <div>
              <div className="eyebrow" style={{ marginBottom: '0.25rem' }}>{t('nbBackupStatus', lang)}</div>
              <p className="mono" style={{ fontSize: '0.8125rem', overflowWrap: 'anywhere' }}>{res.backupStatus}</p>
            </div>
          )}
        </div>
      );
      return renderSection('results', '04', 'nbResults', meta, body);
    }

    const body = (
      <div className="space-y-3">
        <div>
          <label htmlFor={`${uid}-summary`}>{t('nbSummary', lang)}</label>
          <textarea id={`${uid}-summary`} value={res.summary || ''} onChange={e => updateField('results.summary', e.target.value)}
            className="w-full" rows={3} placeholder={zh ? '实验结果总结...' : 'Summarize results...'} />
        </div>
        <div>
          <label htmlFor={`${uid}-dataproc`}>{t('nbDataProcessing', lang)}</label>
          <textarea id={`${uid}-dataproc`} value={res.dataProcessing || ''} onChange={e => updateField('results.dataProcessing', e.target.value)}
            className="w-full" rows={2} placeholder={zh ? '数据处理方法和结果...' : 'Data processing methods and results...'} />
        </div>
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="eyebrow">{t('nbFigures', lang)}</span>
            {addBtn(t('nbAddFigure', lang), () => updateField('results.figures', [...figures, { description: '', notes: '' }]))}
          </div>
          <div className="space-y-2">
            {figures.map((fig, i) => (
              <div key={i} className="grid gap-2 items-center grid-cols-[minmax(0,1fr)_auto] @lg:grid-cols-[minmax(0,1fr)_10rem_auto]">
                <input type="text" value={fig.description} placeholder={t('nbFigureDesc', lang)} aria-label={t('nbFigureDesc', lang)}
                  onChange={e => { const next = [...figures]; next[i] = { ...next[i], description: e.target.value }; updateField('results.figures', next); }}
                  className="w-full min-w-0 col-span-2 @lg:col-span-1" />
                <input type="text" value={fig.notes} placeholder={t('nbFigureNotes', lang)} aria-label={t('nbFigureNotes', lang)}
                  onChange={e => { const next = [...figures]; next[i] = { ...next[i], notes: e.target.value }; updateField('results.figures', next); }}
                  className="w-full min-w-0" />
                {removeBtn(() => updateField('results.figures', figures.filter((_, j) => j !== i)))}
              </div>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor={`${uid}-backup`}>{t('nbBackupStatus', lang)}</label>
          <input id={`${uid}-backup`} type="text" value={res.backupStatus || ''} onChange={e => updateField('results.backupStatus', e.target.value)}
            className="w-full" placeholder={zh ? '备份位置/状态...' : 'Backup location/status...'} />
        </div>
      </div>
    );
    return renderSection('results', '04', 'nbResults', meta, body);
  };

  // ── Document header: title + facts (read) or the header fields (edit) ──
  const renderDocHeader = () => {
    const title = displayTitle(doc, lang);
    const other = zh ? (doc.titleZh ? doc.title : '') : (doc.title ? doc.titleZh : '');
    const shortId = String(doc.id || '').split('_').pop().toUpperCase();
    if (editing) {
      return (
        <div className="space-y-3">
          <div className="grid gap-3 @md:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-title`}>{t('nbEntryTitle', lang)}</label>
              <input id={`${uid}-title`} type="text" value={doc.title || ''} onChange={e => updateField('title', e.target.value)}
                className="w-full" placeholder={zh ? '实验标题 (EN)' : 'Experiment title'} data-autofocus />
            </div>
            <div>
              <label htmlFor={`${uid}-titlezh`}>{t('nbEntryTitleZh', lang)}</label>
              <input id={`${uid}-titlezh`} type="text" value={doc.titleZh || ''} onChange={e => updateField('titleZh', e.target.value)}
                className="w-full" placeholder={zh ? '中文标题' : 'Chinese title (optional)'} />
            </div>
          </div>
          <div className="grid gap-3 grid-cols-2 @lg:grid-cols-3 @3xl:grid-cols-5">
            <div>
              <label htmlFor={`${uid}-date`}>{t('nbDate', lang)}</label>
              <input id={`${uid}-date`} type="date" value={doc.date || ''} onChange={e => updateField('date', e.target.value)} className="w-full" />
            </div>
            <div>
              <label htmlFor={`${uid}-start`}>{t('nbStartTime', lang)}</label>
              <input id={`${uid}-start`} type="time" value={doc.startTime || ''} onChange={e => updateField('startTime', e.target.value)} className="w-full" />
            </div>
            <div>
              <label htmlFor={`${uid}-duration`}>{t('nbDuration', lang)}</label>
              <input id={`${uid}-duration`} type="number" value={doc.duration || ''} onChange={e => updateField('duration', parseInt(e.target.value) || 0)} className="w-full" min="0" />
            </div>
            <div>
              <label htmlFor={`${uid}-status`}>{t('nbStatus', lang)}</label>
              <select id={`${uid}-status`} value={doc.status || 'planned'} onChange={e => updateField('status', e.target.value)} className="w-full">
                {STATUSES.map(s => <option key={s.id} value={s.id}>{t(s.key, lang)}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor={`${uid}-priority`}>{t('nbPriority', lang)}</label>
              <select id={`${uid}-priority`} value={doc.priority || 'medium'} onChange={e => updateField('priority', e.target.value)} className="w-full">
                <option value="high">{t('nbPriorityHigh', lang)}</option>
                <option value="medium">{t('nbPriorityMedium', lang)}</option>
                <option value="low">{t('nbPriorityLow', lang)}</option>
              </select>
            </div>
          </div>
          {doc.protocolRef && (
            <div className="notice notice-info" style={{ alignItems: 'center' }}>
              <IconClipboard size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span><span className="notice-title">{t('nbLinkedProtocol', lang)}:</span> {protocolName(doc.protocolRef)}</span>
            </div>
          )}
        </div>
      );
    }
    const end = addMinutes(doc.startTime, doc.duration);
    return (
      <>
        <header>
          <div className="eyebrow flex items-center gap-1.5">
            <span>{zh ? '实验记录' : 'Entry'}</span><span aria-hidden="true">·</span><span>{shortId}</span>
          </div>
          <h2 style={{ ...DOC_TITLE, marginTop: '0.3rem', color: title ? 'var(--text)' : 'var(--text-muted)', overflowWrap: 'anywhere' }}>{title || untitled}</h2>
          {other && <p style={{ marginTop: '0.2rem', fontSize: '0.9375rem', color: 'var(--text-muted)' }}>{other}</p>}
        </header>
        <dl className="meta-grid grid-cols-2 @xl:grid-cols-3 mt-4">
          <div><dt>{t('nbStatus', lang)}</dt><dd><StatusBadge status={doc.status} lang={lang} /></dd></div>
          <div><dt>{t('nbDate', lang)}</dt><dd>{doc.date || '—'}</dd></div>
          <div>
            <dt>{zh ? '时间' : 'Time'}</dt>
            <dd><span style={{ whiteSpace: 'nowrap' }}>{doc.startTime ? `${doc.startTime}${end ? `–${end}` : ''}` : '—'}</span>{doc.duration ? <span style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap' }}> · {doc.duration} min</span> : null}</dd>
          </div>
          <div>
            <dt>{t('nbPriority', lang)}</dt>
            <dd style={doc.priority === 'high' ? { color: 'var(--danger-text)', fontWeight: 700 } : undefined}>{t(PRIORITY_KEY[doc.priority] || 'nbPriorityMedium', lang)}</dd>
          </div>
          <div><dt>{t('nbLinkedProtocol', lang)}</dt><dd style={doc.protocolRef ? undefined : { color: 'var(--text-muted)' }}>{protocolName(doc.protocolRef) || '—'}</dd></div>
          <div><dt>{zh ? '更新于' : 'Updated'}</dt><dd>{formatStamp(doc.updatedAt)}</dd></div>
        </dl>
        {doc.evidenceLink && (
          <div className="notice notice-info mt-4" style={{ alignItems: 'center' }}>
            <IconGraph size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span className="flex-1 min-w-0" style={{ overflowWrap: 'anywhere' }}>
              <span className="notice-title">{zh ? '来自证据链' : 'From evidence map'}:</span>{' '}
              {doc.evidenceLink.mapTitle || (zh ? '未命名证据链' : 'Untitled map')}
              {doc.evidenceLink.label && <span className="mono" style={{ color: 'var(--text-muted)' }}> · {doc.evidenceLink.label}</span>}
            </span>
            {onNavigateEvidence && (
              <button type="button" className="btn btn-sm flex-none" onClick={openEvidenceMap}>{zh ? '打开证据链' : 'Open map'}</button>
            )}
          </div>
        )}
      </>
    );
  };

  const renderToolbar = () => {
    if (editing) {
      return (
        <>
          <span className="flex items-center gap-2 min-w-0">
            <span aria-hidden="true" style={{ width: 8, height: 8, background: 'var(--primary)', border: '1px solid var(--border-strong)', flexShrink: 0 }} />
            <span className="eyebrow" style={{ color: 'var(--text)' }}>{zh ? '编辑中' : 'Editing'}</span>
            <span className="hidden sm:inline truncate" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {zh ? '· 更改会自动保存' : '· changes auto-save'}
            </span>
          </span>
          <span className="flex items-center gap-2 flex-none">
            <button type="button" className="btn btn-sm" onClick={cancelEdit}>{t('nbCancel', lang)}</button>
            <button type="button" className="btn-primary btn-sm" onClick={saveEdit}><IconCheck size={14} />{t('nbSave', lang)}</button>
          </span>
        </>
      );
    }
    const calLabel = zh ? '在日历中查看' : 'View in calendar';
    return (
      <div className="toolbar w-full" style={{ gap: '0.375rem' }}>
        {isMobile && (
          <button type="button" className="btn-ghost btn-sm" onClick={backToList} style={{ paddingLeft: '0.25rem' }}>
            <IconChevronLeft size={16} />{t('backNav', lang)}
          </button>
        )}
        <button type="button" className="btn btn-sm" onClick={startEdit}><IconEdit size={14} />{zh ? '编辑' : 'Edit'}</button>
        {/* Wide panel: labelled actions. Narrow panel (phones, tablets, 1024–1150px): icons. */}
        <button type="button" className="btn btn-sm hidden @lg:inline-flex" onClick={viewInCalendar}><IconCalendar size={14} />{calLabel}</button>
        <button type="button" className="btn btn-sm hidden @lg:inline-flex" onClick={exportMarkdown}><IconDownload size={14} />{t('nbExportMd', lang)}</button>
        <span className="toolbar-spacer" />
        <button type="button" className="btn-danger btn-sm hidden @lg:inline-flex" onClick={() => setShowDeleteConfirm(true)}><IconTrash size={14} />{t('nbDeleteEntry', lang)}</button>
        <button type="button" className="btn-ghost btn-icon btn-sm @lg:hidden" onClick={viewInCalendar} aria-label={calLabel} title={calLabel}><IconCalendar size={16} /></button>
        <button type="button" className="btn-ghost btn-icon btn-sm @lg:hidden" onClick={exportMarkdown} aria-label={t('nbExportMd', lang)} title={t('nbExportMd', lang)}><IconDownload size={16} /></button>
        <button type="button" className="btn-ghost btn-icon btn-sm @lg:hidden" onClick={() => setShowDeleteConfirm(true)} aria-label={t('nbDeleteEntry', lang)} title={t('nbDeleteEntry', lang)} style={{ color: 'var(--danger-text)' }}>
          <IconTrash size={16} />
        </button>
      </div>
    );
  };

  const detail = doc ? (
    <article className="panel min-w-0 @container" aria-label={displayTitle(doc, lang) || untitled}>
      <div className="panel-head sticky z-[2] top-[calc(var(--topbar-h)_+_env(safe-area-inset-top,0px))] lg:top-0"
        style={{ background: editing ? 'var(--bg-2)' : 'var(--card)', padding: '0.5rem 0.75rem', minHeight: '3rem' }}>
        {renderToolbar()}
      </div>
      <div className="px-4 pt-5 pb-7 @lg:px-7 @lg:pt-6 @lg:pb-8">
        {renderDocHeader()}
        {renderPlan()}
        {renderMaterials()}
        {renderProcedure()}
        {renderResults()}
      </div>
    </article>
  ) : (
    <div className="panel flex items-center justify-center" style={{ minHeight: 420 }}>
      <div className="empty">
        <div className="empty-icon"><IconNotebook size={22} /></div>
        <div className="empty-title">{t('nbSelectEntry', lang)}</div>
        <div className="empty-desc">
          {STATUSES.filter(s => counts[s.id]).map(s => `${counts[s.id]} ${t(s.key, lang).toLowerCase()}`).join(' · ')}
        </div>
      </div>
    </div>
  );

  // ── Master list ──
  const listPanel = (
    <section className="panel flex flex-col min-w-0 lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)]" aria-label={t('nbTitle', lang)}>
      <div className="p-3 space-y-2.5 flex-none" style={{ borderBottom: '1px solid var(--rule)' }}>
        <div className="search-field">
          <IconSearch size={15} />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('nbSearch', lang)} aria-label={t('nbSearch', lang)} />
        </div>
        <div ref={chipRowRef} className="chip-row is-scroll" role="group" aria-label={t('nbStatus', lang)}
          onScroll={updateChipFade} style={chipMask ? { maskImage: chipMask, WebkitMaskImage: chipMask } : undefined}>
          {['all', ...STATUSES.map(s => s.id)].map(s => (
            <button key={s} type="button" className="chip" aria-pressed={statusFilter === s}
              onClick={(e) => { setStatusFilter(s); e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' }); }}>
              {s !== 'all' && <span className="dot" aria-hidden="true" style={{ color: STATUS_BY_ID[s].fg }} />}
              {statusLabel(s)}
              <span className="chip-count">{counts[s]}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2 px-3.5 flex-none" style={{ minHeight: '2rem', borderBottom: '1px solid var(--rule)' }}>
        <span className="panel-title" aria-live="polite">
          {filteredEntries.length === entries.length
            ? (zh ? `${entries.length} 条记录` : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`)
            : (zh ? `${filteredEntries.length} / ${entries.length} 条记录` : `${filteredEntries.length} of ${entries.length} entries`)}
        </span>
        <span className="mono" style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{zh ? '按日期 ↓' : 'by date ↓'}</span>
      </div>
      {filteredEntries.length === 0 ? (
        <div className="empty" style={{ padding: '2rem 1.25rem' }}>
          <div className="empty-icon"><IconSearch size={20} /></div>
          <div className="empty-title">{zh ? '没有匹配的记录' : 'No matching entries'}</div>
          <div className="empty-desc">{zh ? '换个关键词或状态试试。' : 'Try another search term or status.'}</div>
          <button type="button" className="btn btn-sm" onClick={clearFilters}>{zh ? '清除筛选' : 'Clear filters'}</button>
        </div>
      ) : (
        <div ref={listRef} className="list flex-1 min-h-0 overflow-y-auto">
          {filteredEntries.map(entry => {
            const isSelected = entry.id === selectedId;
            const title = displayTitle(entry, lang);
            const proto = protocolName(entry.protocolRef);
            return (
              <button key={entry.id} type="button" data-entry-id={entry.id} onClick={() => openEntry(entry)}
                className={`list-row${isSelected ? ' is-selected' : ''}`} aria-current={isSelected ? 'true' : undefined}>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="list-row-title flex-1 min-w-0 truncate" style={title ? undefined : { color: 'var(--text-muted)', fontWeight: 500 }}>
                      {title || untitled}
                    </span>
                    <StatusBadge status={entry.status} lang={lang} />
                  </span>
                  <span className="list-row-meta" style={{ flexWrap: 'nowrap', gap: '0.375rem' }}>
                    <span className="flex-none">{entry.date || '—'}</span>
                    {entry.priority === 'high' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="flex-none" style={{ color: 'var(--danger-text)', fontWeight: 700 }}>{zh ? '高优先级' : 'high priority'}</span>
                      </>
                    )}
                    {proto && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="truncate min-w-0">{proto}</span>
                      </>
                    )}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  // ── First run: nothing recorded yet ──
  const firstRun = (
    <div className="panel">
      <div className="empty" style={{ padding: '3rem 1.5rem 2.5rem' }}>
        <div className="empty-icon"><IconNotebook size={22} /></div>
        <div className="empty-title">{t('nbNoEntries', lang)}</div>
        <div className="empty-desc" style={{ maxWidth: '46ch' }}>
          {zh
            ? '为每个实验建一条记录：写下计划、导入方案步骤、边做边勾选，并记录结果。数据只保存在本浏览器中。'
            : 'Give each experiment a record: plan it, import a protocol’s steps, tick them off at the bench and log the results. Records stay in this browser.'}
        </div>
        <div className="flex flex-wrap justify-center gap-2" style={{ marginTop: '0.75rem' }}>
          <button type="button" className="btn-primary" onClick={handleNewEntry} style={{ marginTop: 0 }}><IconPlus size={15} />{t('nbNewEntry', lang)}</button>
          <button type="button" className="btn" onClick={() => jsonInputRef.current?.click()} style={{ marginTop: 0 }}><IconUpload size={15} />{t('nbImportJson', lang)}</button>
        </div>
      </div>
      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" style={{ gap: 1, background: 'var(--rule)', borderTop: '1px solid var(--rule)' }}>
        {[
          ['01', 'nbPlan', zh ? '实验目的与备注' : 'Objectives and notes'],
          ['02', 'nbMaterials', zh ? '试剂、设备与检查清单' : 'Reagents, equipment, checklist'],
          ['03', 'nbProcedure', zh ? '从方案导入步骤，逐步勾选' : 'Protocol steps you tick off as you go'],
          ['04', 'nbResults', zh ? '总结、数据处理与图表' : 'Summary, data processing, figures'],
        ].map(([num, key, desc]) => (
          <li key={key} className="px-4 py-3.5" style={{ background: 'var(--card)' }}>
            <div className="flex items-baseline gap-2">
              <span className="mono" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent)' }}>{num}</span>
              <span className="eyebrow" style={{ color: 'var(--text)' }}>{t(key, lang)}</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.2rem', lineHeight: 1.45 }}>{desc}</p>
          </li>
        ))}
      </ol>
    </div>
  );

  const showFirstRun = !loading && entries.length === 0;
  const mobileDetail = isMobile && mobileView === 'editor' && doc;

  return (
    <div>
      {mobileDetail ? (
        <PageHeader tab="notebook" title={t('nbTitle', lang)} />
      ) : (
        <PageHeader tab="notebook" title={t('nbTitle', lang)} description={t('nbSubtitle', lang)}
          meta={entries.length ? (zh ? `${entries.length} 条记录` : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`) : null}
          actions={(
            <>
              <button type="button" className="btn" onClick={() => jsonInputRef.current?.click()} aria-label={t('nbImportJson', lang)}>
                <IconUpload size={15} />
                <span className="sm:hidden">{zh ? '导入' : 'Import'}</span>
                <span className="hidden sm:inline">{t('nbImportJson', lang)}</span>
              </button>
              <button type="button" className="btn" onClick={handleExportJson} disabled={entries.length === 0} aria-label={t('nbExportJson', lang)}>
                <IconDownload size={15} />
                <span className="sm:hidden">{zh ? '导出' : 'Export'}</span>
                <span className="hidden sm:inline">{t('nbExportJson', lang)}</span>
              </button>
              <button type="button" className="btn-primary" onClick={handleNewEntry}>
                <IconPlus size={15} />{t('nbNewEntry', lang)}
              </button>
            </>
          )} />
      )}
      <input ref={jsonInputRef} type="file" accept=".json" onChange={handleImportJson} className="hidden" tabIndex={-1} aria-hidden="true" />

      {loading && entries.length === 0 ? (
        <div className="panel"><div className="empty"><span className="mono" style={{ fontSize: '0.75rem' }}>{zh ? '加载中…' : 'Loading…'}</span></div></div>
      ) : showFirstRun ? firstRun : isMobile ? (
        mobileDetail ? detail : listPanel
      ) : (
        <div className="grid gap-4 items-start md:grid-cols-[280px_minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
          {listPanel}
          {detail}
        </div>
      )}

      {showProtocolImport && (
        <ProtocolSelector lang={lang} onSelect={handleImportProtocol} onClose={() => setShowProtocolImport(false)} title={t('nbImportProtocol', lang)} />
      )}
      {showDeleteConfirm && (
        <Dialog title={t('nbDeleteEntry', lang)} onClose={() => setShowDeleteConfirm(false)} lang={lang} size="sm"
          footer={(
            <>
              <button type="button" className="btn" onClick={() => setShowDeleteConfirm(false)} data-autofocus>{t('nbCancel', lang)}</button>
              <button type="button" className="btn-danger" onClick={handleDelete}><IconTrash size={14} />{t('nbDeleteEntry', lang)}</button>
            </>
          )}>
          <p style={{ fontSize: '0.875rem' }}>{t('nbDeleteConfirm', lang)}</p>
          {doc && <p className="mono" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>{displayTitle(doc, lang) || untitled} · {doc.date}</p>}
        </Dialog>
      )}
    </div>
  );
}

export default NotebookTab;
