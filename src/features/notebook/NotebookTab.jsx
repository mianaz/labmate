import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { S_MUTED, S_TEXT } from '../../lib/styleConstants.js';
import { useToast } from '../../components/Toast.jsx';
import { useExperiments, createEmptyExperiment, exportExperimentsJSON, importExperimentsJSON } from '../../lib/experiments.js';
import { useRecipes } from '../../lib/RecipeProvider.jsx';
import ProtocolSelector from './ProtocolSelector.jsx';

const S_PILL_PRIMARY = { background: 'var(--primary-light)', color: 'var(--accent)', border: '1px solid var(--border)', borderRadius: '0' };

function NotebookTab({ onNavigateCalendar }) {
  const lang = useLang();
  const toast = useToast();
  const { entries, loading, save, remove, reload } = useExperiments();
  const { recipeById: RECIPE_BY_ID } = useRecipes();
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingEntry, setEditingEntry] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showProtocolImport, setShowProtocolImport] = useState(false);
  const [showInventorySearch, setShowInventorySearch] = useState(null);
  const [mobileView, setMobileView] = useState('list');
  const [expandedSections, setExpandedSections] = useState({ plan: true, materials: true, procedure: true, results: true });
  const saveTimerRef = useRef(null);
  const jsonInputRef = useRef(null);

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const selected = useMemo(() => entries.find(e => e.id === selectedId), [entries, selectedId]);

  useEffect(() => {
    if (selected && !editingEntry) setEditingEntry(JSON.parse(JSON.stringify(selected)));
  }, [selectedId]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (statusFilter !== 'all') list = list.filter(e => e.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        (e.title || '').toLowerCase().includes(q) ||
        (e.titleZh || '').toLowerCase().includes(q) ||
        (e.plan?.objectives || '').toLowerCase().includes(q) ||
        (e.date || '').includes(q)
      );
    }
    return list;
  }, [entries, statusFilter, search]);

  const toggleSection = (key) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const autoSave = useCallback((entry) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await save(entry);
      toast.show(t('nbAutoSaved', lang));
    }, 1500);
  }, [save, lang, toast]);

  const updateField = useCallback((path, value) => {
    setEditingEntry(prev => {
      if (!prev) return prev;
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      autoSave(next);
      return next;
    });
  }, [autoSave]);

  const handleNewEntry = useCallback(async () => {
    const entry = createEmptyExperiment();
    const saved = await save(entry);
    setSelectedId(saved.id);
    setEditingEntry(JSON.parse(JSON.stringify(saved)));
    if (isMobile) setMobileView('editor');
  }, [save, isMobile]);

  const handleDelete = useCallback(async () => {
    if (!selectedId) return;
    await remove(selectedId);
    setSelectedId(null);
    setEditingEntry(null);
    setShowDeleteConfirm(false);
    toast.show(lang === 'zh' ? '记录已删除' : 'Entry deleted');
  }, [selectedId, remove, lang, toast]);

  const handleImportProtocol = useCallback((recipe) => {
    if (!editingEntry) return;
    const steps = (recipe.briefSteps || recipe.detailedSteps || []).map(s => ({
      stepText: typeof s === 'string' ? s : (s.text || s.step || ''),
      completed: false, deviation: '', actualParams: ''
    }));
    const next = {
      ...editingEntry,
      protocolRef: recipe.id,
      title: editingEntry.title || (lang === 'zh' ? (recipe.nameZh || recipe.name) : recipe.name),
      titleZh: editingEntry.titleZh || (recipe.nameZh || ''),
      duration: recipe.duration || editingEntry.duration,
      procedure: { mode: 'template', protocolSteps: steps, freeText: editingEntry.procedure?.freeText || '' }
    };
    if (recipe.materials) {
      next.materials = {
        ...next.materials,
        reagents: recipe.materials.map(m => ({
          name: typeof m === 'string' ? m : (m.name || m.reagent || ''),
          amount: m.amount || '', unit: m.unit || '', location: '', inventoryRef: null
        }))
      };
    }
    setEditingEntry(next);
    autoSave(next);
    setShowProtocolImport(false);
    toast.show(lang === 'zh' ? '已从方案导入' : 'Imported from protocol');
  }, [editingEntry, lang, autoSave, toast]);

  const exportMarkdown = useCallback(() => {
    if (!editingEntry) return;
    const e = editingEntry;
    let md = `# ${e.title || 'Untitled Experiment'}\n`;
    if (e.titleZh) md += `**${e.titleZh}**\n`;
    md += `\n**Date:** ${e.date || 'N/A'}  \n`;
    md += `**Status:** ${e.status}  \n**Priority:** ${e.priority}\n`;
    if (e.protocolRef) md += `**Protocol:** ${e.protocolRef}\n`;
    md += `\n## Plan\n\n### Objectives\n${e.plan?.objectives || '_None_'}\n\n### Notes\n${e.plan?.notes || '_None_'}\n`;
    md += `\n## Materials\n\n### Reagents\n`;
    (e.materials?.reagents || []).forEach(r => { md += `- ${r.name}${r.amount ? ': ' + r.amount + ' ' + (r.unit || '') : ''}${r.location ? ' (' + r.location + ')' : ''}\n`; });
    if ((e.materials?.equipment || []).length) { md += `\n### Equipment\n`; e.materials.equipment.forEach(eq => { md += `- [${eq.status === 'ready' ? 'x' : ' '}] ${eq.name}\n`; }); }
    if ((e.materials?.checklist || []).length) { md += `\n### Checklist\n`; e.materials.checklist.forEach(c => { md += `- [${c.checked ? 'x' : ' '}] ${c.item}\n`; }); }
    md += `\n## Procedure\n\n`;
    if (e.procedure?.mode === 'template' && e.procedure.protocolSteps?.length) {
      e.procedure.protocolSteps.forEach((s, i) => {
        md += `${i + 1}. [${s.completed ? 'x' : ' '}] ${s.stepText}\n`;
        if (s.deviation) md += `   - **Deviation:** ${s.deviation}\n`;
        if (s.actualParams) md += `   - **Actual:** ${s.actualParams}\n`;
      });
    } else { md += e.procedure?.freeText || '_None_'; }
    md += `\n\n## Results\n\n### Summary\n${e.results?.summary || '_None_'}\n`;
    if (e.results?.dataProcessing) md += `\n### Data Processing\n${e.results.dataProcessing}\n`;
    if ((e.results?.figures || []).length) { md += `\n### Figures\n`; e.results.figures.forEach((f, i) => { md += `${i + 1}. ${f.description}${f.notes ? ' — ' + f.notes : ''}\n`; }); }
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `experiment_${e.date || 'entry'}_${e.id.slice(-6)}.md`; a.click();
    URL.revokeObjectURL(url);
    toast.show(t('downloaded', lang));
  }, [editingEntry, lang, toast]);

  const handleExportJson = useCallback(async () => {
    const json = await exportExperimentsJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `labmate_experiments_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.show(t('downloaded', lang));
  }, [lang, toast]);

  const handleImportJson = useCallback(async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const count = await importExperimentsJSON(text);
      await reload();
      toast.show((lang === 'zh' ? '已导入 ' : 'Imported ') + count + (lang === 'zh' ? ' 条记录' : ' entries'));
    } catch (err) {
      toast.show(lang === 'zh' ? '导入失败' : 'Import failed');
    }
    e.target.value = '';
  }, [reload, lang, toast]);

  const statusColors = { planned: 'var(--base-c)', 'in-progress': 'var(--base-g)', completed: 'var(--base-a)', cancelled: 'var(--base-t)' };
  const priorityColors = { high: 'var(--base-t)', medium: 'var(--base-g)', low: 'var(--base-a)' };

  // --- Section renderers ---
  const renderSection = (key, icon, labelKey, content) => (
    <div className="mb-3" key={key}>
      <button onClick={() => toggleSection(key)}
        className="w-full flex items-center gap-2 py-2 px-3 rounded-lg text-left font-semibold text-sm transition-colors"
        style={{ background: 'var(--bg-2)', color: 'var(--text)', border: '1px solid var(--border)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 0, background: 'var(--primary)', color: 'var(--on-primary)', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0 }}>{icon}</span>
        <span className="flex-1">{t(labelKey, lang)}</span>
        <span style={{ transform: expandedSections[key] ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', fontSize: '0.7rem' }}>&#9660;</span>
      </button>
      {expandedSections[key] && <div className="mt-2 px-1">{content}</div>}
    </div>
  );

  const renderPlanSection = () => renderSection('plan', '1', 'nbPlan', (
    <div className="space-y-3">
      <div>
        <label>{t('nbObjectives', lang)}</label>
        <textarea value={editingEntry?.plan?.objectives || ''} onChange={e => updateField('plan.objectives', e.target.value)}
          className="w-full" rows={3} placeholder={lang === 'zh' ? '描述实验目的...' : 'Describe experiment objectives...'} />
      </div>
      <div>
        <label>{t('nbNotes', lang)}</label>
        <textarea value={editingEntry?.plan?.notes || ''} onChange={e => updateField('plan.notes', e.target.value)}
          className="w-full" rows={2} placeholder={lang === 'zh' ? '其他备注...' : 'Additional notes...'} />
      </div>
    </div>
  ));

  const renderMaterialsSection = () => {
    const reagents = editingEntry?.materials?.reagents || [];
    const equipment = editingEntry?.materials?.equipment || [];
    const checklist = editingEntry?.materials?.checklist || [];
    return renderSection('materials', '2', 'nbMaterials', (
      <div className="space-y-4">
        {/* Reagents */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold">{t('nbReagents', lang)}</h4>
            <div className="flex gap-1">
              <button onClick={() => { const next = [...reagents, { name: '', amount: '', unit: '', location: '', inventoryRef: null }]; updateField('materials.reagents', next); }}
                className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>+ {t('nbAddReagent', lang)}</button>
            </div>
          </div>
          {reagents.map((r, i) => (
            <div key={i} className="flex gap-2 mb-2 items-center flex-wrap">
              <input type="text" value={r.name} placeholder={t('nbReagentName', lang)}
                onChange={e => { const next = [...reagents]; next[i] = { ...next[i], name: e.target.value }; updateField('materials.reagents', next); }}
                className="flex-1 min-w-[120px]" style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
              <input type="text" value={r.amount} placeholder={t('nbAmount', lang)}
                onChange={e => { const next = [...reagents]; next[i] = { ...next[i], amount: e.target.value }; updateField('materials.reagents', next); }}
                style={{ width: '70px', padding: '4px 8px', fontSize: '0.82rem' }} />
              <input type="text" value={r.unit} placeholder={t('nbUnit', lang)}
                onChange={e => { const next = [...reagents]; next[i] = { ...next[i], unit: e.target.value }; updateField('materials.reagents', next); }}
                style={{ width: '50px', padding: '4px 8px', fontSize: '0.82rem' }} />
              <input type="text" value={r.location} placeholder={t('nbLocation', lang)}
                onChange={e => { const next = [...reagents]; next[i] = { ...next[i], location: e.target.value }; updateField('materials.reagents', next); }}
                style={{ width: '90px', padding: '4px 8px', fontSize: '0.82rem' }} />
              <button onClick={() => { const next = reagents.filter((_, j) => j !== i); updateField('materials.reagents', next); }}
                aria-label={lang === 'zh' ? '删除' : 'Remove'}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '2px', ...(isMobile ? { minWidth: 40, minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } : {}) }}>&times;</button>
            </div>
          ))}
        </div>
        {/* Equipment */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold">{t('nbEquipment', lang)}</h4>
            <button onClick={() => { const next = [...equipment, { name: '', status: 'pending' }]; updateField('materials.equipment', next); }}
              className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>+ {t('nbAddEquipment', lang)}</button>
          </div>
          {equipment.map((eq, i) => (
            <div key={i} className="flex gap-2 mb-1.5 items-center">
              <input type="text" value={eq.name} placeholder={t('nbEquipmentName', lang)}
                onChange={e => { const next = [...equipment]; next[i] = { ...next[i], name: e.target.value }; updateField('materials.equipment', next); }}
                className="flex-1" style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
              <select value={eq.status} onChange={e => { const next = [...equipment]; next[i] = { ...next[i], status: e.target.value }; updateField('materials.equipment', next); }}
                style={{ padding: '4px 6px', fontSize: '0.82rem', width: '80px' }}>
                <option value="ready">{t('nbReady', lang)}</option>
                <option value="pending">{t('nbPending', lang)}</option>
              </select>
              <button onClick={() => { updateField('materials.equipment', equipment.filter((_, j) => j !== i)); }}
                aria-label={lang === 'zh' ? '删除' : 'Remove'}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '2px', ...(isMobile ? { minWidth: 40, minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } : {}) }}>&times;</button>
            </div>
          ))}
        </div>
        {/* Checklist */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-bold">{t('nbChecklist', lang)}</h4>
            <button onClick={() => { updateField('materials.checklist', [...checklist, { item: '', checked: false }]); }}
              className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>+ {t('nbAddCheckItem', lang)}</button>
          </div>
          {checklist.map((c, i) => (
            <div key={i} className="flex gap-2 mb-1.5 items-center">
              <input type="checkbox" checked={c.checked}
                onChange={e => { const next = [...checklist]; next[i] = { ...next[i], checked: e.target.checked }; updateField('materials.checklist', next); }}
                style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
              <input type="text" value={c.item}
                onChange={e => { const next = [...checklist]; next[i] = { ...next[i], item: e.target.value }; updateField('materials.checklist', next); }}
                className="flex-1" style={{ padding: '4px 8px', fontSize: '0.82rem', textDecoration: c.checked ? 'line-through' : 'none', opacity: c.checked ? 0.6 : 1 }} />
              <button onClick={() => { updateField('materials.checklist', checklist.filter((_, j) => j !== i)); }}
                aria-label={lang === 'zh' ? '删除' : 'Remove'}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '2px', ...(isMobile ? { minWidth: 40, minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } : {}) }}>&times;</button>
            </div>
          ))}
        </div>
      </div>
    ));
  };

  const renderProcedureSection = () => {
    const proc = editingEntry?.procedure || { mode: 'freetext', protocolSteps: [], freeText: '' };
    return renderSection('procedure', '3', 'nbProcedure', (
      <div className="space-y-3">
        <div className="flex gap-2 items-center flex-wrap">
          <button onClick={() => updateField('procedure.mode', 'template')}
            className={proc.mode === 'template' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '4px 12px', fontSize: '0.78rem' }}>
            {t('nbTemplateMode', lang)}
          </button>
          <button onClick={() => updateField('procedure.mode', 'freetext')}
            className={proc.mode === 'freetext' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '4px 12px', fontSize: '0.78rem' }}>
            {t('nbFreetextMode', lang)}
          </button>
          {proc.mode === 'template' && (
            <button onClick={() => setShowProtocolImport(true)}
              className="btn-secondary" style={{ padding: '4px 12px', fontSize: '0.78rem' }}>
              {t('nbImportProtocol', lang)}
            </button>
          )}
        </div>
        {proc.mode === 'template' ? (
          <div className="space-y-2">
            {(proc.protocolSteps || []).length === 0 && (
              <p className="text-sm py-4 text-center" style={S_MUTED}>
                {lang === 'zh' ? '点击"从方案导入"加载步骤' : 'Click "Import from Protocol" to load steps'}
              </p>
            )}
            {(proc.protocolSteps || []).map((step, i) => (
              <div key={i} className="p-2 rounded-lg" style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                <div className="flex gap-2 items-start">
                  <input type="checkbox" checked={step.completed}
                    onChange={e => {
                      const next = [...proc.protocolSteps]; next[i] = { ...next[i], completed: e.target.checked };
                      updateField('procedure.protocolSteps', next);
                    }}
                    style={{ accentColor: 'var(--primary)', marginTop: 4, width: 16, height: 16 }} />
                  <div className="flex-1">
                    <p className="text-sm" style={{ opacity: step.completed ? 0.5 : 1, textDecoration: step.completed ? 'line-through' : 'none' }}>
                      <span className="font-semibold mr-1" style={{ color: 'var(--primary)' }}>{i + 1}.</span>
                      {step.stepText}
                    </p>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <input type="text" value={step.deviation || ''} placeholder={t('nbDeviation', lang)}
                        onChange={e => { const next = [...proc.protocolSteps]; next[i] = { ...next[i], deviation: e.target.value }; updateField('procedure.protocolSteps', next); }}
                        className="flex-1 min-w-[120px]" style={{ padding: '3px 6px', fontSize: '0.75rem' }} />
                      <input type="text" value={step.actualParams || ''} placeholder={t('nbActualParams', lang)}
                        onChange={e => { const next = [...proc.protocolSteps]; next[i] = { ...next[i], actualParams: e.target.value }; updateField('procedure.protocolSteps', next); }}
                        className="flex-1 min-w-[120px]" style={{ padding: '3px 6px', fontSize: '0.75rem' }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <textarea value={proc.freeText || ''} onChange={e => updateField('procedure.freeText', e.target.value)}
            className="w-full" rows={8} placeholder={lang === 'zh' ? '自由记录实验步骤...' : 'Record experiment procedure...'} />
        )}
      </div>
    ));
  };

  const renderResultsSection = () => {
    const res = editingEntry?.results || { summary: '', dataProcessing: '', figures: [], backupStatus: '' };
    return renderSection('results', '4', 'nbResults', (
      <div className="space-y-3">
        <div>
          <label>{t('nbSummary', lang)}</label>
          <textarea value={res.summary || ''} onChange={e => updateField('results.summary', e.target.value)}
            className="w-full" rows={3} placeholder={lang === 'zh' ? '实验结果总结...' : 'Summarize results...'} />
        </div>
        <div>
          <label>{t('nbDataProcessing', lang)}</label>
          <textarea value={res.dataProcessing || ''} onChange={e => updateField('results.dataProcessing', e.target.value)}
            className="w-full" rows={2} placeholder={lang === 'zh' ? '数据处理方法和结果...' : 'Data processing methods and results...'} />
        </div>
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="mb-0">{t('nbFigures', lang)}</label>
            <button onClick={() => updateField('results.figures', [...(res.figures || []), { description: '', notes: '' }])}
              className="btn-secondary" style={{ padding: '2px 8px', fontSize: '0.75rem' }}>+ {t('nbAddFigure', lang)}</button>
          </div>
          {(res.figures || []).map((fig, i) => (
            <div key={i} className="flex gap-2 mb-1.5 items-center">
              <input type="text" value={fig.description} placeholder={t('nbFigureDesc', lang)}
                onChange={e => { const next = [...res.figures]; next[i] = { ...next[i], description: e.target.value }; updateField('results.figures', next); }}
                className="flex-1" style={{ padding: '4px 8px', fontSize: '0.82rem' }} />
              <input type="text" value={fig.notes} placeholder={t('nbFigureNotes', lang)}
                onChange={e => { const next = [...res.figures]; next[i] = { ...next[i], notes: e.target.value }; updateField('results.figures', next); }}
                style={{ width: '120px', padding: '4px 8px', fontSize: '0.82rem' }} />
              <button onClick={() => updateField('results.figures', res.figures.filter((_, j) => j !== i))}
                aria-label={lang === 'zh' ? '删除' : 'Remove'}
                style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '2px', ...(isMobile ? { minWidth: 40, minHeight: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } : {}) }}>&times;</button>
            </div>
          ))}
        </div>
        <div>
          <label>{t('nbBackupStatus', lang)}</label>
          <input type="text" value={res.backupStatus || ''} onChange={e => updateField('results.backupStatus', e.target.value)}
            className="w-full" placeholder={lang === 'zh' ? '备份位置/状态...' : 'Backup location/status...'} />
        </div>
      </div>
    ));
  };

  // Protocol import modal
  const protocolImportModal = showProtocolImport && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="card p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" style={{ background: 'var(--card)' }}>
        <h3 className="text-lg font-semibold mb-3">{t('nbImportProtocol', lang)}</h3>
        <ProtocolSelector lang={lang} onSelect={handleImportProtocol} onClose={() => setShowProtocolImport(false)} />
      </div>
    </div>
  );

  // Sidebar
  const sidebar = (
    <div className="card card-scroll p-3" style={{ maxHeight: 'calc(100vh - 240px)' }}>
      <div className="flex items-center gap-2 mb-3">
        <button onClick={handleNewEntry} className="btn-primary flex-1" style={{ padding: '6px 12px', fontSize: '0.82rem' }}>
          + {t('nbNewEntry', lang)}
        </button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => jsonInputRef.current?.click()} className="btn-secondary" style={{ padding: '6px 8px', fontSize: '0.75rem' }} title={t('nbImportJson', lang)}>&darr;</button>
          <input ref={jsonInputRef} type="file" accept=".json" onChange={handleImportJson} style={{ display: 'none' }} />
        </div>
        <button onClick={handleExportJson} className="btn-secondary" style={{ padding: '6px 8px', fontSize: '0.75rem' }} title={t('nbExportJson', lang)}>&uarr;</button>
      </div>
      <input type="search" value={search} onChange={e => setSearch(e.target.value)}
        placeholder={t('nbSearch', lang)} className="w-full mb-2" style={{ padding: '5px 10px', fontSize: '0.82rem' }} />
      <div className="flex gap-1 mb-3 flex-wrap">
        {['all', 'planned', 'in-progress', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="text-xs px-2.5 py-0.5 font-medium transition-colors"
            style={{
              ...(statusFilter === s
                ? { background: 'var(--primary)', color: 'var(--on-primary)' }
                : { background: 'var(--bg-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }),
              ...(isMobile ? { minHeight: 36, padding: '0 12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } : {}),
            }}>
            {s === 'all' ? t('nbAll', lang) : t('nbStatus' + s.replace(/-./g, m => m[1].toUpperCase()).replace(/^./, c => c.toUpperCase()), lang)}
          </button>
        ))}
      </div>
      {loading && <p className="text-sm text-center py-4" style={S_MUTED}>Loading...</p>}
      {!loading && filteredEntries.length === 0 && (
        <div className="text-center py-8">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{margin:'0 auto 8px'}}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
          <p className="text-sm" style={S_MUTED}>{t('nbNoEntries', lang)}</p>
          <p className="text-xs mt-1" style={S_MUTED}>{t('nbNoEntriesHint', lang)}</p>
        </div>
      )}
      <div className="space-y-1">
        {filteredEntries.map(entry => {
          const isSelected = entry.id === selectedId;
          const title = lang === 'zh' ? (entry.titleZh || entry.title || '\u2014') : (entry.title || '\u2014');
          return (
            <button key={entry.id} onClick={() => { setSelectedId(entry.id); setEditingEntry(JSON.parse(JSON.stringify(entry))); if (isMobile) setMobileView('editor'); }}
              className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
              style={{
                background: isSelected ? 'var(--primary-light)' : 'transparent',
                border: isSelected ? '1px solid var(--primary)' : '1px solid transparent',
                color: 'var(--text)'
              }}>
              <div className="flex items-center gap-2">
                <span className="text-xs" style={{ color: statusColors[entry.status] || 'var(--text-muted)' }}>&#9679;</span>
                <span className="text-sm font-medium truncate flex-1">{title || (lang === 'zh' ? '未命名' : 'Untitled')}</span>
                <span className="text-xs" style={{ color: priorityColors[entry.priority] || 'var(--text-muted)' }}>&#9679;</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5 ml-4">
                <span className="text-xs mono" style={S_MUTED}>{entry.date || ''}</span>
                {entry.protocolRef && <span className="text-xs px-1.5 py-0 rounded" style={S_PILL_PRIMARY}>&#8226;</span>}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Editor
  const editor = editingEntry ? (
    <div className="card card-scroll p-4" style={{ maxHeight: 'calc(100vh - 240px)' }}>
      {isMobile && (
        <button onClick={() => setMobileView('list')} className="mb-3 text-sm font-medium flex items-center gap-1" style={{ color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          &larr; {t('backNav', lang)}
        </button>
      )}
      {/* Header fields */}
      <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr' }}>
        <div>
          <label>{t('nbEntryTitle', lang)}</label>
          <input type="text" value={editingEntry.title || ''} onChange={e => updateField('title', e.target.value)}
            className="w-full" placeholder={lang === 'zh' ? '实验标题 (EN)' : 'Experiment title'} />
        </div>
        <div>
          <label>{t('nbEntryTitleZh', lang)}</label>
          <input type="text" value={editingEntry.titleZh || ''} onChange={e => updateField('titleZh', e.target.value)}
            className="w-full" placeholder={lang === 'zh' ? '中文标题' : 'Chinese title (optional)'} />
        </div>
        <div>
          <label>{t('nbDate', lang)}</label>
          <input type="date" value={editingEntry.date || ''} onChange={e => updateField('date', e.target.value)} className="w-full" />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label>{t('nbStartTime', lang)}</label>
            <input type="time" value={editingEntry.startTime || ''} onChange={e => updateField('startTime', e.target.value)} className="w-full" />
          </div>
          <div style={{ width: 80 }}>
            <label>{t('nbDuration', lang)}</label>
            <input type="number" value={editingEntry.duration || ''} onChange={e => updateField('duration', parseInt(e.target.value) || 0)} className="w-full" min="0" />
          </div>
        </div>
        <div>
          <label>{t('nbStatus', lang)}</label>
          <select value={editingEntry.status || 'planned'} onChange={e => updateField('status', e.target.value)} className="w-full">
            <option value="planned">{t('nbStatusPlanned', lang)}</option>
            <option value="in-progress">{t('nbStatusInProgress', lang)}</option>
            <option value="completed">{t('nbStatusCompleted', lang)}</option>
            <option value="cancelled">{t('nbStatusCancelled', lang)}</option>
          </select>
        </div>
        <div>
          <label>{t('nbPriority', lang)}</label>
          <select value={editingEntry.priority || 'medium'} onChange={e => updateField('priority', e.target.value)} className="w-full">
            <option value="high">{t('nbPriorityHigh', lang)}</option>
            <option value="medium">{t('nbPriorityMedium', lang)}</option>
            <option value="low">{t('nbPriorityLow', lang)}</option>
          </select>
        </div>
      </div>
      {editingEntry.protocolRef && (
        <div className="mb-3 px-3 py-1.5 rounded-lg text-xs flex items-center gap-2" style={S_PILL_PRIMARY}>
          <span>&rarr;</span>
          <span>{t('nbLinkedProtocol', lang)}: {RECIPE_BY_ID[editingEntry.protocolRef]?.name || editingEntry.protocolRef}</span>
        </div>
      )}
      {/* 4 sections */}
      {renderPlanSection()}
      {renderMaterialsSection()}
      {renderProcedureSection()}
      {renderResultsSection()}
      {/* Action buttons */}
      <div className="flex gap-2 mt-4 pt-3 flex-wrap" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={exportMarkdown} className="btn-secondary" style={{ padding: '5px 12px', fontSize: '0.78rem' }}>{t('nbExportMd', lang)}</button>
        <div className="flex-1" />
        <button onClick={() => setShowDeleteConfirm(true)} className="btn-secondary" style={{ padding: '5px 12px', fontSize: '0.78rem', color: 'var(--danger-text)' }}>
          {t('nbDeleteEntry', lang)}
        </button>
      </div>
    </div>
  ) : (
    <div className="card p-8 flex flex-col items-center justify-center" style={{ minHeight: 400 }}>
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{margin:'0 auto 12px'}}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
      <p className="text-sm" style={S_MUTED}>{t('nbSelectEntry', lang)}</p>
    </div>
  );

  // Delete confirm
  const deleteConfirmModal = showDeleteConfirm && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="card p-6 max-w-sm w-full" style={{ background: 'var(--card)' }}>
        <p className="text-sm mb-4">{t('nbDeleteConfirm', lang)}</p>
        <div className="flex gap-2 justify-end">
          <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary" style={{ padding: '5px 14px', fontSize: '0.82rem' }}>{t('nbCancel', lang)}</button>
          <button onClick={handleDelete} className="btn-primary" style={{ padding: '5px 14px', fontSize: '0.82rem', background: 'var(--danger-border)', borderColor: 'var(--danger-border)', color: 'var(--on-danger)' }}>{t('nbDeleteEntry', lang)}</button>
        </div>
      </div>
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={S_TEXT}>{t('nbTitle', lang)}</h2>
        <p className="text-sm mt-1" style={S_MUTED}>{t('nbSubtitle', lang)}</p>
      </div>
      {isMobile ? (
        mobileView === 'list' ? sidebar : editor
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: '320px 1fr' }}>
          {sidebar}
          {editor}
        </div>
      )}
      {protocolImportModal}
      {deleteConfirmModal}
    </div>
  );
}

export default NotebookTab;
