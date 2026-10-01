// PlateTab — Full plate designer: well selection, coloring, templates, export
import { useState, useEffect, useLayoutEffect, useRef, useCallback, memo, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { t, useLang } from '../../i18n/index.js';
import { PLATE_CONFIGS, WELL_COLORS, ROW_LABELS } from '../../data/plateConfigs.js';
import { PLATE_STORE_KEY, loadPlateState, toStoredPlate } from './plateState.js';
import { useIsMobile } from '../../hooks/useMediaQuery.js';
import { S_MUTED } from '../../lib/styleConstants.js';
import { downloadFile } from '../../lib/utils.js';
import { plateToCSV, plateToSVG } from './plateExport.js';
import PlateTableView from './PlateTableView.jsx';
import PlateReaderImport from './PlateReaderImport.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import Icon, { IconClose, IconDownload, IconCopy, IconReset, IconChevronRight, IconAlert } from '../../components/icons.jsx';
import { useToast } from '../../components/Toast.jsx';

// "Enlarge" — the shared icon set has no expand glyph; drawn on the same base.
const IconExpand = (p) => (
  <Icon {...p}><path d="M14 4h6v6" /><path d="M10 20H4v-6" /><path d="M20 4l-6.5 6.5" /><path d="M4 20l6.5-6.5" /></Icon>
);

function wellKey(r, c) { return `${ROW_LABELS[r]}${c + 1}`; }

// Well diameter bounds per plate type (px). Wells are sized from the plate
// container's width, capped at MAX so low-density plates don't balloon on wide
// screens, and never smaller than MIN — past that the plate scrolls sideways
// inside its own container instead of squeezing the wells.
const WELL_MAX = { 6: 132, 12: 108, 24: 84, 48: 68, 96: 60, 384: 32 };
const WELL_MIN = { 6: 44, 12: 36, 24: 30, 48: 24, 96: 20, 384: 13 };

// head = row-label column width / column-label row height.
function plateMetrics(width, plateType, cols, touch) {
  const head = touch ? 30 : 22;
  const pitch = Math.max(0, width - head) / cols;
  const gap = Math.round(Math.min(12, Math.max(2, pitch * 0.12)));
  const ws = Math.min(WELL_MAX[plateType] || 60, Math.max(WELL_MIN[plateType] || 14, Math.floor(pitch - gap)));
  return { ws, gap, head, fs: Math.min(13, Math.max(7, Math.round(ws * 0.2))), axisFs: ws >= 40 ? 11 : 10 };
}

const SWATCH_RING = '0 0 0 2px var(--card), 0 0 0 4px var(--text)';

// The global <label> style is uppercase, which turns "µM" into "ΜM" — a capital
// mu that reads as "MM" (millimolar). Keep the micro sign lowercase.
function keepMicro(text) {
  if (typeof text !== 'string' || !/[µμ]/.test(text)) return text;
  return text.split(/([µμ])/).map((part, i) => (i % 2 ? <span key={i} style={{ textTransform: 'none' }}>{part}</span> : part));
}

// One well. Memoized with primitive props + stable handlers so a drag-select
// only re-renders the wells whose selection actually changed, instead of
// rebuilding all 96/384 divs (twice, when the enlarged overlay was open) on
// every well the cursor crossed.
const Well = memo(function Well({ id, r, c, ws, fs, color, label, hasData, isSel,
  onMouseDown, onMouseEnter, onTouchStart, onTouchMove, onTouchEnd }) {
  const showText = ws >= 22;
  return (
    <div
      className={`well ${isSel ? 'selected' : ''}`}
      data-well-key={id}
      style={{
        width: ws, height: ws, minWidth: ws,
        flexDirection: 'column',
        background: hasData
          ? `color-mix(in srgb, ${color} 22%, var(--card))`
          : isSel ? 'var(--primary-light)' : 'var(--bg-2)',
        borderColor: hasData ? color : 'var(--border)',
        borderWidth: hasData ? (ws >= 30 ? 2 : 1.5) : 1,
        fontFamily: 'var(--font-mono)',
        fontSize: fs,
        lineHeight: 1.15,
        touchAction: 'none',
      }}
      onMouseDown={e => onMouseDown(r, c, e)}
      onMouseEnter={() => onMouseEnter(r, c)}
      onTouchStart={() => onTouchStart(r, c)}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      title={id + (hasData ? ': ' + label : '')}>
      {showText && hasData && (
        <>
          {ws >= 44 && <span style={{ fontSize: Math.max(7, fs - 2), color: 'var(--text-muted)' }}>{id}</span>}
          <span className="truncate" style={{ maxWidth: '86%', fontWeight: 700, color: 'var(--text)' }}>{label}</span>
        </>
      )}
      {showText && !hasData && (
        <span style={{ color: 'var(--text-muted)' }}>{id}</span>
      )}
    </div>
  );
});

// The layout survives a reload and rides along in backups (see plateState.js).
function readSavedPlate() {
  try { return loadPlateState(JSON.parse(localStorage.getItem(PLATE_STORE_KEY))); }
  catch { return loadPlateState(null); }
}

function PlateTab() {
  const lang = useLang();
  const toast = useToast();
  const [saved] = useState(readSavedPlate);
  const [mode, setMode] = useState('designer'); // 'designer' | 'reader'
  const [plateType, setPlateType] = useState(saved.plateType);
  const [wellData, setWellData] = useState(saved.wellData);
  const [selectedWells, setSelectedWells] = useState(new Set());
  const [currentColor, setCurrentColor] = useState(saved.colorIdx);
  const [customColor, setCustomColor] = useState(saved.customColor);
  const [useCustomColor, setUseCustomColor] = useState(saved.useCustom);
  const [currentLabel, setCurrentLabel] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false); // read by the stable pointer handlers below
  const setDragging = useCallback((v) => { isDraggingRef.current = v; setIsDragging(v); }, []);
  const [groups, setGroups] = useState(saved.groups);
  const [enlarged, setEnlarged] = useState(false);
  const isMobile = useIsMobile();
  const plateScrollRef = useRef(null);
  const [plateWidth, setPlateWidth] = useState(0);
  const [showScrollHint, setShowScrollHint] = useState(false);
  const lastTouchRef = useRef(0); // timestamp guard vs. ghost mousedown replayed after a real touch
  const labelInputRef = useRef(null);
  const refocusLabelRef = useRef(false); // keyboard-activated Confirm → focus back to the label field

  const config = PLATE_CONFIGS[plateType];

  // ═══════════════════════════════════════════════
  // PLATE TYPE CHANGE + PERSISTENCE
  // ═══════════════════════════════════════════════

  // A new plate type starts empty. (This was an effect on plateType, which
  // also ran on mount and would wipe a restored layout.)
  function changePlateType(next) {
    if (next === plateType) return;
    setPlateType(next);
    setWellData({});
    setSelectedWells(new Set());
    setGroups([]);
  }

  useEffect(() => {
    const value = toStoredPlate({ plateType, wellData, groups, colorIdx: currentColor, useCustom: useCustomColor, customColor });
    try {
      if (value) localStorage.setItem(PLATE_STORE_KEY, JSON.stringify(value));
      else localStorage.removeItem(PLATE_STORE_KEY);
    } catch { /* storage full or blocked: the layout still works for this session */ }
  }, [plateType, wellData, groups, currentColor, useCustomColor, customColor]);

  // ═══════════════════════════════════════════════
  // WELL SELECTION HELPERS
  // ═══════════════════════════════════════════════

  // All pointer handlers are stable (refs + functional setState) so the memoized
  // <Well> bails out unless its own props changed.
  const toggleWell = useCallback((r, c) => {
    const key = wellKey(r, c);
    setSelectedWells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleMouseDown = useCallback((r, c, e) => {
    e.preventDefault();
    // A real touch replays a synthetic mousedown on the same element shortly after;
    // ignore it so a tap doesn't toggle the well twice (once on touch, once on the ghost click).
    if (Date.now() - lastTouchRef.current < 500) return;
    setDragging(true);
    toggleWell(r, c);
  }, [setDragging, toggleWell]);

  const extendSelectionTo = useCallback((key) => {
    setSelectedWells(prev => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }, []);

  const handleMouseEnter = useCallback((r, c) => {
    if (isDraggingRef.current) extendSelectionTo(wellKey(r, c));
  }, [extendSelectionTo]);

  // --- Touch equivalents of the mouse drag-select above ---
  const handleTouchStart = useCallback((r, c) => {
    lastTouchRef.current = Date.now();
    setDragging(true);
    toggleWell(r, c);
  }, [setDragging, toggleWell]);

  const handleTouchMove = useCallback((e) => {
    if (!isDraggingRef.current) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    // Touch doesn't fire per-element "enter" events like the mouse does, so find whichever
    // well is currently under the finger by coordinates instead.
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const wellEl = target && target.closest ? target.closest('[data-well-key]') : null;
    if (wellEl) extendSelectionTo(wellEl.getAttribute('data-well-key'));
  }, [extendSelectionTo]);

  const handleTouchEnd = useCallback(() => {
    setDragging(false);
  }, [setDragging]);

  useEffect(() => {
    function handleUp() { setDragging(false); }
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('touchend', handleUp);
    window.addEventListener('touchcancel', handleUp);
    return () => {
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('touchend', handleUp);
      window.removeEventListener('touchcancel', handleUp);
    };
  }, [setDragging]);

  // Close the enlarged plate overlay on Escape
  useEffect(() => {
    if (!enlarged) return;
    function handleKey(e) { if (e.key === 'Escape') setEnlarged(false); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [enlarged]);

  // Size the wells from the plate container's width (it only changes with the
  // layout, never with the grid inside it, so this can't feed back on itself).
  useLayoutEffect(() => {
    const el = plateScrollRef.current;
    if (!el) return undefined;
    const measure = () => setPlateWidth(el.clientWidth);
    measure();
    const RO = window.ResizeObserver;
    if (!RO) {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }
    const ro = new RO(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);

  // Show a "scroll for more" hint on mobile when the inline plate grid overflows its wrapper
  useEffect(() => {
    const el = plateScrollRef.current;
    if (!el) { setShowScrollHint(false); return; }
    function checkOverflow() { setShowScrollHint(el.scrollWidth > el.clientWidth + 4); }
    function hideOnScroll() { setShowScrollHint(false); }
    checkOverflow();
    el.addEventListener('scroll', hideOnScroll, { passive: true });
    window.addEventListener('resize', checkOverflow);
    return () => {
      el.removeEventListener('scroll', hideOnScroll);
      window.removeEventListener('resize', checkOverflow);
    };
  }, [plateType, mode, plateWidth, enlarged]);

  function getActiveColor() {
    return useCustomColor ? customColor : WELL_COLORS[currentColor % WELL_COLORS.length];
  }

  // ═══════════════════════════════════════════════
  // ASSIGN / CLEAR
  // ═══════════════════════════════════════════════

  function assignSelected() {
    if (selectedWells.size === 0 || !currentLabel) return;
    const color = getActiveColor();
    setWellData(prev => {
      const next = { ...prev };
      selectedWells.forEach(key => {
        next[key] = { color, label: currentLabel };
      });
      return next;
    });
    // Relabelled wells leave their previous group (they used to stay listed under
    // the old label too, so legend counts / SVG legend / copied layout drifted);
    // groups emptied that way drop out.
    setGroups(prev => {
      const rest = prev
        .map(g => (g.label === currentLabel ? g : { ...g, wells: g.wells.filter(w => !selectedWells.has(w)) }))
        .filter(g => g.wells.length > 0);
      const existingIdx = rest.findIndex(g => g.label === currentLabel);
      if (existingIdx === -1) return [...rest, { label: currentLabel, color, wells: [...selectedWells] }];
      return rest.map((g, i) => i === existingIdx
        ? { ...g, wells: [...new Set([...g.wells, ...selectedWells])] }
        : g
      );
    });
    setSelectedWells(new Set());
    setCurrentLabel('');
    if (!useCustomColor) setCurrentColor(prev => prev + 1);
  }

  function clearAll() {
    setWellData({});
    setSelectedWells(new Set());
    setGroups([]);
    setCurrentColor(0);
  }

  function selectRow(r) {
    setSelectedWells(prev => {
      const next = new Set(prev);
      for (let c = 0; c < config.cols; c++) next.add(wellKey(r, c));
      return next;
    });
  }

  function selectCol(c) {
    setSelectedWells(prev => {
      const next = new Set(prev);
      for (let r = 0; r < config.rows; r++) next.add(wellKey(r, c));
      return next;
    });
  }

  // ═══════════════════════════════════════════════
  // TEMPLATE SYSTEM
  // ═══════════════════════════════════════════════

  const [templateDialog, setTemplateDialog] = useState(null);
  const [templateParams, setTemplateParams] = useState({});

  // Escape closes the template dialog
  useEffect(() => {
    if (!templateDialog) return undefined;
    function handleKey(e) { if (e.key === 'Escape') setTemplateDialog(null); }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [templateDialog]);

  function openTemplate(type) {
    const defaults = {
      serial: { startConc: '100', factor: '2', direction: 'row', replicates: '1' },
      checkerboard: { label1: 'Treatment', label2: 'Control', replicates: '1' },
      dose: { drugs: '3', startConc: '100', dilFactor: '3', replicates: '1' },
      control: {},
      antibody: { antibodies: '3', startConc: '100', dilFactor: '2' },
    };
    setTemplateParams(defaults[type]);
    setTemplateDialog(type);
  }

  function updateParam(key, val) {
    setTemplateParams(prev => ({ ...prev, [key]: val }));
  }

  function confirmTemplate() {
    if (templateDialog === 'serial') applySerialDilution();
    else if (templateDialog === 'checkerboard') applyCheckerboard();
    else if (templateDialog === 'dose') applyDoseResponse();
    else if (templateDialog === 'control') applyControlLayout();
    else if (templateDialog === 'antibody') applyAntibodyTitration();
    setTemplateDialog(null);
  }

  // --- Serial dilution template with replicates ---
  function applySerialDilution() {
    const startConc = templateParams.startConc;
    const factor = templateParams.factor;
    const direction = templateParams.direction;
    const reps = Math.max(1, Math.min(4, +(templateParams.replicates || 1)));
    if (!startConc || !factor) return;

    const newData = {};
    const newGroups = [];
    let conc = +startConc;
    const f = +factor;

    if (direction === 'row') {
      const steps = config.cols;
      const rowsPerStep = reps;
      for (let c = 0; c < steps; c++) {
        const label = conc >= 1 ? conc.toFixed(1) : conc.toExponential(1);
        const color = WELL_COLORS[c % WELL_COLORS.length];
        const wells = [];
        for (let rep = 0; rep < rowsPerStep && rep < config.rows; rep++) {
          for (let r = rep; r < config.rows; r += Math.max(1, Math.floor(config.rows / rowsPerStep))) {
            if (wells.length >= config.rows) break;
          }
        }
        for (let r = 0; r < Math.min(reps, config.rows); r++) {
          const key = wellKey(r, c);
          newData[key] = { color, label };
          wells.push(key);
        }
        if (reps === 1) {
          for (let r = 0; r < config.rows; r++) {
            const key = wellKey(r, c);
            newData[key] = { color, label };
            if (!wells.includes(key)) wells.push(key);
          }
        }
        newGroups.push({ label, color, wells });
        conc /= f;
      }
    } else {
      const steps = config.rows;
      for (let r = 0; r < steps; r++) {
        const label = conc >= 1 ? conc.toFixed(1) : conc.toExponential(1);
        const color = WELL_COLORS[r % WELL_COLORS.length];
        const wells = [];
        const colCount = reps === 1 ? config.cols : Math.min(reps, config.cols);
        for (let c = 0; c < colCount; c++) {
          const key = wellKey(r, c);
          newData[key] = { color, label };
          wells.push(key);
        }
        newGroups.push({ label, color, wells });
        conc /= f;
      }
    }

    setWellData(newData);
    setGroups(newGroups);
    setSelectedWells(new Set());
  }

  // --- Checkerboard template with replicates ---
  function applyCheckerboard() {
    const label1 = templateParams.label1;
    const label2 = templateParams.label2;
    const reps = Math.max(1, Math.min(4, +(templateParams.replicates || 1)));
    if (!label1 || !label2) return;
    const newData = {};
    const wells1 = [], wells2 = [];
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        const key = wellKey(r, c);
        const blockR = Math.floor(r / reps);
        const blockC = Math.floor(c / reps);
        if ((blockR + blockC) % 2 === 0) {
          newData[key] = { color: WELL_COLORS[0], label: label1 };
          wells1.push(key);
        } else {
          newData[key] = { color: WELL_COLORS[1], label: label2 };
          wells2.push(key);
        }
      }
    }
    setWellData(newData);
    setGroups([
      { label: label1, color: WELL_COLORS[0], wells: wells1 },
      { label: label2, color: WELL_COLORS[1], wells: wells2 },
    ]);
  }

  // --- Dose-response template with replicates ---
  function applyDoseResponse() {
    const drugs = templateParams.drugs;
    const startConc = templateParams.startConc;
    const dilFactor = templateParams.dilFactor;
    const reps = Math.max(1, Math.min(4, +(templateParams.replicates || 1)));
    if (!drugs || !startConc || !dilFactor) return;
    const nDrugs = Math.min(+drugs, Math.floor(config.rows / reps));
    const newData = {};
    const newGroups = [];

    for (let d = 0; d < nDrugs; d++) {
      let conc = +startConc;
      const color = WELL_COLORS[d % WELL_COLORS.length];
      const drugLabel = `Drug ${d + 1}`;
      const wells = [];

      for (let c = 0; c < config.cols; c++) {
        const label = conc >= 1 ? conc.toFixed(1) : conc.toExponential(1);
        for (let rep = 0; rep < reps; rep++) {
          const r = d * reps + rep;
          if (r >= config.rows) break;
          const key = wellKey(r, c);
          newData[key] = { color, label };
          wells.push(key);
        }
        conc /= +dilFactor;
      }
      newGroups.push({ label: drugLabel, color, wells });
    }

    setWellData(newData);
    setGroups(newGroups);
  }

  // --- Control Layout template ---
  function applyControlLayout() {
    const newData = {};
    const posWells = [], negWells = [], blankWells = [];
    const posColor = WELL_COLORS[2]; // green
    const negColor = WELL_COLORS[1]; // red
    const blankColor = WELL_COLORS[6]; // cyan

    // Last column: positive controls (top half), negative controls (bottom half)
    const lastCol = config.cols - 1;
    const midRow = Math.floor(config.rows / 2);
    for (let r = 0; r < config.rows; r++) {
      const key = wellKey(r, lastCol);
      if (r < midRow) {
        newData[key] = { color: posColor, label: t('platePosCtrl', lang) };
        posWells.push(key);
      } else {
        newData[key] = { color: negColor, label: t('plateNegCtrl', lang) };
        negWells.push(key);
      }
    }
    // First column: blanks
    for (let r = 0; r < config.rows; r++) {
      const key = wellKey(r, 0);
      newData[key] = { color: blankColor, label: t('plateBlank', lang) };
      blankWells.push(key);
    }

    setWellData(newData);
    setGroups([
      { label: t('platePosCtrl', lang), color: posColor, wells: posWells },
      { label: t('plateNegCtrl', lang), color: negColor, wells: negWells },
      { label: t('plateBlank', lang), color: blankColor, wells: blankWells },
    ]);
  }

  // --- Antibody Titration template ---
  function applyAntibodyTitration() {
    const nAb = Math.min(+(templateParams.antibodies || 3), config.rows);
    const startConc = +(templateParams.startConc || 100);
    const dilFactor = +(templateParams.dilFactor || 2);
    const newData = {};
    const newGroups = [];

    for (let ab = 0; ab < nAb; ab++) {
      let conc = startConc;
      const color = WELL_COLORS[ab % WELL_COLORS.length];
      const abLabel = `Ab ${ab + 1}`;
      const wells = [];

      for (let c = 0; c < config.cols; c++) {
        const key = wellKey(ab, c);
        const label = conc >= 1 ? conc.toFixed(1) : conc.toExponential(1);
        newData[key] = { color, label };
        wells.push(key);
        conc /= dilFactor;
      }
      newGroups.push({ label: abLabel, color, wells });
    }

    setWellData(newData);
    setGroups(newGroups);
  }

  // ═══════════════════════════════════════════════
  // EXPORT
  // ═══════════════════════════════════════════════

  function copyLayout() {
    let txt = `${plateType}-well Plate Layout\n${'─'.repeat(40)}\n`;
    groups.forEach(g => { txt += `■ ${g.label}: ${g.wells.join(', ')}\n`; });
    if (groups.length === 0) txt += '(empty)\n';
    navigator.clipboard.writeText(txt);
    toast.show(t('copied', lang));
  }

  // ═══════════════════════════════════════════════
  // PLATE GRID RENDERER (shared between normal and enlarged views)
  // ═══════════════════════════════════════════════

  function renderPlateGrid(m) {
    const { ws, gap, head, fs, axisFs } = m;
    const axisClass = 'flex items-center justify-center mono font-bold bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-2)] hover:text-[var(--text)]';
    const axisStyle = { fontSize: axisFs, border: 0, padding: 0, lineHeight: 1 };
    return (
      <div style={{
        display: 'grid',
        gridTemplateColumns: `${head}px repeat(${config.cols}, ${ws}px)`,
        gridTemplateRows: `${head}px repeat(${config.rows}, ${ws}px)`,
        gap,
        width: 'max-content',
        margin: '0 auto',
      }}>
        <span aria-hidden="true" />
        {Array.from({ length: config.cols }, (_, c) => (
          <button key={`c${c}`} type="button" onClick={() => selectCol(c)} className={axisClass} style={axisStyle}
            aria-label={lang === 'zh' ? `选择第 ${c + 1} 列` : `Select column ${c + 1}`}>
            {c + 1}
          </button>
        ))}
        {Array.from({ length: config.rows }, (_, r) => (
          <Fragment key={r}>
            <button type="button" onClick={() => selectRow(r)} className={axisClass} style={axisStyle}
              aria-label={lang === 'zh' ? `选择 ${ROW_LABELS[r]} 行` : `Select row ${ROW_LABELS[r]}`}>
              {ROW_LABELS[r]}
            </button>
            {Array.from({ length: config.cols }, (_, c) => {
              const key = wellKey(r, c);
              const data = wellData[key];
              return (
                <Well key={c} id={key} r={r} c={c} ws={ws} fs={fs}
                  hasData={!!data} color={data ? data.color : ''} label={data ? String(data.label ?? '') : ''}
                  isSel={selectedWells.has(key)}
                  onMouseDown={handleMouseDown} onMouseEnter={handleMouseEnter}
                  onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} />
              );
            })}
          </Fragment>
        ))}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // LEGEND RENDERER
  // ═══════════════════════════════════════════════

  function renderLegend() {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-3" style={{ borderTop: '1px solid var(--rule)' }}>
        <span className="eyebrow">{t('plateLegend', lang)}</span>
        {groups.length === 0 ? (
          <span className="text-xs" style={S_MUTED}>
            {lang === 'zh' ? '尚未标记——为选中的孔位命名，或应用一个模板。' : 'Nothing labelled yet — name the selected wells, or apply a template.'}
          </span>
        ) : groups.map((g, i) => (
          <span key={i} className="inline-flex items-center gap-1.5 text-xs">
            <span className="rounded-full flex-shrink-0" style={{ width: 10, height: 10, background: g.color }} />
            <span className="font-medium" style={{ color: 'var(--text)' }}>{g.label}</span>
            <span className="mono tabular" style={S_MUTED}>{g.wells.length}</span>
          </span>
        ))}
        <span className="mono tabular text-[11px] ml-auto" style={S_MUTED}>
          {lang === 'zh' ? `已标记 ${labelledCount}/${plateType}` : `${labelledCount}/${plateType} labelled`}
        </span>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // TEMPLATE DIALOG
  // ═══════════════════════════════════════════════

  const TEMPLATE_NAMES = {
    serial: t('plateSerial', lang),
    dose: t('plateDose', lang),
    checkerboard: t('plateCheckerboard', lang),
    control: t('plateControlLayout', lang),
    antibody: t('plateAntibodyTitration', lang),
  };
  const TEMPLATE_DESC = {
    serial: lang === 'en'
      ? 'Each step divides the concentration by the dilution factor — one step per column (→ Row) or per row (↓ Column).'
      : '每一步将浓度除以稀释倍数——沿行方向每列一个梯度，或沿列方向每行一个梯度。',
    dose: lang === 'en'
      ? 'One block of rows per drug, diluted across the columns. Replicates set how many rows each drug gets.'
      : '每种药物占一组行，沿列方向梯度稀释；重复数决定每种药物占几行。',
    checkerboard: lang === 'en'
      ? 'Alternates two labels across the plate; replicates set the size of each block.'
      : '两种标签在整板上交替排列；重复数决定每个方块的大小。',
    control: lang === 'en'
      ? 'Places positive controls (top half of last column), negative controls (bottom half of last column), and blanks (first column).'
      : '在最后一列上半部分放置阳性对照，下半部分放置阴性对照，第一列放置空白。',
    antibody: lang === 'en'
      ? 'One row per antibody, diluted across the columns from the starting concentration.'
      : '每个抗体占一行，从起始浓度沿列方向梯度稀释。',
  };
  const repsOptions = <><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option></>;
  const field = (id, label, control) => (
    <div>
      <label htmlFor={id}>{keepMicro(label)}</label>
      {control}
    </div>
  );

  function renderTemplateFields() {
    const p = templateParams;
    switch (templateDialog) {
      case 'serial': return (<>
        {field('tpl-start', t('serialStartConc', lang),
          <input id="tpl-start" type="text" inputMode="decimal" autoFocus value={p.startConc} onChange={e => updateParam('startConc', e.target.value)} className="w-full" />)}
        {field('tpl-factor', t('serialFactor', lang),
          <input id="tpl-factor" type="text" inputMode="decimal" value={p.factor} onChange={e => updateParam('factor', e.target.value)} className="w-full" />)}
        <div>
          <span id="tpl-dir-label" className="eyebrow" style={{ display: 'block', marginBottom: '0.35rem' }}>
            {lang === 'en' ? 'Direction' : '方向'}
          </span>
          <div className="seg" role="group" aria-labelledby="tpl-dir-label">
            <button type="button" aria-pressed={p.direction === 'row'} onClick={() => updateParam('direction', 'row')}>
              → {lang === 'en' ? 'Row' : '沿行'}
            </button>
            <button type="button" aria-pressed={p.direction === 'col'} onClick={() => updateParam('direction', 'col')}>
              ↓ {lang === 'en' ? 'Column' : '沿列'}
            </button>
          </div>
        </div>
        {field('tpl-reps', t('plateReplicates', lang),
          <select id="tpl-reps" value={p.replicates} onChange={e => updateParam('replicates', e.target.value)} className="w-full">{repsOptions}</select>)}
      </>);
      case 'checkerboard': return (<>
        <div className="grid grid-cols-2 gap-3">
          {field('tpl-l1', lang === 'en' ? 'Label 1' : '标签 1',
            <input id="tpl-l1" type="text" autoFocus value={p.label1} onChange={e => updateParam('label1', e.target.value)} className="w-full" />)}
          {field('tpl-l2', lang === 'en' ? 'Label 2' : '标签 2',
            <input id="tpl-l2" type="text" value={p.label2} onChange={e => updateParam('label2', e.target.value)} className="w-full" />)}
        </div>
        {field('tpl-reps', t('plateReplicates', lang),
          <select id="tpl-reps" value={p.replicates} onChange={e => updateParam('replicates', e.target.value)} className="w-full">{repsOptions}</select>)}
      </>);
      case 'dose': return (<>
        {field('tpl-drugs', t('doseNumDrugs', lang),
          <input id="tpl-drugs" type="number" autoFocus value={p.drugs} onChange={e => updateParam('drugs', e.target.value)} min={1} max={config.rows} className="w-full" />)}
        {field('tpl-start', t('serialStartConc', lang),
          <input id="tpl-start" type="text" inputMode="decimal" value={p.startConc} onChange={e => updateParam('startConc', e.target.value)} className="w-full" />)}
        {field('tpl-factor', t('serialFactor', lang),
          <input id="tpl-factor" type="text" inputMode="decimal" value={p.dilFactor} onChange={e => updateParam('dilFactor', e.target.value)} className="w-full" />)}
        {field('tpl-reps', t('plateReplicates', lang),
          <select id="tpl-reps" value={p.replicates} onChange={e => updateParam('replicates', e.target.value)} className="w-full">{repsOptions}</select>)}
      </>);
      case 'antibody': return (<>
        {field('tpl-abs', t('plateNumAntibodies', lang),
          <input id="tpl-abs" type="number" autoFocus value={p.antibodies} onChange={e => updateParam('antibodies', e.target.value)} min={1} max={config.rows} className="w-full" />)}
        {field('tpl-start', t('serialStartConc', lang),
          <input id="tpl-start" type="text" inputMode="decimal" value={p.startConc} onChange={e => updateParam('startConc', e.target.value)} className="w-full" />)}
        {field('tpl-factor', t('serialFactor', lang),
          <input id="tpl-factor" type="text" inputMode="decimal" value={p.dilFactor} onChange={e => updateParam('dilFactor', e.target.value)} className="w-full" />)}
      </>);
      default: return null;
    }
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  const metrics = plateMetrics(plateWidth, plateType, config.cols, isMobile);
  const labelledCount = Object.keys(wellData).length;
  const selCount = selectedWells.size;
  const activeColor = getActiveColor();
  const plateName = lang === 'zh' ? `${plateType} 孔板` : `${plateType}-well plate`;

  return (
    <div className="fade-in">
      <PageHeader tab="plate" title={t('plateTitle', lang)} description={t('plateSubtitle', lang)}
        actions={<>
          <div className="seg" role="group" aria-label={lang === 'zh' ? '模式' : 'Mode'}>
            <button type="button" aria-pressed={mode === 'designer'} onClick={() => setMode('designer')}>
              {t('plateModeDesigner', lang)}
            </button>
            <button type="button" aria-pressed={mode === 'reader'} onClick={() => setMode('reader')}>
              {t('plateModeReader', lang)}
            </button>
          </div>
          {mode === 'designer' && (
            <div className="flex items-center gap-2">
              <label htmlFor="plate-type-select" className="max-sm:sr-only" style={{ marginBottom: 0 }}>{t('plateType', lang)}</label>
              <select id="plate-type-select" value={plateType} onChange={e => changePlateType(+e.target.value)} style={{ minWidth: '7rem' }}>
                {Object.keys(PLATE_CONFIGS).map(k => (
                  <option key={k} value={k}>{lang === 'zh' ? `${k} 孔` : `${k}-well`}</option>
                ))}
              </select>
            </div>
          )}
        </>}
      />

      {mode === 'reader' && (
        <PlateReaderImport wellData={wellData} plateConfig={config} designerPlateSize={plateType} />
      )}

      {mode === 'designer' && (
      <div className="grid grid-cols-1 gap-4 xl:gap-5 items-start md:grid-cols-[minmax(0,1fr)_17.5rem] xl:grid-cols-[minmax(0,1fr)_19rem]">
        <div className="space-y-4 min-w-0">
          {/* The plate */}
          <section className="panel" aria-labelledby="plate-panel-title">
            <div className="panel-head flex-wrap">
              <div className="flex items-baseline gap-2 min-w-0">
                <h2 id="plate-panel-title" className="panel-title">{plateName}</h2>
                <span className="mono text-[11px] max-sm:hidden" style={S_MUTED}>{config.rows} × {config.cols}</span>
              </div>
              <div className="flex items-center gap-1.5 ml-auto">
                {isMobile && (
                  <button type="button" onClick={() => setEnlarged(true)} className="btn btn-sm">
                    <IconExpand size={14} />{t('plateEnlarge', lang)}
                  </button>
                )}
                <button type="button" onClick={clearAll} className="btn-ghost btn-sm">
                  <IconReset size={14} />{t('plateClear', lang)}
                </button>
              </div>
            </div>
            <div className="relative" style={{ padding: isMobile ? '0.75rem' : '1rem 1.25rem 1.25rem' }}>
              <div ref={plateScrollRef} className="overflow-x-auto"
                style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', paddingBottom: 2 }}>
                {/* While the enlarged overlay is open it owns the grid; don't render a second copy underneath. */}
                {enlarged ? null : renderPlateGrid(metrics)}
              </div>
              {isMobile && showScrollHint && (
                <div aria-hidden="true" className="flex items-center justify-center" style={{
                  position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, pointerEvents: 'none',
                  color: 'var(--text-muted)', background: 'var(--card)', borderLeft: '1px solid var(--rule)',
                }}>
                  <IconChevronRight size={14} />
                </div>
              )}
            </div>
            {renderLegend()}
          </section>

          {/* Table view of the labelled wells */}
          {labelledCount > 0 && (
            <PlateTableView wellData={wellData} config={config} lang={lang} />
          )}
        </div>

        {/* Inspector */}
        <aside className="panel" aria-label={lang === 'zh' ? '孔位检查器' : 'Well inspector'}>
          <div className="panel-head">
            <h2 className="panel-title">{t('plateMarkTitle', lang)}</h2>
            <span className={`badge tabular ${selCount ? 'badge-green' : ''}`} aria-live="polite">
              {lang === 'zh' ? `${t('plateSelected', lang)} ${selCount}` : `${selCount} ${t('plateSelected', lang)}`}
            </span>
          </div>
          <form className="panel-body space-y-4" onSubmit={e => {
            e.preventDefault();
            assignSelected();
            // Confirm disables itself once used; don't strand keyboard focus on <body>.
            if (refocusLabelRef.current) { refocusLabelRef.current = false; labelInputRef.current?.focus(); }
          }}>
            {selCount === 0 ? (
              <p className="text-xs" style={{ ...S_MUTED, lineHeight: 1.5 }}>
                {lang === 'zh'
                  ? '点击或拖动选择孔位；点击行字母或列号可选中整行或整列。'
                  : 'Click or drag across wells to select them — click a row letter or column number to take the whole row or column.'}
              </p>
            ) : (
              <div className="flex items-start gap-2">
                <p className="mono text-[11px] flex-1 min-w-0" style={{ ...S_MUTED, lineHeight: 1.5, overflowWrap: 'anywhere' }}>
                  {[...selectedWells].slice(0, 12).join(' ')}{selCount > 12 ? ` +${selCount - 12}` : ''}
                </p>
                <button type="button" className="btn-ghost btn-sm" style={{ marginTop: -4 }} onClick={() => setSelectedWells(new Set())}>
                  {lang === 'zh' ? '取消选择' : 'Deselect'}
                </button>
              </div>
            )}

            <div>
              <label htmlFor="plate-label-input">{t('plateLabelName', lang)}</label>
              <input id="plate-label-input" ref={labelInputRef} type="text" value={currentLabel} onChange={e => setCurrentLabel(e.target.value)}
                placeholder={lang === 'zh' ? '如 10 µM 药物 A' : 'e.g. 10 µM Drug A'} className="w-full" autoComplete="off" />
            </div>

            <div>
              <div className="flex items-center justify-between gap-2" style={{ marginBottom: '0.5rem' }}>
                <span id="plate-color-label" className="eyebrow">{t('color', lang)}</span>
                <span className="mono text-[11px] inline-flex items-center gap-1.5" style={S_MUTED}>
                  <span className="rounded-full" style={{ width: 10, height: 10, background: activeColor }} />
                  {activeColor.toUpperCase()}
                </span>
              </div>
              <div className="grid grid-cols-9 gap-1.5" role="group" aria-labelledby="plate-color-label">
                {WELL_COLORS.map((c, i) => {
                  const on = !useCustomColor && currentColor % WELL_COLORS.length === i;
                  return (
                    <button key={i} type="button" onClick={() => { setCurrentColor(i); setUseCustomColor(false); }}
                      aria-pressed={on} aria-label={`${t('color', lang)} ${c}`} title={c}
                      className="aspect-square w-full"
                      style={{ background: c, border: 0, boxShadow: on ? SWATCH_RING : 'none' }} />
                  );
                })}
              </div>
              <div className="flex items-center gap-2.5" style={{ marginTop: '0.75rem' }}>
                <input id="plate-custom-color" type="color" value={customColor}
                  onChange={e => { setCustomColor(e.target.value); setUseCustomColor(true); }}
                  onClick={() => setUseCustomColor(true)}
                  className="cursor-pointer flex-shrink-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-moz-color-swatch]:border-0"
                  style={{ width: 26, height: 26, padding: 0, border: '1px solid var(--border-strong)', background: 'transparent', boxShadow: useCustomColor ? SWATCH_RING : 'none' }} />
                <label htmlFor="plate-custom-color" style={{ marginBottom: 0, cursor: 'pointer' }}>{t('plateCustomColor', lang)}</label>
                <span className="mono text-[11px] ml-auto" style={S_MUTED}>{customColor.toUpperCase()}</span>
              </div>
            </div>

            <button type="submit" className="btn-primary btn-block" disabled={!selCount || !currentLabel}
              onClick={e => { if (e.detail === 0) refocusLabelRef.current = true; }}>
              {t('plateConfirm', lang)}
            </button>
          </form>

          <div className="panel-body" style={{ borderTop: '1px solid var(--rule)' }}>
            <h2 className="panel-title" style={{ marginBottom: '0.75rem' }}>{t('plateTemplates', lang)}</h2>
            <div className="grid grid-cols-2 gap-2">
              {['serial', 'dose', 'checkerboard', 'control', 'antibody'].map(type => (
                <button key={type} type="button" onClick={() => openTemplate(type)}
                  className={`btn btn-sm ${type === 'antibody' ? 'col-span-2' : ''}`}
                  aria-haspopup="dialog" aria-expanded={templateDialog === type}>
                  {TEMPLATE_NAMES[type]}
                </button>
              ))}
            </div>
          </div>

          <div className="panel-body" style={{ borderTop: '1px solid var(--rule)' }}>
            <h2 className="panel-title" style={{ marginBottom: '0.75rem' }}>{t('plateExport', lang)}</h2>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className="btn btn-sm" aria-label={t('downloadCSV', lang)} title={t('downloadCSV', lang)}
                onClick={() => downloadFile(`plate_${plateType}well.csv`, plateToCSV(wellData, config), 'text/csv')}>
                <IconDownload size={14} />CSV
              </button>
              <button type="button" className="btn btn-sm" aria-label={t('downloadSVG', lang)} title={t('downloadSVG', lang)}
                onClick={() => downloadFile(`plate_${plateType}well.svg`, plateToSVG(wellData, config, groups), 'image/svg+xml')}>
                <IconDownload size={14} />SVG
              </button>
              <button type="button" className="btn btn-sm col-span-2" onClick={copyLayout}>
                <IconCopy size={14} />{t('copyLayout', lang)}
              </button>
            </div>
          </div>
        </aside>
      </div>
      )}

      {templateDialog && createPortal(
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
          role="dialog" aria-modal="true" aria-labelledby="plate-template-title">
          <div className="overlay-backdrop" onClick={() => setTemplateDialog(null)} aria-hidden="true" />
          <form className="dialog w-full sm:max-w-md max-h-[92vh] overflow-y-auto" style={{ zIndex: 51 }}
            onSubmit={e => { e.preventDefault(); confirmTemplate(); }}>
            <div className="panel-head">
              <h2 id="plate-template-title" className="section-title">{TEMPLATE_NAMES[templateDialog]}</h2>
              <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => setTemplateDialog(null)}
                aria-label={lang === 'zh' ? '关闭' : 'Close'}>
                <IconClose size={16} />
              </button>
            </div>
            <div className="panel-body space-y-3">
              <p className="text-[13px]" style={{ ...S_MUTED, lineHeight: 1.55 }}>
                {TEMPLATE_DESC[templateDialog]}
                <span className="mono" style={{ color: 'var(--text)', whiteSpace: 'nowrap' }}> · {plateName}</span>
              </p>
              {renderTemplateFields()}
              {labelledCount > 0 && (
                <div className="notice notice-warn">
                  <IconAlert size={15} style={{ color: 'var(--warning-text)', flexShrink: 0, marginTop: 2 }} />
                  <span>{lang === 'zh' ? '应用模板会替换当前布局。' : 'Applying a template replaces the current layout.'}</span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--rule)' }}>
              <button type="button" className="btn" onClick={() => setTemplateDialog(null)}>
                {lang === 'en' ? 'Cancel' : '取消'}
              </button>
              <button type="submit" className="btn-primary" autoFocus={templateDialog === 'control'}>
                {lang === 'en' ? 'Apply' : '应用'}
              </button>
            </div>
          </form>
        </div>,
        document.body,
      )}

      {enlarged && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
          role="dialog" aria-modal="true" aria-label={t('plateEnlarge', lang)}>
          <div className="overlay-backdrop" onClick={() => setEnlarged(false)} aria-hidden="true" />
          <div className="dialog flex flex-col" style={{ zIndex: 51, width: '100%', height: '100%', maxWidth: '96vw', maxHeight: '96vh' }}>
            <div className="panel-head" style={{ flexShrink: 0 }}>
              <h2 className="section-title">{plateName}</h2>
              <button type="button" onClick={() => setEnlarged(false)} aria-label={t('plateClose', lang)} className="btn-ghost btn-icon btn-sm">
                <IconClose size={16} />
              </button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: '0.75rem', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
              {renderPlateGrid({ ws: Math.max(config.wellSize, 42), gap: 4, head: 32, fs: 10, axisFs: 11 })}
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3" style={{ flexShrink: 0, borderTop: '1px solid var(--rule)' }}>
              <p className="text-xs" style={S_MUTED}>
                {t('plateSelected', lang)}: <span className="mono font-bold" style={{ color: 'var(--text)' }}>{selCount}</span> {t('wells', lang)}
              </p>
              <button type="button" onClick={() => setEnlarged(false)} className="btn-primary btn-sm">
                {lang === 'zh' ? '完成' : 'Done'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

export default PlateTab;
