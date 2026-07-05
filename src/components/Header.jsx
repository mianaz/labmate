import { useRef, useEffect, useState, useCallback } from 'react';
import { t } from '../i18n/index.js';
import { S_BG2, S_TEXT } from '../lib/styleConstants.js';

function Header({ activeTab, setActiveTab, onOpenSearch, onRefreshRecipes, isSyncing, lang, setLang, theme, setTheme }) {
  const tabKeys = ['buffers','protocols','calc','plate','tools','inventory','notebook','calendar','refs'];
  const tabIcons = {};
  const tabLabels = { buffers:'tabBuffers', protocols:'tabProtocols', calc:'tabCalc', plate:'tabPlate', tools:'tabTools', inventory:'tabInventory', notebook:'tabNotebook', calendar:'tabCalendar', refs:'tabRefs' };

  // Auto-scroll active tab into view on mobile
  const tabBarRef = useRef(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    if (!tabBarRef.current) return;
    const activeBtn = tabBarRef.current.querySelector('[aria-selected="true"]');
    if (activeBtn) {
      const bar = tabBarRef.current.getBoundingClientRect();
      const btn = activeBtn.getBoundingClientRect();
      setIndicator({ left: btn.left - bar.left + tabBarRef.current.scrollLeft, width: btn.width });
    }
  }, []);

  useEffect(() => {
    if (!tabBarRef.current) return;
    const activeBtn = tabBarRef.current.querySelector('[aria-selected="true"]');
    if (activeBtn) activeBtn.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    // Update indicator after scroll settles
    requestAnimationFrame(updateIndicator);
  }, [activeTab, updateIndicator, lang]);

  // Re-measure on resize / font load
  useEffect(() => {
    window.addEventListener('resize', updateIndicator);
    document.fonts?.ready?.then(updateIndicator);
    return () => window.removeEventListener('resize', updateIndicator);
  }, [updateIndicator]);

  return (
    <nav role="navigation" aria-label="Main navigation" style={{ background: 'var(--nav-bg)', borderColor: 'var(--border-strong)' }}
      className="sticky top-0 z-40 border-b-2">
      <div className="max-w-7xl mx-auto px-4">
        {/* Top bar */}
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xl font-bold" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '-0.02em' }}>
              <img src="favicon.svg" alt="" width="26" height="26" style={{flexShrink:0}} />
              <a href="https://bioinfospace.com" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                <span style={{ color: 'var(--text)' }}>Bio</span><span style={{ color: 'var(--accent)' }}>info</span><span style={{ color: 'var(--text)' }}>space</span>
              </a>
              <a href="/labmate/" style={{ textDecoration: 'none', color: 'var(--text)', marginLeft: '-0.25rem' }}>LabMate</a>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button onClick={onRefreshRecipes} disabled={isSyncing} title={t('refreshRecipes', lang)}
              className="inline-flex items-center justify-center px-2 rounded-lg text-sm transition-all border"
              style={{ borderColor:'var(--border)', background:'var(--card)', color: isSyncing ? 'var(--primary)' : 'var(--text-muted)', opacity: isSyncing ? 0.7 : 1, height: '2.125rem' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={isSyncing ? {animation:'spin 1s linear infinite'} : {}}><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            </button>
            <button onClick={onOpenSearch}
              className="inline-flex items-center justify-center gap-2 px-3 rounded-lg text-xs transition-all border"
              style={{ borderColor:'var(--border)', color:'var(--text-muted)', background:'var(--card)', minWidth: '2.5rem', height: '2.125rem' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <span className="hidden sm:inline">{t('searchPlaceholder', lang).slice(0,12)}...</span>
              <kbd className="text-[10px] px-1 py-0.5 rounded hidden md:inline" style={S_BG2}>⌘K</kbd>
            </button>
            <button onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
              className="inline-flex items-center justify-center px-2.5 rounded-lg text-xs font-semibold transition-all border"
              style={{ borderColor:'var(--border)', color:'var(--primary)', background:'var(--card)', height: '2.125rem' }}>
              {t('langToggle', lang)}
            </button>
            <button onClick={() => { const next = theme === 'dark' ? 'light' : 'dark'; setTheme(next); document.documentElement.setAttribute('data-theme', next === 'dark' ? 'dark' : ''); }}
              className="inline-flex items-center justify-center px-2 rounded-lg text-sm transition-all border"
              style={{ borderColor:'var(--border)', background:'var(--card)', height: '2.125rem' }}>
              {theme === 'dark'
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S_TEXT}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S_TEXT}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>}
            </button>
          </div>
        </div>
        {/* Tab bar */}
        <div style={{ position: 'relative' }}>
          <div ref={tabBarRef} className="flex gap-0.5 overflow-x-auto -mb-px" role="tablist" aria-label="App sections"
            onScroll={e => { const h = e.currentTarget.parentElement.querySelector('.tab-scroll-hint'); if (h) h.style.opacity = '0'; }}>
            {tabKeys.map(id => (
              <button key={id} onClick={() => setActiveTab(id)}
                role="tab"
                aria-selected={activeTab === id}
                aria-controls={`tabpanel-${id}`}
                id={`tab-${id}`}
                className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === id ? 'font-semibold' : ''
                }`}
                style={{
                  color: activeTab === id ? 'var(--primary)' : 'var(--text-muted)',
                }}>
                {t(tabLabels[id], lang)}
              </button>
            ))}
          </div>
          <div className="tab-indicator" style={{ left: indicator.left, width: indicator.width }} />
          <div className="tab-scroll-hint md:hidden" style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', color: 'var(--text-muted)', fontSize: 18, fontWeight: 700, opacity: 0.6, transition: 'opacity 0.3s', background: 'var(--nav-bg)' }}>›</div>
        </div>
      </div>
    </nav>
  );
}

export default Header;
