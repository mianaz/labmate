// ═══════════════════════════════════════════════
// Inventory — BoxGrid display component (JSX)
// ═══════════════════════════════════════════════
import React, { useState, useRef } from 'react';
import { t } from '../../i18n/index.js';
import { SAMPLE_TYPE_COLORS, SAMPLE_TYPE_LABELS, posLabel } from './inventoryUtils.js';

export { posLabel };

export function BoxGrid({ box, samples, onCellClick, lang, selectMode, selectedCells, onToggleSelect, onDragSelect }) {
  const dragStart = useRef(null);
  const [dragging, setDragging] = useState(false);

  if (!box) return null;

  const sampleMap = {};
  samples.forEach(s => { if (s.position) sampleMap[s.position] = s; });
  const occupied = Object.keys(sampleMap).length;
  const total = box.rows * box.cols;
  const cellSize = Math.max(24, Math.min(40, Math.floor(300 / Math.max(box.rows, box.cols))));

  const handleMouseDown = (r, c) => {
    if (!selectMode) return;
    dragStart.current = { r, c };
    setDragging(true);
  };

  const handleMouseUp = (r, c) => {
    if (!selectMode || !dragStart.current) return;
    if (dragStart.current.r === r && dragStart.current.c === c) {
      onToggleSelect && onToggleSelect(posLabel(r, c));
    } else {
      const r0 = Math.min(dragStart.current.r, r), r1 = Math.max(dragStart.current.r, r);
      const c0 = Math.min(dragStart.current.c, c), c1 = Math.max(dragStart.current.c, c);
      const positions = [];
      for (let ri = r0; ri <= r1; ri++)
        for (let ci = c0; ci <= c1; ci++)
          positions.push(posLabel(ri, ci));
      onDragSelect && onDragSelect(positions);
    }
    dragStart.current = null;
    setDragging(false);
  };

  const handleMouseEnter = (e, r, c) => {
    if (!selectMode || !dragging) {
      if (!selectMode) e.currentTarget.style.transform = 'scale(1.15)';
      return;
    }
  };

  // Build column headers
  const colHeaders = Array.from({ length: box.cols }, (_, c) => (
    <div
      key={'h' + c}
      className="text-center"
      style={{ color: 'var(--text-muted)', lineHeight: cellSize + 'px' }}
    >
      {c + 1}
    </div>
  ));

  // Build grid rows
  const gridRows = Array.from({ length: box.rows }, (_, r) => {
    const rowLabel = (
      <div
        key={'r' + r}
        className="flex items-center justify-center"
        style={{ color: 'var(--text-muted)', width: 20 }}
      >
        {String.fromCharCode(65 + r)}
      </div>
    );

    const cells = Array.from({ length: box.cols }, (_, c) => {
      const pos = posLabel(r, c);
      const sample = sampleMap[pos];
      const colors = sample ? (SAMPLE_TYPE_COLORS[sample.sampleType] || SAMPLE_TYPE_COLORS.other) : null;
      const isSelected = selectMode && selectedCells && selectedCells.has(pos);
      const isExpired = sample && sample.expiryDate && new Date(sample.expiryDate).getTime() < Date.now();

      return (
        <div
          key={pos}
          onClick={() => { if (!selectMode) onCellClick(pos, sample); }}
          onMouseDown={() => handleMouseDown(r, c)}
          onMouseUp={() => handleMouseUp(r, c)}
          onMouseEnter={e => handleMouseEnter(e, r, c)}
          onMouseLeave={e => { if (!selectMode) e.currentTarget.style.transform = 'scale(1)'; }}
          title={sample ? (sample.name + ' (' + pos + ')' + (isExpired ? ' — Expired' : '')) : pos}
          style={{
            width: cellSize,
            height: cellSize,
            borderRadius: 4,
            cursor: selectMode ? 'crosshair' : 'pointer',
            background: isSelected ? 'var(--primary)' : sample ? colors.bg : 'var(--bg-2)',
            border: isSelected
              ? '2px solid var(--primary)'
              : isExpired
                ? '2px solid hsl(0,70%,55%)'
                : sample
                  ? '2px solid ' + colors.text + '33'
                  : '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: isSelected ? '#fff' : sample ? colors.text : 'var(--text-muted)',
            fontWeight: sample ? 600 : 400,
            fontSize: cellSize > 30 ? '9px' : '8px',
            textShadow: sample ? '0 0 2px rgba(255,255,255,0.4)' : 'none',
            transition: 'transform 0.1s, background 0.1s',
            position: 'relative',
          }}
        >
          {isSelected ? '✓' : sample ? sample.name.slice(0, cellSize >= 36 ? 5 : 3) : ''}
        </div>
      );
    });

    return [rowLabel, ...cells];
  }).flat();

  // Legend — only show types that are present
  const legendTypes = Object.entries(SAMPLE_TYPE_COLORS).filter(
    ([type]) => samples.some(s => s.sampleType === type)
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
            {lang === 'zh' ? (box.nameZh || box.name) : box.name}
          </span>
          {box.color && (
            <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: box.color }} />
          )}
        </div>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {occupied + '/' + total + ' ' + t('invOccupied', lang) + ' · ' + (total - occupied) + ' ' + t('invEmpty', lang)}
        </span>
      </div>

      {/* Grid */}
      <div style={{ overflowX: 'auto', userSelect: selectMode ? 'none' : 'auto' }}>
        <div
          style={{
            display: 'inline-grid',
            gridTemplateColumns: 'auto repeat(' + box.cols + ', ' + cellSize + 'px)',
            gap: '2px',
            fontSize: '10px',
          }}
        >
          <div />{/* empty top-left corner */}
          {colHeaders}
          {gridRows}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3">
        {legendTypes.map(([type, colors]) => (
          <span
            key={type}
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: colors.bg, color: colors.text, fontWeight: 500 }}
          >
            {t(SAMPLE_TYPE_LABELS[type], lang)}
          </span>
        ))}
      </div>

      {/* Hint */}
      {!selectMode && (
        <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
          {t('invClickToAdd', lang)}
        </p>
      )}
    </div>
  );
}
