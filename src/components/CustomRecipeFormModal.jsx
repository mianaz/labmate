import { useState, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { t, useLang } from '../i18n/index.js';
import { IconClose, IconPlus } from './icons.jsx';

function parseTags(str, sep = ',') {
  return str ? str.split(sep).map(s => s.trim()).filter(Boolean) : [];
}

function Field({ id, label, children, className }) {
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

function RemoveBtn({ onClick, label }) {
  return (
    <button type="button" onClick={onClick} className="btn-ghost btn-icon flex-shrink-0" aria-label={label} title={label}>
      <IconClose size={14} />
    </button>
  );
}

function CustomRecipeFormModal({ isOpen, onClose, onSave, initial, isProtocol }) {
  const lang = useLang();
  const uid = useId();
  const fid = (name) => `${uid}-${name}`;
  const [name, setName] = useState(initial?.name || '');
  const [nameCn, setNameCn] = useState(initial?.nameCn || '');
  const [category, setCategory] = useState(initial?.category || (isProtocol ? 'protocol' : 'buffer'));
  const [tags, setTags] = useState((initial?.tags || []).join(', '));
  const [ph, setPh] = useState(initial?.ph || '');
  const [defaultVolume, setDefaultVolume] = useState(initial?.defaultVolume || 1000);
  const [unit, setUnit] = useState(initial?.unit || 'mL');
  const [storageTemp, setStorageTemp] = useState(initial?.storage?.temp || 'RT');
  const [storageDuration, setStorageDuration] = useState(initial?.storage?.duration || '');
  const [storageLabelEn, setStorageLabelEn] = useState(initial?.storage?.label?.en || '');
  const [storageLabelZh, setStorageLabelZh] = useState(initial?.storage?.label?.zh || '');
  const [notesEn, setNotesEn] = useState(initial?._notesEn || '');
  const [notesZh, setNotesZh] = useState(initial?.notes || '');
  const [components, setComponents] = useState(initial?.components || [{ name: '', amount: '', unit: 'g', note: '' }]);
  // Protocol-specific
  const [steps, setSteps] = useState(initial?.briefSteps?.map((s, i) => ({ en: s, zh: initial?.briefSteps?.[i] || '' })) || [{ en: '', zh: '' }]);
  const [materials, setMaterials] = useState(initial?.materials || ['']);

  useEffect(() => {
    if (isOpen) {
      setName(initial?.name || '');
      setNameCn(initial?.nameCn || '');
      setCategory(initial?.category || (isProtocol ? 'protocol' : 'buffer'));
      setTags((initial?.tags || []).join(', '));
      setPh(initial?.ph || '');
      setDefaultVolume(initial?.defaultVolume || 1000);
      setUnit(initial?.unit || 'mL');
      setStorageTemp(initial?.storage?.temp || 'RT');
      setStorageDuration(initial?.storage?.duration || '');
      setStorageLabelEn(initial?.storage?.label?.en || '');
      setStorageLabelZh(initial?.storage?.label?.zh || '');
      setNotesEn(initial?._notesEn || '');
      setNotesZh(initial?.notes || '');
      setComponents(initial?.components || [{ name: '', amount: '', unit: 'g', note: '' }]);
      setSteps(initial?.briefSteps?.map((s, i) => ({ en: s, zh: initial?.briefSteps?.[i] || '' })) || [{ en: '', zh: '' }]);
      setMaterials(initial?.materials || ['']);
    }
  }, [isOpen, initial]);

  // Escape closes
  useEffect(() => {
    if (!isOpen) return undefined;
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  function handleSave(e) {
    e?.preventDefault();
    if (!name.trim()) return;
    const tagArr = parseTags(tags);
    const recipe = {
      id: initial?.id || ('custom_' + Date.now()),
      name: name.trim(),
      nameCn: nameCn.trim(),
      category,
      tags: tagArr,
      _isCustom: true,
      defaultVolume: +defaultVolume || 1000,
      unit,
    };
    if (!isProtocol) {
      recipe.ph = ph || '';
      recipe.storage = {
        temp: storageTemp,
        duration: storageDuration,
        label: { en: storageLabelEn, zh: storageLabelZh },
      };
      recipe.notes = notesZh;
      recipe._notesEn = notesEn;
      recipe.components = components.filter(c => c.name.trim()).map(c => ({
        name: c.name.trim(), amount: +c.amount || 0, unit: c.unit || 'g', note: c.note || '',
      }));
    } else {
      recipe.briefSteps = steps.filter(s => s.en.trim() || s.zh.trim()).map(s => s[lang] || s.en || s.zh);
      recipe.materials = materials.filter(m => m.trim());
      recipe.notes = notesZh;
      recipe._notesEn = notesEn;
      recipe.components = [];
    }
    onSave(recipe);
    onClose();
  }

  if (!isOpen) return null;

  const title = initial?.id ? t('editCustom', lang) : (isProtocol ? t('addCustomProtocol', lang) : t('addCustomRecipe', lang));
  const removeLabel = lang === 'zh' ? '移除' : 'Remove';
  const sectionLabel = (text) => (
    <div className="eyebrow pt-2 pb-1.5" style={{ borderBottom: '1px solid var(--rule)', color: 'var(--text)' }}>{text}</div>
  );

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog" aria-modal="true" aria-labelledby={fid('title')}>
      <div className="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <form onSubmit={handleSave} className="dialog w-full sm:max-w-xl flex flex-col" style={{ zIndex: 51, maxHeight: '92vh' }}>
        <div className="panel-head">
          <h2 id={fid('title')} className="section-title">{title}</h2>
          <button type="button" className="btn-ghost btn-icon btn-sm" onClick={onClose} aria-label={t('closeLabel', lang)}>
            <IconClose size={16} />
          </button>
        </div>

        <div className="panel-body space-y-4 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id={fid('name')} label={t('customFormName', lang)}>
              <input id={fid('name')} type="text" value={name} onChange={e => setName(e.target.value)} className="w-full" required autoFocus />
            </Field>
            <Field id={fid('nameCn')} label={t('customFormNameCn', lang)}>
              <input id={fid('nameCn')} type="text" value={nameCn} onChange={e => setNameCn(e.target.value)} className="w-full" />
            </Field>
            {!isProtocol && (
              <Field id={fid('category')} label={t('customFormCategory', lang)}>
                <select id={fid('category')} value={category} onChange={e => setCategory(e.target.value)} className="w-full">
                  <option value="buffer">{t('buffer', lang)}</option>
                  <option value="staining">{t('staining', lang)}</option>
                  <option value="media">{t('media', lang)}</option>
                </select>
              </Field>
            )}
            <Field id={fid('tags')} label={t('customFormTags', lang)} className={isProtocol ? 'sm:col-span-2' : undefined}>
              <input id={fid('tags')} type="text" value={tags} onChange={e => setTags(e.target.value)} className="w-full" placeholder="e.g. WB, common" />
            </Field>
          </div>

          {!isProtocol && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Field id={fid('vol')} label={t('customFormDefaultVol', lang)}>
                  <input id={fid('vol')} type="number" value={defaultVolume} onChange={e => setDefaultVolume(e.target.value)} className="w-full" />
                </Field>
                <Field id={fid('unit')} label={t('customFormUnit', lang)}>
                  <input id={fid('unit')} type="text" value={unit} onChange={e => setUnit(e.target.value)} className="w-full" />
                </Field>
                <Field id={fid('ph')} label={t('customFormPH', lang)}>
                  <input id={fid('ph')} type="text" value={ph} onChange={e => setPh(e.target.value)} className="w-full" />
                </Field>
                <Field id={fid('temp')} label={t('customFormStorageTemp', lang)}>
                  <select id={fid('temp')} value={storageTemp} onChange={e => setStorageTemp(e.target.value)} className="w-full">
                    {['RT', '4°C', '-20°C', '-80°C', 'N/A'].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                </Field>
                <Field id={fid('dur')} label={t('customFormStorageDuration', lang)} className="sm:col-span-2">
                  <input id={fid('dur')} type="text" value={storageDuration} onChange={e => setStorageDuration(e.target.value)} className="w-full" placeholder="e.g. 12 months" />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field id={fid('slen')} label={t('customFormStorageLabelEn', lang)}>
                  <input id={fid('slen')} type="text" value={storageLabelEn} onChange={e => setStorageLabelEn(e.target.value)} className="w-full" placeholder="e.g. Prepare fresh; DMSO aliquots at RT" />
                </Field>
                <Field id={fid('slzh')} label={t('customFormStorageLabelZh', lang)}>
                  <input id={fid('slzh')} type="text" value={storageLabelZh} onChange={e => setStorageLabelZh(e.target.value)} className="w-full" placeholder="例如：现配现用；DMSO 分装室温保存" />
                </Field>
              </div>

              <div>
                {sectionLabel(t('customFormComponents', lang))}
                <div className="space-y-1.5 mt-2">
                  {components.map((c, i) => (
                    <div key={i} className="flex gap-1.5 items-center">
                      <input type="text" value={c.name} placeholder={t('customFormCompName', lang)} aria-label={t('customFormCompName', lang)} className="flex-1 min-w-0"
                        onChange={e => { const a = [...components]; a[i] = { ...a[i], name: e.target.value }; setComponents(a); }} />
                      <input type="number" value={c.amount} placeholder={t('customFormCompAmount', lang)} aria-label={t('customFormCompAmount', lang)} style={{ width: '5.5rem' }}
                        onChange={e => { const a = [...components]; a[i] = { ...a[i], amount: e.target.value }; setComponents(a); }} />
                      <input type="text" value={c.unit} placeholder={t('customFormCompUnit', lang)} aria-label={t('customFormCompUnit', lang)} style={{ width: '4.25rem' }}
                        onChange={e => { const a = [...components]; a[i] = { ...a[i], unit: e.target.value }; setComponents(a); }} />
                      <RemoveBtn label={removeLabel} onClick={() => setComponents(components.filter((_, j) => j !== i))} />
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-sm mt-2" onClick={() => setComponents([...components, { name: '', amount: '', unit: 'g', note: '' }])}>
                  <IconPlus size={13} />{t('customFormAddComponent', lang)}
                </button>
              </div>
            </>
          )}

          {isProtocol && (
            <>
              <div>
                {sectionLabel(t('customFormSteps', lang))}
                <ol className="space-y-2 mt-2">
                  {steps.map((s, i) => (
                    <li key={i} className="flex gap-2 items-start">
                      <span className="mono flex-shrink-0 text-right" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', minWidth: '1.5rem', paddingTop: '0.6rem' }}>{i + 1}.</span>
                      <div className="flex-1 min-w-0 space-y-1">
                        <input type="text" value={s.en} placeholder={t('customFormStepTextEn', lang)} aria-label={t('customFormStepTextEn', lang)} className="w-full"
                          onChange={e => { const a = [...steps]; a[i] = { ...a[i], en: e.target.value }; setSteps(a); }} />
                        <input type="text" value={s.zh} placeholder={t('customFormStepTextZh', lang)} aria-label={t('customFormStepTextZh', lang)} className="w-full"
                          onChange={e => { const a = [...steps]; a[i] = { ...a[i], zh: e.target.value }; setSteps(a); }} />
                      </div>
                      <RemoveBtn label={removeLabel} onClick={() => setSteps(steps.filter((_, j) => j !== i))} />
                    </li>
                  ))}
                </ol>
                <button type="button" className="btn btn-sm mt-2" onClick={() => setSteps([...steps, { en: '', zh: '' }])}>
                  <IconPlus size={13} />{t('customFormAddStep', lang)}
                </button>
              </div>
              <div>
                {sectionLabel(t('customFormMaterials', lang))}
                <div className="space-y-1.5 mt-2">
                  {materials.map((m, i) => (
                    <div key={i} className="flex gap-1.5 items-center">
                      <input type="text" value={m} className="flex-1 min-w-0" aria-label={t('customFormMaterials', lang)}
                        onChange={e => { const a = [...materials]; a[i] = e.target.value; setMaterials(a); }} />
                      <RemoveBtn label={removeLabel} onClick={() => setMaterials(materials.filter((_, j) => j !== i))} />
                    </div>
                  ))}
                </div>
                <button type="button" className="btn btn-sm mt-2" onClick={() => setMaterials([...materials, ''])}>
                  <IconPlus size={13} />{t('customFormAddMaterial', lang)}
                </button>
              </div>
            </>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field id={fid('nen')} label={t('customFormNotesEn', lang)}>
              <textarea id={fid('nen')} value={notesEn} onChange={e => setNotesEn(e.target.value)} className="w-full" rows={2} />
            </Field>
            <Field id={fid('nzh')} label={t('customFormNotesZh', lang)}>
              <textarea id={fid('nzh')} value={notesZh} onChange={e => setNotesZh(e.target.value)} className="w-full" rows={2} />
            </Field>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-4 py-3" style={{ borderTop: '1px solid var(--rule)', paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}>
          <button type="button" className="btn" onClick={onClose}>{t('customFormCancel', lang)}</button>
          <button type="submit" className="btn-primary" disabled={!name.trim()}>{t('customFormSave', lang)}</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

export default CustomRecipeFormModal;
