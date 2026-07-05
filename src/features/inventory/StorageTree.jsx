// ═══════════════════════════════════════════════
// Inventory — StorageTree navigation (JSX)
// ═══════════════════════════════════════════════
import React, { useState } from 'react';
import { t } from '../../i18n/index.js';
import { StorageIcon } from './InventoryComponents.jsx';
import { invBtnStyle, invBtnSecStyle } from './inventoryUtils.js';

export function StorageTree({
  data, selectedBoxId, onSelectBox,
  onAddLocation, onEditLocation, onDeleteLocation,
  onAddBox, onEditBox, onDeleteBox, lang,
}) {
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  const [hovered, setHovered] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  return (
    <div>
      {/* Top buttons */}
      <div className="flex items-center gap-1 mb-3 flex-wrap">
        <span
          className="text-sm font-semibold flex-1"
          style={{ color: 'var(--text)', fontFamily: 'var(--font-heading)' }}
        >
          {t('invStorageTree', lang)}
        </span>
        <button
          onClick={onAddLocation}
          style={{ ...invBtnStyle, padding: '4px 8px', fontSize: '11px' }}
        >
          {'+ ' + t('invAddLocation', lang)}
        </button>
        <button
          onClick={() => {
            const locId = data.locations.length > 0 ? data.locations[0].id : null;
            if (locId) onAddBox(locId); else onAddLocation();
          }}
          style={{ ...invBtnSecStyle, padding: '4px 8px', fontSize: '11px' }}
          title={lang === 'en' ? 'Add Box (hover a location to pick it)' : '添加盒子'}
        >
          {'+ ' + t('invAddBox', lang)}
        </button>
      </div>

      {/* Empty state */}
      {data.locations.length === 0 && (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>
          {t('invAddLocation', lang)}
        </p>
      )}

      {/* Location tree */}
      {data.locations.map(loc => {
        const boxes = data.boxes.filter(b => b.locationId === loc.id);
        const isExp = expanded[loc.id] !== false;

        return (
          <div key={loc.id} className="mb-1">
            {/* Location row */}
            <div
              className="flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer text-sm"
              style={{
                background: hovered === 'loc-' + loc.id ? 'var(--bg-2)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onClick={() => toggle(loc.id)}
              onMouseEnter={() => setHovered('loc-' + loc.id)}
              onMouseLeave={() => setHovered(null)}
            >
              <span
                className="text-xs"
                style={{
                  color: 'var(--text-muted)',
                  transform: isExp ? 'rotate(90deg)' : 'none',
                  transition: 'transform 0.15s',
                  display: 'inline-block',
                }}
              >
                ▶
              </span>
              <StorageIcon type={loc.type} size={14} />
              <span className="flex-1 font-medium" style={{ color: 'var(--text)' }}>
                {lang === 'zh' ? (loc.nameZh || loc.name) : loc.name}
              </span>
              {loc.temperature && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ background: 'var(--bg-2)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                >
                  {loc.temperature}
                </span>
              )}
              {hovered === 'loc-' + loc.id && (
                <>
                  <button
                    onClick={e => { e.stopPropagation(); onEditLocation(loc); }}
                    className="text-xs px-1"
                    style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                    title={t('invEditLocation', lang)}
                  >
                    ✎
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); onAddBox(loc.id); }}
                    className="text-xs px-1"
                    style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                    title={t('invAddBox', lang)}
                  >
                    +
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirmDel === 'loc-' + loc.id) {
                        onDeleteLocation(loc.id);
                        setConfirmDel(null);
                      } else {
                        setConfirmDel('loc-' + loc.id);
                      }
                    }}
                    className="text-xs px-1"
                    style={{ color: 'var(--danger-text)', background: 'none', border: 'none', cursor: 'pointer' }}
                    title={confirmDel === 'loc-' + loc.id ? t('invConfirm', lang) : t('invDeleteLocation', lang)}
                  >
                    {confirmDel === 'loc-' + loc.id ? '!!' : '✕'}
                  </button>
                </>
              )}
            </div>

            {/* Boxes under this location */}
            {isExp && boxes.map(box => {
              const sampleCount = data.samples.filter(s => s.boxId === box.id).length;
              const totalSlots = box.rows * box.cols;

              return (
                <div
                  key={box.id}
                  className="flex items-center gap-1 pl-7 pr-2 py-1 rounded-lg cursor-pointer text-sm"
                  style={{
                    background: selectedBoxId === box.id
                      ? 'var(--primary-light)'
                      : hovered === 'box-' + box.id ? 'var(--bg-2)' : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => onSelectBox(box.id)}
                  onMouseEnter={() => setHovered('box-' + box.id)}
                  onMouseLeave={() => setHovered(null)}
                >
                  {box.color ? (
                    <span style={{
                      display: 'inline-block', width: 8, height: 8,
                      borderRadius: 0, background: box.color, flexShrink: 0,
                    }} />
                  ) : (
                    <svg
                      width={14} height={14} viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth={2}
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <rect x={3} y={3} width={18} height={18} rx={2} />
                      <line x1={3} y1={9} x2={21} y2={9} />
                      <line x1={9} y1={3} x2={9} y2={21} />
                    </svg>
                  )}
                  <span
                    className="flex-1"
                    style={{ color: selectedBoxId === box.id ? 'var(--primary)' : 'var(--text)' }}
                  >
                    {lang === 'zh' ? (box.nameZh || box.name) : box.name}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
                  >
                    {sampleCount + '/' + totalSlots}
                  </span>
                  {hovered === 'box-' + box.id && (
                    <>
                      <button
                        onClick={e => { e.stopPropagation(); onEditBox(box); }}
                        className="text-xs px-1"
                        style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        ✎
                      </button>
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          if (confirmDel === 'box-' + box.id) {
                            onDeleteBox(box.id);
                            setConfirmDel(null);
                          } else {
                            setConfirmDel('box-' + box.id);
                          }
                        }}
                        className="text-xs px-1"
                        style={{ color: 'var(--danger-text)', background: 'none', border: 'none', cursor: 'pointer' }}
                      >
                        {confirmDel === 'box-' + box.id ? '!!' : '✕'}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
