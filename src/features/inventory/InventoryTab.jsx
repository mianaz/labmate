// ═══════════════════════════════════════════════
// Inventory — Main InventoryTab component (JSX)
// ═══════════════════════════════════════════════
// PageHeader → toolbar (sample search · Boxes/All-samples switch · undo, stats,
// import, export) → optional overview strip → storage tree | box grid | sample.
// ≥1280px: three columns. 768–1279px: tree | box, sample detail under the grid
// (global .inv-grid-3col / .inv-col-3 rule). <768px: drill-down tree → box →
// sample. With no locations the page is a single empty state.
import { useState, useEffect, useRef, useMemo } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { useToast } from '../../components/Toast.jsx';
import { useIsMobile, useMediaQuery } from '../../hooks/useMediaQuery.js';
import PageHeader from '../../components/PageHeader.jsx';
import {
  IconPlus, IconSearch, IconClose, IconEdit, IconTrash, IconCopy, IconArrowRight, IconDownload, IconUpload,
  IconChevronDown, IconChevronLeft, IconChevronRight, IconReset, IconBox, IconLayers, IconFile, IconFlask,
  IconCheck, IconAlert, IconPlate,
} from '../../components/icons.jsx';
import { InvModal, InvInput, InvSelect, TypeBadge, IconBars, StorageIcon, MenuItem, MenuPanel, Meter } from './InventoryComponents.jsx';
import { LocationForm, BoxForm, SampleForm, MoveSampleForm, ImportDialog } from './InventoryForms.jsx';
import { BoxGrid, posLabel } from './BoxGrid.jsx';
import { StorageTree } from './StorageTree.jsx';
import {
  SAMPLE_TYPE_COLORS, SAMPLE_TYPE_LABELS,
  parseTags, getInvData, saveInventory, nextInvId, normalizeSampleType,
  invExportAllCsv, invExportBoxCsv, invCsvTemplate, downloadCsv, parseCsvImport,
} from './inventoryUtils.js';
import db from '../../lib/db.js';

const DAY = 86400000;
function isoDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}
function daysUntil(ts) {
  if (!ts) return null;
  const ms = new Date(ts).getTime();
  return Number.isNaN(ms) ? null : Math.ceil((ms - Date.now()) / DAY);
}

// ── Sample detail panel ──────────────────────────────────────────────────────
// Keyed by sample id by the caller, so the delete confirmation resets per sample.
function SampleDetail({ sample, box, loc, lang, onBack, backLabel, onEdit, onMove, onDuplicate, onDelete }) {
  const [confirming, setConfirming] = useState(false);
  const nameOf = (o) => (o ? (lang === 'zh' ? (o.nameZh || o.name) : o.name) : '');
  const du = daysUntil(sample.expiryDate);
  const expired = du !== null && du < 0;
  const soon = du !== null && du >= 0 && du <= 30;
  const tags = sample.tags || [];
  const dash = <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const field = (label, value, ddStyle) => (
    <div><dt>{label}</dt><dd style={ddStyle}>{value || dash}</dd></div>
  );
  const expiryText = isoDate(sample.expiryDate)
    ? isoDate(sample.expiryDate) + (expired ? ' · ' + t('expired', lang) : soon ? ' · ' + du + ' d' : '')
    : '';

  return (
    <section className="panel" aria-labelledby="inv-sample-title">
      <div className="panel-head">
        <div className="flex min-w-0 items-center gap-1">
          {onBack && (
            <button type="button" className="btn-ghost btn-icon btn-sm" style={{ marginLeft: '-0.5rem' }}
              onClick={onBack} aria-label={backLabel} title={backLabel}>
              <IconChevronLeft size={16} />
            </button>
          )}
          <span className="panel-title">{lang === 'zh' ? '样品' : 'Sample'}</span>
        </div>
        <span className="badge" style={{ '--badge-fg': 'var(--text)', fontSize: '0.6875rem', height: '1.375rem' }}>{sample.position || '—'}</span>
      </div>

      <div className="panel-body">
        <h2 id="inv-sample-title" className="section-title" style={{ overflowWrap: 'anywhere', lineHeight: 1.25 }}>{sample.name}</h2>
        {sample.nameZh && sample.nameZh !== sample.name && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{sample.nameZh}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <TypeBadge type={sample.sampleType} lang={lang} />
          {expired && <span className="badge badge-danger"><IconAlert size={10} />{t('expired', lang)}</span>}
          {!expired && du !== null && du <= 7 && <span className="badge badge-warn"><IconAlert size={10} />{du}<span className="nocase">d</span></span>}
          {tags.map(tag => <span key={tag} className="badge"><span className="nocase">{tag}</span></span>)}
        </div>

        <dl className="meta-grid mt-3" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          {field(t('invColBox', lang), nameOf(box))}
          {field(t('invColLocation', lang), loc ? nameOf(loc) + (loc.temperature ? ' · ' + loc.temperature : '') : '')}
          {field(t('invQuantity', lang), sample.quantity)}
          {field(t('invConcentration', lang), sample.concentration)}
          {field(t('invPassage', lang), sample.passage)}
          {field(t('invOwner', lang), sample.owner)}
          {field(t('invDateStored', lang), isoDate(sample.dateStored))}
          {field(t('invExpiryDate', lang), expiryText, { color: expired ? 'var(--danger-text)' : soon ? 'var(--warning-text)' : undefined })}
        </dl>

        {sample.description && (
          <div className="mt-3">
            <div className="eyebrow">{t('invDescription', lang)}</div>
            <p style={{ fontSize: '0.8125rem', lineHeight: 1.5, marginTop: 2, overflowWrap: 'anywhere' }}>{sample.description}</p>
          </div>
        )}
        {sample.notes && (
          <div className="mt-3">
            <div className="eyebrow">{t('invNotes', lang)}</div>
            <p style={{ fontSize: '0.8125rem', lineHeight: 1.5, marginTop: 2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{sample.notes}</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 py-3" style={{ borderTop: '1px solid var(--rule)' }}>
        {confirming ? (
          <>
            <span className="mr-auto" style={{ fontSize: '0.75rem', color: 'var(--danger-text)' }}>{t('invDeleteConfirm', lang)}</span>
            <button type="button" className="btn btn-sm" onClick={() => setConfirming(false)}>{t('invCancel', lang)}</button>
            <button type="button" className="btn-danger btn-sm" onClick={onDelete}><IconTrash size={14} />{t('invConfirm', lang)}</button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-sm" onClick={onEdit}><IconEdit size={14} />{lang === 'zh' ? '编辑' : 'Edit'}</button>
            <button type="button" className="btn btn-sm" onClick={onMove}><IconArrowRight size={14} />{lang === 'zh' ? '移动' : 'Move'}</button>
            <button type="button" className="btn btn-sm" onClick={onDuplicate}><IconCopy size={14} />{t('invDuplicate', lang)}</button>
            <button type="button" className="btn-danger btn-sm btn-icon ml-auto" onClick={() => setConfirming(true)}
              aria-label={t('invDeleteSample', lang)} title={t('invDeleteSample', lang)}>
              <IconTrash size={14} />
            </button>
          </>
        )}
      </div>
    </section>
  );
}

export default function InventoryTab() {
  const lang = useLang();
  const toast = useToast();

  const [data, setData] = useState(getInvData);
  const [pickedBoxId, setSelectedBoxId] = useState(null);
  const [selectedSampleId, setSelectedSampleId] = useState(null);
  const [moveSampleId, setMoveSampleId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [search, setSearch] = useState('');
  const [showLocForm, setShowLocForm] = useState(false);
  const [editLoc, setEditLoc] = useState(null);
  const [showBoxForm, setShowBoxForm] = useState(false);
  const [editBox, setEditBox] = useState(null);
  const [addBoxLocId, setAddBoxLocId] = useState(null);
  const [showSampleForm, setShowSampleForm] = useState(false);
  const [editSample, setEditSample] = useState(null);
  const [samplePos, setSamplePos] = useState(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showImportMenu, setShowImportMenu] = useState(false);
  const [mobileView, setMobileView] = useState('tree');
  const [invViewMode, setInvViewMode] = useState('grid'); // 'grid' | 'list'
  const [listFilters, setListFilters] = useState({ name: '', type: '', location: '', box: '', owner: '', sort: 'name', dir: 'asc' });
  const [selectMode, setSelectMode] = useState(false);
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [showDashboard, setShowDashboard] = useState(() => localStorage.getItem('labmate_inv_dashboard_dismissed') !== 'true');
  const [bulkForm, setBulkForm] = useState({ owner: '', sampleType: '', expiryDate: '', tags: '' });
  const [bulkAddForm, setBulkAddForm] = useState({ name: '', nameZh: '', sampleType: 'reagent', quantity: '', concentration: '', owner: '', tags: '', description: '', notes: '', expiryDate: '' });

  const csvInputRef = useRef(null);
  const jsonInputRef = useRef(null);
  const exportMenuRef = useRef(null);
  const importMenuRef = useRef(null);
  const undoStackRef = useRef([]);
  const [undoCount, setUndoCount] = useState(0);

  // ── Dashboard visibility ─────────────────────────────────────────────────
  function dismissDashboard() { setShowDashboard(false); localStorage.setItem('labmate_inv_dashboard_dismissed', 'true'); db.settings.put({ key: 'labmate_inv_dashboard_dismissed', value: 'true' }).catch(() => {}); }
  function showDashboardAgain() { setShowDashboard(true); localStorage.removeItem('labmate_inv_dashboard_dismissed'); db.settings.delete('labmate_inv_dashboard_dismissed').catch(() => {}); }

  // ── Close dropdown menus on outside click ────────────────────────────────
  useEffect(() => {
    if (!showExportMenu && !showImportMenu) return;
    const handler = (e) => {
      if (showExportMenu && exportMenuRef.current && !exportMenuRef.current.contains(e.target)) setShowExportMenu(false);
      if (showImportMenu && importMenuRef.current && !importMenuRef.current.contains(e.target)) setShowImportMenu(false);
    };
    const onKey = (e) => { if (e.key === 'Escape') { setShowExportMenu(false); setShowImportMenu(false); } };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', handler); document.removeEventListener('keydown', onKey); };
  }, [showExportMenu, showImportMenu]);

  // ── Responsive ───────────────────────────────────────────────────────────
  const isMobile = useIsMobile();
  // 768–1279px: global CSS folds the grid to two columns and hides .inv-col-3,
  // so the sample panel renders under the box grid instead.
  const midWidth = useMediaQuery('(min-width: 768px) and (max-width: 1279px)');

  // ── Effective box selection ──────────────────────────────────────────────
  // On wider screens the first box (tree order) is shown until one is picked,
  // so the page never opens on empty "select a box" panels. Phones keep the
  // explicit drill-down (nothing selected until a box is tapped).
  const firstBoxId = useMemo(() => {
    for (const loc of data.locations) {
      const b = data.boxes.find(x => x.locationId === loc.id);
      if (b) return b.id;
    }
    return data.boxes.length ? data.boxes[0].id : null;
  }, [data.locations, data.boxes]);
  const pickedValid = pickedBoxId != null && data.boxes.some(b => b.id === pickedBoxId);
  const selectedBoxId = pickedValid ? pickedBoxId : (isMobile ? null : firstBoxId);

  // Leaving a box (picked, deleted or fallen back) ends any cell selection.
  useEffect(() => { setSelectMode(false); setSelectedCells(new Set()); }, [selectedBoxId]);

  // ── Persist helper ───────────────────────────────────────────────────────
  const persist = (newData) => { setData(newData); saveInventory(newData); };

  // ── Undo stack (in-memory, max 10) ───────────────────────────────────────
  const pushUndo = () => {
    undoStackRef.current.push(typeof structuredClone === 'function' ? structuredClone(data) : JSON.parse(JSON.stringify(data)));
    if (undoStackRef.current.length > 10) undoStackRef.current.shift();
    setUndoCount(c => c + 1);
  };
  const handleUndo = () => {
    if (undoStackRef.current.length === 0) { toast.show(t('invNoUndo', lang)); return; }
    const prev = undoStackRef.current.pop();
    persist(prev);
    setUndoCount(c => c - 1);
    toast.show(t('invUndone', lang));
  };

  // Ctrl+Z / Cmd+Z keyboard shortcut — handler read through a ref so the window
  // listener is registered once, not torn down and re-added on every data change.
  const handleUndoRef = useRef(handleUndo);
  handleUndoRef.current = handleUndo;
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        const el = e.target;
        if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return; // native text undo
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return; // not under an open form
        if (undoStackRef.current.length > 0) { e.preventDefault(); handleUndoRef.current(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Select mode helpers ──────────────────────────────────────────────────
  const toggleSelectMode = () => { setSelectMode(prev => !prev); setSelectedCells(new Set()); };
  const toggleSelectCell = (pos) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      if (next.has(pos)) next.delete(pos); else next.add(pos);
      return next;
    });
  };
  const dragSelectCells = (positions) => {
    setSelectedCells(prev => {
      const next = new Set(prev);
      positions.forEach(p => next.add(p));
      return next;
    });
  };

  // ── Find first empty slot ────────────────────────────────────────────────
  const findNextEmpty = (boxId, existingSamples) => {
    const box = data.boxes.find(b => b.id === boxId);
    if (!box) return null;
    const occupied = new Set(existingSamples.map(s => s.position));
    for (let r = 0; r < box.rows; r++) {
      for (let c = 0; c < box.cols; c++) {
        const pos = posLabel(r, c);
        if (!occupied.has(pos)) return pos;
      }
    }
    return null;
  };

  // ── Duplicate a sample ───────────────────────────────────────────────────
  const handleDuplicate = (sample) => {
    const d = { ...data, samples: [...data.samples], nextId: { ...data.nextId } };
    const pos = findNextEmpty(sample.boxId, d.samples.filter(s => s.boxId === sample.boxId));
    if (!pos) { toast.show(lang === 'zh' ? '没有空位了' : 'No empty slots available'); return; }
    pushUndo();
    const id = nextInvId(d, 'samples');
    d.samples.push({ ...sample, id, position: pos, dateStored: Date.now() });
    persist(d);
    setSelectedSampleId(id);
    toast.show(lang === 'zh' ? '已复制到 ' + pos : 'Duplicated to ' + pos);
  };

  // ── Memoized box samples ─────────────────────────────────────────────────
  const boxSamples = useMemo(
    () => selectedBoxId ? data.samples.filter(s => s.boxId === selectedBoxId) : [],
    [selectedBoxId, data.samples]
  );
  const boxSampleMap = useMemo(() => {
    const map = {};
    boxSamples.forEach(s => { if (s.position) map[s.position] = s; });
    return map;
  }, [boxSamples]);
  // Sample shown in the detail panel (only while it lives in the selected box).
  const selectedSample = useMemo(
    () => (selectedSampleId != null ? boxSamples.find(s => s.id === selectedSampleId) || null : null),
    [selectedSampleId, boxSamples]
  );

  // ── Bulk delete ──────────────────────────────────────────────────────────
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  useEffect(() => { setConfirmBulkDelete(false); }, [selectedCells.size, selectedBoxId]);

  const handleBulkDelete = () => {
    if (!selectedBoxId || selectedCells.size === 0) return;
    if (!confirmBulkDelete) { setConfirmBulkDelete(true); return; }
    pushUndo();
    const d = { ...data, samples: [...data.samples] };
    const idsToDelete = new Set();
    selectedCells.forEach(pos => { if (boxSampleMap[pos]) idsToDelete.add(boxSampleMap[pos].id); });
    d.samples = d.samples.filter(s => !idsToDelete.has(s.id));
    persist(d);
    setSelectedCells(new Set());
    setConfirmBulkDelete(false);
    toast.show(lang === 'zh' ? '已删除 ' + idsToDelete.size + ' 个样品' : 'Deleted ' + idsToDelete.size + ' sample(s)');
  };

  // ── Count selected empty/occupied ────────────────────────────────────────
  const { selectedEmptyCount, selectedOccupiedCount } = useMemo(() => {
    if (!selectedBoxId || selectedCells.size === 0) return { selectedEmptyCount: 0, selectedOccupiedCount: 0 };
    let empty = 0, occupied = 0;
    selectedCells.forEach(pos => { if (boxSampleMap[pos]) occupied++; else empty++; });
    return { selectedEmptyCount: empty, selectedOccupiedCount: occupied };
  }, [selectedBoxId, selectedCells, boxSampleMap]);

  // ── Bulk add ─────────────────────────────────────────────────────────────
  const handleBulkAdd = () => {
    if (!selectedBoxId || selectedEmptyCount === 0) return;
    if (!bulkAddForm.name) { toast.show(lang === 'zh' ? '请输入样品名称' : 'Please enter sample name'); return; }
    pushUndo();
    const d = { ...data, samples: [...data.samples], nextId: { ...data.nextId } };
    const positions = [...selectedCells].filter(pos => !boxSampleMap[pos]);
    let count = 0;
    positions.forEach(pos => {
      const id = nextInvId(d, 'samples');
      d.samples.push({
        id, boxId: selectedBoxId, position: pos,
        name: bulkAddForm.name, nameZh: bulkAddForm.nameZh,
        sampleType: bulkAddForm.sampleType, quantity: bulkAddForm.quantity,
        concentration: bulkAddForm.concentration, owner: bulkAddForm.owner,
        tags: parseTags(bulkAddForm.tags),
        description: bulkAddForm.description, notes: bulkAddForm.notes,
        dateStored: Date.now(),
        expiryDate: bulkAddForm.expiryDate ? new Date(bulkAddForm.expiryDate).getTime() : null,
      });
      count++;
    });
    persist(d);
    setSelectedCells(new Set());
    setShowBulkAdd(false);
    setBulkAddForm({ name: '', nameZh: '', sampleType: 'reagent', quantity: '', concentration: '', owner: '', tags: '', description: '', notes: '', expiryDate: '' });
    toast.show(lang === 'zh' ? '已添加 ' + count + ' 个样品' : 'Added ' + count + ' sample(s)');
  };

  // ── Bulk edit ────────────────────────────────────────────────────────────
  const handleBulkEditApply = () => {
    if (!selectedBoxId || selectedCells.size === 0) return;
    pushUndo();
    const d = { ...data, samples: [...data.samples] };
    const idsToEdit = new Set();
    selectedCells.forEach(pos => { if (boxSampleMap[pos]) idsToEdit.add(boxSampleMap[pos].id); });
    d.samples = d.samples.map(s => {
      if (!idsToEdit.has(s.id)) return s;
      const updated = { ...s };
      if (bulkForm.owner) updated.owner = bulkForm.owner;
      if (bulkForm.sampleType) updated.sampleType = bulkForm.sampleType;
      if (bulkForm.expiryDate) updated.expiryDate = new Date(bulkForm.expiryDate).getTime();
      if (bulkForm.tags) updated.tags = parseTags(bulkForm.tags);
      return updated;
    });
    persist(d);
    setSelectedCells(new Set());
    setShowBulkEdit(false);
    setBulkForm({ owner: '', sampleType: '', expiryDate: '', tags: '' });
    toast.show(lang === 'zh' ? '已批量编辑 ' + idsToEdit.size + ' 个样品' : 'Edited ' + idsToEdit.size + ' sample(s)');
  };

  // ── Location CRUD ────────────────────────────────────────────────────────
  const handleSaveLocation = (form) => {
    pushUndo();
    const d = { ...data, locations: [...data.locations], nextId: { ...data.nextId } };
    if (editLoc) {
      d.locations = d.locations.map(l => l.id === editLoc.id ? { ...l, ...form } : l);
    } else {
      const id = nextInvId(d, 'locations');
      d.locations.push({ id, ...form, parentId: null, order: d.locations.length });
    }
    persist(d);
    setShowLocForm(false);
    setEditLoc(null);
  };

  const handleDeleteLocation = (locId) => {
    pushUndo();
    const d = { ...data };
    const boxIds = d.boxes.filter(b => b.locationId === locId).map(b => b.id);
    d.locations = d.locations.filter(l => l.id !== locId);
    d.boxes = d.boxes.filter(b => b.locationId !== locId);
    d.samples = d.samples.filter(s => !boxIds.includes(s.boxId));
    if (boxIds.includes(selectedBoxId)) setSelectedBoxId(null);
    persist(d);
    toast.show(lang === 'zh' ? '已删除位置' : 'Location deleted', '', { actionLabel: t('invUndo', lang), onAction: () => handleUndoRef.current() });
  };

  // ── Box CRUD ─────────────────────────────────────────────────────────────
  const handleSaveBox = (form) => {
    pushUndo();
    const d = { ...data, boxes: [...data.boxes], nextId: { ...data.nextId } };
    if (editBox) {
      d.boxes = d.boxes.map(b => b.id === editBox.id ? { ...b, ...form } : b);
    } else {
      const id = nextInvId(d, 'boxes');
      d.boxes.push({ id, ...form, locationId: addBoxLocId });
    }
    persist(d);
    setShowBoxForm(false);
    setEditBox(null);
    setAddBoxLocId(null);
  };

  const handleDeleteBox = (boxId) => {
    pushUndo();
    const d = { ...data };
    d.boxes = d.boxes.filter(b => b.id !== boxId);
    d.samples = d.samples.filter(s => s.boxId !== boxId);
    if (selectedBoxId === boxId) setSelectedBoxId(null);
    persist(d);
    toast.show(lang === 'zh' ? '已删除盒子' : 'Box deleted', '', { actionLabel: t('invUndo', lang), onAction: () => handleUndoRef.current() });
  };

  // ── Sample CRUD ──────────────────────────────────────────────────────────
  const handleSaveSample = (form) => {
    pushUndo();
    const d = { ...data, samples: [...data.samples], nextId: { ...data.nextId } };
    if (editSample) {
      d.samples = d.samples.map(s => s.id === editSample.id ? { ...s, ...form } : s);
    } else {
      const id = nextInvId(d, 'samples');
      d.samples.push({ id, ...form, boxId: selectedBoxId, position: samplePos });
      setSelectedSampleId(id);
    }
    persist(d);
    setShowSampleForm(false);
    setEditSample(null);
    setSamplePos(null);
  };

  const handleDeleteSample = (sampleId) => {
    pushUndo();
    const d = { ...data };
    d.samples = d.samples.filter(s => s.id !== sampleId);
    persist(d);
    toast.show(lang === 'zh' ? '已删除样品' : 'Sample deleted', '', { actionLabel: t('invUndo', lang), onAction: () => handleUndoRef.current() });
  };

  // ── Move a sample to another (empty) position / box ─────────────────────
  const handleMoveSample = (sampleId, boxId, position) => {
    if (data.samples.some(s => s.boxId === boxId && s.position === position && s.id !== sampleId)) {
      toast.show(lang === 'zh' ? '该孔位已被占用' : 'That position is occupied');
      return;
    }
    pushUndo();
    const d = { ...data, samples: data.samples.map(s => (s.id === sampleId ? { ...s, boxId, position } : s)) };
    persist(d);
    setMoveSampleId(null);
    setSelectedBoxId(boxId);
    setSelectedSampleId(sampleId);
    const box = d.boxes.find(b => b.id === boxId);
    toast.show((lang === 'zh' ? '已移动到 ' : 'Moved to ') + (box ? (lang === 'zh' ? (box.nameZh || box.name) : box.name) + ' · ' : '') + position);
  };

  const handleCellClick = (pos, sample) => {
    setEditSample(sample || null);
    setSamplePos(pos);
    setShowSampleForm(true);
  };

  // ── Search ───────────────────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    if (!search.trim()) return null;
    const q = search.toLowerCase();
    return data.samples.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.owner || '').toLowerCase().includes(q) ||
      (s.description || '').toLowerCase().includes(q) ||
      (s.tags || []).some(tag => tag.toLowerCase().includes(q))
    );
  }, [search, data.samples]);

  // ── Export / Import ──────────────────────────────────────────────────────
  const handleExportAllCsv = () => {
    downloadCsv(invExportAllCsv(data, lang), 'inventory-all-' + new Date().toISOString().slice(0, 10) + '.csv');
    setShowExportMenu(false);
  };
  const handleExportBoxCsv = () => {
    if (!selectedBoxId) return;
    const box = data.boxes.find(b => b.id === selectedBoxId);
    downloadCsv(invExportBoxCsv(data, selectedBoxId), 'inventory-' + (box ? box.name : 'box') + '.csv');
    setShowExportMenu(false);
  };
  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), type: 'inventory', data }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventory-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };
  const handleDownloadTemplate = () => {
    downloadCsv(invCsvTemplate(), 'inventory-template.csv');
    setShowExportMenu(false);
  };

  const handleImportCsv = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const rows = parseCsvImport(ev.target.result);
        if (rows.length === 0) { toast.show(t('importError', lang)); return; }
        if (!selectedBoxId) { toast.show(lang === 'zh' ? '请先选择一个盒子' : 'Select a box first'); return; }
        pushUndo();
        const d = { ...data, samples: [...data.samples], nextId: { ...data.nextId } };
        const occupiedPositions = new Set(d.samples.filter(s => s.boxId === selectedBoxId).map(s => s.position));
        let count = 0, skipped = 0;
        rows.forEach(r => {
          if (!r.name) return;
          const pos = r.position || '';
          if (pos && occupiedPositions.has(pos)) { skipped++; return; }
          const id = nextInvId(d, 'samples');
          d.samples.push({
            id, boxId: selectedBoxId, position: pos, name: r.name,
            sampleType: normalizeSampleType(r.type || 'other'),
            quantity: r.quantity || '', concentration: r.concentration || '',
            passage: r.passage || '',
            dateStored: r.datestored ? new Date(r.datestored).getTime() : Date.now(),
            expiryDate: r.expiry ? new Date(r.expiry).getTime() : null,
            owner: r.owner || '',
            tags: r.tags ? r.tags.split(';').map(s => s.trim()).filter(Boolean) : [],
            description: r.description || '', notes: r.notes || '',
          });
          if (pos) occupiedPositions.add(pos);
          count++;
        });
        persist(d);
        const msg = t('importSuccess', lang).replace('{n}', count);
        toast.show(skipped > 0 ? msg + (lang === 'zh' ? ' (' + skipped + ' 个位置冲突跳过)' : ' (' + skipped + ' skipped — position conflict)') : msg);
      } catch { toast.show(t('importError', lang)); }
      if (csvInputRef.current) csvInputRef.current.value = '';
    };
    reader.readAsText(file);
    setShowImportMenu(false);
  };

  const handleImportJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        const imported = parsed.data || parsed;
        if (!imported.locations && !imported.boxes && !imported.samples) { toast.show(t('importError', lang)); return; }
        pushUndo();
        const d = { ...data };
        const locIdMap = {};
        const boxIdMap = {};
        if (imported.locations) {
          d.locations = [...d.locations];
          d.nextId = { ...d.nextId };
          imported.locations.forEach(l => {
            const newId = nextInvId(d, 'locations');
            locIdMap[l.id] = newId;
            d.locations.push({ ...l, id: newId });
          });
        }
        if (imported.boxes) {
          d.boxes = [...d.boxes];
          imported.boxes.forEach(b => {
            const newId = nextInvId(d, 'boxes');
            boxIdMap[b.id] = newId;
            const resolvedLocId = locIdMap[b.locationId] || b.locationId;
            if (!d.locations.some(l => l.id === resolvedLocId)) return;
            d.boxes.push({ ...b, id: newId, locationId: resolvedLocId });
          });
        }
        if (imported.samples) {
          d.samples = [...d.samples];
          imported.samples.forEach(s => {
            const newId = nextInvId(d, 'samples');
            d.samples.push({ ...s, id: newId, boxId: boxIdMap[s.boxId] || s.boxId });
          });
        }
        persist(d);
        toast.show(t('importSuccess', lang).replace('{n}', (imported.locations || []).length + (imported.boxes || []).length + (imported.samples || []).length));
      } catch { toast.show(t('importError', lang)); }
      if (jsonInputRef.current) jsonInputRef.current.value = '';
    };
    reader.readAsText(file);
    setShowImportMenu(false);
  };

  // ── Print ────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!selectedBoxId) return;
    const box = data.boxes.find(b => b.id === selectedBoxId);
    const samples = boxSamples;
    const loc = box ? data.locations.find(l => l.id === box.locationId) : null;
    const esc = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let html = '<html><head><title>' + esc(box ? box.name : 'Box') + '</title><style>body{font-family:sans-serif;padding:20px}table{border-collapse:collapse;margin-top:10px}td,th{border:1px solid #ccc;padding:4px 8px;font-size:12px}th{background:#f0f0f0}</style></head><body>';
    html += '<h2>' + esc(box ? box.name : '') + '</h2>';
    if (loc) html += '<p>' + esc(loc.name) + ' ' + esc(loc.temperature) + '</p>';
    html += '<table><tr><th>Position</th><th>Name</th><th>Type</th><th>Quantity</th><th>Owner</th><th>Date</th></tr>';
    samples.sort((a, b) => (a.position || '').localeCompare(b.position || '')).forEach(s => {
      html += '<tr><td>' + esc(s.position) + '</td><td>' + esc(s.name) + '</td><td>' + esc(s.sampleType) + '</td><td>' + esc(s.quantity) + '</td><td>' + esc(s.owner) + '</td><td>' + (s.dateStored ? new Date(s.dateStored).toISOString().slice(0, 10) : '') + '</td></tr>';
    });
    html += '</table></body></html>';
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.print();
  };

  const selectedBox = data.boxes.find(b => b.id === selectedBoxId);

  // ── Inventory statistics (memoized) ──────────────────────────────────────
  const invStats = useMemo(() => {
    const now = Date.now();
    const DAY = 86400000;
    const totalPositions = data.boxes.reduce((sum, b) => sum + b.rows * b.cols, 0);
    const occupiedPositions = data.samples.length;
    const utilPct = totalPositions > 0 ? Math.round(occupiedPositions / totalPositions * 100) : 0;
    const byType = {};
    data.samples.forEach(s => { const tp = s.sampleType || 'other'; byType[tp] = (byType[tp] || 0) + 1; });
    const maxTypeCount = Math.max(1, ...Object.values(byType));
    const expiring7 = data.samples.filter(s => s.expiryDate && s.expiryDate > now && s.expiryDate <= now + 7 * DAY).length;
    const expiring30 = data.samples.filter(s => s.expiryDate && s.expiryDate > now && s.expiryDate <= now + 30 * DAY).length;
    const expiring90 = data.samples.filter(s => s.expiryDate && s.expiryDate > now && s.expiryDate <= now + 90 * DAY).length;
    const added7 = data.samples.filter(s => s.dateStored && s.dateStored >= now - 7 * DAY).length;
    const added30 = data.samples.filter(s => s.dateStored && s.dateStored >= now - 30 * DAY).length;
    return { totalPositions, occupiedPositions, utilPct, byType, maxTypeCount, expiring7, expiring30, expiring90, added7, added30 };
  }, [data]);

  // ── Dashboard recent samples / location occupancy ────────────────────────
  const recentSamples = useMemo(
    () => data.samples.slice().sort((a, b) => (b.dateStored || 0) - (a.dateStored || 0)).slice(0, 5),
    [data.samples]
  );
  const locationOccupancy = useMemo(() => {
    // Was locations × samples × boxes; index samples per box once instead.
    const samplesPerBox = new Map();
    for (const s of data.samples) samplesPerBox.set(s.boxId, (samplesPerBox.get(s.boxId) || 0) + 1);
    const boxesPerLoc = new Map();
    for (const b of data.boxes) { const arr = boxesPerLoc.get(b.locationId); if (arr) arr.push(b); else boxesPerLoc.set(b.locationId, [b]); }
    return data.locations.map(loc => {
      const locBoxes = boxesPerLoc.get(loc.id) || [];
      const totalSlots = locBoxes.reduce((s, b) => s + b.rows * b.cols, 0);
      const usedSlots = locBoxes.reduce((s, b) => s + (samplesPerBox.get(b.id) || 0), 0);
      return { name: loc.name, nameZh: loc.nameZh, totalSlots, usedSlots };
    });
  }, [data.locations, data.boxes, data.samples]);


  // ══════════════════════════════════════════════════════════════════════════
  // SUB-RENDERS
  // ══════════════════════════════════════════════════════════════════════════
  const zh = lang === 'zh';
  const nameOf = (o) => (o ? (zh ? (o.nameZh || o.name) : o.name) : '');
  const hasLocations = data.locations.length > 0;
  const hasData = data.samples.length > 0 || data.boxes.length > 0;
  const canUndo = undoStackRef.current.length > 0;
  const selectedLoc = selectedBox ? data.locations.find(l => l.id === selectedBox.locationId) : null;
  const daysWord = t('invStatsDays', lang);

  const openAddLocation = () => { setEditLoc(null); setShowLocForm(true); };
  const openAddBox = (locId) => { setEditBox(null); setAddBoxLocId(locId); setShowBoxForm(true); };
  const selectBox = (id) => { setSelectedBoxId(id); setSelectedSampleId(null); setSelectMode(false); setSelectedCells(new Set()); };
  const openSample = (s) => { setSelectedSampleId(s.id); if (isMobile) setMobileView('sample'); };
  // Grid cell: an occupied position opens its details, an empty one the add form.
  const onGridCell = (pos, sample) => { if (sample) openSample(sample); else handleCellClick(pos, null); };

  // ── Header actions ───────────────────────────────────────────────────────
  const undoButton = (
    <button type="button" className="btn-ghost btn-sm" onClick={handleUndo} disabled={!canUndo}
      title={t('invUndoLast', lang) + ' · Ctrl/⌘ Z'} aria-label={t('invUndo', lang)}>
      <IconReset size={15} /><span className="hidden xl:inline">{t('invUndo', lang)}</span>
    </button>
  );
  const headerActions = hasLocations
    ? (
      <button type="button" className="btn-primary" onClick={openAddLocation}>
        <IconPlus size={16} />{t('invAddLocation', lang)}
      </button>
    )
    : (canUndo ? undoButton : null);

  // ── Toolbar ──────────────────────────────────────────────────────────────
  // Labels collapse to icons on narrower screens (menus below 1024px, the rest
  // below 1280px, next to the sidebar) so the row stays one tidy line.
  const toolBtn = ({ icon, label, onClick, disabled, title, outlined, menuOpen }) => (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title || label} aria-label={label}
      aria-haspopup={menuOpen !== undefined ? 'menu' : undefined} aria-expanded={menuOpen}
      className={(outlined ? 'btn' : 'btn-ghost') + ' btn-sm'}
    >
      {icon}
      <span className={outlined ? 'hidden lg:inline' : 'hidden xl:inline'}>{label}</span>
      {menuOpen !== undefined && <IconChevronDown size={12} className="hidden lg:inline" />}
    </button>
  );

  const toolbar = () => (
    <div className="toolbar mb-4">
      {invViewMode === 'grid' && (
        <div className="search-field w-full sm:w-auto sm:min-w-[12rem] sm:max-w-[18rem] sm:flex-1">
          <IconSearch size={15} />
          <input
            type="search" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('invSearch', lang)}
            aria-label={t('invSearch', lang)}
          />
        </div>
      )}
      <div className="seg" role="group" aria-label={zh ? '视图' : 'View'}>
        <button type="button" aria-pressed={invViewMode === 'grid'} onClick={() => setInvViewMode('grid')}>{t('invStatsBoxes', lang)}</button>
        <button type="button" aria-pressed={invViewMode === 'list'} onClick={() => setInvViewMode('list')}>{t('invAllSamples', lang)}</button>
      </div>
      <div className="toolbar-spacer" />
      <div className="flex items-center gap-1">
        {undoButton}
        {!showDashboard && hasData && (
          <span className="hidden lg:inline-flex">
            {toolBtn({ icon: <IconLayers size={15} />, label: t('invDashboardShow', lang), onClick: showDashboardAgain })}
          </span>
        )}
        {toolBtn({ icon: <IconBars size={15} />, label: t('invStats', lang), onClick: () => setShowStats(true) })}
        <span aria-hidden="true" className="mx-1 hidden h-5 w-px sm:block" style={{ background: 'var(--rule)' }} />
        {toolBtn({
          outlined: true, icon: <IconUpload size={15} />, label: t('invImport', lang),
          onClick: () => { setShowImport(true); setShowExportMenu(false); },
        })}
        <div className="relative" ref={exportMenuRef}>
          {toolBtn({
            outlined: true, menuOpen: showExportMenu, icon: <IconDownload size={15} />, label: t('invExport', lang),
            onClick: () => { setShowExportMenu(!showExportMenu); setShowImportMenu(false); },
          })}
          {showExportMenu && (
            <MenuPanel label={t('invExport', lang)}>
              <MenuItem icon={<IconFile size={15} />} label={t('invExportAllCsv', lang)}
                sub={data.samples.length + (zh ? ' 个样品' : ' samples')} onClick={handleExportAllCsv} />
              <MenuItem icon={<IconBox size={15} />} label={t('invExportBoxCsv', lang)}
                sub={selectedBox ? nameOf(selectedBox) : (zh ? '请先选择一个盒子' : 'Select a box first')}
                disabled={!selectedBoxId} onClick={handleExportBoxCsv} />
              <MenuItem icon={<IconLayers size={15} />} label={t('invExportJson', lang)} onClick={handleExportJson} />
              <div role="separator" style={{ borderTop: '1px solid var(--rule)', margin: '4px 0' }} />
              <MenuItem icon={<IconDownload size={15} />} label={t('invDownloadTemplate', lang)} onClick={handleDownloadTemplate} />
            </MenuPanel>
          )}
        </div>
      </div>
    </div>
  );

  // ── Overview strip (the dismissible dashboard) ───────────────────────────
  const dashboardPanel = () => {
    if (!showDashboard || (data.samples.length === 0 && data.boxes.length === 0)) return null;
    const cells = [
      {
        label: t('invStatsSamples', lang), value: data.samples.length,
        sub: data.boxes.length + (zh ? ' 个盒子 · ' : ' boxes · ') + data.locations.length + (zh ? ' 个位置' : ' locations'),
      },
      {
        label: t('invStatsUtilization', lang), value: invStats.utilPct + '%', meter: invStats.utilPct,
        sub: invStats.occupiedPositions + ' / ' + invStats.totalPositions,
      },
      {
        label: t('invStatsExpiring', lang), value: invStats.expiring30,
        tone: invStats.expiring30 > 0 ? 'var(--warning-text)' : undefined,
        sub: '≤ 30 ' + daysWord + ' · ≤ 7: ' + invStats.expiring7,
      },
      {
        label: t('invStatsRecentlyAdded', lang), value: invStats.added7,
        sub: '≤ 7 ' + daysWord + ' · ≤ 30: ' + invStats.added30,
      },
    ];
    return (
      <section className="panel mb-4" aria-labelledby="inv-overview-title">
        <div className="panel-head">
          <h2 id="inv-overview-title" className="panel-title">{t('invStatsTitle', lang)}</h2>
          <button type="button" className="btn-ghost btn-icon btn-sm" style={{ marginRight: '-0.5rem' }} onClick={dismissDashboard}
            aria-label={t('invDashboardDismiss', lang)} title={t('invDashboardDismiss', lang)}>
            <IconClose size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 1, background: 'var(--rule)' }}>
          {cells.map(c => (
            <div key={c.label} className="min-w-0 px-4 py-3" style={{ background: 'var(--card)' }}>
              <div className="stat-label truncate">{c.label}</div>
              <div className="stat-value" style={{ color: c.tone }}>{c.value}</div>
              {c.meter != null && <Meter pct={c.meter} style={{ margin: '4px 0 3px' }} />}
              <div className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{c.sub}</div>
            </div>
          ))}
        </div>
      </section>
    );
  };

  // ── Empty state (no locations yet) ───────────────────────────────────────
  const emptyState = () => {
    const steps = [
      { icon: <StorageIcon type="freezer" size={15} />, label: zh ? '存储位置' : 'Location', ex: zh ? '冰箱 · -80°C' : 'Freezer · -80°C' },
      { icon: <IconBox size={15} />, label: zh ? '盒子' : 'Box', ex: zh ? '9×9 冻存盒' : '9×9 cryo box' },
      { icon: <IconPlate size={15} />, label: zh ? '孔位' : 'Position', ex: 'A1 … I9' },
      { icon: <IconFlask size={15} />, label: zh ? '样品' : 'Sample', ex: 'HEK293T · P5' },
    ];
    return (
      <section className="panel">
        <div className="empty" style={{ padding: '3rem 1.25rem 2.5rem' }}>
          <div className="empty-icon"><IconBox size={22} /></div>
          <h2 className="empty-title">{zh ? '建立你的样品库存' : 'Set up your storage'}</h2>
          <p className="empty-desc" style={{ maxWidth: '54ch' }}>
            {zh
              ? '库存与实验室实物一一对应：存储位置里放盒子，每个盒子是一个孔位网格，每个孔位存放一个样品。先添加一台冰箱或一个架子。'
              : 'Inventory mirrors your bench: a location holds boxes, each box is a grid of positions, and each position holds one sample. Start with a freezer or shelf.'}
          </p>
          <ol className="mt-4 grid w-full grid-cols-2 gap-2 sm:grid-cols-4" style={{ maxWidth: 640 }}>
            {steps.map((s, i) => (
              <li key={s.label} className="relative text-left" style={{ background: 'var(--bg)', border: '1px solid var(--rule)', padding: '0.625rem 0.75rem' }}>
                <div className="flex items-center justify-between" style={{ color: 'var(--text-muted)' }}>
                  <span className="mono" style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--accent)' }}>{'0' + (i + 1)}</span>
                  {s.icon}
                </div>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text)', marginTop: 6 }}>{s.label}</div>
                <div className="mono truncate" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{s.ex}</div>
                {i < steps.length - 1 && (
                  <IconChevronRight size={12} aria-hidden="true" className="absolute hidden sm:block"
                    style={{ right: -11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', background: 'var(--card)' }} />
                )}
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap justify-center gap-2 mt-3">
            <button type="button" className="btn-primary" onClick={openAddLocation}>
              <IconPlus size={16} />{t('invAddLocation', lang)}
            </button>
            <button type="button" className="btn" onClick={() => setShowImport(true)}>
              <IconUpload size={15} />{zh ? '导入 CSV / 备份' : 'Import CSV or backup'}
            </button>
          </div>
        </div>
      </section>
    );
  };

  // ── Box panel ────────────────────────────────────────────────────────────
  const selectionBar = () => {
    const n = selectedCells.size;
    const countText = n === 0
      ? (zh ? '点击或拖动选择孔位' : 'Click or drag across positions')
      : (zh ? '已选 ' + n + (selectedEmptyCount > 0 ? ' · ' + selectedEmptyCount + ' 个空位' : '')
            : n + ' selected' + (selectedEmptyCount > 0 ? ' · ' + selectedEmptyCount + ' empty' : ''));
    return (
      <div className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ background: 'var(--primary-light)', borderBottom: '1px solid var(--rule)' }}>
        <span className="mono" aria-live="polite" style={{ fontSize: '0.75rem', fontWeight: 700, color: n ? 'var(--text)' : 'var(--text-muted)' }}>{countText}</span>
        <span className="flex-1" />
        {selectedEmptyCount > 0 && (
          <button type="button" className="btn btn-sm" onClick={() => setShowBulkAdd(true)}>
            <IconPlus size={14} />{t('invBulkAddBtn', lang) + ' · ' + selectedEmptyCount}
          </button>
        )}
        {selectedOccupiedCount > 0 && (
          <button type="button" className="btn btn-sm" onClick={() => { setShowBulkEdit(true); setBulkForm({ owner: '', sampleType: '', expiryDate: '', tags: '' }); }}>
            <IconEdit size={14} />{t('invBulkEdit', lang) + ' · ' + selectedOccupiedCount}
          </button>
        )}
        {selectedOccupiedCount > 0 && (
          <button type="button" className="btn-danger btn-sm" onClick={handleBulkDelete}>
            <IconTrash size={14} />{confirmBulkDelete ? t('invBulkDelConfirm', lang) : (zh ? '删除' : 'Delete') + ' · ' + selectedOccupiedCount}
          </button>
        )}
      </div>
    );
  };

  const boxPanel = () => {
    if (!selectedBox) {
      const noBoxes = data.boxes.length === 0;
      const firstLoc = data.locations[0];
      return (
        <section className="panel">
          <div className="empty">
            <div className="empty-icon"><IconBox size={22} /></div>
            <h2 className="empty-title">{noBoxes ? (zh ? '还没有盒子' : 'No boxes yet') : t('invSelectABox', lang)}</h2>
            <p className="empty-desc">
              {noBoxes
                ? (zh ? '为「' + nameOf(firstLoc) + '」添加一个盒子，选择规格（9×9 冻存盒、枪头盒…）后孔位会显示在这里。'
                      : 'Add a box to ' + nameOf(firstLoc) + ' — pick a format (9×9 cryo box, tip box…) and its positions appear here.')
                : t('invSelectBox', lang)}
            </p>
            {noBoxes && firstLoc && (
              <button type="button" className="btn" onClick={() => openAddBox(firstLoc.id)}>
                <IconPlus size={15} />{t('invAddBox', lang)}
              </button>
            )}
          </div>
        </section>
      );
    }
    const total = selectedBox.rows * selectedBox.cols;
    return (
      <section className="panel" aria-labelledby="inv-box-title">
        <div className="panel-head">
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              {selectedBox.color && (
                <span aria-hidden="true" className="shrink-0" style={{ width: 10, height: 10, background: selectedBox.color, border: '1px solid var(--border-strong)' }} />
              )}
              <h2 id="inv-box-title" className="truncate" style={{ fontFamily: 'var(--font-heading)', fontSize: '0.9375rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
                {nameOf(selectedBox)}
              </h2>
              <span className="mono tabular shrink-0" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}
                title={boxSamples.length + ' ' + t('invOccupied', lang) + ' · ' + (total - boxSamples.length) + ' ' + t('invEmpty', lang)}>
                {boxSamples.length + '/' + total}
              </span>
            </div>
            {selectedLoc && (
              <div className="mono truncate" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                {nameOf(selectedLoc) + (selectedLoc.temperature ? ' · ' + selectedLoc.temperature : '') + ' · ' + selectedBox.rows + '×' + selectedBox.cols}
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1" style={{ marginRight: '-0.375rem' }}>
            <button type="button" className="btn-ghost btn-sm" aria-pressed={selectMode} onClick={toggleSelectMode}>
              <IconCheck size={14} />{t('invSelect', lang)}
            </button>
            <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => { setEditBox(selectedBox); setShowBoxForm(true); }}
              aria-label={t('invEditBox', lang)} title={t('invEditBox', lang)}>
              <IconEdit size={15} />
            </button>
          </div>
        </div>
        {selectMode && selectionBar()}
        <div className="panel-body">
          <BoxGrid
            box={selectedBox} samples={boxSamples} onCellClick={onGridCell} onCellOpen={handleCellClick}
            lang={lang} selectMode={selectMode} selectedCells={selectedCells}
            onToggleSelect={toggleSelectCell} onDragSelect={dragSelectCells}
            activePos={selectedSample ? selectedSample.position : null}
            minCell={isMobile ? 26 : 24}
            hint={selectMode ? null : (zh ? '点击样品查看详情，点击空位添加样品。' : 'Click a sample for details · click an empty position to add one.')}
          />
        </div>
      </section>
    );
  };

  // ── Sample column: list of the box's samples, or one sample's details ────
  const sampleListPanel = () => {
    const sorted = boxSamples.slice().sort((a, b) => (a.position || '').localeCompare(b.position || '', undefined, { numeric: true }));
    return (
      <section className="panel" aria-labelledby="inv-samples-title">
        <div className="panel-head">
          <h2 id="inv-samples-title" className="panel-title">{t('invSamples', lang)}</h2>
          <span className="mono tabular" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{boxSamples.length}</span>
        </div>
        {boxSamples.length === 0 ? (
          <div className="empty" style={{ padding: '2rem 1rem' }}>
            <div className="empty-title">{t('invNoSamples', lang)}</div>
            <p className="empty-desc">{t('invClickToAdd', lang)}</p>
          </div>
        ) : (
          <div className={'list' + (isMobile ? '' : ' overflow-y-auto')} style={isMobile ? undefined : { maxHeight: 'calc(100vh - 7rem)' }}>
            {sorted.map(s => {
              const du = daysUntil(s.expiryDate);
              return (
                <button key={s.id} type="button" className="list-row" onClick={() => openSample(s)}
                  style={{ minHeight: 0, alignItems: 'flex-start', padding: '0.5rem 0.75rem 0.55rem' }}>
                  <span className="mono tabular shrink-0" style={{ width: 30, fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1.45 }}>{s.position}</span>
                  <span className="min-w-0 flex-1">
                    <span className="list-row-title block truncate" style={{ fontSize: '0.8125rem' }}>{s.name}</span>
                    <span className="list-row-meta">
                      <TypeBadge type={s.sampleType} lang={lang} />
                      {du !== null && du < 0 && <span className="badge badge-danger">{t('expired', lang)}</span>}
                      {du !== null && du >= 0 && du <= 7 && <span className="badge badge-warn">{du}<span className="nocase">d</span></span>}
                      {du !== null && du > 7 && du <= 30 && <span style={{ color: 'var(--warning-text)' }}>{du + ' d'}</span>}
                      {s.quantity && <span>{s.quantity}</span>}
                      {s.owner && <span>{'· ' + s.owner}</span>}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    );
  };

  const renderSampleDetail = (s, withBack) => (
    <SampleDetail
      key={s.id} sample={s} box={selectedBox} loc={selectedLoc} lang={lang}
      onBack={withBack ? () => setSelectedSampleId(null) : undefined}
      backLabel={t('invSamples', lang)}
      onEdit={() => handleCellClick(s.position, s)}
      onMove={() => setMoveSampleId(s.id)}
      onDuplicate={() => handleDuplicate(s)}
      onDelete={() => handleDeleteSample(s.id)}
    />
  );

  const samplePanel = () => {
    if (!selectedBox) return null;
    if (selectedSample) return renderSampleDetail(selectedSample, true);
    return sampleListPanel();
  };

  // ── Search results ───────────────────────────────────────────────────────
  const searchResultsBlock = (results) => (
    <section className="panel" aria-labelledby="inv-results-title">
      <div className="panel-head">
        <h2 id="inv-results-title" className="panel-title">{results.length + t('invResults', lang)}</h2>
        <button type="button" className="btn-ghost btn-sm" style={{ marginRight: '-0.375rem' }} onClick={() => setSearch('')}>
          <IconClose size={14} />{zh ? '清除' : 'Clear'}
        </button>
      </div>
      {results.length === 0 ? (
        <div className="empty">
          <div className="empty-icon"><IconSearch size={20} /></div>
          <div className="empty-title">{t('invNoResults', lang)}</div>
        </div>
      ) : (
        <div className="list">
          {results.map(s => {
            const box = data.boxes.find(b => b.id === s.boxId);
            const loc = box ? data.locations.find(l => l.id === box.locationId) : null;
            return (
              <button key={s.id} type="button" className="list-row"
                onClick={() => { setSelectedBoxId(s.boxId); setSelectedSampleId(s.id); if (isMobile) setMobileView('grid'); setSearch(''); }}>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="list-row-title truncate">{s.name}</span>
                    <TypeBadge type={s.sampleType} lang={lang} />
                  </span>
                  <span className="list-row-meta">
                    <span className="truncate">{(loc ? nameOf(loc) + ' / ' : '') + (box ? nameOf(box) : '')}</span>
                    {s.quantity && <span>{'· ' + s.quantity}</span>}
                    {s.owner && <span>{'· ' + s.owner}</span>}
                  </span>
                </span>
                <span className="badge shrink-0" style={{ '--badge-fg': 'var(--text)' }}>{s.position || '—'}</span>
                <IconChevronRight size={14} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  // ── All Samples memoized data ────────────────────────────────────────────
  const { _allSamples, _uniqueTypes, _uniqueLocs, _uniqueBoxes, _uniqueOwners, _filtered } = useMemo(() => {
    const locById = new Map(data.locations.map(l => [l.id, l]));
    const samplesByBox = new Map();
    for (const s of data.samples) { const arr = samplesByBox.get(s.boxId); if (arr) arr.push(s); else samplesByBox.set(s.boxId, [s]); }
    const allSamples = data.boxes.flatMap(box => {
      const loc = locById.get(box.locationId);
      return (samplesByBox.get(box.id) || []).map(s => ({
        ...s,
        boxName: lang === 'zh' ? (box.nameZh || box.name) : box.name,
        locName: loc ? (lang === 'zh' ? (loc.nameZh || loc.name) : loc.name) : '',
        locTemp: loc ? loc.temperature : '',
      }));
    });
    return {
      _allSamples: allSamples,
      _uniqueTypes:  [...new Set(allSamples.map(s => s.sampleType).filter(Boolean))],
      _uniqueLocs:   [...new Set(allSamples.map(s => s.locName).filter(Boolean))],
      _uniqueBoxes:  [...new Set(allSamples.map(s => s.boxName).filter(Boolean))],
      _uniqueOwners: [...new Set(allSamples.map(s => s.owner).filter(Boolean))],
      _filtered: allSamples.filter(s => {
        if (listFilters.name     && !(s.name || '').toLowerCase().includes(listFilters.name.toLowerCase())) return false;
        if (listFilters.type     && s.sampleType !== listFilters.type)    return false;
        if (listFilters.location && s.locName !== listFilters.location)   return false;
        if (listFilters.box      && s.boxName !== listFilters.box)        return false;
        if (listFilters.owner    && (s.owner || '') !== listFilters.owner) return false;
        return true;
      }).sort((a, b) => {
        const field = listFilters.sort || 'name';
        const av = field === 'date' ? (a.dateStored || 0) : (a[field] || '');
        const bv = field === 'date' ? (b.dateStored || 0) : (b[field] || '');
        const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
        return listFilters.dir === 'desc' ? -cmp : cmp;
      }),
    };
  }, [data, lang, listFilters]);

  // ── All Samples page ─────────────────────────────────────────────────────
  const allSamplesPanel = () => {
    const allSamples = _allSamples, filtered = _filtered;
    const sortBy = (col) => setListFilters(f => ({ ...f, sort: col, dir: f.sort === col && f.dir === 'asc' ? 'desc' : 'asc' }));
    const hasFilters = listFilters.name || listFilters.type || listFilters.location || listFilters.box || listFilters.owner;
    const colCount = isMobile ? 4 : 8;
    const muted = { color: 'var(--text-muted)' };
    const fcell = { padding: '0.3rem 0.5rem', borderBottom: 0 };
    const fsel = { width: '100%', minHeight: 30, height: 30, paddingTop: 0, paddingBottom: 0, paddingLeft: '0.5rem', fontSize: '0.75rem' };
    const sortTh = (col, label) => {
      const active = listFilters.sort === col;
      return (
        <th aria-sort={active ? (listFilters.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
          <button type="button" onClick={() => sortBy(col)} className="inline-flex items-center gap-1"
            style={{ background: 'none', border: 0, padding: 0, font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit', color: active ? 'var(--text)' : 'inherit', cursor: 'pointer' }}>
            {label}
            <span aria-hidden="true" style={{ opacity: active ? 1 : 0.35 }}>{active ? (listFilters.dir === 'asc' ? '↑' : '↓') : '↕'}</span>
          </button>
        </th>
      );
    };
    const filterSelect = (key, values, labelOf, ariaLabel) => (
      <select style={fsel} value={listFilters[key]} aria-label={ariaLabel}
        onChange={e => { const v = e.target.value; setListFilters(f => ({ ...f, [key]: v })); }}>
        <option value="">—</option>
        {values.map(v => <option key={v} value={v}>{labelOf ? labelOf(v) : v}</option>)}
      </select>
    );
    const openFromList = (s) => { setSelectedBoxId(s.boxId); setSelectedSampleId(s.id); setEditSample(s); setSamplePos(s.position); setShowSampleForm(true); };

    return (
      <section className="panel" aria-labelledby="inv-all-title">
        <div className="panel-head flex-wrap" style={{ rowGap: '0.5rem' }}>
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 id="inv-all-title" className="panel-title">{t('invAllSamples', lang)}</h2>
            <span className="mono tabular" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {filtered.length + t('invResults', lang) + (filtered.length < allSamples.length ? (zh ? ' / 共 ' + allSamples.length : ' / ' + allSamples.length + ' total') : '')}
            </span>
            {hasFilters && (
              <button type="button" className="link" style={{ fontSize: '0.75rem' }}
                onClick={() => setListFilters({ name: '', type: '', location: '', box: '', owner: '', sort: 'name', dir: 'asc' })}>
                {t('invClearFilters', lang)}
              </button>
            )}
          </div>
          <div className="search-field w-full sm:w-64">
            <IconSearch size={15} />
            <input type="search" value={listFilters.name}
              onChange={e => { const v = e.target.value; setListFilters(f => ({ ...f, name: v })); }}
              placeholder={t('invSearchName', lang)} aria-label={t('invSearchName', lang)} />
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className={'w-full' + (isMobile ? ' [&_td]:whitespace-nowrap' : '')} style={{ minWidth: isMobile ? 440 : 760 }}>
            <thead>
              <tr>
                {sortTh('name', t('invColName', lang))}
                {sortTh('sampleType', t('invColType', lang))}
                {!isMobile && sortTh('locName', t('invColLocation', lang))}
                {sortTh('boxName', t('invColBox', lang))}
                <th>{t('invColPos', lang)}</th>
                {!isMobile && sortTh('quantity', t('invColQty', lang))}
                {!isMobile && sortTh('owner', t('invColOwner', lang))}
                {!isMobile && sortTh('date', t('invColDate', lang))}
              </tr>
              <tr style={{ background: 'var(--bg-2)' }}>
                <td style={fcell} />
                <td style={fcell}>{filterSelect('type', _uniqueTypes, tp => t(SAMPLE_TYPE_LABELS[tp] || tp, lang), t('invColType', lang))}</td>
                {!isMobile && <td style={fcell}>{filterSelect('location', _uniqueLocs, null, t('invColLocation', lang))}</td>}
                <td style={fcell}>{filterSelect('box', _uniqueBoxes, null, t('invColBox', lang))}</td>
                <td style={fcell} />
                {!isMobile && <td style={fcell} />}
                {!isMobile && <td style={fcell}>{filterSelect('owner', _uniqueOwners, null, t('invColOwner', lang))}</td>}
                {!isMobile && <td style={fcell} />}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={colCount} style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'var(--font-body)' }}>
                    {t('invNoResults', lang)}
                  </td>
                </tr>
              ) : filtered.map(s => (
                <tr key={s.id} className="cursor-pointer hover:bg-[var(--bg-2)]" onClick={() => openFromList(s)}>
                  <td>
                    <button type="button" className="text-left"
                      style={{ background: 'none', border: 0, padding: 0, font: 'inherit', fontWeight: 600, color: 'var(--text)', cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); openFromList(s); }}>
                      {s.name}
                    </button>
                  </td>
                  <td><TypeBadge type={s.sampleType} lang={lang} /></td>
                  {!isMobile && <td style={muted}>{s.locName + (s.locTemp ? ' (' + s.locTemp + ')' : '')}</td>}
                  <td style={muted}>{s.boxName}</td>
                  <td style={{ fontWeight: 700 }}>{s.position || ''}</td>
                  {!isMobile && <td style={muted}>{s.quantity || ''}</td>}
                  {!isMobile && <td style={muted}>{s.owner || ''}</td>}
                  {!isMobile && <td style={muted}>{isoDate(s.dateStored)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  };

  // ── Stats dialog ─────────────────────────────────────────────────────────
  const statsBody = () => {
    if (data.samples.length === 0 && data.boxes.length === 0) {
      return (
        <div className="empty">
          <div className="empty-icon"><IconBars size={20} /></div>
          <div className="empty-title">{t('invStatsEmpty', lang)}</div>
        </div>
      );
    }
    const byType = Object.entries(invStats.byType).sort((a, b) => b[1] - a[1]);
    const countTable = (rows, activeColor) => (
      <table className="w-full">
        <tbody>
          {rows.map(([days, count]) => (
            <tr key={days}>
              <td>{'≤ ' + days + ' ' + daysWord}</td>
              <td className="tabular" style={{ textAlign: 'right', fontWeight: 700, color: count > 0 ? activeColor : 'var(--text-muted)' }}>{count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
    return (
      <>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[['invStatsLocations', data.locations.length], ['invStatsBoxes', data.boxes.length], ['invStatsSamples', data.samples.length]].map(([key, val]) => (
            <div key={key} className="stat">
              <div className="stat-value">{val}</div>
              <div className="stat-label">{t(key, lang)}</div>
            </div>
          ))}
          <div className="stat">
            <div className="stat-value">{invStats.utilPct}%</div>
            <div className="stat-label">{t('invStatsUtilization', lang)}</div>
          </div>
        </div>

        <section>
          <h3 className="eyebrow mb-2">{t('invStatsUtilization', lang)}</h3>
          <Meter pct={invStats.utilPct} height={8} />
          <p className="mono mt-1.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {invStats.occupiedPositions + ' ' + t('invStatsOccupied', lang) + ' / ' + invStats.totalPositions + ' ' + t('invStatsTotal', lang) + ' (' + invStats.utilPct + '%)'}
          </p>
          {locationOccupancy.length > 0 && (
            <div className="mt-2 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>{t('invColLocation', lang)}</th>
                    <th style={{ textAlign: 'right' }}>{t('invStatsOccupied', lang)}</th>
                    <th style={{ width: '40%' }}><span className="sr-only">%</span></th>
                  </tr>
                </thead>
                <tbody>
                  {locationOccupancy.map((loc, i) => {
                    const pct = loc.totalSlots > 0 ? Math.round(loc.usedSlots / loc.totalSlots * 100) : 0;
                    return (
                      <tr key={i}>
                        <td>{zh ? (loc.nameZh || loc.name) : loc.name}</td>
                        <td className="tabular" style={{ textAlign: 'right' }}>{loc.usedSlots + '/' + loc.totalSlots}</td>
                        <td>
                          <div className="flex items-center gap-2">
                            <Meter pct={pct} height={6} style={{ flex: 1 }} />
                            <span className="tabular" style={{ width: '2.75rem', textAlign: 'right', color: pct >= 85 ? 'var(--danger-text)' : undefined }}>{pct + '%'}</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {byType.length > 0 && (
          <section>
            <h3 className="eyebrow mb-2">{t('invStatsByType', lang)}</h3>
            <table className="w-full">
              <tbody>
                {byType.map(([tp, count]) => {
                  const c = SAMPLE_TYPE_COLORS[tp] || SAMPLE_TYPE_COLORS.other;
                  return (
                    <tr key={tp}>
                      <td style={{ width: '34%' }}><TypeBadge type={tp} lang={lang} /></td>
                      <td className="tabular" style={{ width: '3.5rem', textAlign: 'right', fontWeight: 700 }}>{count}</td>
                      <td><Meter pct={Math.round(count / invStats.maxTypeCount * 100)} color={c.text} height={6} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <section>
            <h3 className="eyebrow mb-2">{t('invStatsExpiring', lang)}</h3>
            {countTable([['7', invStats.expiring7], ['30', invStats.expiring30], ['90', invStats.expiring90]], 'var(--danger-text)')}
          </section>
          <section>
            <h3 className="eyebrow mb-2">{t('invStatsRecentlyAdded', lang)}</h3>
            {countTable([['7', invStats.added7], ['30', invStats.added30]], 'var(--accent)')}
          </section>
        </div>

        {recentSamples.length > 0 && (
          <section>
            <h3 className="eyebrow mb-2">{zh ? '最新样品' : 'Latest samples'}</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>{t('invColName', lang)}</th>
                    <th>{t('invColType', lang)}</th>
                    <th>{t('invColBox', lang)}</th>
                    <th style={{ textAlign: 'right' }}>{t('invColDate', lang)}</th>
                  </tr>
                </thead>
                <tbody>
                  {recentSamples.map(s => {
                    const box = data.boxes.find(b => b.id === s.boxId);
                    return (
                      <tr key={s.id}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td><TypeBadge type={s.sampleType} lang={lang} /></td>
                        <td style={{ color: 'var(--text-muted)' }}>{box ? nameOf(box) + (s.position ? ' · ' + s.position : '') : ''}</td>
                        <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>{isoDate(s.dateStored)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </>
    );
  };

  const statsModal = (
    <InvModal
      open={showStats} onClose={() => setShowStats(false)} title={t('invStatsTitle', lang)} size="lg" bodyClassName="space-y-5"
      footer={<>
        {hasData && (
          <label className="label-inline mr-auto">
            <input type="checkbox" checked={showDashboard} onChange={e => (e.target.checked ? showDashboardAgain() : dismissDashboard())} />
            {zh ? '在库存页顶部显示概览' : 'Show overview on the inventory page'}
          </label>
        )}
        <button type="button" className="btn" onClick={() => setShowStats(false)}>{t('closeLabel', lang)}</button>
      </>}
    >
      {statsBody()}
    </InvModal>
  );

  // ── Shared forms & modals ────────────────────────────────────────────────
  const moveSample = moveSampleId != null ? data.samples.find(s => s.id === moveSampleId) || null : null;
  const formBox = data.boxes.find(b => b.id === (editSample ? editSample.boxId : selectedBoxId));
  const sharedForms = (
    <>
      <input ref={csvInputRef} type="file" accept=".csv" onChange={handleImportCsv} style={{ display: 'none' }} />
      <input ref={jsonInputRef} type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
      <LocationForm
        open={showLocForm}
        onClose={() => { setShowLocForm(false); setEditLoc(null); }}
        onSave={handleSaveLocation}
        initial={editLoc}
        lang={lang}
      />
      <BoxForm
        open={showBoxForm}
        onClose={() => { setShowBoxForm(false); setEditBox(null); setAddBoxLocId(null); }}
        onSave={handleSaveBox}
        initial={editBox}
        lang={lang}
        locationName={nameOf(data.locations.find(l => l.id === addBoxLocId))}
      />
      <SampleForm
        open={showSampleForm}
        onClose={() => { setShowSampleForm(false); setEditSample(null); setSamplePos(null); if (isMobile && mobileView === 'tree') setMobileView('grid'); }}
        onSave={handleSaveSample}
        onDelete={handleDeleteSample}
        onDuplicate={handleDuplicate}
        initial={editSample}
        position={samplePos}
        lang={lang}
        boxName={nameOf(formBox)}
      />
      <ImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        data={data}
        lang={lang}
        defaultBoxId={selectedBoxId}
        onPickCsv={(boxId) => {
          // The CSV handler imports into the selected box, so select it first.
          setShowImport(false);
          if (boxId !== selectedBoxId) { setSelectedBoxId(boxId); setSelectedSampleId(null); }
          if (isMobile) setMobileView('grid');
          if (csvInputRef.current) csvInputRef.current.click();
        }}
        onPickJson={() => { setShowImport(false); if (jsonInputRef.current) jsonInputRef.current.click(); }}
        onDownloadTemplate={handleDownloadTemplate}
      />
      <MoveSampleForm
        open={!!moveSample}
        sample={moveSample}
        data={data}
        onClose={() => setMoveSampleId(null)}
        onMove={handleMoveSample}
        lang={lang}
      />

      {/* Bulk edit modal */}
      <InvModal
        open={showBulkEdit} onClose={() => setShowBulkEdit(false)} onSubmit={handleBulkEditApply}
        title={t('invBulkEditTitle', lang) + ' (' + selectedOccupiedCount + t('invSamplesCount', lang)}
        footer={<>
          <button type="button" className="btn" onClick={() => setShowBulkEdit(false)}>{t('invCancel', lang)}</button>
          <button type="submit" className="btn-primary">{t('invApply', lang)}</button>
        </>}
      >
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t('invBulkEditHint', lang)}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <InvInput label={t('invOwner', lang)} value={bulkForm.owner} onChange={v => setBulkForm(f => ({ ...f, owner: v }))} />
          <InvSelect
            label={t('invSampleType', lang)}
            value={bulkForm.sampleType}
            onChange={v => setBulkForm(f => ({ ...f, sampleType: v }))}
            options={[{ value: '', label: t('invBulkNoChange', lang) }, ...Object.entries(SAMPLE_TYPE_LABELS).map(([val, lbl]) => ({ value: val, label: t(lbl, lang) }))]}
          />
          <InvInput label={t('invExpiryDate', lang)} value={bulkForm.expiryDate} onChange={v => setBulkForm(f => ({ ...f, expiryDate: v }))} type="date" />
          <InvInput label={t('invTagsShort', lang)} value={bulkForm.tags} onChange={v => setBulkForm(f => ({ ...f, tags: v }))} />
        </div>
      </InvModal>

      {/* Bulk add modal */}
      <InvModal
        open={showBulkAdd} onClose={() => setShowBulkAdd(false)} onSubmit={handleBulkAdd}
        title={t('invBulkAddTitle', lang) + ' (' + selectedEmptyCount + t('invPositionsCount', lang)}
        footer={<>
          <button type="button" className="btn" onClick={() => setShowBulkAdd(false)}>{t('invCancel', lang)}</button>
          <button type="submit" className="btn-primary">{t('invBulkAddBtn', lang) + ' ' + selectedEmptyCount}</button>
        </>}
      >
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{t('invBulkAddHint', lang)}</p>
        <InvInput label={t('invSampleNameReq', lang)} value={bulkAddForm.name} onChange={v => setBulkAddForm(f => ({ ...f, name: v }))} autoFocus />
        <div className="grid grid-cols-2 gap-3">
          <InvInput label={t('invChineseName', lang)} value={bulkAddForm.nameZh} onChange={v => setBulkAddForm(f => ({ ...f, nameZh: v }))} />
          <InvSelect
            label={t('invSampleType', lang)}
            value={bulkAddForm.sampleType}
            onChange={v => setBulkAddForm(f => ({ ...f, sampleType: v }))}
            options={Object.entries(SAMPLE_TYPE_LABELS).map(([val, lbl]) => ({ value: val, label: t(lbl, lang) }))}
          />
          <InvInput label={t('invQuantity', lang)} value={bulkAddForm.quantity} onChange={v => setBulkAddForm(f => ({ ...f, quantity: v }))} />
          <InvInput label={t('invConcentration', lang)} value={bulkAddForm.concentration} onChange={v => setBulkAddForm(f => ({ ...f, concentration: v }))} />
          <InvInput label={t('invOwner', lang)} value={bulkAddForm.owner} onChange={v => setBulkAddForm(f => ({ ...f, owner: v }))} />
          <InvInput label={t('invExpiryDate', lang)} value={bulkAddForm.expiryDate} onChange={v => setBulkAddForm(f => ({ ...f, expiryDate: v }))} type="date" />
        </div>
        <InvInput label={t('invTagsShort', lang)} value={bulkAddForm.tags} onChange={v => setBulkAddForm(f => ({ ...f, tags: v }))} />
        <InvInput label={t('invDescription', lang)} value={bulkAddForm.description} onChange={v => setBulkAddForm(f => ({ ...f, description: v }))} />
        <InvInput label={t('invNotes', lang)} value={bulkAddForm.notes} onChange={v => setBulkAddForm(f => ({ ...f, notes: v }))} />
      </InvModal>
    </>
  );

  const header = (
    <PageHeader
      tab="inventory"
      title={t('tabInventory', lang)}
      description={t('pageInventoryDesc', lang)}
      meta={data.samples.length > 0 ? data.samples.length + (zh ? ' 个样品' : ' samples') : undefined}
      actions={headerActions}
    />
  );

  // ══════════════════════════════════════════════════════════════════════════
  // EMPTY STATE (no locations yet) — same on every screen size
  // ══════════════════════════════════════════════════════════════════════════
  if (!hasLocations) {
    return (
      <div className="fade-in">
        {header}
        {emptyState()}
        {sharedForms}
        {statsModal}
      </div>
    );
  }

  const treeProps = {
    data, selectedBoxId, lang,
    onEditLocation: loc => { setEditLoc(loc); setShowLocForm(true); },
    onDeleteLocation: handleDeleteLocation,
    onAddBox: openAddBox,
    onEditBox: box => { setEditBox(box); setShowBoxForm(true); },
    onDeleteBox: handleDeleteBox,
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MOBILE LAYOUT (<768px) — drill-down: tree → box → sample
  // ══════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    let mView = mobileView;
    if (mView === 'sample' && !selectedSample) mView = 'grid';
    if (mView === 'grid' && !selectedBox) mView = 'tree';
    const backBar = (label, onClick) => (
      <button type="button" className="btn-ghost btn-sm" style={{ marginLeft: '-0.5rem', maxWidth: '100%' }} onClick={onClick}>
        <IconChevronLeft size={16} /><span className="truncate">{label}</span>
      </button>
    );
    const browsing = invViewMode === 'grid' && !searchResults;
    return (
      <div className="fade-in">
        {header}
        {toolbar()}
        {invViewMode === 'list' && allSamplesPanel()}
        {invViewMode === 'grid' && searchResults && searchResultsBlock(searchResults)}

        {browsing && mView === 'tree' && (
          <>
            {dashboardPanel()}
            <StorageTree {...treeProps} onSelectBox={id => { selectBox(id); setMobileView('grid'); }} />
          </>
        )}

        {browsing && mView === 'grid' && (
          <div className="space-y-3">
            {backBar(t('invStorageTree', lang), () => { setMobileView('tree'); setSelectedBoxId(null); setSelectedSampleId(null); })}
            {boxPanel()}
            {boxSamples.length > 0 && sampleListPanel()}
          </div>
        )}

        {browsing && mView === 'sample' && (
          <div className="space-y-3">
            {backBar(nameOf(selectedBox), () => setMobileView('grid'))}
            {renderSampleDetail(selectedSample, false)}
          </div>
        )}

        {sharedForms}
        {statsModal}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DESKTOP / TABLET LAYOUT (≥768px)
  // ══════════════════════════════════════════════════════════════════════════
  const showCol3 = !midWidth && !!selectedBox;
  return (
    <div className="fade-in">
      {header}
      {toolbar()}
      {invViewMode === 'grid' && !searchResults && dashboardPanel()}
      {invViewMode === 'list' && allSamplesPanel()}
      {invViewMode === 'grid' && searchResults && searchResultsBlock(searchResults)}

      {/* 3-column grid: storage | box | sample (768–1279px: 2 columns via global CSS) */}
      {invViewMode === 'grid' && !searchResults && (
        <div className={'inv-grid-3col grid items-start gap-3 ' + (showCol3
          ? 'grid-cols-[220px_minmax(0,1fr)_280px] xl:grid-cols-[240px_minmax(0,1fr)_320px]'
          : 'grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)]')}>
          <StorageTree
            {...treeProps}
            onSelectBox={selectBox}
            className="md:sticky md:top-[4.25rem] lg:top-6"
            bodyClassName="overflow-y-auto max-h-[calc(100vh-9rem)] lg:max-h-[calc(100vh-6.5rem)]"
          />
          <div className="min-w-0 space-y-3">
            {boxPanel()}
            {midWidth && samplePanel()}
          </div>
          {showCol3 && <div className="inv-col-3 min-w-0 lg:sticky lg:top-6">{samplePanel()}</div>}
        </div>
      )}

      {sharedForms}
      {statsModal}
    </div>
  );
}
