// ═══════════════════════════════════════════════
// Inventory — Form components (JSX)
// ═══════════════════════════════════════════════
import React, { useState, useEffect } from 'react';
import { t } from '../../i18n/index.js';
import { InvModal, InvInput, InvSelect, InvTextarea } from './InventoryComponents.jsx';
import {
  STORAGE_TYPE_LABELS, BOX_CONFIGS, BOX_TYPE_LABELS,
  SAMPLE_TYPE_LABELS, invBtnStyle, invBtnSecStyle, invBtnDangerStyle,
  parseTags,
} from './inventoryUtils.js';

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

  return (
    <InvModal open={open} onClose={onClose} title={initial ? t('invEditLocation', lang) : t('invAddLocation', lang)}>
      <InvInput label={t('invName', lang)} value={form.name} onChange={v => set('name', v)} />
      <InvInput label={t('invNameZh', lang)} value={form.nameZh} onChange={v => set('nameZh', v)} />
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
      <div className="flex gap-2 mt-4 justify-end">
        <button style={invBtnSecStyle} onClick={onClose}>{t('invCancel', lang)}</button>
        <button
          style={{ ...invBtnStyle, opacity: form.name ? 1 : 0.5 }}
          disabled={!form.name}
          onClick={() => { if (form.name) onSave(form); }}
        >
          {t('invSave', lang)}
        </button>
      </div>
    </InvModal>
  );
}

// ── BoxForm ──────────────────────────────────────────────────────────────────

export function BoxForm({ open, onClose, onSave, initial, lang }) {
  const [form, setForm] = useState({ name: '', nameZh: '', boxType: 'cryo_81', rows: 9, cols: 9, color: '' });

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

  return (
    <InvModal open={open} onClose={onClose} title={initial ? t('invEditBox', lang) : t('invAddBox', lang)}>
      <InvInput label={t('invName', lang)} value={form.name} onChange={v => set('name', v)} />
      <InvInput label={t('invNameZh', lang)} value={form.nameZh} onChange={v => set('nameZh', v)} />
      <InvSelect
        label={t('invBoxType', lang)}
        value={form.boxType}
        onChange={handleTypeChange}
        options={BOX_CONFIGS.map(c => ({ value: c.type, label: t(BOX_TYPE_LABELS[c.type], lang) }))}
      />
      {form.boxType === 'custom' && (
        <div className="flex gap-2">
          <InvInput
            label={t('invRows', lang)}
            value={form.rows}
            onChange={v => set('rows', Math.max(1, Math.min(26, parseInt(v) || 1)))}
            type="number"
          />
          <InvInput
            label={t('invCols', lang)}
            value={form.cols}
            onChange={v => set('cols', Math.max(1, Math.min(50, parseInt(v) || 1)))}
            type="number"
          />
        </div>
      )}
      <InvInput label={t('invColor', lang)} value={form.color} onChange={v => set('color', v)} type="color" />
      <div className="flex gap-2 mt-4 justify-end">
        <button style={invBtnSecStyle} onClick={onClose}>{t('invCancel', lang)}</button>
        <button
          style={{ ...invBtnStyle, opacity: form.name ? 1 : 0.5 }}
          disabled={!form.name}
          onClick={() => { if (form.name) onSave(form); }}
        >
          {t('invSave', lang)}
        </button>
      </div>
    </InvModal>
  );
}

// ── SampleForm ───────────────────────────────────────────────────────────────

export function SampleForm({ open, onClose, onSave, onDelete, onDuplicate, initial, position, lang }) {
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

  return (
    <InvModal open={open} onClose={onClose} title={initial ? t('invEditSample', lang) : t('invAddSample', lang)}>
      {position && (
        <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
          {t('invPosition', lang) + ': ' + position}
        </p>
      )}
      <InvInput label={t('invName', lang) + ' *'} value={form.name} onChange={v => set('name', v)} />
      <InvSelect
        label={t('invSampleType', lang)}
        value={form.sampleType}
        onChange={v => set('sampleType', v)}
        options={Object.entries(SAMPLE_TYPE_LABELS).map(([val, lbl]) => ({ value: val, label: t(lbl, lang) }))}
      />
      <div className="flex gap-2">
        <div className="flex-1">
          <InvInput label={t('invQuantity', lang)} value={form.quantity} onChange={v => set('quantity', v)} placeholder="e.g. 500 µL" />
        </div>
        <div className="flex-1">
          <InvInput label={t('invConcentration', lang)} value={form.concentration} onChange={v => set('concentration', v)} />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <InvInput label={t('invPassage', lang)} value={form.passage} onChange={v => set('passage', v)} />
        </div>
        <div className="flex-1">
          <InvInput label={t('invOwner', lang)} value={form.owner} onChange={v => set('owner', v)} />
        </div>
      </div>
      <div className="flex gap-2">
        <div style={{ flex: 1 }}>
          <InvInput label={t('invDateStored', lang)} value={form.dateStored} onChange={v => set('dateStored', v)} type="date" />
        </div>
        <div style={{ flex: 1 }}>
          <InvInput label={t('invExpiryDate', lang)} value={form.expiryDate} onChange={v => set('expiryDate', v)} type="date" />
        </div>
      </div>
      <InvInput label={t('invTags', lang)} value={form.tags} onChange={v => set('tags', v)} />
      <InvTextarea label={t('invDescription', lang)} value={form.description} onChange={v => set('description', v)} rows={2} />
      <InvTextarea label={t('invNotes', lang)} value={form.notes} onChange={v => set('notes', v)} rows={2} />

      <div className="flex gap-2 mt-4 justify-between">
        {initial ? (
          <div className="flex gap-2 items-center">
            {!confirmDelete ? (
              <button
                style={{ ...invBtnDangerStyle, opacity: 0.8 }}
                onClick={() => setConfirmDelete(true)}
              >
                {t('invDeleteSample', lang)}
              </button>
            ) : (
              <div className="flex gap-2 items-center">
                <span className="text-xs" style={{ color: 'var(--danger-text)' }}>{t('invDeleteConfirm', lang)}</span>
                <button
                  style={invBtnDangerStyle}
                  onClick={() => { onDelete(initial.id); onClose(); }}
                >
                  {t('invConfirm', lang)}
                </button>
              </div>
            )}
            {onDuplicate && (
              <button
                style={{ ...invBtnSecStyle, fontSize: '12px' }}
                onClick={() => { onDuplicate(initial); onClose(); }}
              >
                {lang === 'zh' ? '复制' : 'Duplicate'}
              </button>
            )}
          </div>
        ) : (
          <div />
        )}
        <div className="flex gap-2">
          <button style={invBtnSecStyle} onClick={onClose}>{t('invCancel', lang)}</button>
          <button
            style={{ ...invBtnStyle, opacity: form.name ? 1 : 0.5 }}
            disabled={!form.name}
            onClick={() => {
              if (!form.name) return;
              onSave({
                ...form,
                dateStored: form.dateStored ? new Date(form.dateStored).getTime() : Date.now(),
                expiryDate: form.expiryDate ? new Date(form.expiryDate).getTime() : null,
                tags: parseTags(form.tags),
              });
            }}
          >
            {t('invSave', lang)}
          </button>
        </div>
      </div>
    </InvModal>
  );
}
