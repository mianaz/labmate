import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { t, useLang } from '../i18n/index.js';

function parseTags(str, sep = ',') {
  return str ? str.split(sep).map(s => s.trim()).filter(Boolean) : [];
}

function CustomRecipeFormModal({ isOpen, onClose, onSave, initial, isProtocol }) {
  const lang = useLang();
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

  function handleSave() {
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

  return createPortal(
    React.createElement('div', {className:'fixed inset-0 z-50 flex items-center justify-center p-4', onClick: onClose},
      React.createElement('div', {className:'absolute inset-0', style:{background:'rgba(0,0,0,0.4)', backdropFilter:'blur(4px)'}}),
      React.createElement('div', {className:'relative w-full max-w-lg rounded-xl p-6', style:{background:'var(--card)', border:'1px solid var(--border)', boxShadow:'var(--shadow-lg)', maxHeight:'85vh', overflowY:'auto'}, onClick: e => e.stopPropagation()},
        React.createElement('h3', {className:'text-lg font-semibold mb-4', style:{fontFamily:'var(--font-heading)', color:'var(--text)'}},
          initial?.id ? t('editCustom', lang) : (isProtocol ? t('addCustomProtocol', lang) : t('addCustomRecipe', lang))
        ),
        React.createElement('div', {className:'space-y-3'},
          React.createElement('div', null,
            React.createElement('label', null, t('customFormName', lang)),
            React.createElement('input', {type:'text', value:name, onChange: e => setName(e.target.value), className:'w-full'})
          ),
          React.createElement('div', null,
            React.createElement('label', null, t('customFormNameCn', lang)),
            React.createElement('input', {type:'text', value:nameCn, onChange: e => setNameCn(e.target.value), className:'w-full'})
          ),
          !isProtocol && React.createElement('div', null,
            React.createElement('label', null, t('customFormCategory', lang)),
            React.createElement('select', {value:category, onChange: e => setCategory(e.target.value), className:'w-full'},
              React.createElement('option', {value:'buffer'}, t('buffer', lang)),
              React.createElement('option', {value:'staining'}, t('staining', lang)),
              React.createElement('option', {value:'media'}, t('media', lang))
            )
          ),
          React.createElement('div', null,
            React.createElement('label', null, t('customFormTags', lang)),
            React.createElement('input', {type:'text', value:tags, onChange: e => setTags(e.target.value), className:'w-full', placeholder:'e.g. WB, common'})
          ),
          !isProtocol && React.createElement(React.Fragment, null,
            React.createElement('div', {className:'grid grid-cols-2 gap-3'},
              React.createElement('div', null,
                React.createElement('label', null, t('customFormDefaultVol', lang)),
                React.createElement('input', {type:'number', value:defaultVolume, onChange: e => setDefaultVolume(e.target.value), className:'w-full'})
              ),
              React.createElement('div', null,
                React.createElement('label', null, t('customFormUnit', lang)),
                React.createElement('input', {type:'text', value:unit, onChange: e => setUnit(e.target.value), className:'w-full'})
              )
            ),
            React.createElement('div', null,
              React.createElement('label', null, t('customFormPH', lang)),
              React.createElement('input', {type:'text', value:ph, onChange: e => setPh(e.target.value), className:'w-full'})
            ),
            React.createElement('div', {className:'grid grid-cols-2 gap-3'},
              React.createElement('div', null,
                React.createElement('label', null, t('customFormStorageTemp', lang)),
                React.createElement('select', {value:storageTemp, onChange: e => setStorageTemp(e.target.value), className:'w-full'},
                  ['RT','4\u00B0C','-20\u00B0C','-80\u00B0C','N/A'].map(v => React.createElement('option', {key:v, value:v}, v))
                )
              ),
              React.createElement('div', null,
                React.createElement('label', null, t('customFormStorageDuration', lang)),
                React.createElement('input', {type:'text', value:storageDuration, onChange: e => setStorageDuration(e.target.value), className:'w-full', placeholder:'e.g. 12 months'})
              )
            ),
            React.createElement('div', {className:'grid grid-cols-2 gap-3'},
              React.createElement('div', null,
                React.createElement('label', null, t('customFormStorageLabelEn', lang)),
                React.createElement('input', {type:'text', value:storageLabelEn, onChange: e => setStorageLabelEn(e.target.value), className:'w-full', placeholder:'e.g. Prepare fresh; DMSO aliquots at RT'})
              ),
              React.createElement('div', null,
                React.createElement('label', null, t('customFormStorageLabelZh', lang)),
                React.createElement('input', {type:'text', value:storageLabelZh, onChange: e => setStorageLabelZh(e.target.value), className:'w-full', placeholder:'例如：现配现用；DMSO 分装室温保存'})
              )
            ),
            // Components
            React.createElement('div', null,
              React.createElement('label', null, t('customFormComponents', lang)),
              components.map((c, i) =>
                React.createElement('div', {key:i, className:'flex gap-2 mb-2 items-end'},
                  React.createElement('input', {type:'text', value:c.name, placeholder:t('customFormCompName', lang), className:'flex-1',
                    onChange: e => { const a = [...components]; a[i] = {...a[i], name: e.target.value}; setComponents(a); }}),
                  React.createElement('input', {type:'number', value:c.amount, placeholder:t('customFormCompAmount', lang), className:'w-20',
                    onChange: e => { const a = [...components]; a[i] = {...a[i], amount: e.target.value}; setComponents(a); }}),
                  React.createElement('input', {type:'text', value:c.unit, placeholder:t('customFormCompUnit', lang), className:'w-16',
                    onChange: e => { const a = [...components]; a[i] = {...a[i], unit: e.target.value}; setComponents(a); }}),
                  React.createElement('button', {onClick: () => setComponents(components.filter((_, j) => j !== i)),
                    className:'px-2 py-1 rounded text-xs', style:{color:'var(--text-muted)', background:'var(--bg-2)'}},
                    React.createElement('svg', {width:12, height:12, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2},
                      React.createElement('line', {x1:18, y1:6, x2:6, y2:18}), React.createElement('line', {x1:6, y1:6, x2:18, y2:18}))
                  )
                )
              ),
              React.createElement('button', {onClick: () => setComponents([...components, { name: '', amount: '', unit: 'g', note: '' }]),
                className:'text-xs px-3 py-1.5 rounded-lg font-semibold', style:{background:'var(--primary-light)', color:'var(--primary)', border:'1px solid var(--border)'}},
                '+ ' + t('customFormAddComponent', lang))
            )
          ),
          isProtocol && React.createElement(React.Fragment, null,
            // Steps
            React.createElement('div', null,
              React.createElement('label', null, t('customFormSteps', lang)),
              steps.map((s, i) =>
                React.createElement('div', {key:i, className:'flex gap-2 mb-2 items-start'},
                  React.createElement('span', {className:'text-xs font-bold mt-2 flex-shrink-0', style:{color:'var(--text-muted)', minWidth:'1.5rem'}}, (i+1) + '.'),
                  React.createElement('div', {className:'flex-1 space-y-1'},
                    React.createElement('input', {type:'text', value:s.en, placeholder:t('customFormStepTextEn', lang), className:'w-full',
                      onChange: e => { const a = [...steps]; a[i] = {...a[i], en: e.target.value}; setSteps(a); }}),
                    React.createElement('input', {type:'text', value:s.zh, placeholder:t('customFormStepTextZh', lang), className:'w-full',
                      onChange: e => { const a = [...steps]; a[i] = {...a[i], zh: e.target.value}; setSteps(a); }})
                  ),
                  React.createElement('button', {onClick: () => setSteps(steps.filter((_, j) => j !== i)),
                    className:'px-2 py-1 rounded text-xs mt-1', style:{color:'var(--text-muted)', background:'var(--bg-2)'}},
                    React.createElement('svg', {width:12, height:12, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2},
                      React.createElement('line', {x1:18, y1:6, x2:6, y2:18}), React.createElement('line', {x1:6, y1:6, x2:18, y2:18}))
                  )
                )
              ),
              React.createElement('button', {onClick: () => setSteps([...steps, { en: '', zh: '' }]),
                className:'text-xs px-3 py-1.5 rounded-lg font-semibold', style:{background:'var(--primary-light)', color:'var(--primary)', border:'1px solid var(--border)'}},
                '+ ' + t('customFormAddStep', lang))
            ),
            // Materials
            React.createElement('div', null,
              React.createElement('label', null, t('customFormMaterials', lang)),
              materials.map((m, i) =>
                React.createElement('div', {key:i, className:'flex gap-2 mb-2'},
                  React.createElement('input', {type:'text', value:m, className:'flex-1',
                    onChange: e => { const a = [...materials]; a[i] = e.target.value; setMaterials(a); }}),
                  React.createElement('button', {onClick: () => setMaterials(materials.filter((_, j) => j !== i)),
                    className:'px-2 py-1 rounded text-xs', style:{color:'var(--text-muted)', background:'var(--bg-2)'}},
                    React.createElement('svg', {width:12, height:12, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2},
                      React.createElement('line', {x1:18, y1:6, x2:6, y2:18}), React.createElement('line', {x1:6, y1:6, x2:18, y2:18}))
                  )
                )
              ),
              React.createElement('button', {onClick: () => setMaterials([...materials, '']),
                className:'text-xs px-3 py-1.5 rounded-lg font-semibold', style:{background:'var(--primary-light)', color:'var(--primary)', border:'1px solid var(--border)'}},
                '+ ' + t('customFormAddMaterial', lang))
            )
          ),
          React.createElement('div', {className:'grid grid-cols-2 gap-3'},
            React.createElement('div', null,
              React.createElement('label', null, t('customFormNotesEn', lang)),
              React.createElement('textarea', {value:notesEn, onChange: e => setNotesEn(e.target.value), className:'w-full', rows:2})
            ),
            React.createElement('div', null,
              React.createElement('label', null, t('customFormNotesZh', lang)),
              React.createElement('textarea', {value:notesZh, onChange: e => setNotesZh(e.target.value), className:'w-full', rows:2})
            )
          )
        ),
        React.createElement('div', {className:'flex gap-3 mt-5'},
          React.createElement('button', {onClick:onClose, className:'flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold',
            style:{background:'var(--bg-2)', color:'var(--text-muted)', border:'1px solid var(--border)'}},
            t('customFormCancel', lang)),
          React.createElement('button', {onClick:handleSave, className:'flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold',
            style:{background:'var(--primary)', color:'white'}},
            t('customFormSave', lang))
        )
      )
    ),
    document.body
  );
}

export default CustomRecipeFormModal;
