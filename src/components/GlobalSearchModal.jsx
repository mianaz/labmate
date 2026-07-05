import { useState, useMemo, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { t, useLang } from '../i18n/index.js';
import { S_BORDER } from '../lib/styleConstants.js';
import { getRecipeNotes } from '../lib/utils.js';
import { loadCustomRecipes, loadCustomProtocols } from '../hooks/useLocalStorage.js';
import { useRecipes } from '../lib/RecipeProvider.jsx';

function GlobalSearchModal({ isOpen, onClose, onSelect, onSwitchTab }) {
  const lang = useLang();
  const { recipes: RECIPES } = useRecipes();

  const [query, setQuery] = useState('');
  const [cachedCustom] = useState(() => ({
    recipes: loadCustomRecipes().map(r => ({...r, _isCustom: true})),
    protocols: loadCustomProtocols().map(r => ({...r, _isCustom: true}))
  }));
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
    }
  }, [isOpen]);

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); onClose(); }
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const results = useMemo(() => {
    if (!query || query.length < 1) return [];
    const q = query.toLowerCase();
    const allRecipes = [...RECIPES, ...cachedCustom.recipes, ...cachedCustom.protocols];
    return allRecipes.map(r => {
      let score = 0;
      const nameMatch = r.name.toLowerCase().includes(q);
      const cnMatch = (r.nameCn || '').includes(q);
      const tagMatch = (r.tags || []).some(t => t.toLowerCase().includes(q));
      const compMatch = (r.components || []).some(c => c.name.toLowerCase().includes(q));
      const noteMatch = (getRecipeNotes(r, 'en') + ' ' + getRecipeNotes(r, 'zh')).toLowerCase().includes(q);
      if (nameMatch) score += 10;
      if (cnMatch) score += 8;
      if (tagMatch) score += 5;
      if (compMatch) score += 6;
      if (noteMatch) score += 2;
      return { recipe: r, score, nameMatch, compMatch, tagMatch };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 15);
  }, [query]);

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-w-2xl mx-4 overflow-hidden"
        role="dialog" aria-modal="true" aria-label="Search recipes"
        style={{background:'var(--card)', border:'2px solid var(--border-strong)', boxShadow:'var(--shadow-lg)'}}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-4 border-b" style={S_BORDER}>
                    <input ref={inputRef} id="global-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
            placeholder={lang === 'en' ? 'Search recipes, reagents, tags...' : '搜索配方、试剂名、标签...'}
            aria-label="Search recipes"
            className="flex-1 text-base border-none outline-none bg-transparent"
            style={{ fontFamily: 'var(--font-body)', boxShadow: 'none' }} />
          <kbd className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-400 font-mono">ESC</kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {query && results.length === 0 && (
            <p className="text-center text-gray-400 py-8 text-sm">{t('noResults', lang)}</p>
          )}
          {results.map(({ recipe: r, compMatch, tagMatch }) => {
            const catColors = {
              buffer: { bg: 'var(--cat-buffer-bg)', text: 'var(--cat-buffer)' },
              protocol: { bg: 'var(--cat-protocol-bg)', text: 'var(--cat-protocol)' },
              staining: { bg: 'var(--cat-staining-bg)', text: 'var(--cat-staining)' },
              media: { bg: 'var(--cat-media-bg)', text: 'var(--cat-media)' },
            };
            const cc = catColors[r.category] || catColors.buffer;
            return (
              <button key={r.id} onClick={() => { onSelect(r); onSwitchTab(r.category === 'protocol' ? 'protocols' : 'buffers'); onClose(); }}
                className="w-full text-left p-3 rounded-lg hover:bg-gray-50 transition-colors flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm truncate">{r.name}</span>
                    <span className="text-[10px] font-semibold" style={{ color: cc.text }}>{r.category}</span>
                    {r._isCustom && <span className="text-[9px] font-semibold px-1.5 py-0.5" style={{background:'var(--accent-light)', color:'var(--accent)'}}>{t('customBadge', lang)}</span>}
                  </div>
                  {lang === 'zh' && <p className="text-xs text-gray-500 truncate">{r.nameCn}</p>}
                  {compMatch && (
                    <p className="text-[10px] text-amber-600 mt-0.5">
                      {t('searchContains', lang)} {r.components.filter(c => c.name.toLowerCase().includes(query.toLowerCase())).map(c => c.name).join(', ')}
                    </p>
                  )}
                </div>
                <span className="text-gray-300 text-xs">→</span>
              </button>
            );
          })}
          {!query && (
            <div className="text-center py-8 text-gray-400">
              <p className="text-sm mb-2">{t('searchHint', lang)}</p>
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {['PBS', 'Tris', 'ChIP', 'WB', 'CRISPR', 'RNA', '转膜', '蛋白纯化'].map(tag => (
                  <button key={tag} onClick={() => setQuery(tag)}
                    className="text-xs px-3 py-1 bg-gray-100 text-gray-500 hover:bg-primary-light hover:text-primary transition-colors">
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t flex items-center justify-between text-[10px] text-gray-400" style={{borderColor:'var(--border)', background:'var(--bg-2)'}}>
          <span>{RECIPES.length} {t('totalRecipes', lang)}</span>
          <span>{t('searchBy', lang)}</span>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default GlobalSearchModal;
