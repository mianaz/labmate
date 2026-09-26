// Protocol picker dialog, used by both the Notebook and the Calendar tab.
import { useState, useMemo } from 'react';
import { t } from '../../i18n/index.js';
import Dialog from '../../components/Dialog.jsx';
import { useRecipes } from '../../lib/RecipeProvider.jsx';
import { normalizeProtocolSteps } from '../../lib/protocolImport.js';
import { IconSearch, IconChevronRight, IconClipboard } from '../../components/icons.jsx';

// Pick a library protocol to import its steps and materials into an experiment.
export default function ProtocolSelector({ lang, onSelect, onClose, title }) {
  const { protocolRecipes } = useRecipes();
  const [search, setSearch] = useState('');
  const filtered = useMemo(() => {
    if (!search.trim()) return protocolRecipes;
    const q = search.toLowerCase();
    return protocolRecipes.filter(r =>
      (r.name || '').toLowerCase().includes(q) ||
      (r.nameCn || '').toLowerCase().includes(q) ||
      (r.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [search, protocolRecipes]);

  // What an import brings in: step and material counts per protocol.
  const counts = useMemo(() => {
    const map = {};
    protocolRecipes.forEach(r => {
      map[r.id] = { steps: normalizeProtocolSteps(r, lang).length, materials: Array.isArray(r.materials) ? r.materials.length : 0 };
    });
    return map;
  }, [protocolRecipes, lang]);

  const zh = lang === 'zh';
  return (
    <Dialog title={title || t('nbImportProtocol', lang)} onClose={onClose} lang={lang} size="lg" bodyClassName=""
      footer={<button type="button" className="btn" onClick={onClose}>{t('nbCancel', lang)}</button>}>
      <div className="px-4 py-3 space-y-2" style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--card)', borderBottom: '1px solid var(--rule)' }}>
        <div className="search-field">
          <IconSearch size={15} />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} data-autofocus
            aria-label={zh ? '搜索方案' : 'Search protocols'}
            placeholder={zh ? '搜索方案…' : 'Search protocols…'} />
        </div>
        <p className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          {zh
            ? `${filtered.length} / ${protocolRecipes.length} 个方案 · 导入步骤和材料`
            : `${filtered.length} of ${protocolRecipes.length} protocols · imports steps and materials`}
        </p>
      </div>
      {filtered.length > 0 ? (
        <div className="list">
          {filtered.map(r => {
            const primary = zh ? (r.nameCn || r.name) : r.name;
            const secondary = zh ? (r.nameCn ? r.name : '') : (r.nameCn || '');
            const c = counts[r.id] || { steps: 0, materials: 0 };
            return (
              <button key={r.id} type="button" className="list-row" onClick={() => onSelect(r)}>
                <span className="flex-1 min-w-0">
                  <span className="list-row-title block truncate">{primary}</span>
                  {secondary && <span className="list-row-sub block truncate">{secondary}</span>}
                  <span className="list-row-meta">
                    <span>{zh ? `${c.steps} 步` : `${c.steps} steps`}</span>
                    {c.materials > 0 && <span>{zh ? `${c.materials} 项材料` : `${c.materials} materials`}</span>}
                    {r.duration && <span>~{r.duration} min</span>}
                  </span>
                </span>
                <IconChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              </button>
            );
          })}
        </div>
      ) : (
        <div className="empty">
          <div className="empty-icon"><IconClipboard size={20} /></div>
          <div className="empty-title">{t('noResults', lang)}</div>
          <div className="empty-desc">{zh ? '换个关键词试试，例如 “PCR” 或 “转染”。' : 'Try another term, e.g. “PCR” or “transfection”.'}</div>
        </div>
      )}
    </Dialog>
  );
}
