import { useState, useMemo } from 'react';
import { t } from '../../i18n/index.js';
import { S_MUTED } from '../../lib/styleConstants.js';
import { useRecipes } from '../../lib/RecipeProvider.jsx';

export default function ProtocolSelector({ lang, onSelect, onClose }) {
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

  return (
    <div>
      <input type="search" value={search} onChange={e => setSearch(e.target.value)}
        placeholder={lang === 'zh' ? '搜索方案...' : 'Search protocols...'}
        className="w-full mb-3" style={{ padding: '6px 10px', fontSize: '0.82rem' }} />
      <div className="space-y-1" style={{ maxHeight: 400, overflowY: 'auto' }}>
        {filtered.map(r => (
          <button key={r.id} onClick={() => onSelect(r)}
            className="w-full text-left px-3 py-2.5 rounded-lg transition-colors hover:opacity-80"
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text)' }}>
            <span className="text-sm font-medium">{lang === 'zh' ? (r.nameCn || r.name) : r.name}</span>
            {r.duration && <span className="text-xs ml-2" style={S_MUTED}>~{r.duration} min</span>}
          </button>
        ))}
        {filtered.length === 0 && <p className="text-sm text-center py-4" style={S_MUTED}>{t('noResults', lang)}</p>}
      </div>
      <div className="mt-3 flex justify-end">
        <button onClick={onClose} className="btn-secondary" style={{ padding: '5px 14px', fontSize: '0.82rem' }}>{t('nbCancel', lang)}</button>
      </div>
    </div>
  );
}
