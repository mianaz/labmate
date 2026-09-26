// ═══════════════════════════════════════════════
// Inventory — StorageTree navigation (JSX)
// ═══════════════════════════════════════════════
// Locations (collapsible) → boxes, as compact rows inside a .panel. Row actions
// (edit / delete) are revealed on hover or keyboard focus on pointer devices and
// always shown on touch. Deletes are two-step (Confirm).
import { useState, useMemo } from 'react';
import { t } from '../../i18n/index.js';
import { IconBox, IconChevronRight, IconEdit, IconTrash, IconPlus, IconClose } from '../../components/icons.jsx';
import { StorageIcon } from './InventoryComponents.jsx';
import { useIsMobile, useMediaQuery } from '../../hooks/useMediaQuery.js';

export function StorageTree({
  data, selectedBoxId, onSelectBox,
  onEditLocation, onDeleteLocation,
  onAddBox, onEditBox, onDeleteBox, lang,
  className = '', bodyClassName = '',
}) {
  const isMobile = useIsMobile();
  const canHover = useMediaQuery('(hover: hover) and (pointer: fine)');
  const [expanded, setExpanded] = useState({});
  const toggle = (id) => setExpanded(prev => ({ ...prev, [id]: prev[id] === false }));
  // Index once per data change instead of filtering boxes per location and
  // samples per box inside render.
  const boxesByLocation = useMemo(() => {
    const m = new Map();
    for (const b of data.boxes) { const arr = m.get(b.locationId); if (arr) arr.push(b); else m.set(b.locationId, [b]); }
    return m;
  }, [data.boxes]);
  const sampleCountByBox = useMemo(() => {
    const m = new Map();
    for (const s of data.samples) m.set(s.boxId, (m.get(s.boxId) || 0) + 1);
    return m;
  }, [data.samples]);
  const [confirmDel, setConfirmDel] = useState(null);

  const rowH = isMobile ? 44 : 36;
  const boxRowH = isMobile ? 44 : 34;
  const name = (o) => (lang === 'zh' ? (o.nameZh || o.name) : o.name);

  // Edit / delete controls. On phones and touch screens they sit in the row and
  // are always visible. With a mouse they overlay the row's right edge (so names
  // keep their full width) and appear on hover or keyboard focus.
  const inlineActions = isMobile || !canHover;
  const rowActions = (key, { onEdit, editLabel, onDelete, deleteLabel }, overlayBg) => {
    const confirming = confirmDel === key;
    const cls = inlineActions
      ? 'flex shrink-0 items-center gap-0.5 pr-1.5'
      : 'absolute inset-y-0 right-0 flex items-center gap-0.5 pl-1 pr-1.5' + (confirming ? '' : ' opacity-0 group-hover:opacity-100 focus-within:opacity-100');
    return (
      <div className={cls} style={inlineActions ? undefined : { background: overlayBg }}>
        {confirming ? (
          <>
            <button type="button" className="btn-danger btn-sm" style={{ minHeight: 26, padding: '0 0.5rem' }}
              onClick={() => { onDelete(); setConfirmDel(null); }} title={deleteLabel}>
              {t('invConfirm', lang)}
            </button>
            <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => setConfirmDel(null)}
              aria-label={t('invCancel', lang)} title={t('invCancel', lang)}>
              <IconClose size={14} />
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn-ghost btn-icon btn-sm" onClick={onEdit} aria-label={editLabel} title={editLabel}>
              <IconEdit size={14} />
            </button>
            <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => setConfirmDel(key)} aria-label={deleteLabel} title={deleteLabel}>
              <IconTrash size={14} />
            </button>
          </>
        )}
      </div>
    );
  };

  return (
    <section className={'panel ' + className} aria-labelledby="inv-storage-title">
      <div className="panel-head">
        <h2 id="inv-storage-title" className="panel-title">{t('invStorageTree', lang)}</h2>
      </div>

      <ul className={'py-1 ' + bodyClassName}>
        {data.locations.map((loc, li) => {
          const boxes = boxesByLocation.get(loc.id) || [];
          const isExp = expanded[loc.id] !== false;
          const locKey = 'loc-' + loc.id;

          return (
            <li key={loc.id} style={li > 0 ? { borderTop: '1px solid var(--rule)', marginTop: 4, paddingTop: 4 } : undefined}>
              {/* Location row */}
              <div className="group relative flex items-center hover:bg-[var(--bg-2)] focus-within:bg-[var(--bg-2)]" style={{ minHeight: rowH }}>
                <button
                  type="button"
                  onClick={() => toggle(loc.id)}
                  aria-expanded={isExp}
                  className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left"
                  style={{ background: 'transparent', border: 0, padding: inlineActions ? '0 0.25rem 0 0.625rem' : '0 0.75rem 0 0.625rem', color: 'var(--text)' }}
                >
                  <IconChevronRight size={12} className="shrink-0" style={{
                    color: 'var(--text-muted)', transform: isExp ? 'rotate(90deg)' : 'none',
                    transition: 'transform var(--duration-fast) ease',
                  }} />
                  <StorageIcon type={loc.type} size={16} className="shrink-0" style={{ color: 'var(--text-muted)' }} />
                  <span className="min-w-0 truncate" style={{ fontSize: '0.8125rem', fontWeight: 600, flexShrink: 1 }}>{name(loc)}</span>
                  {loc.temperature && (
                    // The temperature gives way before the name does.
                    <span className="mono min-w-0 truncate whitespace-nowrap" title={loc.temperature}
                      style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', flexShrink: 6 }}>
                      {loc.temperature}
                    </span>
                  )}
                </button>
                {rowActions(locKey, {
                  onEdit: () => onEditLocation(loc), editLabel: t('invEditLocation', lang),
                  onDelete: () => onDeleteLocation(loc.id), deleteLabel: t('invDeleteLocation', lang),
                }, 'var(--bg-2)')}
              </div>

              {/* Boxes under this location */}
              {isExp && (
                <ul>
                  {boxes.map(box => {
                    const count = sampleCountByBox.get(box.id) || 0;
                    const totalSlots = box.rows * box.cols;
                    const selected = selectedBoxId === box.id;
                    return (
                      <li
                        key={box.id}
                        className={'group relative flex items-center' + (selected ? '' : ' hover:bg-[var(--bg-2)] focus-within:bg-[var(--bg-2)]')}
                        style={{ minHeight: boxRowH, background: selected ? 'var(--primary-light)' : undefined }}
                      >
                        {selected && <span aria-hidden="true" className="absolute left-0 top-0 bottom-0" style={{ width: 3, background: 'var(--primary)' }} />}
                        <button
                          type="button"
                          onClick={() => onSelectBox(box.id)}
                          aria-current={selected ? 'true' : undefined}
                          className="flex min-w-0 flex-1 items-center gap-2 self-stretch text-left"
                          style={{ background: 'transparent', border: 0, padding: inlineActions ? '0 0.25rem 0 1.875rem' : '0 0.75rem 0 1.875rem', color: 'var(--text)' }}
                        >
                          <span className="flex shrink-0 items-center justify-center" style={{ width: 16, height: 16 }}>
                            {box.color
                              ? <span style={{ width: 10, height: 10, background: box.color, border: '1px solid var(--border-strong)' }} />
                              : <IconBox size={15} style={{ color: selected ? 'var(--accent)' : 'var(--text-muted)' }} />}
                          </span>
                          <span className="min-w-0 truncate" style={{ fontSize: '0.8125rem', fontWeight: selected ? 600 : 500 }}>{name(box)}</span>
                          <span className="mono tabular ml-auto shrink-0 pl-1" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                            {count + '/' + totalSlots}
                          </span>
                        </button>
                        {rowActions('box-' + box.id, {
                          onEdit: () => onEditBox(box), editLabel: t('invEditBox', lang),
                          onDelete: () => onDeleteBox(box.id), deleteLabel: t('invDeleteBox', lang),
                        }, selected ? 'var(--primary-light)' : 'var(--bg-2)')}
                      </li>
                    );
                  })}
                  <li>
                    <button
                      type="button"
                      onClick={() => onAddBox(loc.id)}
                      className="flex w-full items-center gap-2 text-left text-[var(--text-muted)] hover:bg-[var(--bg-2)] hover:text-[var(--text)]"
                      style={{ minHeight: isMobile ? 40 : 30, background: 'transparent', border: 0, padding: '0 0.625rem 0 1.875rem', fontSize: '0.75rem', fontWeight: 500 }}
                    >
                      <span className="flex shrink-0 items-center justify-center" style={{ width: 16 }}><IconPlus size={13} /></span>
                      {t('invAddBox', lang)}
                    </button>
                  </li>
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
