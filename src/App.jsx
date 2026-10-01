import { useState, useCallback, useEffect, useMemo, lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { LangContext, t } from './i18n/index.js';
import { useLocalStorage, loadCustomRecipes, loadCustomProtocols } from './hooks/useLocalStorage.js';
import { useBackupStatus, describeLastBackup } from './hooks/useBackupStatus.js';
import { readCookie } from './lib/cookies.js';
import db from './lib/db.js';
import { TAB_TO_PATH, PATH_TO_TAB } from './lib/nav.jsx';
import ToastProvider, { useToast } from './components/Toast.jsx';
import FavProvider from './components/Favorites.jsx';
import { TimerProvider, TimerBar, QuickTimerPanel } from './components/Timer.jsx';
import { QuickCalcPanel } from './features/calc/QuickCalculatorButton.jsx';
import RecipeProvider, { useRecipes } from './lib/RecipeProvider.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import Sidebar from './components/Sidebar.jsx';
import MobileTopBar from './components/MobileTopBar.jsx';
import BottomNav from './components/BottomNav.jsx';
import MoreSheet from './components/MoreSheet.jsx';
import InstallPrompt from './components/InstallPrompt.jsx';
import { IconAlert, IconClose } from './components/icons.jsx';
// The agent stack (loop, prompt, proxy, permissions, grounding, tools) only mounts
// when the backend probe succeeds, so keep it out of the initial chunk.
const AgentProvider = lazy(() => import('./lib/agent/AgentContext.jsx'));
const AgentPanel = lazy(() => import('./features/agent/AgentPanel.jsx'));
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
const EvidenceTab = lazy(() => import('./features/evidence/EvidenceTab.jsx'));
const CalendarTab = lazy(() => import('./features/calendar/CalendarTab.jsx'));
const RefsTab = lazy(() => import('./features/refs/RefsTab.jsx'));

// Lazy load modals (not visible on initial render)
const GlobalSearchModal = lazy(() => import('./components/GlobalSearchModal.jsx'));
const OnboardingModal = lazy(() => import('./components/OnboardingModal.jsx'));

import { S_MUTED } from './lib/styleConstants.js';
import { BUFFER_CATEGORIES } from './data/protocolCategories.js';

const SkeletonLine = ({ width = '100%', height = '0.75rem', style }) => (
  <div className="skeleton-shimmer" style={{ width, height, ...style }} />
);

const LazySkeleton = () => (
  <div className="space-y-4 py-2" aria-busy="true">
    <SkeletonLine width="8rem" height="0.7rem" />
    <SkeletonLine width="40%" height="1.75rem" />
    <div className="card p-5 space-y-3">
      <SkeletonLine width="60%" height="1rem" />
      <SkeletonLine width="100%" />
      <SkeletonLine width="80%" />
      <SkeletonLine width="45%" />
    </div>
  </div>
);

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
  const { loading, syncing, refresh, bufferRecipes, protocolRecipes } = useRecipes();
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
    // Already there: don't push a duplicate history entry (Back would look broken).
    if (tabId === activeTab) return;
    const path = TAB_TO_PATH[tabId] || '/recipes';
    navigate(`/${lang}${path}`);
  }, [navigate, lang, activeTab]);
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
  const [calcInitialMode] = useState(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  // One small tool open at a time: 'timer' | 'calc' | null
  const [utility, setUtility] = useState(null);
  const agentAvailable = useAgentAvailability();
  const toast = useToast();
  const backupStatus = useBackupStatus();

  // Custom entries count toward the sidebar totals; LibraryView announces edits.
  const readCustomCounts = () => ({
    buffers: loadCustomRecipes().filter(r => BUFFER_CATEGORIES.includes(r.category)).length,
    protocols: loadCustomProtocols().length,
  });
  const [customCounts, setCustomCounts] = useState(readCustomCounts);
  useEffect(() => {
    const onChange = () => setCustomCounts(readCustomCounts());
    window.addEventListener('labmate-custom-changed', onChange);
    return () => window.removeEventListener('labmate-custom-changed', onChange);
  }, []);

  const toggleUtility = useCallback((name) => setUtility(cur => (cur === name ? null : name)), []);
  const closeUtility = useCallback(() => setUtility(null), []);
  const toggleTheme = useCallback(() => setTheme(cur => (cur === 'dark' ? 'light' : 'dark')), [setTheme]);
  const closeMore = useCallback(() => setMoreOpen(false), []);
  const toggleAgent = useCallback(() => setAgentOpen(o => !o), []);

  const backup = useMemo(() => ({
    ...backupStatus,
    backupNow: () => backupStatus.backupNow()
      .then(() => toast.show(t('backupDone', lang), '✓'))
      .catch(() => toast.show(t('backupFailed', lang), '⚠')),
  }), [backupStatus, toast, lang]);

  const refreshRecipes = useCallback(async () => {
    toast.show(lang === 'zh' ? '正在刷新配方...' : 'Refreshing recipes...', 'info');
    try {
      const result = await refresh();
      if (result.verified) {
        toast.show(
          t('recipesUpdated', lang) + ` (${result.total} total${result.newCount > 0 ? ', ' + result.newCount + ' new' : ''})`,
          'success'
        );
      } else {
        // Fell back to the trusted bundled library — say why.
        const why = {
          behind: ['The online library is older than this app version, so the built-in library is in use.', '在线配方库比当前应用版本旧，已使用内置配方库。'],
          unverified: ['The online library failed its signature check and was not used.', '在线配方库未通过签名校验，未予采用。'],
          rollback: ['The online library is older than one already applied on this device; kept the built-in library.', '在线配方库比本设备已应用的版本旧，已使用内置配方库。'],
          offline: ['Couldn’t reach the online library; using the built-in library.', '无法连接在线配方库，已使用内置配方库。'],
        }[result.reason] || ['Using the built-in library.', '已使用内置配方库。'];
        toast.show(lang === 'zh' ? why[1] : why[0], 'info');
      }
    } catch (err) {
      toast.show(lang === 'zh' ? '刷新失败' : 'Refresh failed', 'error');
    }
  }, [lang, toast, refresh]);

  const handleCrossNavigate = useCallback((targetRecipe) => {
    setSearchSelected(targetRecipe);
    const targetTab = BUFFER_CATEGORIES.includes(targetRecipe.category) ? 'buffers' : 'protocols';
    setActiveTab(targetTab);
  }, [setActiveTab]);

  // Theme effect
  useEffect(() => {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0D0F0C' : '#F0EEE6');
  }, [theme]);

  // Sync <html lang>
  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
  }, [lang]);

  // Scroll to top when switching sections
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [activeTab]);

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
        <div className="flex flex-col items-center gap-3">
          <img src={import.meta.env.BASE_URL + 'favicon.svg'} alt="" width="36" height="36" />
          <div style={{ width: 120, height: 3, background: 'var(--bg-2)', overflow: 'hidden' }}>
            <div className="skeleton-shimmer" style={{ width: '100%', height: '100%', background: 'var(--primary)' }} />
          </div>
          <p className="mono text-xs" style={S_MUTED}>Loading recipes…</p>
        </div>
      </div>
    );
  }

  const panel = (id, element, lazyTab = true) => (
    <div id={`tabpanel-${id}`}>
      <ErrorBoundary>
        {lazyTab ? <Suspense fallback={<LazySkeleton />}>{element}</Suspense> : element}
      </ErrorBoundary>
    </div>
  );

  // Tab routes shared by every /:locale branch below (see the Routes block in the
  // JSX) — written once and reused via SUPPORTED_LOCALES.map so /en/... and /zh/...
  // both mount the exact same components. Uses locale-RELATIVE Navigate targets
  // ('recipes', not '/en/recipes') so this list doesn't need to know which locale
  // branch it's nested under.
  const renderTabRoutes = () => [
    <Route key="index" index element={<Navigate to="recipes" replace />} />,
    <Route key="buffers-alias" path="buffers" element={<Navigate to="recipes" replace />} />,
    <Route key="recipes" path="recipes" element={panel('buffers',
      <BuffersTab externalSelected={searchSelected} setExternalSelected={setSearchSelected} onCrossNavigate={handleCrossNavigate} />, false)} />,
    <Route key="protocols" path="protocols" element={panel('protocols',
      <ProtocolsTab externalSelected={searchSelected} setExternalSelected={setSearchSelected} onCrossNavigate={handleCrossNavigate} />, false)} />,
    <Route key="calc" path="calc" element={panel('calc', <CalcTab initialMode={calcInitialMode} />)} />,
    <Route key="plate" path="plate" element={panel('plate', <PlateTab />)} />,
    <Route key="tools" path="tools" element={panel('tools', <ToolsTab />)} />,
    <Route key="inventory" path="inventory" element={panel('inventory', <InventoryTab />)} />,
    <Route key="evidence" path="evidence" element={panel('evidence', <EvidenceTab onNavigateNotebook={() => setActiveTab('notebook')} agentAvailable={agentAvailable} />)} />,
    <Route key="notebook" path="notebook" element={panel('notebook', <NotebookTab onNavigateCalendar={() => setActiveTab('calendar')} onNavigateEvidence={() => setActiveTab('evidence')} />)} />,
    <Route key="calendar" path="calendar" element={panel('calendar', <CalendarTab onNavigateNotebook={() => setActiveTab('notebook')} />)} />,
    <Route key="guide" path="guide" element={panel('refs',
      <RefsTab onReplayTour={() => { localStorage.removeItem('labmate_onboardingDone'); db.settings.delete('labmate_onboardingDone').catch(() => {}); setShowOnboarding(true); }} />)} />,
    <Route key="not-found" path="*" element={<Navigate to="recipes" replace />} />,
  ];

  return (
    <LangContext.Provider value={lang}>
      <div className="app-shell" style={{ background: 'var(--bg)', color: 'var(--text)' }}>
        <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); const m = document.getElementById('main'); m?.focus({ preventScroll: true }); m?.scrollIntoView(); }}>
          {lang === 'zh' ? '跳到主要内容' : 'Skip to content'}
        </a>
        <Sidebar
          activeTab={activeTab} onNavigate={setActiveTab} lang={lang} setLang={switchLocale}
          theme={theme} onToggleTheme={toggleTheme} onOpenSearch={() => setSearchOpen(true)}
          onRefreshRecipes={refreshRecipes} isSyncing={syncing}
          counts={{ buffers: bufferRecipes.length + customCounts.buffers, protocols: protocolRecipes.length + customCounts.protocols }}
          backup={backup} utility={utility} onToggleUtility={toggleUtility}
          agentAvailable={agentAvailable} agentOpen={agentOpen} onToggleAgent={toggleAgent}
        />
        <div className="app-main">
          <MobileTopBar
            lang={lang} onNavigate={setActiveTab} onOpenSearch={() => setSearchOpen(true)}
            utility={utility} onToggleUtility={toggleUtility}
            agentAvailable={agentAvailable} agentOpen={agentOpen} onToggleAgent={toggleAgent}
          />
          <main className="app-content" id="main" tabIndex={-1} style={{ outline: 'none' }}>
            {backup.due && (
              /* Phones/tablets only — on desktop the reminder lives in the sidebar */
              <div className="notice notice-warn lg:hidden mb-4" role="status" style={{ alignItems: 'center', padding: '0.5rem 0.5rem 0.5rem 0.75rem' }}>
                <IconAlert size={16} style={{ color: 'var(--warning-text)', flexShrink: 0 }} />
                <span className="flex-1 min-w-0 truncate" style={{ fontSize: '0.8125rem', lineHeight: 1.35 }}>
                  <span className="notice-title">{t('backupLast', lang)}:</span>{' '}
                  <span className="mono">{describeLastBackup(backup.lastExport, t, lang)}</span>
                </span>
                <button type="button" className="btn-primary btn-sm" onClick={backup.backupNow}>{t('backupAction', lang)}</button>
                <button type="button" className="btn-ghost btn-icon btn-sm" onClick={backup.snooze} aria-label={t('backupLater', lang)}>
                  <IconClose size={14} />
                </button>
              </div>
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
        </div>

        <Suspense fallback={null}>
          <GlobalSearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)}
            onSelect={r => setSearchSelected(r)} onSwitchTab={setActiveTab} />
        </Suspense>
        <Suspense fallback={null}>
          <OnboardingModal isOpen={showOnboarding} onClose={() => setShowOnboarding(false)} />
        </Suspense>
        <QuickTimerPanel open={utility === 'timer'} onClose={closeUtility} />
        <QuickCalcPanel open={utility === 'calc'} onClose={closeUtility} />
        <TimerBar />
        <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} onMore={() => setMoreOpen(true)} moreOpen={moreOpen} lang={lang} />
        <MoreSheet isOpen={moreOpen} onClose={closeMore} activeTab={activeTab} setActiveTab={setActiveTab}
          lang={lang} setLang={switchLocale} theme={theme} setTheme={setTheme}
          onRefreshRecipes={refreshRecipes} isSyncing={syncing} backup={backup}
          onOpenAgent={agentAvailable ? () => setAgentOpen(true) : undefined} />
        <InstallPrompt />
        {agentAvailable && (
          <Suspense fallback={null}>
            <AgentProvider>
              <AgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} />
            </AgentProvider>
          </Suspense>
        )}
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
