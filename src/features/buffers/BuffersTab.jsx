import { useState, useMemo, useEffect } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { S_MUTED, S_INLINE_ICON } from '../../lib/styleConstants.js';
import { loadCustomRecipes, saveCustomRecipes } from '../../hooks/useLocalStorage.js';
import { BUFFER_CATEGORIES } from '../../data/protocolCategories.js';
import { useFavs } from '../../components/Favorites.jsx';
import RecipeCard from '../../components/RecipeCard.jsx';
import RecipeDetail from '../../components/RecipeDetail.jsx';
import CustomRecipeFormModal from '../../components/CustomRecipeFormModal.jsx';
import { useRecipes } from '../../lib/RecipeProvider.jsx';
import db from '../../lib/db.js';

function BuffersTab({ externalSelected, setExternalSelected, onCrossNavigate }) {
  const { bufferRecipes: BUFFER_RECIPES } = useRecipes();
  const [search, setSearch] = useState('');
  const [selCat, setSelCat] = useState('all');
  const [selected, setSelected] = useState(externalSelected || null);
  const { favs, recent, addRecent } = useFavs();
  const [customRecipes, setCustomRecipes] = useState(() => loadCustomRecipes());
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingRecipe, setEditingRecipe] = useState(null);
  const [sidebarHidden, setSidebarHidden] = useState(() => localStorage.getItem('labmate_buffers_sidebar_hidden') === 'true');
  function toggleSidebar() { setSidebarHidden(h => { const next = !h; localStorage.setItem('labmate_buffers_sidebar_hidden', String(next)); db.settings.put({ key: 'labmate_buffers_sidebar_hidden', value: String(next) }).catch(() => {}); return next; }); }

  function handleSaveCustom(recipe) {
    const arr = loadCustomRecipes();
    const idx = arr.findIndex(r => r.id === recipe.id);
    if (idx >= 0) arr[idx] = recipe; else arr.push(recipe);
    saveCustomRecipes(arr);
    setCustomRecipes(arr);
    setSelected(recipe);
  }
  function handleDeleteCustom(recipe) {
    const arr = loadCustomRecipes().filter(r => r.id !== recipe.id);
    saveCustomRecipes(arr);
    setCustomRecipes(arr);
    setSelected(BUFFER_RECIPES[0] || null);
  }
  function handleEditCustom(recipe) {
    setEditingRecipe(recipe);
    setShowCustomForm(true);
  }

  // Set default selected when recipes load
  useEffect(() => {
    if (!selected && BUFFER_RECIPES.length > 0) {
      setSelected(BUFFER_RECIPES[0]);
    }
  }, [BUFFER_RECIPES]);

  useEffect(() => {
    if (externalSelected && BUFFER_CATEGORIES.includes(externalSelected.category)) {
      setSelected(externalSelected);
    }
  }, [externalSelected]);

  const filtered = useMemo(() => {
    const allBuf = [...BUFFER_RECIPES, ...customRecipes.filter(r => BUFFER_CATEGORIES.includes(r.category)).map(r => ({...r, _isCustom: true}))];
    return allBuf.filter(r => {
      const matchCat = selCat === 'all' ? true
        : selCat === 'favs' ? favs.includes(r.id)
        : selCat === 'custom' ? r._isCustom
        : (r.discipline || []).includes(selCat);
      const q = search.toLowerCase();
      const matchSearch = !q || r.name.toLowerCase().includes(q) || (r.nameCn || '').includes(q)
        || (r.tags || []).some(t => t.includes(q));
      return matchCat && matchSearch;
    });
  }, [search, selCat, favs, customRecipes]);

  const lang = useLang();
  const cats = [
    { id: 'all', label: t('all', lang) },
    { id: 'favs', label: t('favorites', lang) },
    { id: 'custom', label: t('customFilter', lang) },
    { id: 'molecular', label: t('discMolecular', lang) },
    { id: 'cell', label: t('discCell', lang) },
    { id: 'protein', label: t('discProtein', lang) },
    { id: 'rna_dna', label: t('discRnaDna', lang) },
    { id: 'immunology', label: t('discImmunology', lang) },
    { id: 'microbiology', label: t('discMicrobiology', lang) },
    { id: 'general', label: t('discGeneral', lang) },
  ];

  // Recently used section (buffers only)
  const recentRecipes = useMemo(() => {
    return recent.map(id => BUFFER_RECIPES.find(r => r.id === id)).filter(Boolean).slice(0, 4);
  }, [recent]);

  function handleSelect(recipe) {
    setSelected(recipe);
    addRecent(recipe.id);
  }

  // Mobile: show detail view when selected (drill-down)
  const [mobileShowDetail, setMobileShowDetail] = useState(false);
  function handleMobileSelect(recipe) {
    handleSelect(recipe);
    setMobileShowDetail(true);
  }
  function handleMobileBack() {
    setMobileShowDetail(false);
  }

  // Desktop: two-panel layout; Mobile: drill-down
  return (
    <div>
      {/* ── DESKTOP layout (lg+): side-by-side ── */}
      <div className="hidden lg:grid gap-6" style={{alignItems:'start', gridTemplateColumns: sidebarHidden ? '1fr' : '340px 1fr'}}>
        {/* List panel */}
        {!sidebarHidden && <div>
          <div className="flex items-center gap-2 mb-4">
            <input type="text" autoComplete="off" placeholder={t('searchPlaceholder', lang)} value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontFamily: "'DM Sans', sans-serif" }}
              className="flex-1" />
            <button onClick={() => { setEditingRecipe(null); setShowCustomForm(true); }}
              className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
              style={{background:'var(--accent-light)', color:'var(--accent)', border:'1px solid var(--border)'}}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={S_INLINE_ICON}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              {t('addCustomRecipe', lang)}
            </button>
          </div>
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 filter-tags-scroll">
            {cats.map(c => (
              <button key={c.id} onClick={() => setSelCat(c.id)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
                style={{
                  background: selCat === c.id ? 'var(--primary)' : 'var(--card)',
                  color: selCat === c.id ? 'white' : 'var(--text-muted)',
                  border: `1px solid ${selCat === c.id ? 'var(--primary)' : 'var(--border)'}`,
                }}>{c.label}</button>
            ))}
          </div>
          {recentRecipes.length > 0 && selCat === 'all' && !search && (
            <div className="mb-3">
              <p className="text-xs font-semibold mb-1.5" style={S_MUTED}>{t('recentlyUsed', lang)}</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                {recentRecipes.map(r => (
                  <button key={r.id} onClick={() => handleSelect(r)}
                    className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-all"
                    style={{background:'var(--primary-light)', color:'var(--primary)', border:'1px solid var(--border)'}}>
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2 overflow-y-auto pr-1 sidebar-scroll" style={{maxHeight:'calc(100vh - 220px)'}}>
            {filtered.map(r => (
              <RecipeCard key={r.id} recipe={r} onSelect={handleSelect} selected={selected?.id === r.id} />
            ))}
            {filtered.length === 0 && <p className="text-sm text-center py-8" style={S_MUTED}>{t('noResults', lang)}</p>}
          </div>
        </div>}
        {/* Detail panel — sticky */}
        <div className="sticky" style={{top:'7rem', maxHeight:'calc(100vh - 8rem)', overflowY:'auto'}}>
          <button onClick={toggleSidebar} title={sidebarHidden ? 'Show sidebar' : 'Hide sidebar'}
            className="mb-2 p-1.5 rounded-lg transition-all hover:opacity-80"
            style={{background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-muted)'}}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/>
              {sidebarHidden ? <polyline points="14 9 17 12 14 15"/> : <polyline points="17 9 14 12 17 15"/>}
            </svg>
          </button>
          {selected ? <RecipeDetail recipe={selected} onNavigateRecipe={handleSelect} onCrossNavigate={onCrossNavigate} onEditCustom={handleEditCustom} onDeleteCustom={handleDeleteCustom} /> : (
            <div className="card p-12 text-center" style={S_MUTED}>

              <p>{t('selectRecipe', lang)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── MOBILE layout (<lg): drill-down ── */}
      <div className="lg:hidden">
        {!mobileShowDetail ? (
          /* List view */
          <div className="fade-in">
            <div className="mb-3">
              <input type="text" placeholder={t('searchPlaceholder', lang)} value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ fontFamily: "'DM Sans', sans-serif", width: '100%', marginBottom: '0.5rem' }} />
              <button onClick={() => { setEditingRecipe(null); setShowCustomForm(true); }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap"
                style={{background:'var(--accent-light)', color:'var(--accent)', border:'1px solid var(--border)'}}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" style={S_INLINE_ICON}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                {t('addCustomRecipe', lang)}
              </button>
            </div>
            <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1 filter-tags-scroll" style={{WebkitOverflowScrolling:'touch'}}>
              {cats.map(c => (
                <button key={c.id} onClick={() => setSelCat(c.id)}
                  className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0"
                  style={{
                    background: selCat === c.id ? 'var(--primary)' : 'var(--card)',
                    color: selCat === c.id ? 'white' : 'var(--text-muted)',
                    border: `1px solid ${selCat === c.id ? 'var(--primary)' : 'var(--border)'}`,
                  }}>{c.label}</button>
              ))}
            </div>
            {recentRecipes.length > 0 && selCat === 'all' && !search && (
              <div className="mb-3">
                <p className="text-xs font-semibold mb-1.5" style={S_MUTED}>{t('recentlyUsed', lang)}</p>
                <div className="flex gap-1.5 overflow-x-auto pb-1">
                  {recentRecipes.map(r => (
                    <button key={r.id} onClick={() => handleMobileSelect(r)}
                      className="px-2.5 py-1 rounded-full text-xs whitespace-nowrap transition-all flex-shrink-0"
                      style={{background:'var(--primary-light)', color:'var(--primary)', border:'1px solid var(--border)'}}>
                      {r.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              {filtered.map(r => (
                <RecipeCard key={r.id} recipe={r} onSelect={handleMobileSelect} selected={false} />
              ))}
              {filtered.length === 0 && <p className="text-sm text-center py-8" style={S_MUTED}>{t('noResults', lang)}</p>}
            </div>
          </div>
        ) : (
          /* Detail view (mobile drill-down) */
          <div className="fade-in">
            <button onClick={handleMobileBack}
              className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
              style={{color:'var(--primary)', background:'var(--primary-light)', border:'1px solid var(--border)'}}>
              ← {t('all', lang)} {t('tabBuffers', lang)}
            </button>
            {selected && <RecipeDetail recipe={selected} onNavigateRecipe={handleMobileSelect} onCrossNavigate={onCrossNavigate} onEditCustom={handleEditCustom} onDeleteCustom={handleDeleteCustom} />}
          </div>
        )}
      </div>
      <CustomRecipeFormModal isOpen={showCustomForm} onClose={() => { setShowCustomForm(false); setEditingRecipe(null); }}
        onSave={handleSaveCustom} initial={editingRecipe} isProtocol={false} />
    </div>
  );
}

export default BuffersTab;
