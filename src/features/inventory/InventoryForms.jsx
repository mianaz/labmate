// ═══════════════════════════════════════════════
// Inventory — Form components (JSX)
// ═══════════════════════════════════════════════
import { useState, useEffect, useMemo, useId } from 'react';
import { t } from '../../i18n/index.js';
import { IconTrash, IconCopy, IconArrowRight, IconUpload, IconDownload, IconFile, IconLayers } from '../../components/icons.jsx';
import { InvModal, InvInput, InvSelect, InvTextarea } from './InventoryComponents.jsx';
import { BoxGrid } from './BoxGrid.jsx';
import {
  STORAGE_TYPE_LABELS, BOX_CONFIGS, BOX_TYPE_LABELS,
  SAMPLE_TYPE_LABELS, parseTags, posLabel,
} from './inventoryUtils.js';

// Preset colour labels for boxes (value stays a plain hex string, '' = none).
const BOX_COLORS = ['#16B364', '#0B6E63', '#1D5FD6', '#5B3FA8', '#9D174D', '#C42B1C', '#C2410C', '#7A5E00', '#57534A'];

const posBadge = (pos) => (pos ? <span className="badge" style={{ '--badge-fg': 'var(--text)' }}>{pos}</span> : null);

// ── LocationForm ─────────────────────────────────────────────────────────────

export function LocationForm({ open, onClose, onSave, initial, lang }) {
  const [form, setForm] = useState({ name: '', nameZh: '', type: 'freezer', temperature: '-80°C' });

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || '',
        nameZh: initial.nameZh || '',
        type: initial.type || 'freezer',
        temperature: initial.temperature || '',
      });
    } else {
      setForm({ name: '', nameZh: '', type: 'freezer', temperature: '-80°C' });
    }
  }, [initial, open]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const submit = () => { if (form.name) onSave(form); };

  return (
    <InvModal
      open={open} onClose={onClose} onSubmit={submit} size="sm"
      title={initial ? t('invEditLocation', lang) : t('invAddLocation', lang)}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>{t('invCancel', lang)}</button>
        <button type="submit" className="btn-primary" disabled={!form.name}>{t('invSave', lang)}</button>
      </>}
    >
      <InvInput label={t('invName', lang)} value={form.name} onChange={v => set('name', v)} autoFocus
        placeholder={lang === 'zh' ? '如 Freezer A' : 'e.g. Freezer A'} />
      <InvInput label={t('invNameZh', lang)} value={form.nameZh} onChange={v => set('nameZh', v)} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InvSelect
          label={t('invLocationType', lang)}
          value={form.type}
          onChange={v => set('type', v)}
          options={Object.entries(STORAGE_TYPE_LABELS).map(([val, lbl]) => ({ value: val, label: t(lbl, lang) }))}
        />
        <InvSelect
          label={t('invTemperature', lang)}
          value={form.temperature}
          onChange={v => set('temperature', v)}
          options={[
            { value: '', label: '—' },
            { value: 'RT', label: 'RT (Room Temp)' },
            { value: '4°C', label: '4°C' },
            { value: '-20°C', label: '-20°C' },
            { value: '-80°C', label: '-80°C' },
            { value: '-196°C (LN₂)', label: '-196°C (LN₂)' },
            { value: '37°C', label: '37°C' },
            { value: '4°F (freezer)', label: '4°F (freezer)' },
            { value: '-4°F', label: '-4°F' },
            { value: '-112°F', label: '-112°F' },
          ]}
        />
      </div>
    </InvModal>
  );
}

// ── BoxForm ──────────────────────────────────────────────────────────────────

export function BoxForm({ open, onClose, onSave, initial, lang, locationName }) {
  const [form, setForm] = useState({ name: '', nameZh: '', boxType: 'cryo_81', rows: 9, cols: 9, color: '' });
  const colorLabelId = useId();

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || '',
        nameZh: initial.nameZh || '',
        boxType: initial.boxType || 'cryo_81',
        rows: initial.rows || 9,
        cols: initial.cols || 9,
        color: initial.color || '',
      });
    } else {
      setForm({ name: '', nameZh: '', boxType: 'cryo_81', rows: 9, cols: 9, color: '' });
    }
  }, [initial, open]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleTypeChange = (v) => {
    const cfg = BOX_CONFIGS.find(c => c.type === v) || { rows: 8, cols: 8 };
    setForm(prev => ({ ...prev, boxType: v, rows: cfg.rows, cols: cfg.cols }));
  };
  const submit = () => { if (form.name) onSave(form); };

  return (
    <InvModal
      open={open} onClose={onClose} onSubmit={submit} size="sm"
      title={initial ? t('invEditBox', lang) : t('invAddBox', lang)}
      meta={!initial && locationName ? <span className="mono truncate" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{'→ ' + locationName}</span> : null}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>{t('invCancel', lang)}</button>
        <button type="submit" className="btn-primary" disabled={!form.name}>{t('invSave', lang)}</button>
      </>}
    >
      <InvInput label={t('invName', lang)} value={form.name} onChange={v => set('name', v)} autoFocus
        placeholder={lang === 'zh' ? '如 细胞系 1 号盒' : 'e.g. Cell lines — Box 1'} />
      <InvInput label={t('invNameZh', lang)} value={form.nameZh} onChange={v => set('nameZh', v)} />
      <InvSelect
        label={t('invBoxType', lang)}
        value={form.boxType}
        onChange={handleTypeChange}
        options={BOX_CONFIGS.map(c => ({ value: c.type, label: t(BOX_TYPE_LABELS[c.type], lang) }))}
      />
      {form.boxType === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <InvInput
            label={t('invRows', lang)}
            value={form.rows}
            onChange={v => set('rows', Math.max(1, Math.min(26, parseInt(v) || 1)))}
            type="number" min={1} max={26}
          />
          <InvInput
            label={t('invCols', lang)}
            value={form.cols}
            onChange={v => set('cols', Math.max(1, Math.min(50, parseInt(v) || 1)))}
            type="number" min={1} max={50}
          />
        </div>
      )}
      <p className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
        {form.rows + ' × ' + form.cols + ' = ' + (form.rows * form.cols) + (lang === 'zh' ? ' 个孔位' : ' positions')}
        {' · A1–' + posLabel(form.rows - 1, form.cols - 1)}
      </p>
      <div>
        <div id={colorLabelId} className="eyebrow" style={{ marginBottom: '0.35rem' }}>{t('invColor', lang)}</div>
        <div role="group" aria-labelledby={colorLabelId} className="flex flex-wrap items-center gap-1.5">
          {(() => {
            const current = (form.color || '').toLowerCase();
            const isPreset = BOX_COLORS.some(c => c.toLowerCase() === current);
            const ring = (on) => (on ? '0 0 0 2px var(--card), 0 0 0 3px var(--text)' : 'none');
            const sw = { width: 26, height: 26, border: '1px solid var(--border-strong)', padding: 0, flexShrink: 0 };
            const noneLabel = lang === 'zh' ? '无颜色' : 'No colour';
            const customLabel = lang === 'zh' ? '自定义颜色' : 'Custom colour';
            return (
              <>
                <button type="button" aria-pressed={!form.color} aria-label={noneLabel} title={noneLabel}
                  onClick={() => set('color', '')}
                  style={{ ...sw, background: 'var(--card)', boxShadow: ring(!form.color), position: 'relative', overflow: 'hidden' }}>
                  <span aria-hidden="true" style={{ position: 'absolute', left: -4, right: -4, top: '50%', height: 1, background: 'var(--danger-border)', transform: 'rotate(-45deg)' }} />
                </button>
                {BOX_COLORS.map(c => (
                  <button key={c} type="button" aria-pressed={current === c.toLowerCase()} aria-label={c} title={c}
                    onClick={() => set('color', c)}
                    style={{ ...sw, background: c, boxShadow: ring(current === c.toLowerCase()) }} />
                ))}
                <input
                  type="color" aria-label={customLabel} title={customLabel}
                  value={form.color && !isPreset ? form.color : '#8a8578'}
                  onChange={e => set('color', e.target.value)}
                  style={{ width: 34, height: 28, padding: 2, background: 'var(--card)', border: '1px dashed var(--border)', cursor: 'pointer', boxShadow: ring(!!form.color && !isPreset) }}
                />
                <span className="mono" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>
                  {form.color ? form.color.toUpperCase() : (lang === 'zh' ? '无' : 'None')}
                </span>
              </>
            );
          })()}
        </div>
      </div>
    </InvModal>
  );
}

// ── SampleForm ───────────────────────────────────────────────────────────────

export function SampleForm({ open, onClose, onSave, onDelete, onDuplicate, initial, position, lang, boxName }) {
  const [form, setForm] = useState({
    name: '', sampleType: 'cell_line', quantity: '', concentration: '',
    passage: '', dateStored: '', expiryDate: '', owner: '', tags: '',
    description: '', notes: '',
  });
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name || '',
        sampleType: initial.sampleType || 'cell_line',
        quantity: initial.quantity || '',
        concentration: initial.concentration || '',
        passage: initial.passage || '',
        dateStored: initial.dateStored ? new Date(initial.dateStored).toISOString().slice(0, 10) : '',
        expiryDate: initial.expiryDate ? new Date(initial.expiryDate).toISOString().slice(0, 10) : '',
        owner: initial.owner || '',
        tags: (initial.tags || []).join(', '),
        description: initial.description || '',
        notes: initial.notes || '',
      });
    } else {
      setForm({
        name: '', sampleType: 'cell_line', quantity: '', concentration: '',
        passage: '', dateStored: new Date().toISOString().slice(0, 10), expiryDate: '',
        owner: '', tags: '', description: '', notes: '',
      });
    }
  }, [initial, open]);

  useEffect(() => { if (!open) setConfirmDelete(false); }, [open]);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const submit = () => {
    if (!form.name) return;
    onSave({
      ...form,
      dateStored: form.dateStored ? new Date(form.dateStored).getTime() : Date.now(),
      expiryDate: form.expiryDate ? new Date(form.expiryDate).getTime() : null,
      tags: parseTags(form.tags),
    });
  };

  const deleteWord = lang === 'zh' ? '删除' : 'Delete';

  return (
    <InvModal
      open={open} onClose={onClose} onSubmit={submit}
      title={initial ? t('invEditSample', lang) : t('invAddSample', lang)}
      meta={<>
        {posBadge(position)}
        {boxName && <span className="mono truncate hidden sm:inline" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{boxName}</span>}
      </>}
      footer={<>
        {initial && (
          <div className="mr-auto flex items-center gap-2">
            {!confirmDelete ? (
              <button type="button" className="btn-danger btn-sm" onClick={() => setConfirmDelete(true)}
                aria-label={t('invDeleteSample', lang)} title={t('invDeleteSample', lang)}>
                <IconTrash size={14} /><span className="hidden sm:inline">{deleteWord}</span>
              </button>
            ) : (
              <>
                <span className="hidden sm:inline" style={{ fontSize: '0.75rem', color: 'var(--danger-text)' }}>{t('invDeleteConfirm', lang)}</span>
                <button type="button" className="btn-danger btn-sm" onClick={() => { onDelete(initial.id); onClose(); }}>
                  {t('invConfirm', lang)}
                </button>
              </>
            )}
            {onDuplicate && !confirmDelete && (
              <button type="button" className="btn-ghost btn-sm" onClick={() => { onDuplicate(initial); onClose(); }}
                aria-label={t('invDuplicate', lang)} title={t('invDuplicate', lang)}>
                <IconCopy size={14} /><span className="hidden sm:inline">{t('invDuplicate', lang)}</span>
              </button>
            )}
          </div>
        )}
        <button type="button" className="btn" onClick={onClose}>{t('invCancel', lang)}</button>
        <button type="submit" className="btn-primary" disabled={!form.name}>{t('invSave', lang)}</button>
      </>}
    >
      <InvInput label={t('invName', lang) + ' *'} value={form.name} onChange={v => set('name', v)} autoFocus />
      <InvSelect
        label={t('invSampleType', lang)}
        value={form.sampleType}
        onChange={v => set('sampleType', v)}
        options={Object.entries(SAMPLE_TYPE_LABELS).map(([val, lbl]) => ({ value: val, label: t(lbl, lang) }))}
      />
      <div className="grid grid-cols-2 gap-3">
        <InvInput label={t('invQuantity', lang)} value={form.quantity} onChange={v => set('quantity', v)} placeholder="e.g. 500 µL" />
        <InvInput label={t('invConcentration', lang)} value={form.concentration} onChange={v => set('concentration', v)} />
        <InvInput label={t('invPassage', lang)} value={form.passage} onChange={v => set('passage', v)} />
        <InvInput label={t('invOwner', lang)} value={form.owner} onChange={v => set('owner', v)} />
        <InvInput label={t('invDateStored', lang)} value={form.dateStored} onChange={v => set('dateStored', v)} type="date" />
        <InvInput label={t('invExpiryDate', lang)} value={form.expiryDate} onChange={v => set('expiryDate', v)} type="date" />
      </div>
      <InvInput label={t('invTags', lang)} value={form.tags} onChange={v => set('tags', v)} />
      <InvTextarea label={t('invDescription', lang)} value={form.description} onChange={v => set('description', v)} rows={2} />
      <InvTextarea label={t('invNotes', lang)} value={form.notes} onChange={v => set('notes', v)} rows={2} />
    </InvModal>
  );
}

// ── MoveSampleForm ───────────────────────────────────────────────────────────
// Pick a target box and one of its empty positions (list or click on the grid).

export function MoveSampleForm({ open, onClose, onMove, sample, data, lang }) {
  const [boxId, setBoxId] = useState(null);
  const [pos, setPos] = useState('');
  const boxSelectId = useId();
  const posSelectId = useId();

  useEffect(() => {
    if (open && sample) { setBoxId(sample.boxId); setPos(''); }
  }, [open, sample]);

  const box = data.boxes.find(b => b.id === boxId) || null;
  const boxSamples = useMemo(() => (box ? data.samples.filter(s => s.boxId === box.id) : []), [box, data.samples]);
  const freePositions = useMemo(() => {
    if (!box) return [];
    const taken = new Set(boxSamples.map(s => s.position));
    const out = [];
    for (let r = 0; r < box.rows; r++)
      for (let c = 0; c < box.cols; c++) {
        const p = posLabel(r, c);
        if (!taken.has(p)) out.push(p);
      }
    return out;
  }, [box, boxSamples]);

  if (!sample) return null;
  const target = freePositions.includes(pos) ? pos : (freePositions[0] || '');
  const name = (o) => (lang === 'zh' ? (o.nameZh || o.name) : o.name);
  const fromBox = data.boxes.find(b => b.id === sample.boxId);
  const freeCount = (b) => b.rows * b.cols - data.samples.filter(s => s.boxId === b.id).length;
  const moveWord = lang === 'zh' ? '移动' : 'Move';

  return (
    <InvModal
      open={open} onClose={onClose} onSubmit={() => { if (target && box) onMove(sample.id, box.id, target); }}
      title={lang === 'zh' ? '移动样品' : 'Move sample'}
      meta={posBadge(sample.position)}
      footer={<>
        <button type="button" className="btn" onClick={onClose}>{t('invCancel', lang)}</button>
        <button type="submit" className="btn-primary" disabled={!target}>
          <IconArrowRight size={15} />{moveWord}{target ? ' → ' + target : ''}
        </button>
      </>}
    >
      <p style={{ fontSize: '0.8125rem' }}>
        <strong style={{ fontWeight: 600 }}>{sample.name}</strong>
        <span className="mono" style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
          {' · ' + (fromBox ? name(fromBox) : '') + ' ' + (sample.position || '')}
        </span>
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_9rem]">
        <div>
          <label htmlFor={boxSelectId}>{lang === 'zh' ? '目标盒子' : 'Target box'}</label>
          <select id={boxSelectId} className="w-full" value={boxId == null ? '' : String(boxId)}
            onChange={e => { const b = data.boxes.find(x => String(x.id) === e.target.value); setBoxId(b ? b.id : null); setPos(''); }}>
            {data.locations.map(loc => {
              const bs = data.boxes.filter(b => b.locationId === loc.id);
              if (!bs.length) return null;
              return (
                <optgroup key={loc.id} label={name(loc) + (loc.temperature ? ' · ' + loc.temperature : '')}>
                  {bs.map(b => (
                    <option key={b.id} value={String(b.id)}>
                      {name(b) + ' · ' + freeCount(b) + (lang === 'zh' ? ' 个空位' : ' free')}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </div>
        <div>
          <label htmlFor={posSelectId}>{lang === 'zh' ? '目标孔位' : 'Target position'}</label>
          <select id={posSelectId} className="w-full" value={target} onChange={e => setPos(e.target.value)} disabled={!freePositions.length}>
            {freePositions.length === 0 && <option value="">—</option>}
            {freePositions.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      {box && freePositions.length === 0 && (
        <div className="notice notice-warn">{lang === 'zh' ? '这个盒子没有空位了。' : 'This box has no empty positions.'}</div>
      )}
      {box && freePositions.length > 0 && (
        <div className="pt-1">
          <p className="eyebrow mb-2">{lang === 'zh' ? '或点击空位' : 'Or pick an empty position'}</p>
          <BoxGrid
            box={box} samples={boxSamples} lang={lang} compact maxCell={30} minCell={20}
            activePos={target}
            onCellClick={(p, s) => { if (!s) setPos(p); }}
          />
        </div>
      )}
    </InvModal>
  );
}

// ── ImportDialog ─────────────────────────────────────────────────────────────
// CSV rows go into one box (chosen here, so it also works before a box is
// open); a JSON backup restores locations, boxes and samples. The actual
// parsing/merging stays in InventoryTab's handlers.

const CSV_COLUMNS = 'Position, Name, Type, Quantity, Concentration, Passage, Date Stored, Expiry, Owner, Tags, Description, Notes';

export function ImportDialog({ open, onClose, data, lang, defaultBoxId, onPickCsv, onPickJson, onDownloadTemplate }) {
  const [boxId, setBoxId] = useState(null);
  const boxSelectId = useId();
  useEffect(() => {
    if (open) setBoxId(defaultBoxId != null ? defaultBoxId : (data.boxes[0] ? data.boxes[0].id : null));
  }, [open, defaultBoxId, data.boxes]);

  const zh = lang === 'zh';
  const name = (o) => (zh ? (o.nameZh || o.name) : o.name);
  const hasBoxes = data.boxes.length > 0;
  const freeCount = (b) => b.rows * b.cols - data.samples.filter(s => s.boxId === b.id).length;
  const heading = { fontSize: '0.9375rem' };
  const muted = { fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 };

  return (
    <InvModal
      open={open} onClose={onClose} title={t('invImport', lang)} bodyClassName="space-y-4"
      footer={<button type="button" className="btn" onClick={onClose}>{t('closeLabel', lang)}</button>}
    >
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <IconFile size={16} style={{ color: 'var(--text-muted)' }} />
          <h3 className="section-title" style={heading}>{t('invImportCsv', lang)}</h3>
        </div>
        <p style={muted}>
          {zh ? 'CSV 的每一行会成为所选盒子里的一个样品；孔位已被占用的行会被跳过。'
              : 'Each CSV row becomes a sample in the chosen box. Rows whose position is already taken are skipped.'}
        </p>
        {hasBoxes ? (
          <div>
            <label htmlFor={boxSelectId}>{zh ? '导入到盒子' : 'Into box'}</label>
            <select id={boxSelectId} className="w-full" value={boxId == null ? '' : String(boxId)}
              onChange={e => { const b = data.boxes.find(x => String(x.id) === e.target.value); setBoxId(b ? b.id : null); }}>
              {data.locations.map(loc => {
                const bs = data.boxes.filter(b => b.locationId === loc.id);
                if (!bs.length) return null;
                return (
                  <optgroup key={loc.id} label={name(loc) + (loc.temperature ? ' · ' + loc.temperature : '')}>
                    {bs.map(b => (
                      <option key={b.id} value={String(b.id)}>{name(b) + ' · ' + freeCount(b) + (zh ? ' 个空位' : ' free')}</option>
                    ))}
                  </optgroup>
                );
              })}
            </select>
          </div>
        ) : (
          <div className="notice notice-info">
            {zh ? '先添加一个存储位置和盒子——CSV 中的样品会放进盒子里。' : 'Add a location and a box first — CSV rows are placed into a box.'}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn-primary" disabled={!hasBoxes || boxId == null} onClick={() => onPickCsv(boxId)}>
            <IconUpload size={15} />{zh ? '选择 CSV 文件' : 'Choose CSV file'}
          </button>
          <button type="button" className="btn-ghost btn-sm" onClick={onDownloadTemplate}>
            <IconDownload size={14} />{t('invDownloadTemplate', lang)}
          </button>
        </div>
        <p className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
          {(zh ? '列：' : 'Columns: ') + CSV_COLUMNS}
        </p>
      </section>

      <section className="space-y-3 pt-4" style={{ borderTop: '1px solid var(--rule)' }}>
        <div className="flex items-center gap-2">
          <IconLayers size={16} style={{ color: 'var(--text-muted)' }} />
          <h3 className="section-title" style={heading}>{t('invImportJson', lang)}</h3>
        </div>
        <p style={muted}>
          {zh ? '恢复从 labmate 导出的库存备份（位置、盒子与样品），与现有数据合并。'
              : 'Restores an inventory backup exported from labmate — locations, boxes and samples — merged with what is already here.'}
        </p>
        <button type="button" className="btn" onClick={onPickJson}>
          <IconUpload size={15} />{zh ? '选择 JSON 文件' : 'Choose JSON file'}
        </button>
      </section>
    </InvModal>
  );
}
