import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LangContext, t } from './i18n/index.js';
import { useLocalStorage } from './hooks/useLocalStorage.js';
import { readCookie } from './lib/cookies.js';
import db from './lib/db.js';
import ToastProvider, { useToast } from './components/Toast.jsx';
import FavProvider from './components/Favorites.jsx';
import { TimerProvider, TimerBar, QuickTimerButton } from './components/Timer.jsx';
import QuickCalculatorButton from './features/calc/QuickCalculatorButton.jsx';
import RecipeProvider, { useRecipes } from './lib/RecipeProvider.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Header from './components/Header.jsx';
import BottomNav from './components/BottomNav.jsx';
import MoreSheet from './components/MoreSheet.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import AgentProvider from './lib/agent/AgentContext.jsx';
import AgentLauncher from './features/agent/AgentLauncher.jsx';
import AgentPanel from './features/agent/AgentPanel.jsx';
import { useAgentAvailability } from './hooks/useAgentAvailability.js';

// Eager load (always needed on first render)
import BuffersTab from './features/buffers/BuffersTab.jsx';
import ProtocolsTab from './features/protocols/ProtocolsTab.jsx';

// Lazy load tabs (loaded on demand when tab is selected)
const CalcTab = lazy(() => import('./features/calc/CalcTab.jsx'));
const PlateTab = lazy(() => import('./features/plate/PlateTab.jsx'));
const ToolsTab = lazy(() => import('./features/tools/ToolsTab.jsx'));
const InventoryTab = lazy(() => import('./features/inventory/InventoryTab.jsx'));
const NotebookTab = lazy(() => import('./features/notebook/NotebookTab.jsx'));
const CalendarTab = lazy(() => import('./features/calendar/CalendarTab.jsx'));
const RefsTab = lazy(() => import('./features/refs/RefsTab.jsx'));

// Lazy load modals (not visible on initial render)
const GlobalSearchModal = lazy(() => import('./components/GlobalSearchModal.jsx'));
const OnboardingModal = lazy(() => import('./components/OnboardingModal.jsx'));

import { S_MUTED } from './lib/styleConstants.js';
import { BUFFER_CATEGORIES } from './data/protocolCategories.js';

const SkeletonLine = ({ width = '100%', height = '0.75rem', style }) => (
  <div className="skeleton-shimmer rounded" style={{ width, height, ...style }} />
);

const LazySkeleton = () => (
  <div className="space-y-4 py-4">
    <SkeletonLine width="40%" height="1.5rem" />
    <div className="card p-5 space-y-3">
      <SkeletonLine width="60%" height="1rem" />
      <SkeletonLine width="100%" />
      <SkeletonLine width="80%" />
      <SkeletonLine width="45%" />
    </div>
    <div className="card p-5 space-y-3">
      <SkeletonLine width="50%" height="1rem" />
      <SkeletonLine width="90%" />
      <SkeletonLine width="70%" />
    </div>
  </div>
);

// Tab <-> URL path mapping. /labmate/ basename is applied by BrowserRouter.
// Paths here are locale-bare; the active locale is prefixed on top (/en/recipes,
// /zh/recipes) — see SUPPORTED_LOCALES and the Routes block in AppInner below.
const TAB_TO_PATH = {
  buffers:   '/recipes',
  protocols: '/protocols',
  calc:      '/calc',
  plate:     '/plate',
  tools:     '/tools',
  inventory: '/inventory',
  notebook:  '/notebook',
  calendar:  '/calendar',
  refs:      '/guide',
};
const PATH_TO_TAB = Object.fromEntries(Object.entries(TAB_TO_PATH).map(([k, v]) => [v, k]));

// Locale-prefixed routing, mirroring the main bioinfospace.com site's /en/, /zh/
// URL pattern: the URL is the source of truth for the active locale once inside
// a /:locale route; bare/legacy (unprefixed) paths redirect to the active/stored
// locale. Kept as a plain array (not derived from i18n) since LabMate only ships
// these two — see i18n/translations.js.
const SUPPORTED_LOCALES = ['en', 'zh'];

// Seed theme/lang from the main site's cross-domain cookies (bis_theme/bis_lang,
// written on .bioinfospace.com by bioinfospace.com — see src/utils/crossDomainCookie.ts
// and components/theme-provider.tsx / LocaleRouter.tsx in the website repo) — but
// ONLY as the initial default. useLocalStorage's defaultVal argument is only ever
// consulted when nothing is stored locally yet (see useIndexedStorage.js), so once
// the user has toggled theme/lang here, their local choice always wins over the
// cookie on every later load.
function getDefaultLang() {
  const cookieLang = (readCookie('bis_lang') || '').slice(0, 2);
  if (cookieLang === 'zh') return 'zh';
  if (cookieLang) return 'en'; // any other bis_lang (de/es/fr/ja/ko/...) maps to en
  return (navigator.language || '').startsWith('zh') ? 'zh' : 'en';
}

function getDefaultTheme() {
  const cookieTheme = readCookie('bis_theme');
  if (cookieTheme === 'dark' || cookieTheme === 'light') return cookieTheme;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function AppInner() {
  const { loading, syncing, refresh, recipes } = useRecipes();
  const location = useLocation();
  const navigate = useNavigate();
  // lang/theme declared before activeTab/setActiveTab/switchLocale below, which
  // close over `lang` to build locale-prefixed paths.
  const [lang, setLang] = useLocalStorage('lang', getDefaultLang());
  const [theme, setTheme] = useLocalStorage('theme', getDefaultTheme());
  const activeTab = useMemo(() => {
    // location.pathname has the /labmate basename already stripped by BrowserRouter,
    // so parts[1] is the locale segment (en/zh) and parts[2] is the tab segment —
    // e.g. '/en/recipes' -> ['', 'en', 'recipes']. Bare/legacy paths (no locale
    // prefix yet, mid-redirect) fall back to parts[1] as the tab segment so this
    // still resolves sanely for the one render before the redirect commits.
    const parts = location.pathname.split('/');
    const tabSeg = SUPPORTED_LOCALES.includes(parts[1]) ? parts[2] : parts[1];
    const seg = '/' + (tabSeg || '');
    return PATH_TO_TAB[seg] || 'buffers';
  }, [location.pathname]);
  const setActiveTab = useCallback((tabId) => {
    const path = TAB_TO_PATH[tabId] || '/recipes';
    navigate(`/${lang}${path}`);
  }, [navigate, lang]);
  // Language toggle: navigates to swap the locale prefix (URL is the source of
  // truth, mirroring the main site's useLocalePath/LocaleRouter). The effect
  // below persists the change to `lang` once the route actually updates.
  const switchLocale = useCallback((nextLang) => {
    const bare = TAB_TO_PATH[activeTab] || '/recipes';
    navigate(`/${nextLang}${bare}`);
  }, [navigate, activeTab]);
  // Keep stored `lang` in sync with the URL's locale segment whenever they
  // diverge (e.g. after switchLocale navigates, or a direct deep link to
  // /zh/... on a device whose stored preference was 'en'). One-way, URL -> state,
  // same direction as the main site's LocaleRouter effect.
  useEffect(() => {
    const urlLocale = location.pathname.split('/')[1];
    if (SUPPORTED_LOCALES.includes(urlLocale) && urlLocale !== lang) {
      setLang(urlLocale);
    }
  }, [location.pathname, lang, setLang]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchSelected, setSearchSelected] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(() => !localStorage.getItem('labmate_onboardingDone'));
  const [calcInitialMode, setCalcInitialMode] = useState(null);
  const [showBackupReminder, setShowBackupReminder] = useState(false);
  const [recipeVersion, setRecipeVersion] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const agentAvailable = useAgentAvailability();
  const toast = useToast();

  const refreshRecipes = useCallback(async () => {
    toast.show(lang === 'zh' ? '正在刷新配方...' : 'Refreshing recipes...', 'info');
    try {
      const result = await refresh();
      setRecipeVersion(v => v + 1);
      if (result.verified) {
        toast.show(
          t('recipesUpdated', lang) + ` (${result.total} total${result.newCount > 0 ? ', ' + result.newCount + ' new' : ''})`,
          'success'
        );
      } else {
        // Remote unavailable or unverified — we fell back to the trusted local library.
        toast.show(lang === 'zh' ? '已使用本地配方（远程不可用或未通过校验）' : 'Using local recipes (remote unavailable or unverified)', 'info');
      }
    } catch (err) {
      toast.show(lang === 'zh' ? '刷新失败' : 'Refresh failed', 'error');
    }
  }, [lang, toast, refresh]);

  // Auto-backup reminder
  useEffect(() => {
    const last = parseInt(localStorage.getItem('labmate_lastExport'), 10);
    if (!last || Date.now() - last > 7 * 24 * 60 * 60 * 1000) setShowBackupReminder(true);
  }, []);

  const handleCrossNavigate = useCallback((fromTab, fromSelected, targetRecipe) => {
    setSearchSelected(targetRecipe);
    const targetTab = BUFFER_CATEGORIES.includes(targetRecipe.category) ? 'buffers' : 'protocols';
    setActiveTab(targetTab);
  }, [setActiveTab]);

  // Theme effect
  useEffect(() => {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
  }, [theme]);

  // Scroll-reveal observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); } }),
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    const observe = () => document.querySelectorAll('.scroll-reveal:not(.visible)').forEach(el => observer.observe(el));
    observe();
    const mo = new MutationObserver(observe);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { observer.disconnect(); mo.disconnect(); };
  }, []);

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

  // Global ⌘J / Ctrl+J — toggle the agent panel (mirrors the ⌘K handler above).
  // Only bound when the agent backend is actually available.
  useEffect(() => {
    if (!agentAvailable) return;
    function handleKey(e) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'J')) {
        e.preventDefault();
        setAgentOpen(prev => !prev);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [agentAvailable]);

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

  // Tab routes shared by every /:locale branch below (see the Routes block in the
  // JSX) — written once and reused via SUPPORTED_LOCALES.map so /en/... and /zh/...
  // both mount the exact same components. Uses locale-RELATIVE Navigate targets
  // ('recipes', not '/en/recipes') so this list doesn't need to know which locale
  // branch it's nested under.
  const renderTabRoutes = () => [
    <Route key="index" index element={<Navigate to="recipes" replace />} />,
    <Route key="buffers-alias" path="buffers" element={<Navigate to="recipes" replace />} />,
    <Route key="recipes" path="recipes" element={
      <div role="tabpanel" id="tabpanel-buffers" aria-labelledby="tab-buffers"><ErrorBoundary><BuffersTab externalSelected={searchSelected} setExternalSelected={setSearchSelected} onCrossNavigate={(recipe) => handleCrossNavigate('buffers', searchSelected, recipe)} /></ErrorBoundary></div>
    } />,
    <Route key="protocols" path="protocols" element={
      <div role="tabpanel" id="tabpanel-protocols" aria-labelledby="tab-protocols"><ErrorBoundary><ProtocolsTab externalSelected={searchSelected} setExternalSelected={setSearchSelected} onCrossNavigate={(recipe) => handleCrossNavigate('protocols', searchSelected, recipe)} /></ErrorBoundary></div>
    } />,
    <Route key="calc" path="calc" element={
      <div role="tabpanel" id="tabpanel-calc" aria-labelledby="tab-calc">
        <ErrorBoundary>
          <Suspense fallback={<LazySkeleton />}>
            <CalcTab initialMode={calcInitialMode} />
          </Suspense>
        </ErrorBoundary>
      </div>
    } />,
    <Route key="plate" path="plate" element={
      <div role="tabpanel" id="tabpanel-plate" aria-labelledby="tab-plate">
        <ErrorBoundary>
          <Suspense fallback={<LazySkeleton />}>
            <PlateTab />
          </Suspense>
        </ErrorBoundary>
      </div>
    } />,
    <Route key="tools" path="tools" element={
      <div role="tabpanel" id="tabpanel-tools" aria-labelledby="tab-tools">
        <ErrorBoundary>
          <Suspense fallback={<LazySkeleton />}>
            <ToolsTab />
          </Suspense>
        </ErrorBoundary>
      </div>
    } />,
    <Route key="inventory" path="inventory" element={
      <div role="tabpanel" id="tabpanel-inventory" aria-labelledby="tab-inventory">
        <ErrorBoundary>
          <Suspense fallback={<LazySkeleton />}>
            <InventoryTab />
          </Suspense>
        </ErrorBoundary>
      </div>
    } />,
    <Route key="notebook" path="notebook" element={
      <div role="tabpanel" id="tabpanel-notebook" aria-labelledby="tab-notebook">
        <ErrorBoundary>
          <Suspense fallback={<LazySkeleton />}>
            <NotebookTab onNavigateCalendar={() => setActiveTab('calendar')} />
          </Suspense>
        </ErrorBoundary>
      </div>
    } />,
    <Route key="calendar" path="calendar" element={
      <div role="tabpanel" id="tabpanel-calendar" aria-labelledby="tab-calendar">
        <ErrorBoundary>
          <Suspense fallback={<LazySkeleton />}>
            <CalendarTab onNavigateNotebook={() => setActiveTab('notebook')} />
          </Suspense>
        </ErrorBoundary>
      </div>
    } />,
    <Route key="guide" path="guide" element={
      <div role="tabpanel" id="tabpanel-refs" aria-labelledby="tab-refs">
        <ErrorBoundary>
          <Suspense fallback={<LazySkeleton />}>
            <RefsTab onReplayTour={() => { localStorage.removeItem('labmate_onboardingDone'); db.settings.delete('labmate_onboardingDone').catch(() => {}); setShowOnboarding(true); }} />
          </Suspense>
        </ErrorBoundary>
      </div>
    } />,
    <Route key="not-found" path="*" element={<Navigate to="recipes" replace />} />,
  ];

  return (
    <LangContext.Provider value={lang}>
      <div className="min-h-screen" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <Header activeTab={activeTab} setActiveTab={setActiveTab} onOpenSearch={() => setSearchOpen(true)}
          onRefreshRecipes={refreshRecipes} isSyncing={syncing} lang={lang} setLang={switchLocale} theme={theme} setTheme={setTheme} />
        <Suspense fallback={null}>
          <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)}
            onSelect={r => setSearchSelected(r)} onSwitchTab={setActiveTab} />
        </Suspense>
        <Suspense fallback={null}>
          <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
        </Suspense>
        <main className="max-w-6xl mx-auto px-6 md:px-10 lg:px-12 py-8 md:py-10">
          {showBackupReminder && (
            <>
              {/* Full banner — sm: and up (≥640px), unchanged from pre-mobile-overhaul */}
              <div className="hidden sm:flex mb-5 px-5 py-4 rounded-lg items-center justify-between gap-4 text-sm"
                style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)' }}>
                <span style={{lineHeight:'1.5'}}>{t('backupReminder', lang)}</span>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => { setActiveTab('tools'); setShowBackupReminder(false); }}
                    className="px-3 py-1 rounded-md text-xs font-semibold"
                    style={{ background: 'var(--primary)', color: 'var(--on-primary)' }}>{t('backupNow', lang)}</button>
                  <button onClick={() => { localStorage.setItem('labmate_lastExport', String(Date.now())); db.settings.put({ key: 'labmate_lastExport', value: String(Date.now()) }).catch(() => {}); setShowBackupReminder(false); }}
                    className="px-3 py-1 rounded-md text-xs font-semibold"
                    style={{ background: 'transparent', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}>{t('dismissReminder', lang)}</button>
                </div>
              </div>
              {/* Slim banner — below sm (<640px): same state/handlers, compact one-liner (≤44px) */}
              <div className="sm:hidden mb-3 px-3 py-2 flex items-center justify-between gap-3 text-xs"
                style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning-border)', color: 'var(--warning-text)' }}>
                <span className="truncate" style={{ lineHeight: '1.3' }}>
                  {lang === 'zh' ? '仅本地存储，请定期备份' : 'Local data only — back up regularly'}
                </span>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <button onClick={() => { setActiveTab('tools'); setShowBackupReminder(false); }}
                    className="font-semibold py-1"
                    style={{ color: 'var(--warning-text)', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                    {lang === 'zh' ? '备份' : 'Back up'}
                  </button>
                  <button onClick={() => { localStorage.setItem('labmate_lastExport', String(Date.now())); db.settings.put({ key: 'labmate_lastExport', value: String(Date.now()) }).catch(() => {}); setShowBackupReminder(false); }}
                    aria-label={lang === 'zh' ? '关闭' : 'Dismiss'}
                    className="font-bold leading-none px-1 py-1"
                    style={{ color: 'var(--warning-text)', fontSize: '1rem' }}>
                    ×
                  </button>
                </div>
              </div>
            </>
          )}
          <div key={activeTab} className="tab-fade-in">
            <Routes>
              {/* Bare/legacy paths (no locale prefix) redirect to the active/stored
                  locale — covers old bookmarks/shared links from before locale-
                  prefixed routing, plus a bare "/" on first-ever visit. */}
              <Route path="/" element={<Navigate to={`/${lang}/recipes`} replace />} />
              <Route path="/buffers" element={<Navigate to={`/${lang}/recipes`} replace />} />
              {Object.values(TAB_TO_PATH).map((path) => (
                <Route key={`bare${path}`} path={path} element={<Navigate to={`/${lang}${path}`} replace />} />
              ))}

              {/* Locale-prefixed routes — enumerated (not a `:locale` param) so an
                  unsupported prefix falls through to the catch-all below instead
                  of being (wrongly) matched and rendered as a locale here. */}
              {SUPPORTED_LOCALES.map((loc) => (
                <Route key={loc} path={`/${loc}`}>
                  {renderTabRoutes()}
                </Route>
              ))}

              <Route path="*" element={<Navigate to={`/${lang}/recipes`} replace />} />
            </Routes>
          </div>
        </main>
        <footer className="text-center py-8 text-xs border-t scroll-reveal" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          <p className="font-semibold">
            bio<span style={{ color: 'var(--accent)' }}>info</span>space{' '}
            labmate v{__APP_VERSION__}
          </p>
          <p className="mt-1 opacity-50">© {new Date().getFullYear()} <a href="https://bioinfospace.com" target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>Bioinfospace</a></p>
          <p className="mt-1 flex items-center justify-center gap-3">
            <a href="https://bioinfospace.com" target="_blank" rel="noopener noreferrer"
              className="opacity-50 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              bioinfospace.com
            </a>
            <span className="opacity-30">|</span>
            <a href="https://github.com/mianaz/labmate" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 opacity-50 hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-muted)', textDecoration: 'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" /></svg>
              GitHub
            </a>
          </p>
        </footer>
        <TimerBar />
        <QuickTimerButton />
        <QuickCalculatorButton agentAvailable={agentAvailable} />
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onMore={() => setMoreOpen(true)} lang={lang} />
        <MoreSheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} activeTab={activeTab} setActiveTab={setActiveTab}
          lang={lang} setLang={switchLocale} onRefreshRecipes={refreshRecipes} isSyncing={syncing}
          onOpenAgent={agentAvailable ? () => { setMoreOpen(false); setAgentOpen(true); } : undefined} />
        <InstallPrompt />
        {agentAvailable && (
          <AgentProvider>
            <AgentLauncher open={agentOpen} onToggle={() => setAgentOpen(o => !o)} />
            <AgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} />
          </AgentProvider>
        )}
        <div className="grain" aria-hidden="true" />
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
