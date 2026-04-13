// ═══════════════════════════════════════════════
// Inventory — Main InventoryTab component (JSX)
// ═══════════════════════════════════════════════
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { t, useLang } from '../../i18n/index.js';
import { useToast } from '../../components/Toast.jsx';
import { useIsMobile } from '../../hooks/useMediaQuery.js';
import { InvModal, InvInput, InvSelect } from './InventoryComponents.jsx';
import { LocationForm, BoxForm, SampleForm } from './InventoryForms.jsx';
import { BoxGrid, posLabel } from './BoxGrid.jsx';
import { StorageTree } from './StorageTree.jsx';
import {
  SAMPLE_TYPE_COLORS, SAMPLE_TYPE_LABELS,
  invBtnStyle, invBtnSecStyle, invBtnDangerStyle,
  parseTags, getInvData, saveInventory, nextInvId, normalizeSampleType,
  invExportAllCsv, invExportBoxCsv, invCsvTemplate, downloadCsv, parseCsvImport,
} from './inventoryUtils.js';
import db from '../../lib/db.js';

export default function InventoryTab() {
  const lang = useLang();
  const toast = useToast();

  const [data, setData] = useState(getInvData);
  const [selectedBoxId, setSelectedBoxId] = useState(null);
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
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showExportMenu, showImportMenu]);

  // ── Responsive ───────────────────────────────────────────────────────────
  const isMobile = useIsMobile();

  // ── Persist helper ───────────────────────────────────────────────────────
  const persist = (newData) => { setData(newData); saveInventory(newData); };

  // ── Undo stack (in-memory, max 10) ───────────────────────────────────────
  const pushUndo = () => {
    undoStackRef.current.push(JSON.parse(JSON.stringify(data)));
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

  // Ctrl+Z / Cmd+Z keyboard shortcut
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        if (undoStackRef.current.length > 0) { e.preventDefault(); handleUndo(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [data, lang]);

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
    const id = nextInvId(d, 'samples');
    d.samples.push({ ...sample, id, position: pos, dateStored: Date.now() });
    persist(d);
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
        if (!selectedBoxId) { toast.show('Select a box first'); return; }
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
  const locationOccupancy = useMemo(
    () => data.locations.map(loc => {
      const locBoxes = data.boxes.filter(b => b.locationId === loc.id);
      const totalSlots = locBoxes.reduce((s, b) => s + b.rows * b.cols, 0);
      const usedSlots = data.samples.filter(s => locBoxes.some(b => b.id === s.boxId)).length;
      return { name: loc.name, nameZh: loc.nameZh, totalSlots, usedSlots };
    }),
    [data]
  );

  // ══════════════════════════════════════════════════════════════════════════
  // SUB-RENDERS
  // ══════════════════════════════════════════════════════════════════════════

  // ── Dashboard panel ──────────────────────────────────────────────────────
  const dashboardPanel = () => {
    if (!showDashboard || (data.samples.length === 0 && data.boxes.length === 0)) return null;
    return (
      <div className="card p-5 mb-4" style={{ borderLeft: '3px solid var(--primary)' }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold" style={{ color: 'var(--text)' }}>{t('invStatsTitle', lang)}</h3>
          <button
            onClick={dismissDashboard}
            className="px-3 py-1 rounded-lg text-xs font-semibold transition-all hover:opacity-80"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
          >
            {t('invDashboardDismiss', lang)}
          </button>
        </div>

        {/* Summary cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {[['invStatsLocations', data.locations.length], ['invStatsBoxes', data.boxes.length], ['invStatsSamples', data.samples.length]].map(([key, val]) => (
            <div key={key} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
              <div className="text-xl font-bold" style={{ color: 'var(--primary)' }}>{val}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t(key, lang)}</div>
            </div>
          ))}
        </div>

        {/* By type */}
        {Object.keys(invStats.byType).length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('invStatsByType', lang)}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(invStats.byType).sort((a, b) => b[1] - a[1]).map(([tp, count]) => {
                const colors = SAMPLE_TYPE_COLORS[tp] || SAMPLE_TYPE_COLORS.other;
                return (
                  <span key={tp} className="text-xs px-2.5 py-1 rounded-full font-semibold" style={{ background: colors.bg, color: colors.text }}>
                    {t(SAMPLE_TYPE_LABELS[tp] || tp, lang) + ' ' + count}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Location occupancy */}
        {locationOccupancy.length > 0 && (
          <div className="mb-4">
            <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('invStatsUtilization', lang)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {locationOccupancy.map(loc => {
                const pct = loc.totalSlots > 0 ? Math.round(loc.usedSlots / loc.totalSlots * 100) : 0;
                return (
                  <div key={loc.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="text-xs" style={{ width: 80, flexShrink: 0, textAlign: 'right', color: 'var(--text)' }}>
                      {lang === 'zh' ? (loc.nameZh || loc.name) : loc.name}
                    </span>
                    <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 6, height: 16, overflow: 'hidden', border: '1px solid var(--border)' }}>
                      <div style={{
                        width: pct + '%', height: '100%',
                        background: pct < 60 ? '#22c55e' : pct < 85 ? '#eab308' : '#ef4444',
                        borderRadius: 6, minWidth: pct > 0 ? 2 : 0, transition: 'width 0.3s',
                      }} />
                    </div>
                    <span className="text-xs font-mono" style={{ width: 50, flexShrink: 0, color: 'var(--text-muted)' }}>
                      {loc.usedSlots + '/' + loc.totalSlots}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent samples */}
        {recentSamples.length > 0 && (
          <div>
            <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('invDashboardRecent', lang)}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {recentSamples.map(s => {
                const colors = SAMPLE_TYPE_COLORS[s.sampleType] || SAMPLE_TYPE_COLORS.other;
                const box = data.boxes.find(b => b.id === s.boxId);
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid var(--bg-2)' }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: colors.bg, color: colors.text }}>
                      {t(SAMPLE_TYPE_LABELS[s.sampleType], lang)}
                    </span>
                    <span className="text-sm" style={{ color: 'var(--text)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                      {box ? box.name : ''}
                    </span>
                    {s.dateStored && (
                      <span className="text-xs font-mono" style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                        {new Date(s.dateStored).toISOString().slice(0, 10)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Toolbar ──────────────────────────────────────────────────────────────
  const toolbar = (mobile) => (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      {invViewMode === 'list' && (
        <button
          onClick={() => setInvViewMode('grid')}
          style={{ ...invBtnSecStyle, padding: mobile ? '4px 10px' : '6px 12px', fontSize: mobile ? '12px' : '13px' }}
        >
          {'← ' + t('backNav', lang)}
        </button>
      )}
      {invViewMode === 'grid' && (
        <input
          type="text" value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('invSearch', lang)}
          className="px-3 py-1.5 rounded-lg text-sm"
          style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)', outline: 'none', minWidth: mobile ? 120 : 180, maxWidth: 220 }}
        />
      )}
      <div className="flex-1" />

      {/* Export menu */}
      <div className="relative" ref={exportMenuRef}>
        <button
          onClick={() => { setShowExportMenu(!showExportMenu); setShowImportMenu(false); }}
          style={{ ...invBtnSecStyle, padding: mobile ? '4px 10px' : '6px 12px', fontSize: mobile ? '12px' : '13px' }}
        >
          {t('invExport', lang)}
        </button>
        {showExportMenu && (
          <div className="absolute right-0 mt-1 rounded-lg p-1 z-50" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200 }}>
            <button onClick={handleExportAllCsv} className="block w-full text-left px-3 py-2 text-sm rounded hover:opacity-80" style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('invExportAllCsv', lang)}</button>
            {selectedBoxId && (
              <button onClick={handleExportBoxCsv} className="block w-full text-left px-3 py-2 text-sm rounded hover:opacity-80" style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('invExportBoxCsv', lang)}</button>
            )}
            <button onClick={handleExportJson} className="block w-full text-left px-3 py-2 text-sm rounded hover:opacity-80" style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('invExportJson', lang)}</button>
            <button onClick={handleDownloadTemplate} className="block w-full text-left px-3 py-2 text-sm rounded hover:opacity-80" style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('invDownloadTemplate', lang)}</button>
          </div>
        )}
      </div>

      {/* Import menu */}
      <div className="relative" ref={importMenuRef}>
        <button
          onClick={() => { setShowImportMenu(!showImportMenu); setShowExportMenu(false); }}
          style={{ ...invBtnSecStyle, padding: mobile ? '4px 10px' : '6px 12px', fontSize: mobile ? '12px' : '13px' }}
        >
          {t('invImport', lang)}
        </button>
        {showImportMenu && (
          <div className="absolute right-0 mt-1 rounded-lg p-1 z-50" style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', minWidth: 200 }}>
            <button onClick={() => csvInputRef.current && csvInputRef.current.click()} className="block w-full text-left px-3 py-2 text-sm rounded hover:opacity-80" style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('invImportCsv', lang)}</button>
            <button onClick={() => jsonInputRef.current && jsonInputRef.current.click()} className="block w-full text-left px-3 py-2 text-sm rounded hover:opacity-80" style={{ color: 'var(--text)', background: 'none', border: 'none', cursor: 'pointer' }}>{t('invImportJson', lang)}</button>
          </div>
        )}
      </div>

      {/* Undo */}
      <button
        onClick={handleUndo}
        disabled={undoStackRef.current.length === 0}
        title={t('invUndoLast', lang)}
        style={{
          ...invBtnSecStyle, padding: mobile ? '4px 10px' : '6px 12px', fontSize: mobile ? '12px' : '13px',
          opacity: undoStackRef.current.length === 0 ? 0.4 : 1,
          cursor: undoStackRef.current.length === 0 ? 'default' : 'pointer',
        }}
      >
        {'↩ ' + t('invUndo', lang)}
      </button>

      {/* Select mode */}
      {invViewMode === 'grid' && selectedBoxId && (
        <button
          onClick={toggleSelectMode}
          style={{ ...(selectMode ? invBtnStyle : invBtnSecStyle), padding: mobile ? '4px 10px' : '6px 12px', fontSize: mobile ? '12px' : '13px' }}
        >
          {selectMode ? t('invCancelSelect', lang) : t('invSelect', lang)}
        </button>
      )}

      {/* Selection actions */}
      {invViewMode === 'grid' && selectMode && selectedCells.size > 0 && (
        <>
          <span className="text-xs font-semibold" style={{ color: 'var(--primary)' }}>
            {selectedCells.size + t('invSelCount', lang) + (selectedEmptyCount > 0 ? ' (' + selectedEmptyCount + t('invEmptyCount', lang) : '')}
          </span>
          {selectedEmptyCount > 0 && (
            <button onClick={() => setShowBulkAdd(true)} style={{ ...invBtnStyle, padding: mobile ? '4px 8px' : '6px 10px', fontSize: '12px' }}>+ Add</button>
          )}
          {selectedOccupiedCount > 0 && (
            <button
              onClick={() => { setShowBulkEdit(true); setBulkForm({ owner: '', sampleType: '', expiryDate: '', tags: '' }); }}
              style={{ ...invBtnSecStyle, padding: mobile ? '4px 8px' : '6px 10px', fontSize: '12px' }}
            >
              {t('invBulkEdit', lang)}
            </button>
          )}
          {selectedOccupiedCount > 0 && (
            <button
              onClick={handleBulkDelete}
              style={{ ...invBtnDangerStyle, padding: mobile ? '4px 8px' : '6px 10px', fontSize: '12px', background: confirmBulkDelete ? '#991b1b' : '#dc2626' }}
            >
              {confirmBulkDelete ? t('invBulkDelConfirm', lang) : t('invBulkDel', lang)}
            </button>
          )}
        </>
      )}

      {/* Stats / Dashboard / List toggle */}
      <button
        onClick={() => setShowStats(true)}
        style={{ ...invBtnSecStyle, padding: mobile ? '4px 10px' : '6px 12px', fontSize: mobile ? '12px' : '13px' }}
      >
        {t('invStats', lang)}
      </button>
      {!showDashboard && (
        <button
          onClick={showDashboardAgain}
          style={{ ...invBtnSecStyle, padding: mobile ? '4px 10px' : '6px 12px', fontSize: mobile ? '12px' : '13px' }}
        >
          {t('invDashboardShow', lang)}
        </button>
      )}
      {invViewMode === 'grid' && (
        <button
          onClick={() => setInvViewMode('list')}
          style={{ ...invBtnSecStyle, padding: mobile ? '4px 10px' : '6px 12px', fontSize: mobile ? '12px' : '13px', whiteSpace: 'nowrap' }}
        >
          {'☰ ' + t('invAllSamples', lang)}
        </button>
      )}
    </div>
  );

  // ── All Samples memoized data ────────────────────────────────────────────
  const { _allSamples, _uniqueTypes, _uniqueLocs, _uniqueBoxes, _uniqueOwners, _filtered } = useMemo(() => {
    const allSamples = data.boxes.flatMap(box => {
      const loc = data.locations.find(l => l.id === box.locationId);
      return data.samples.filter(s => s.boxId === box.id).map(s => ({
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
  }, [data, lang, listFilters, isMobile]);

  // ── All Samples page ─────────────────────────────────────────────────────
  const allSamplesPage = () => {
    const { _allSamples: allSamples, _uniqueTypes: uniqueTypes, _uniqueLocs: uniqueLocs, _uniqueBoxes: uniqueBoxes, _uniqueOwners: uniqueOwners, _filtered: filtered } = { _allSamples, _uniqueTypes, _uniqueLocs, _uniqueBoxes, _uniqueOwners, _filtered };
    const thStyle = { textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' };
    const fiStyle = { width: '100%', padding: '3px 6px', fontSize: 11, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', outline: 'none' };
    const SortArr = (col) => listFilters.sort === col
      ? <span style={{ marginLeft: 3 }}>{listFilters.dir === 'asc' ? '↑' : '↓'}</span>
      : <span style={{ marginLeft: 3, opacity: 0.25 }}>↕</span>;
    const sortBy = (col) => setListFilters(f => ({ ...f, sort: col, dir: f.sort === col && f.dir === 'asc' ? 'desc' : 'asc' }));
    const hasFilters = listFilters.name || listFilters.type || listFilters.location || listFilters.box || listFilters.owner;
    const colCount = isMobile ? 4 : 8;

    return (
      <div className="card p-4" style={{ overflowX: 'auto' }}>
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}>
            {t('invAllSamples', lang)}
          </h3>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {filtered.length + t('invResults', lang) + (filtered.length < allSamples.length ? ' / ' + allSamples.length + ' total' : '')}
          </span>
          {hasFilters && (
            <button
              onClick={() => setListFilters({ name: '', type: '', location: '', box: '', owner: '', sort: 'name', dir: 'asc' })}
              style={{ fontSize: 11, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              {t('invClearFilters', lang)}
            </button>
          )}
          <input
            type="text" value={listFilters.name}
            onChange={e => setListFilters(f => ({ ...f, name: e.target.value }))}
            placeholder={t('invSearchName', lang)}
            style={{ padding: '4px 10px', fontSize: 12, background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', outline: 'none', marginLeft: 'auto', width: 180 }}
          />
        </div>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: isMobile ? 400 : 700 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={thStyle} onClick={() => sortBy('name')}>{t('invColName', lang)}{SortArr('name')}</th>
              <th style={thStyle} onClick={() => sortBy('sampleType')}>{t('invColType', lang)}{SortArr('sampleType')}</th>
              {!isMobile && <th style={thStyle} onClick={() => sortBy('locName')}>{t('invColLocation', lang)}{SortArr('locName')}</th>}
              <th style={thStyle} onClick={() => sortBy('boxName')}>{t('invColBox', lang)}{SortArr('boxName')}</th>
              <th style={thStyle}>{t('invColPos', lang)}</th>
              {!isMobile && <th style={thStyle} onClick={() => sortBy('quantity')}>{t('invColQty', lang)}{SortArr('quantity')}</th>}
              {!isMobile && <th style={thStyle} onClick={() => sortBy('owner')}>{t('invColOwner', lang)}{SortArr('owner')}</th>}
              {!isMobile && <th style={thStyle} onClick={() => sortBy('date')}>{t('invColDate', lang)}{SortArr('date')}</th>}
            </tr>
            <tr style={{ borderBottom: '2px solid var(--border)', background: 'var(--bg-2)' }}>
              <td style={{ padding: '4px 8px' }} />
              <td style={{ padding: '4px 8px' }}>
                <select style={fiStyle} value={listFilters.type} onChange={e => setListFilters(f => ({ ...f, type: e.target.value }))}>
                  <option value="">—</option>
                  {uniqueTypes.map(tp => <option key={tp} value={tp}>{t(SAMPLE_TYPE_LABELS[tp] || tp, lang)}</option>)}
                </select>
              </td>
              {!isMobile && (
                <td style={{ padding: '4px 8px' }}>
                  <select style={fiStyle} value={listFilters.location} onChange={e => setListFilters(f => ({ ...f, location: e.target.value }))}>
                    <option value="">—</option>
                    {uniqueLocs.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </td>
              )}
              <td style={{ padding: '4px 8px' }}>
                <select style={fiStyle} value={listFilters.box} onChange={e => setListFilters(f => ({ ...f, box: e.target.value }))}>
                  <option value="">—</option>
                  {uniqueBoxes.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </td>
              <td style={{ padding: '4px 8px' }} />
              {!isMobile && <td style={{ padding: '4px 8px' }} />}
              {!isMobile && (
                <td style={{ padding: '4px 8px' }}>
                  <select style={fiStyle} value={listFilters.owner} onChange={e => setListFilters(f => ({ ...f, owner: e.target.value }))}>
                    <option value="">—</option>
                    {uniqueOwners.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </td>
              )}
              {!isMobile && <td style={{ padding: '4px 8px' }} />}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={colCount} className="text-center py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
                  {t('invNoResults', lang)}
                </td>
              </tr>
            ) : filtered.map(s => {
              const colors = SAMPLE_TYPE_COLORS[s.sampleType] || SAMPLE_TYPE_COLORS.other;
              return (
                <tr
                  key={s.id}
                  className="cursor-pointer"
                  onClick={() => { setSelectedBoxId(s.boxId); setEditSample(s); setSamplePos(s.position); setShowSampleForm(true); }}
                  style={{ borderBottom: '1px solid var(--bg-2)', transition: 'opacity 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
                >
                  <td className="py-2 px-2 font-medium" style={{ color: 'var(--text)' }}>{s.name}</td>
                  <td className="py-2 px-2">
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 9999, background: colors.bg, color: colors.text, whiteSpace: 'nowrap' }}>
                      {t(SAMPLE_TYPE_LABELS[s.sampleType], lang)}
                    </span>
                  </td>
                  {!isMobile && <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>{s.locName + (s.locTemp ? ' (' + s.locTemp + ')' : '')}</td>}
                  <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>{s.boxName}</td>
                  <td className="py-2 px-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{s.position || ''}</td>
                  {!isMobile && <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>{s.quantity || ''}</td>}
                  {!isMobile && <td className="py-2 px-2 text-xs" style={{ color: 'var(--text-muted)' }}>{s.owner || ''}</td>}
                  {!isMobile && <td className="py-2 px-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{s.dateStored ? new Date(s.dateStored).toISOString().slice(0, 10) : ''}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // ── Stats modal ──────────────────────────────────────────────────────────
  const statsModal = showStats && createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={() => setShowStats(false)}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }} />
      <div
        className="relative w-full rounded-xl p-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', maxHeight: '85vh', overflowY: 'auto', maxWidth: 520 }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold" style={{ color: 'var(--text)' }}>{t('invStatsTitle', lang)}</h3>
          <button onClick={() => setShowStats(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>

        {data.samples.length === 0 && data.boxes.length === 0 ? (
          <p className="text-sm text-center py-8" style={{ color: 'var(--text-muted)' }}>{t('invStatsEmpty', lang)}</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Count cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {[['invStatsLocations', data.locations.length], ['invStatsBoxes', data.boxes.length], ['invStatsSamples', data.samples.length]].map(([key, val]) => (
                <div key={key} className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>{val}</div>
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t(key, lang)}</div>
                </div>
              ))}
            </div>

            {/* Utilization bar */}
            <div>
              <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('invStatsUtilization', lang)}</div>
              <div style={{ background: 'var(--bg-2)', borderRadius: 8, height: 24, overflow: 'hidden', border: '1px solid var(--border)', position: 'relative' }}>
                <div style={{
                  width: invStats.utilPct + '%', height: '100%', borderRadius: 8, transition: 'width 0.3s',
                  background: invStats.utilPct < 60 ? '#22c55e' : invStats.utilPct < 85 ? '#eab308' : '#ef4444',
                }} />
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {invStats.occupiedPositions + ' ' + t('invStatsOccupied', lang) + ' / ' + invStats.totalPositions + ' ' + t('invStatsTotal', lang) + ' (' + invStats.utilPct + '%)'}
              </div>
            </div>

            {/* By type bars */}
            {Object.keys(invStats.byType).length > 0 && (
              <div>
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('invStatsByType', lang)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(invStats.byType).sort((a, b) => b[1] - a[1]).map(([tp, count]) => {
                    const colors = SAMPLE_TYPE_COLORS[tp] || SAMPLE_TYPE_COLORS.other;
                    return (
                      <div key={tp} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="text-xs" style={{ width: 70, flexShrink: 0, textAlign: 'right', color: 'var(--text)' }}>
                          {t(SAMPLE_TYPE_LABELS[tp] || tp, lang)}
                        </span>
                        <div style={{ flex: 1, background: 'var(--bg-2)', borderRadius: 6, height: 20, overflow: 'hidden' }}>
                          <div style={{
                            width: Math.round(count / invStats.maxTypeCount * 100) + '%',
                            height: '100%', background: colors.text, borderRadius: 6, minWidth: 2, transition: 'width 0.3s',
                          }} />
                        </div>
                        <span className="text-xs font-mono" style={{ width: 30, flexShrink: 0, color: 'var(--text-muted)' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Expiring + Recently added */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('invStatsExpiring', lang)}</div>
                {[['7', invStats.expiring7], ['30', invStats.expiring30], ['90', invStats.expiring90]].map(([days, count]) => (
                  <div key={days} className="flex justify-between text-xs py-1" style={{ color: count > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                    <span>{'≤ ' + days + ' ' + t('invStatsDays', lang)}</span>
                    <span className="font-mono font-semibold">{count}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>{t('invStatsRecentlyAdded', lang)}</div>
                {[['7', invStats.added7], ['30', invStats.added30]].map(([days, count]) => (
                  <div key={days} className="flex justify-between text-xs py-1" style={{ color: count > 0 ? '#22c55e' : 'var(--text-muted)' }}>
                    <span>{'≤ ' + days + ' ' + t('invStatsDays', lang)}</span>
                    <span className="font-mono font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );

  // ── Shared forms & modals ────────────────────────────────────────────────
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
      />
      <SampleForm
        open={showSampleForm}
        onClose={() => { setShowSampleForm(false); setEditSample(null); setSamplePos(null); if (isMobile && mobileView !== 'grid') setMobileView('grid'); }}
        onSave={handleSaveSample}
        onDelete={handleDeleteSample}
        onDuplicate={handleDuplicate}
        initial={editSample}
        position={samplePos}
        lang={lang}
      />

      {/* Bulk edit modal */}
      <InvModal open={showBulkEdit} onClose={() => setShowBulkEdit(false)} title={t('invBulkEditTitle', lang) + ' (' + selectedOccupiedCount + t('invSamplesCount', lang)}>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{t('invBulkEditHint', lang)}</p>
        <InvInput label={t('invOwner', lang)} value={bulkForm.owner} onChange={v => setBulkForm(f => ({ ...f, owner: v }))} />
        <InvSelect
          label={t('invSampleType', lang)}
          value={bulkForm.sampleType}
          onChange={v => setBulkForm(f => ({ ...f, sampleType: v }))}
          options={[{ value: '', label: t('invBulkNoChange', lang) }, ...Object.entries(SAMPLE_TYPE_LABELS).map(([val, lbl]) => ({ value: val, label: t(lbl, lang) }))]}
        />
        <InvInput label={t('invExpiryDate', lang)} value={bulkForm.expiryDate} onChange={v => setBulkForm(f => ({ ...f, expiryDate: v }))} type="date" />
        <InvInput label={t('invTagsShort', lang)} value={bulkForm.tags} onChange={v => setBulkForm(f => ({ ...f, tags: v }))} />
        <div className="flex gap-2 mt-4 justify-end">
          <button style={invBtnSecStyle} onClick={() => setShowBulkEdit(false)}>{t('invCancel', lang)}</button>
          <button style={invBtnStyle} onClick={handleBulkEditApply}>{t('invApply', lang)}</button>
        </div>
      </InvModal>

      {/* Bulk add modal */}
      <InvModal open={showBulkAdd} onClose={() => setShowBulkAdd(false)} title={t('invBulkAddTitle', lang) + ' (' + selectedEmptyCount + t('invPositionsCount', lang)}>
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{t('invBulkAddHint', lang)}</p>
        <InvInput label={t('invSampleNameReq', lang)} value={bulkAddForm.name} onChange={v => setBulkAddForm(f => ({ ...f, name: v }))} />
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
        <InvInput label={t('invTagsShort', lang)} value={bulkAddForm.tags} onChange={v => setBulkAddForm(f => ({ ...f, tags: v }))} />
        <InvInput label={t('invDescription', lang)} value={bulkAddForm.description} onChange={v => setBulkAddForm(f => ({ ...f, description: v }))} />
        <InvInput label={t('invNotes', lang)} value={bulkAddForm.notes} onChange={v => setBulkAddForm(f => ({ ...f, notes: v }))} />
        <div className="flex gap-2 mt-4 justify-end">
          <button style={invBtnSecStyle} onClick={() => setShowBulkAdd(false)}>{t('invCancel', lang)}</button>
          <button style={invBtnStyle} onClick={handleBulkAdd}>{t('invBulkAddBtn', lang) + ' ' + selectedEmptyCount}</button>
        </div>
      </InvModal>
    </>
  );

  // ── Sample list panel (col-3 + mobile) ────────────────────────────────────
  const sampleListPanel = () => {
    if (!selectedBox) {
      return (
        <div className="flex items-center justify-center" style={{ minHeight: 200 }}>
          <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>{t('invSelectABox', lang)}</p>
        </div>
      );
    }

    return (
      <div>
        <div className="flex items-center justify-between mb-2 pb-2" style={{ borderBottom: '1px solid var(--border)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--text)' }}>
            {lang === 'zh' ? (selectedBox.nameZh || selectedBox.name) : selectedBox.name}
          </span>
          <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
            {boxSamples.length + '/' + (selectedBox.rows * selectedBox.cols)}
          </span>
        </div>
        {boxSamples.length === 0 ? (
          <p className="text-xs text-center py-6" style={{ color: 'var(--text-muted)' }}>{t('invNoSamples', lang)}</p>
        ) : (
          boxSamples.slice().sort((a, b) => (a.position || '').localeCompare(b.position || '')).map(s => {
            const colors = SAMPLE_TYPE_COLORS[s.sampleType] || SAMPLE_TYPE_COLORS.other;
            const du = s.expiryDate ? Math.ceil((new Date(s.expiryDate).getTime() - Date.now()) / 86400000) : null;

            return (
              <div
                key={s.id}
                className="flex items-start gap-2 py-2 cursor-pointer"
                onClick={() => handleCellClick(s.position, s)}
                style={{ borderBottom: '1px solid var(--bg-2)', transition: 'opacity 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.opacity = '0.7'; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = '1'; }}
              >
                <span className="text-xs font-mono shrink-0 mt-0.5" style={{ color: 'var(--text-muted)', width: 28 }}>{s.position}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="text-sm font-medium truncate" style={{ color: 'var(--text)' }}>{s.name}</div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: colors.bg, color: colors.text }}>
                      {t(SAMPLE_TYPE_LABELS[s.sampleType], lang)}
                    </span>
                    {du !== null && du < 0 && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'hsla(0,80%,50%,0.15)', color: 'hsl(0,70%,45%)', fontWeight: 600 }}>
                        {'⚠ ' + t('expired', lang)}
                      </span>
                    )}
                    {du !== null && du >= 0 && du <= 7 && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9999, background: 'hsla(35,90%,50%,0.15)', color: 'hsl(35,80%,40%)', fontWeight: 600 }}>
                        {'⚠ ' + du + 'd'}
                      </span>
                    )}
                    {du !== null && du > 7 && du <= 30 && (
                      <span style={{ fontSize: 10, color: 'hsl(35,70%,45%)' }}>{du + 'd'}</span>
                    )}
                    {s.quantity && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.quantity}</span>}
                    {s.owner && <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{'· ' + s.owner}</span>}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  };

  // ── Search results renderer ──────────────────────────────────────────────
  const searchResultsBlock = (searchResults) => {
    if (!searchResults) return null;
    if (searchResults.length === 0) {
      return (
        <div className="card p-4">
          <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>{t('invNoResults', lang)}</p>
        </div>
      );
    }
    return (
      <div className="card p-4">
        {searchResults.map(s => {
          const box = data.boxes.find(b => b.id === s.boxId);
          const loc = box ? data.locations.find(l => l.id === box.locationId) : null;
          const colors = SAMPLE_TYPE_COLORS[s.sampleType] || SAMPLE_TYPE_COLORS.other;
          return (
            <div
              key={s.id}
              className={'flex items-center gap-' + (isMobile ? '2' : '3') + ' py-2 cursor-pointer' + (isMobile ? '' : ' hover:opacity-80')}
              onClick={() => { setSelectedBoxId(s.boxId); if (isMobile) setMobileView('grid'); setSearch(''); }}
              style={{ borderBottom: '1px solid var(--bg-2)' }}
            >
              <span style={{ fontSize: 10, padding: '2px ' + (isMobile ? '6' : '8') + 'px', borderRadius: 9999, background: colors.bg, color: colors.text, flexShrink: isMobile ? 0 : undefined }}>
                {t(SAMPLE_TYPE_LABELS[s.sampleType], lang)}
              </span>
              <span className={'text-sm font-medium' + (isMobile ? ' flex-1 truncate' : '')} style={{ color: 'var(--text)' }}>{s.name}</span>
              {!isMobile && s.quantity && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.quantity}</span>}
              <span className={'text-xs' + (isMobile ? ' shrink-0' : ' ml-auto')} style={{ color: 'var(--text-muted)' }}>
                {(loc ? loc.name + (isMobile ? '/' : ' / ') : '') + (box ? box.name : '') + ' ' + (s.position || '')}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ══════════════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div className="fade-in">
        {toolbar(true)}
        {invViewMode === 'grid' && !searchResults && dashboardPanel()}
        {invViewMode === 'list' && allSamplesPage()}
        {invViewMode === 'grid' && searchResults && searchResultsBlock(searchResults)}

        {/* Tree view */}
        {invViewMode === 'grid' && !searchResults && mobileView === 'tree' && (
          <div className="card p-4">
            <StorageTree
              data={data} selectedBoxId={selectedBoxId}
              onSelectBox={id => { setSelectedBoxId(id); setMobileView('grid'); }}
              onAddLocation={() => { setEditLoc(null); setShowLocForm(true); }}
              onEditLocation={loc => { setEditLoc(loc); setShowLocForm(true); }}
              onDeleteLocation={handleDeleteLocation}
              onAddBox={locId => { setEditBox(null); setAddBoxLocId(locId); setShowBoxForm(true); }}
              onEditBox={box => { setEditBox(box); setShowBoxForm(true); }}
              onDeleteBox={handleDeleteBox}
              lang={lang}
            />
          </div>
        )}

        {/* Grid + sample list (mobile) */}
        {invViewMode === 'grid' && !searchResults && mobileView === 'grid' && selectedBox && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button onClick={() => { setMobileView('tree'); setSelectedBoxId(null); }} style={{ ...invBtnSecStyle, padding: '4px 8px', fontSize: '12px' }}>←</button>
              <span className="text-sm font-semibold flex-1" style={{ color: 'var(--text)' }}>
                {lang === 'zh' ? (selectedBox.nameZh || selectedBox.name) : selectedBox.name}
              </span>
              <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                {boxSamples.length + '/' + (selectedBox.rows * selectedBox.cols)}
              </span>
            </div>
            <div className="card p-3 mb-3">
              <BoxGrid
                box={selectedBox} samples={boxSamples} onCellClick={handleCellClick}
                lang={lang} selectMode={selectMode} selectedCells={selectedCells}
                onToggleSelect={toggleSelectCell} onDragSelect={dragSelectCells}
              />
            </div>
            {boxSamples.length > 0 && (
              <div className="card p-3">
                <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {t('invSamples', lang)}
                </div>
                {sampleListPanel()}
              </div>
            )}
          </div>
        )}

        {sharedForms}
        {statsModal}
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // DESKTOP LAYOUT
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="fade-in">
      {toolbar(false)}
      {invViewMode === 'grid' && !searchResults && dashboardPanel()}
      {invViewMode === 'list' && allSamplesPage()}
      {invViewMode === 'grid' && searchResults && searchResultsBlock(searchResults)}

      {/* 3-column grid */}
      {invViewMode === 'grid' && !searchResults && (
        <div className="inv-grid-3col" style={{ display: 'grid', gridTemplateColumns: '240px 1fr 280px', gap: 12, alignItems: 'start' }}>
          {/* Col 1: Storage tree */}
          <div className="card card-scroll p-3" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <StorageTree
              data={data} selectedBoxId={selectedBoxId}
              onSelectBox={id => { setSelectedBoxId(id); setSelectMode(false); setSelectedCells(new Set()); }}
              onAddLocation={() => { setEditLoc(null); setShowLocForm(true); }}
              onEditLocation={loc => { setEditLoc(loc); setShowLocForm(true); }}
              onDeleteLocation={handleDeleteLocation}
              onAddBox={locId => { setEditBox(null); setAddBoxLocId(locId); setShowBoxForm(true); }}
              onEditBox={box => { setEditBox(box); setShowBoxForm(true); }}
              onDeleteBox={handleDeleteBox}
              lang={lang}
            />
          </div>

          {/* Col 2: Box grid */}
          <div className="card card-scroll p-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {!selectedBox ? (
              <div className="flex flex-col items-center justify-center gap-4" style={{ minHeight: 300 }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('invSelectBox', lang)}</p>
                {data.locations.length === 0 && (
                  <button
                    onClick={() => { setEditLoc(null); setShowLocForm(true); }}
                    style={{ ...invBtnStyle, padding: '8px 16px' }}
                  >
                    {'+ ' + t('invAddLocation', lang)}
                  </button>
                )}
              </div>
            ) : (
              <BoxGrid
                box={selectedBox} samples={boxSamples} onCellClick={handleCellClick}
                lang={lang} selectMode={selectMode} selectedCells={selectedCells}
                onToggleSelect={toggleSelectCell} onDragSelect={dragSelectCells}
              />
            )}
          </div>

          {/* Col 3: Sample list */}
          <div className="card card-scroll p-3 inv-col-3" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            {sampleListPanel()}
          </div>
        </div>
      )}

      {sharedForms}
      {statsModal}
    </div>
  );
}
