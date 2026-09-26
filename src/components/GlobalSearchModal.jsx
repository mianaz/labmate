import { useState, useMemo, useRef, useEffect, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import { t, useLang } from '../i18n/index.js';
import { getRecipeNotes } from '../lib/utils.js';
import { loadCustomRecipes, loadCustomProtocols } from '../hooks/useLocalStorage.js';
import { useRecipes } from '../lib/RecipeProvider.jsx';
import { CAT_COLORS, categoryLabel } from './RecipeRow.jsx';
import { IconSearch, IconArrowRight } from './icons.jsx';

const SUGGESTIONS = ['PBS', 'Tris', 'ChIP', 'WB', 'CRISPR', 'RNA', '转膜', '蛋白纯化'];

function GlobalSearchModal({ isOpen, onClose, onSelect, onSwitchTab }) {
  const lang = useLang();
  const { recipes: RECIPES } = useRecipes();

  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [cachedCustom] = useState(() => ({
    recipes: loadCustomRecipes().map(r => ({...r, _isCustom: true})),
    protocols: loadCustomProtocols().map(r => ({...r, _isCustom: true}))
  }));
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
      setQuery('');
      setActive(0);
    }
  }, [isOpen]);

  // Lowercase every searchable field once per library change, not per keystroke
  // per recipe (the notes alone are ~90 KB of text across the library).
  const index = useMemo(() => {
    const allRecipes = [...RECIPES, ...cachedCustom.recipes, ...cachedCustom.protocols];
    return allRecipes.map(r => ({
      r,
      name: (r.name || '').toLowerCase(),
      cn: r.nameCn || '',
      tags: (r.tags || []).map(t => String(t).toLowerCase()),
      comps: (r.components || []).map(c => String(c?.name || '').toLowerCase()),
      notes: (getRecipeNotes(r, 'en') + ' ' + getRecipeNotes(r, 'zh')).toLowerCase(),
    }));
  }, [RECIPES, cachedCustom]);

  // Let typing stay responsive; the result list follows a beat behind.
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(() => {
    if (!deferredQuery || deferredQuery.length < 1) return [];
    const q = deferredQuery.toLowerCase();
    return index.map(({ r, name, cn, tags, comps, notes }) => {
      let score = 0;
      const nameMatch = name.includes(q);
      const cnMatch = cn.includes(q);
      const tagMatch = tags.some(t => t.includes(q));
      const compMatch = comps.some(c => c.includes(q));
      const noteMatch = notes.includes(q);
      if (nameMatch) score += 10;
      if (cnMatch) score += 8;
      if (tagMatch) score += 5;
      if (compMatch) score += 6;
      if (noteMatch) score += 2;
      return { recipe: r, score, nameMatch, compMatch, tagMatch };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 15);
  }, [deferredQuery, index]);

  useEffect(() => { setActive(0); }, [deferredQuery]);

  function choose(r) {
    onSelect(r);
    onSwitchTab(r.category === 'protocol' ? 'protocols' : 'buffers');
    onClose();
  }

  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); onClose(); }
      if (e.key === 'Escape' && isOpen) onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  function onInputKeyDown(e) {
    if (!results.length) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      setActive(next);
      listRef.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[active];
      if (hit) choose(hit.recipe);
    }
  }

  if (!isOpen) return null;

  const q = query.toLowerCase();
  const activeId = results[active] ? `search-opt-${results[active].recipe.id}` : undefined;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center px-3 pt-3 sm:pt-[12vh]">
      <div className="overlay-backdrop" onClick={onClose} aria-hidden="true" />
      <div className="dialog w-full sm:max-w-2xl flex flex-col" role="dialog" aria-modal="true" aria-label="Search recipes"
        style={{ zIndex: 51, maxHeight: 'min(640px, 80vh)' }}>
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--border-strong)', minHeight: '3.5rem' }}>
          <IconSearch size={18} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input ref={inputRef} id="global-search" type="search" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={lang === 'en' ? 'Search recipes, reagents, tags...' : '搜索配方、试剂名、标签...'}
            aria-label="Search recipes"
            role="combobox" aria-expanded={results.length > 0} aria-controls="global-search-results" aria-autocomplete="list"
            aria-activedescendant={activeId}
            className="input-bare flex-1" style={{ fontFamily: 'var(--font-body)', fontSize: '1rem', height: '3.5rem' }} />
          <button type="button" onClick={onClose} className="kbd" style={{ cursor: 'pointer', height: '1.375rem' }} aria-label={t('closeLabel', lang)}>ESC</button>
        </div>

        <div ref={listRef} className="overflow-y-auto flex-1 py-1.5">
          {query && results.length === 0 && (
            <div className="empty" style={{ padding: '2rem 1rem' }}>
              <p className="empty-title">{t('noResults', lang)}</p>
            </div>
          )}
          {results.length > 0 && (
            <ul id="global-search-results" role="listbox" aria-label="Search recipes">
              {results.map(({ recipe: r, compMatch }, i) => {
                const cc = CAT_COLORS[r.category] || CAT_COLORS.buffer;
                const isActive = i === active;
                return (
                  <li key={r.id} id={`search-opt-${r.id}`} role="option" aria-selected={isActive} data-index={i}
                    onClick={() => choose(r)} onMouseMove={() => active !== i && setActive(i)}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer"
                    style={{ background: isActive ? 'var(--primary-light)' : 'transparent', boxShadow: isActive ? 'inset 3px 0 0 var(--primary)' : 'none' }}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate" style={{ fontSize: '0.875rem', fontWeight: 600 }}>{r.name}</span>
                        {r._isCustom && <span className="badge badge-green">{t('customBadge', lang)}</span>}
                      </div>
                      {lang === 'zh' && r.nameCn && <p className="truncate" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{r.nameCn}</p>}
                      {compMatch && (
                        <p className="mono truncate mt-0.5" style={{ fontSize: '0.6875rem', color: 'var(--warning-text)' }}>
                          {t('searchContains', lang)}: {r.components.filter(c => c.name.toLowerCase().includes(q)).map(c => c.name).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="eyebrow inline-flex items-center gap-1.5 flex-shrink-0" style={{ color: cc.text, fontSize: '0.625rem' }}>
                      <span className="dot" style={{ width: 6, height: 6 }} aria-hidden="true" />{categoryLabel(r, lang)}
                    </span>
                    <IconArrowRight size={14} style={{ color: isActive ? 'var(--accent)' : 'var(--rule)', flexShrink: 0 }} />
                  </li>
                );
              })}
            </ul>
          )}
          {!query && (
            <div className="px-4 py-6 text-center">
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{t('searchHint', lang)}</p>
              <div className="chip-row justify-center mt-3">
                {SUGGESTIONS.map(tag => (
                  <button key={tag} type="button" className="chip" onClick={() => { setQuery(tag); inputRef.current?.focus(); }}>{tag}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-2 mono" style={{ borderTop: '1px solid var(--rule)', background: 'var(--bg-2)', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
          <span>{RECIPES.length} {t('totalRecipes', lang)}</span>
          <span className="hidden sm:inline-flex items-center gap-2">
            <kbd>↑</kbd><kbd>↓</kbd>{lang === 'zh' ? '选择' : 'navigate'}
            <kbd>↵</kbd>{lang === 'zh' ? '打开' : 'open'}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default GlobalSearchModal;
