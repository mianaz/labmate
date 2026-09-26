// LibraryView — the shared master–detail layout behind the Recipes and
// Protocols tabs. Desktop: sticky filterable list + document-style detail.
// Below 1024px: list → detail drill-down in a single tree (CSS toggles which
// half is visible, so only one RecipeDetail is ever mounted).
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { useFavs } from '../../components/Favorites.jsx';
import RecipeRow, { DISC_KEYS, matchesDiscipline } from '../../components/RecipeRow.jsx';
import RecipeDetail from '../../components/RecipeDetail.jsx';
import CustomRecipeFormModal from '../../components/CustomRecipeFormModal.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import db from '../../lib/db.js';
import { IconPlus, IconSearch, IconChevronLeft, IconPanelLeft, IconStar, IconFlask, IconClipboard } from '../../components/icons.jsx';

// Last opened item per library, kept for the session so leaving the tab and
// coming back returns to the same recipe/protocol.
const lastSelectedId = {};

function matchesQuery(r, q) {
  if (!q) return true;
  if (r.name.toLowerCase().includes(q) || (r.nameCn || '').includes(q)) return true;
  if ((r.tags || []).some(tag => String(tag).toLowerCase().includes(q))) return true;
  // Reagent names for recipes, material names for protocols — what the search box promises.
  const parts = r.category === 'protocol' ? (r.materials || []) : (r.components || []);
  return parts.some(c => String(c?.name || '').toLowerCase().includes(q));
}

export default function LibraryView({
  tab, items, loadCustom, saveCustom, normalizeCustom, acceptsExternal, disciplines,
  isProtocol, sidebarKey, newLabelKey, descKey, backKey,
  externalSelected, setExternalSelected, onCrossNavigate,
}) {
  const lang = useLang();
  const { favs, recent, addRecent } = useFavs();
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState('all'); // all | favs | custom
  const [disc, setDisc] = useState('all');
  const [customItems, setCustomItems] = useState(() => loadCustom());
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [listHidden, setListHidden] = useState(() => localStorage.getItem(sidebarKey) === 'true');
  const listRef = useRef(null);

  const allItems = useMemo(() => [...items, ...normalizeCustom(customItems)], [items, customItems, normalizeCustom]);

  const external = externalSelected && acceptsExternal(externalSelected) ? externalSelected : null;
  const [selected, setSelected] = useState(() => external
    || (lastSelectedId[tab] && allItems.find(r => r.id === lastSelectedId[tab]))
    || items[0] || null);
  // Phones: arriving from search / a cross-link opens the detail straight away.
  const [mobileShowDetail, setMobileShowDetail] = useState(() => !!external);

  function toggleList() {
    setListHidden(h => {
      const next = !h;
      localStorage.setItem(sidebarKey, String(next));
      db.settings.put({ key: sidebarKey, value: String(next) }).catch(() => {});
      return next;
    });
  }

  // Default selection once the library has loaded.
  useEffect(() => {
    if (!selected && items.length > 0) setSelected(items[0]);
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  // Selection handed over from global search or a cross-link — apply it, then
  // consume it so a later visit to this tab doesn't reopen it.
  useEffect(() => {
    if (!externalSelected || !acceptsExternal(externalSelected)) return;
    setSelected(externalSelected);
    setMobileShowDetail(true);
    setExternalSelected?.(null);
  }, [externalSelected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (selected) lastSelectedId[tab] = selected.id; }, [selected, tab]);

  // Re-tapping this section in the bottom nav returns from the detail to the list.
  useEffect(() => {
    function onReselect(e) {
      if (e.detail?.tab !== tab) return;
      setMobileShowDetail(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    window.addEventListener('labmate-tab-reselect', onReselect);
    return () => window.removeEventListener('labmate-tab-reselect', onReselect);
  }, [tab]);

  const q = search.trim().toLowerCase();
  const filtered = useMemo(() => allItems.filter(r => {
    if (scope === 'favs' && !favs.includes(r.id)) return false;
    if (scope === 'custom' && !r._isCustom) return false;
    if (disc !== 'all' && !matchesDiscipline(r, disc)) return false;
    return matchesQuery(r, q);
  }), [allItems, scope, disc, q, favs]);

  const discCounts = useMemo(() => Object.fromEntries(
    disciplines.map(d => [d, allItems.filter(r => matchesDiscipline(r, d)).length])
  ), [allItems, disciplines]);

  const recentItems = useMemo(
    () => recent.map(id => allItems.find(r => r.id === id)).filter(Boolean).slice(0, 5),
    [recent, allItems]
  );

  const handleSelect = useCallback((recipe) => {
    setSelected(recipe);
    addRecent(recipe.id);
  }, [addRecent]);

  const handleRowSelect = useCallback((recipe) => {
    handleSelect(recipe);
    setMobileShowDetail(true);
    if (window.innerWidth < 1024) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [handleSelect]);

  function handleSaveCustom(recipe) {
    const arr = loadCustom();
    const idx = arr.findIndex(r => r.id === recipe.id);
    if (idx >= 0) arr[idx] = recipe; else arr.push(recipe);
    saveCustom(arr);
    setCustomItems(arr);
    setSelected(normalizeCustom([recipe])[0] || recipe);
    setMobileShowDetail(true);
    window.dispatchEvent(new window.CustomEvent('labmate-custom-changed'));
  }
  function handleDeleteCustom(recipe) {
    const arr = loadCustom().filter(r => r.id !== recipe.id);
    saveCustom(arr);
    setCustomItems(arr);
    setSelected(items[0] || null);
    setMobileShowDetail(false);
    window.dispatchEvent(new window.CustomEvent('labmate-custom-changed'));
  }
  function handleEditCustom(recipe) {
    setEditing(recipe);
    setShowCustomForm(true);
  }
  function openNew() {
    setEditing(null);
    setShowCustomForm(true);
  }
  function clearFilters() {
    setSearch('');
    setScope('all');
    setDisc('all');
  }

  // ↑/↓ move between rows (each row is one tab stop; the star is mouse-only,
  // the detail view has the keyboard-accessible favourite toggle).
  function onListKeyDown(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const rows = [...(listRef.current?.querySelectorAll('[data-row]') || [])];
    const i = rows.indexOf(document.activeElement);
    if (i === -1) return;
    e.preventDefault();
    const next = rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    next?.focus();
  }

  const filtersActive = scope !== 'all' || disc !== 'all' || !!q;
  const EmptyIcon = isProtocol ? IconClipboard : IconFlask;
  const title = t(isProtocol ? 'tabProtocols' : 'tabBuffers', lang);

  let emptyState = null;
  if (filtered.length === 0) {
    if (scope === 'favs' && !q && disc === 'all') {
      emptyState = (
        <div className="empty">
          <div className="empty-icon"><IconStar size={20} /></div>
          <p className="empty-title">{lang === 'zh' ? '还没有收藏' : 'No favorites yet'}</p>
          <p className="empty-desc">{lang === 'zh' ? '点击任意条目上的 ☆ 即可收藏，方便快速找到。' : 'Star anything you use often and it will show up here.'}</p>
        </div>
      );
    } else if (scope === 'custom' && !q && disc === 'all') {
      emptyState = (
        <div className="empty">
          <div className="empty-icon"><EmptyIcon size={20} /></div>
          <p className="empty-title">{lang === 'zh' ? '还没有自定义条目' : `No custom ${isProtocol ? 'protocols' : 'recipes'} yet`}</p>
          <p className="empty-desc">{lang === 'zh' ? '添加实验室自己的配方或方案，仅保存在本机。' : 'Add your lab’s own versions — they stay on this device.'}</p>
          <button type="button" className="btn-primary btn-sm" onClick={openNew}><IconPlus size={14} />{t(newLabelKey, lang)}</button>
        </div>
      );
    } else {
      emptyState = (
        <div className="empty">
          <div className="empty-icon"><IconSearch size={20} /></div>
          <p className="empty-title">{t('noResults', lang)}</p>
          <button type="button" className="btn btn-sm" onClick={clearFilters}>{lang === 'zh' ? '清除筛选' : 'Clear filters'}</button>
        </div>
      );
    }
  }

  return (
    <div className={`library-root${mobileShowDetail ? ' show-detail' : ''}`}>
      <PageHeader
        tab={tab}
        title={title}
        meta={String(allItems.length)}
        description={t(descKey, lang)}
        actions={(
          <>
            <button type="button" className="btn hidden lg:inline-flex" onClick={toggleList} aria-pressed={!listHidden}>
              <IconPanelLeft size={15} collapsed={listHidden} />{t(listHidden ? 'showList' : 'hideList', lang)}
            </button>
            <button type="button" className="btn-primary" onClick={openNew}>
              <IconPlus size={15} />{t(newLabelKey, lang)}
            </button>
          </>
        )}
      />

      <div className={`library${listHidden ? ' is-list-hidden' : ''}${mobileShowDetail ? ' show-detail' : ''}`}>
        <aside className="panel library-list" aria-label={title}>
            <div className="p-3 space-y-2" style={{ borderBottom: '1px solid var(--rule)' }}>
              <div className="search-field">
                <IconSearch size={15} />
                <input type="search" autoComplete="off" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={lang === 'zh' ? '名称、试剂或标签' : 'Name, reagent or tag'} aria-label={t('searchPlaceholder', lang)} />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="seg flex-shrink-0" role="group" aria-label={lang === 'zh' ? '范围' : 'Show'}>
                  <button type="button" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>{t('all', lang)}</button>
                  <button type="button" aria-pressed={scope === 'favs'} onClick={() => setScope('favs')} title={t('favorites', lang)}>
                    <span className="inline-flex items-center"><IconStar size={13} filled={scope === 'favs'} /><span className="sr-only">{t('favorites', lang)}</span></span>
                  </button>
                  <button type="button" aria-pressed={scope === 'custom'} onClick={() => setScope('custom')}>{t('customBadge', lang)}</button>
                </div>
                <select value={disc} onChange={e => setDisc(e.target.value)} className="min-w-0"
                  aria-label={lang === 'zh' ? '学科' : 'Discipline'}
                  style={{ flex: '1 1 7.5rem', minHeight: '1.875rem', paddingTop: '0.2rem', paddingBottom: '0.2rem', fontSize: '0.75rem' }}>
                  <option value="all">{lang === 'zh' ? '全部学科' : 'Discipline'}</option>
                  {disciplines.map(d => (
                    <option key={d} value={d}>{t(DISC_KEYS[d], lang)}{discCounts[d] ? ` (${discCounts[d]})` : ''}</option>
                  ))}
                </select>
              </div>
              {recentItems.length > 0 && !filtersActive && (
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="eyebrow flex-shrink-0" style={{ fontSize: '0.625rem' }}>{t('recentlyUsed', lang)}</span>
                  <div className="chip-row is-scroll">
                    {recentItems.map(r => (
                      <button key={r.id} type="button" className="chip" onClick={() => handleRowSelect(r)}
                        style={{ minHeight: '1.5rem', fontSize: '0.6875rem', maxWidth: '11rem' }} title={r.name}>
                        <span className="truncate">{r.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div ref={listRef} className="library-list-scroll list" onKeyDown={onListKeyDown}>
              {filtered.map(r => (
                <RecipeRow key={r.id} recipe={r} onSelect={handleRowSelect} selected={selected?.id === r.id} />
              ))}
              {emptyState}
            </div>
            <div className="library-list-foot" aria-live="polite">
              {filtersActive
                ? t('resultsCount', lang).replace('{n}', filtered.length) + ` / ${allItems.length}`
                : t('itemsCount', lang).replace('{n}', allItems.length)}
            </div>
          </aside>

        <section className="library-detail min-w-0" aria-label={selected?.name || title}>
          <button type="button" className="btn-ghost btn-sm mb-3 lg:hidden" onClick={() => setMobileShowDetail(false)}
            style={{ paddingLeft: '0.25rem' }}>
            <IconChevronLeft size={16} />{t(backKey, lang)}
          </button>
          {selected ? (
            <RecipeDetail recipe={selected} onNavigateRecipe={handleSelect} onCrossNavigate={onCrossNavigate}
              onEditCustom={handleEditCustom} onDeleteCustom={handleDeleteCustom} />
          ) : (
            <div className="panel empty" style={{ minHeight: '16rem' }}>
              <div className="empty-icon"><EmptyIcon size={20} /></div>
              <p className="empty-title">{t('selectRecipe', lang)}</p>
            </div>
          )}
        </section>
      </div>

      <CustomRecipeFormModal isOpen={showCustomForm} onClose={() => { setShowCustomForm(false); setEditing(null); }}
        onSave={handleSaveCustom} initial={editing} isProtocol={isProtocol} />
    </div>
  );
}
