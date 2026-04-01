import { useState, useCallback, useEffect } from 'react';
import { LangContext, t } from './i18n/index.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import db from './lib/db.js';
import ToastProvider, { useToast } from './components/Toast.jsx';
import FavProvider from './components/Favorites.jsx';
import { TimerProvider, TimerBar, QuickTimerButton } from './components/Timer.jsx';
import RecipeProvider, { useRecipes } from './lib/RecipeProvider.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Header from './components/Header.jsx';
import GlobalSearchModal from './components/GlobalSearchModal.jsx';
import OnboardingModal from './components/OnboardingModal.jsx';
import QuickCalculatorButton from './features/calc/QuickCalculatorButton.jsx';
import BuffersTab from './features/buffers/BuffersTab.jsx';
import ProtocolsTab from './features/protocols/ProtocolsTab.jsx';
import CalcTab from './features/calc/CalcTab.jsx';
import PlateTab from './features/plate/PlateTab.jsx';
import ToolsTab from './features/tools/ToolsTab.jsx';
import InventoryTab from './features/inventory/InventoryTab.jsx';
import RefsTab from './features/refs/RefsTab.jsx';
import { S_MUTED } from './lib/styleConstants.js';
import { BUFFER_CATEGORIES } from './data/protocolCategories.js';

function AppInner() {
  const { loading, syncing, refresh, recipes } = useRecipes();
  const [activeTab, setActiveTab] = useState('buffers');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSelected, setSearchSelected] = useState(null);
  const [navHistory, setNavHistory] = useState([]);
  const [lang, setLang] = useLocalStorage('lang', (navigator.language || '').startsWith('zh') ? 'zh' : 'en');
  const [theme, setTheme] = useLocalStorage('theme', window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('labmate_onboardingDone'));
  const [calcInitialMode, setCalcInitialMode] = useState(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [recipeVersion, setRecipeVersion] = useState(0);
  const toast = useToast();

  const refreshRecipes = useCallback(async () => {
    toast.show(lang === 'zh' ? '正在同步配方...' : 'Syncing recipes...', 'info');
    try {
      const result = await refresh();
      setRecipeVersion(v => v + 1);
      toast.show(
        t('recipesUpdated', lang) + ` (${result.total} total${result.newCount > 0 ? ', ' + result.newCount + ' new' : ''})`,
        'success'
      );
    } catch (err) {
      toast.show(lang === 'zh' ? '同步失败' : 'Sync failed', 'error');
    }
  }, [lang, toast, refresh]);

  // Auto-backup reminder
  useEffect(() => {
    const last = parseInt(localStorage.getItem('labmate_lastExport'), 10);
    if (!last || Date.now() - last > 7 * 24 * 60 * 60 * 1000) setShowBackupReminder(true);
  }, []);

  const handleCrossNavigate = useCallback((fromTab, fromSelected, targetRecipe) => {
    setNavHistory(prev => [...prev, { tab: fromTab, recipeId: fromSelected }]);
    setSearchSelected(targetRecipe);
    const targetTab = BUFFER_CATEGORIES.includes(targetRecipe.category) ? 'buffers' : 'protocols';
    setActiveTab(targetTab);
  }, []);

  const handleNavBack = useCallback(() => {
    setNavHistory(prev => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      const last = next.pop();
      if (last.recipeId) setSearchSelected(last.recipeId);
      setActiveTab(last.tab);
      return next;
    });
  }, []);

  // Theme effect
  useEffect(() => {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  // Sync <html lang>
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  // Global ⌘K / Ctrl+K
  useEffect(() => {
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 rounded-full animate-spin mb-3"
            style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
          <p className="text-sm" style={S_MUTED}>Loading recipes…</p>
        </div>
      </div>
    );
  }

  return (
    <LangContext.Provider value={lang}>
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <Header activeTab={activeTab} setActiveTab={setActiveTab} onOpenSearch={() => setSearchOpen(true)}
          onRefreshRecipes={refreshRecipes} isSyncing={syncing} lang={lang} setLang={setLang} theme={theme} setTheme={setTheme} />
        <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)}
          onSelect={r => setSearchSelected(r)} onSwitchTab={setActiveTab} />
        <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
        <main className="max-w-7xl mx-auto px-4 py-6">
          {showBackupReminder && (
            <div className="mb-5 px-5 py-4 rounded-lg flex items-center justify-between gap-4 text-sm"
              style={{ background: 'hsl(45,90%,94%)', border: '1px solid hsl(45,80%,70%)', color: 'hsl(30,60%,30%)' }}>
              <span style={{lineHeight:'1.5'}}>{t('backupReminder', lang)}</span>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => { setActiveTab('tools'); setShowBackupReminder(false); }}
                  className="px-3 py-1 rounded-md text-xs font-semibold"
                  style={{ background: 'var(--primary)', color: 'white' }}>{t('backupNow', lang)}</button>
                <button onClick={() => { localStorage.setItem('labmate_lastExport', String(Date.now())); db.settings.put({ key: 'labmate_lastExport', value: String(Date.now()) }).catch(() => {}); setShowBackupReminder(false); }}
                  className="px-3 py-1 rounded-md text-xs font-semibold"
                  style={{ background: 'transparent', color: 'hsl(30,60%,30%)', border: '1px solid hsl(45,80%,70%)' }}>{t('dismissReminder', lang)}</button>
              </div>
            </div>
          )}
          {navHistory.length > 0 && (
            <button onClick={handleNavBack}
              className="mb-3 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 transition-colors hover:opacity-80"
              style={{ background: 'var(--primary-light)', color: 'var(--primary)', border: '1px solid var(--border)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
              {t('backNav', lang)}
            </button>
          )}
          {activeTab === 'buffers' && <div role="tabpanel" id="tabpanel-buffers" aria-labelledby="tab-buffers"><ErrorBoundary><BuffersTab externalSelected={searchSelected} setExternalSelected={setSearchSelected} onCrossNavigate={(recipe) => handleCrossNavigate('buffers', searchSelected, recipe)} /></ErrorBoundary></div>}
          {activeTab === 'protocols' && <div role="tabpanel" id="tabpanel-protocols" aria-labelledby="tab-protocols"><ErrorBoundary><ProtocolsTab externalSelected={searchSelected} setExternalSelected={setSearchSelected} onCrossNavigate={(recipe) => handleCrossNavigate('protocols', searchSelected, recipe)} /></ErrorBoundary></div>}
          {activeTab === 'calc' && <div role="tabpanel" id="tabpanel-calc" aria-labelledby="tab-calc"><ErrorBoundary><CalcTab initialMode={calcInitialMode} /></ErrorBoundary></div>}
          {activeTab === 'plate' && <div role="tabpanel" id="tabpanel-plate" aria-labelledby="tab-plate"><ErrorBoundary><PlateTab /></ErrorBoundary></div>}
          {activeTab === 'tools' && <div role="tabpanel" id="tabpanel-tools" aria-labelledby="tab-tools"><ErrorBoundary><ToolsTab /></ErrorBoundary></div>}
          {activeTab === 'inventory' && <div role="tabpanel" id="tabpanel-inventory" aria-labelledby="tab-inventory"><ErrorBoundary><InventoryTab /></ErrorBoundary></div>}
          {activeTab === 'refs' && <div role="tabpanel" id="tabpanel-refs" aria-labelledby="tab-refs"><ErrorBoundary><RefsTab onReplayTour={() => { localStorage.removeItem('labmate_onboardingDone'); db.settings.delete('labmate_onboardingDone').catch(() => {}); setShowOnboarding(true); }} /></ErrorBoundary></div>}
        </main>
        <footer className="text-center py-8 text-xs border-t" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <p className="font-semibold">
            Bioinfo<span style={{ background: 'linear-gradient(135deg, hsl(161 69% 37%), hsl(170 60% 45%), hsl(180 55% 50%))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Space</span>{' '}
            LabMate v{__APP_VERSION__}
          </p>
          <p className="mt-1 opacity-50">© {new Date().getFullYear()} BioinfoSpace</p>
          <p className="mt-1">
            <a href="https://github.com/mianaz/labmate" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 opacity-50 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
              mianaz/labmate
            </a>
          </p>
        </footer>
        <TimerBar />
        <QuickTimerButton />
        <QuickCalculatorButton />
      </div>
    </LangContext.Provider>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <FavProvider>
        <TimerProvider>
          <RecipeProvider>
            <AppInner />
          </RecipeProvider>
        </TimerProvider>
      </FavProvider>
    </ToastProvider>
  );
}
