// ═══════════════════════════════════════════════
// Inventory — BoxGrid display component (JSX)
// ═══════════════════════════════════════════════
// A square position grid sized to its container (cells 24–44px; narrower
// containers scroll horizontally). Occupied positions are tinted with the
// sample-type colours, empty ones are hairline squares, the active sample is
// outlined in --primary. Cells are buttons with a roving tabindex (arrow keys
// move between positions). Select mode keeps click / drag / touch-drag range
// selection.
import { useState, useRef, useEffect } from 'react';
import { t } from '../../i18n/index.js';
import { IconCheck } from '../../components/icons.jsx';
import { SAMPLE_TYPE_COLORS, SAMPLE_TYPE_LABELS, posLabel } from './inventoryUtils.js';

export { posLabel };

const LABEL = 18;   // row-label column width / column-label row height (px)
const GAP = 3;      // gap between cells (px)
const PAD = 4;      // room for the active cell's outline inside the scroll box

function daysUntil(ts) {
  if (!ts) return null;
  return Math.ceil((new Date(ts).getTime() - Date.now()) / 86400000);
}

export function BoxGrid({
  box, samples, onCellClick, onCellOpen, lang, selectMode, selectedCells, onToggleSelect, onDragSelect,
  activePos, minCell = 24, maxCell = 44, compact = false, hint,
}) {
  const dragStart = useRef(null);
  const lastTouch = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const [wrapEl, setWrapEl] = useState(null);
  const [avail, setAvail] = useState(0);
  const [focusRC, setFocusRC] = useState(null);

  // Measure the available width so the grid fills its panel.
  useEffect(() => {
    if (!wrapEl) return undefined;
    const measure = () => setAvail(wrapEl.clientWidth);
    measure();
    if (typeof window.ResizeObserver !== 'function') return undefined;
    const ro = new window.ResizeObserver(measure);
    ro.observe(wrapEl);
    return () => ro.disconnect();
  }, [wrapEl]);

  // A drag released outside the grid is abandoned.
  useEffect(() => {
    if (!dragging) return undefined;
    const cancel = () => { dragStart.current = null; setDragging(false); setDragOver(null); };
    window.addEventListener('mouseup', cancel);
    return () => window.removeEventListener('mouseup', cancel);
  }, [dragging]);

  if (!box) return null;

  const rows = box.rows, cols = box.cols;
  const sampleMap = {};
  samples.forEach(s => { if (s.position) sampleMap[s.position] = s; });
  const occupied = Object.keys(sampleMap).length;
  const total = rows * cols;

  const fit = avail > 0 ? Math.floor((avail - 2 * PAD - LABEL - GAP * cols) / cols) : 30;
  const cell = Math.max(minCell, Math.min(maxCell, fit));
  const chars = cell >= 40 ? 5 : cell >= 32 ? 4 : cell >= 24 ? 3 : 0;
  const cellFont = cell >= 36 ? 10 : 9;
  const gridWidth = 2 * PAD + LABEL + cols * (cell + GAP);

  const rangePositions = (a, b) => {
    const r0 = Math.min(a.r, b.r), r1 = Math.max(a.r, b.r);
    const c0 = Math.min(a.c, b.c), c1 = Math.max(a.c, b.c);
    const positions = [];
    for (let ri = r0; ri <= r1; ri++)
      for (let ci = c0; ci <= c1; ci++)
        positions.push(posLabel(ri, ci));
    return positions;
  };

  // ── Mouse drag-select ──
  const handleMouseDown = (r, c) => {
    if (!selectMode || Date.now() - lastTouch.current < 800) return;
    dragStart.current = { r, c };
    setDragging(true);
    setDragOver({ r, c });
  };

  const handleMouseUp = (r, c) => {
    if (!selectMode || !dragStart.current || Date.now() - lastTouch.current < 800) return;
    if (dragStart.current.r === r && dragStart.current.c === c) {
      onToggleSelect && onToggleSelect(posLabel(r, c));
    } else {
      onDragSelect && onDragSelect(rangePositions(dragStart.current, { r, c }));
    }
    dragStart.current = null;
    setDragging(false);
    setDragOver(null);
  };

  const handleMouseEnter = (r, c) => {
    if (selectMode && dragging) setDragOver({ r, c });
  };

  // ── Touch drag-select (mirrors the mouse handlers above for touchscreens) ──
  // Touch events stay targeted to the cell where the gesture started, so we
  // resolve the *current* finger position via elementFromPoint + data attrs.
  // Browsers follow a tap with emulated mouse events; lastTouch makes the
  // mouse handlers ignore those so a tap toggles a cell exactly once.
  const handleTouchStart = (r, c) => {
    if (!selectMode) return;
    lastTouch.current = Date.now();
    dragStart.current = { r, c };
    setDragging(true);
    setDragOver({ r, c });
  };

  const cellAtTouchPoint = (touch) => {
    if (!touch || typeof document.elementFromPoint !== 'function') return null;
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cellEl = el && el.closest ? el.closest('[data-cell-row]') : null;
    if (!cellEl) return null;
    const r = parseInt(cellEl.dataset.cellRow, 10);
    const c = parseInt(cellEl.dataset.cellCol, 10);
    if (Number.isNaN(r) || Number.isNaN(c)) return null;
    return { r, c };
  };

  const handleTouchMove = (e) => {
    if (!selectMode || !dragStart.current) return;
    // Keep the drag gesture from scrolling the page/grid while selecting.
    if (e.cancelable) e.preventDefault();
    const over = cellAtTouchPoint(e.touches && e.touches[0]);
    if (over) setDragOver(over);
  };

  const handleTouchEnd = (e) => {
    if (!selectMode || !dragStart.current) return;
    lastTouch.current = Date.now();
    const end = cellAtTouchPoint(e.changedTouches && e.changedTouches[0]) || dragStart.current;
    if (dragStart.current.r === end.r && dragStart.current.c === end.c) {
      onToggleSelect && onToggleSelect(posLabel(end.r, end.c));
    } else {
      onDragSelect && onDragSelect(rangePositions(dragStart.current, end));
    }
    dragStart.current = null;
    setDragging(false);
    setDragOver(null);
  };

  // ── Click / keyboard ──
  const handleClick = (e, pos, sample) => {
    if (selectMode) {
      // Keyboard activation (Enter/Space) has no pointer events: toggle here.
      if (e.detail === 0) onToggleSelect && onToggleSelect(pos);
      return;
    }
    onCellClick(pos, sample);
  };

  const handleKeyDown = (e) => {
    const cellEl = e.target && e.target.closest ? e.target.closest('[data-cell-row]') : null;
    if (!cellEl) return;
    let r = parseInt(cellEl.dataset.cellRow, 10);
    let c = parseInt(cellEl.dataset.cellCol, 10);
    switch (e.key) {
      case 'ArrowUp': r -= 1; break;
      case 'ArrowDown': r += 1; break;
      case 'ArrowLeft': c -= 1; break;
      case 'ArrowRight': c += 1; break;
      case 'Home': c = 0; break;
      case 'End': c = cols - 1; break;
      default: return;
    }
    e.preventDefault();
    r = Math.max(0, Math.min(rows - 1, r));
    c = Math.max(0, Math.min(cols - 1, c));
    const next = e.currentTarget.querySelector('[data-cell-row="' + r + '"][data-cell-col="' + c + '"]');
    if (next) next.focus();
  };

  // Roving tabindex target: last focused cell, else the active sample, else A1.
  let tabRC = { r: 0, c: 0 };
  if (focusRC && focusRC.r < rows && focusRC.c < cols) tabRC = focusRC;
  else if (activePos) {
    const r = activePos.charCodeAt(0) - 65, c = parseInt(activePos.slice(1), 10) - 1;
    if (r >= 0 && r < rows && c >= 0 && c < cols) tabRC = { r, c };
  }

  const inDrag = (r, c) => {
    if (!dragging || !dragStart.current || !dragOver) return false;
    const a = dragStart.current, b = dragOver;
    return r >= Math.min(a.r, b.r) && r <= Math.max(a.r, b.r) && c >= Math.min(a.c, b.c) && c <= Math.max(a.c, b.c);
  };

  const emptyWord = t('invEmpty', lang);
  const expiredWord = t('expired', lang);
  const labelStyle = { fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', lineHeight: 1 };

  const colHeaders = Array.from({ length: cols }, (_, c) => (
    <span key={'h' + c} aria-hidden="true" className="flex items-end justify-center tabular" style={labelStyle}>{c + 1}</span>
  ));

  const gridRows = Array.from({ length: rows }, (_, r) => {
    const rowLabel = (
      <span key={'r' + r} aria-hidden="true" className="flex items-center justify-center" style={labelStyle}>
        {String.fromCharCode(65 + r)}
      </span>
    );

    const cells = Array.from({ length: cols }, (_, c) => {
      const pos = posLabel(r, c);
      const sample = sampleMap[pos];
      const colors = sample ? (SAMPLE_TYPE_COLORS[sample.sampleType] || SAMPLE_TYPE_COLORS.other) : null;
      const isSelected = !!(selectMode && selectedCells && selectedCells.has(pos));
      const isActive = !selectMode && activePos === pos;
      const du = sample ? daysUntil(sample.expiryDate) : null;
      const isExpired = du !== null && du < 0;
      const preview = selectMode && !isSelected && inDrag(r, c);
      const typeLabel = sample ? t(SAMPLE_TYPE_LABELS[sample.sampleType] || SAMPLE_TYPE_LABELS.other, lang) : '';

      let background = 'transparent', border = 'color-mix(in srgb, var(--border) 55%, transparent)', color = 'var(--text-muted)';
      if (sample) { background = colors.bg; border = 'color-mix(in srgb, ' + colors.text + ' 45%, transparent)'; color = colors.text; }
      if (isSelected) { background = 'var(--primary)'; border = 'var(--border-strong)'; color = 'var(--on-primary)'; }

      return (
        <button
          type="button"
          key={pos}
          data-cell-row={r}
          data-cell-col={c}
          tabIndex={tabRC.r === r && tabRC.c === c ? 0 : -1}
          aria-label={pos + ': ' + (sample ? sample.name + ' (' + typeLabel + ')' + (isExpired ? ', ' + expiredWord : '') : emptyWord)}
          aria-pressed={selectMode ? isSelected : undefined}
          aria-current={isActive ? 'true' : undefined}
          title={sample ? (sample.name + ' (' + pos + ')' + (isExpired ? ' — ' + expiredWord : '')) : pos}
          onClick={e => handleClick(e, pos, sample)}
          onDoubleClick={() => { if (!selectMode && sample && onCellOpen) onCellOpen(pos, sample); }}
          onMouseDown={() => handleMouseDown(r, c)}
          onMouseUp={() => handleMouseUp(r, c)}
          onMouseEnter={() => handleMouseEnter(r, c)}
          onTouchStart={() => handleTouchStart(r, c)}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onFocus={() => setFocusRC({ r, c })}
          className="relative flex items-center justify-center overflow-hidden p-0 hover:shadow-[inset_0_0_0_1px_var(--text)]"
          style={{
            width: '100%', height: '100%', minWidth: 0,
            background,
            border: '1px solid ' + border,
            color,
            fontFamily: 'var(--font-mono)',
            fontSize: cellFont,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            cursor: selectMode ? 'crosshair' : 'pointer',
            touchAction: selectMode ? 'none' : 'manipulation',
            outline: isActive ? '2px solid var(--primary)' : undefined,
            outlineOffset: isActive ? 1 : undefined,
            zIndex: isActive ? 1 : undefined,
            boxShadow: preview ? 'inset 0 0 0 2px var(--primary)' : undefined,
            transition: 'background-color var(--duration-fast) ease, box-shadow var(--duration-fast) ease',
          }}
        >
          {isSelected
            ? <IconCheck size={Math.min(14, cell - 10)} strokeWidth={2.25} />
            : sample && chars > 0 ? <span className="truncate px-px">{sample.name.slice(0, chars)}</span> : null}
          {isExpired && !isSelected && (
            <span aria-hidden="true" style={{
              position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid',
              borderWidth: '0 7px 7px 0', borderColor: 'transparent var(--danger-border) transparent transparent',
            }} />
          )}
        </button>
      );
    });

    return [rowLabel, ...cells];
  }).flat();

  // Legend — types present in this box, with counts.
  const typeCounts = {};
  samples.forEach(s => { const tp = SAMPLE_TYPE_COLORS[s.sampleType] ? s.sampleType : 'other'; typeCounts[tp] = (typeCounts[tp] || 0) + 1; });
  const legendTypes = Object.keys(SAMPLE_TYPE_COLORS).filter(tp => typeCounts[tp]);
  const anyExpired = samples.some(s => { const du = daysUntil(s.expiryDate); return du !== null && du < 0; });
  const legendText = { fontFamily: 'var(--font-mono)', fontSize: '0.6875rem', color: 'var(--text-muted)' };
  const swatch = { width: 10, height: 10, flexShrink: 0, display: 'inline-block' };

  return (
    <div>
      <div ref={setWrapEl} className="overflow-x-auto" style={{ userSelect: selectMode ? 'none' : undefined, WebkitUserSelect: selectMode ? 'none' : undefined, }}>
        <div
          role="group"
          aria-label={(lang === 'zh' ? (box.nameZh || box.name) : box.name) + ' · ' + rows + ' × ' + cols}
          onKeyDown={handleKeyDown}
          style={{
            display: 'grid',
            gridTemplateColumns: LABEL + 'px repeat(' + cols + ', ' + cell + 'px)',
            gridTemplateRows: LABEL + 'px',
            gridAutoRows: cell + 'px',
            gap: GAP,
            width: 'max-content',
            margin: '0 auto',
            padding: PAD,
          }}
        >
          <span aria-hidden="true" />
          {colHeaders}
          {gridRows}
        </div>
      </div>

      {!compact && (
        // Legend + hint start under column 1 of the (centred) grid.
        <div style={{ maxWidth: gridWidth, margin: '0 auto', paddingLeft: PAD + LABEL + GAP, paddingRight: PAD }}>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {legendTypes.map(tp => {
            const c = SAMPLE_TYPE_COLORS[tp];
            return (
              <span key={tp} className="inline-flex items-center gap-1.5" style={legendText}>
                <span style={{ ...swatch, background: c.bg, border: '1px solid color-mix(in srgb, ' + c.text + ' 45%, transparent)' }} />
                {t(SAMPLE_TYPE_LABELS[tp], lang)}
                <span className="tabular" style={{ color: 'var(--text)' }}>{typeCounts[tp]}</span>
              </span>
            );
          })}
          <span className="inline-flex items-center gap-1.5" style={legendText}>
            <span style={{ ...swatch, border: '1px solid color-mix(in srgb, var(--border) 55%, transparent)' }} />
            {lang === 'zh' ? '空位' : 'Empty'}
            <span className="tabular" style={{ color: 'var(--text)' }}>{total - occupied}</span>
          </span>
          {anyExpired && (
            <span className="inline-flex items-center gap-1.5" style={legendText}>
              <span style={{ ...swatch, position: 'relative', border: '1px solid var(--rule)' }}>
                <span style={{ position: 'absolute', top: 0, right: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 6px 6px 0', borderColor: 'transparent var(--danger-border) transparent transparent' }} />
              </span>
              {expiredWord}
            </span>
          )}
        </div>
        {hint && <p className="mt-2" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.45 }}>{hint}</p>}
        </div>
      )}
    </div>
  );
}
