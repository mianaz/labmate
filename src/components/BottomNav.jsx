// BottomNav — phones/tablets (<1024px) primary navigation: the four most-used
// sections plus "More". Hidden ≥1024px by CSS (.bottom-nav).
// ⚠️ Never set `display` inline on this element — the breakpoint rule lives in CSS.
import { t } from '../i18n/index.js';
import { BOTTOM_NAV_TABS, TABS, tabHref, isPlainClick } from '../lib/nav.jsx';
import { IconMore } from './icons.jsx';

export default function BottomNav({ activeTab, setActiveTab, onMore, moreOpen = false, lang }) {
  const moreActive = !BOTTOM_NAV_TABS.includes(activeTab);

  return (
    <nav aria-label={lang === 'zh' ? '底部导航' : 'Bottom navigation'} className="bottom-nav">
      {BOTTOM_NAV_TABS.map(id => {
        const { Icon, short } = TABS[id];
        const active = activeTab === id;
        return (
          <a key={id} href={tabHref(id, lang)} className="bottom-nav-item" aria-current={active ? 'page' : undefined}
            onClick={(e) => {
              if (!isPlainClick(e)) return;
              e.preventDefault();
              // Tapping the tab you're already on pops back to its top level (list view).
              if (active) window.dispatchEvent(new window.CustomEvent('labmate-tab-reselect', { detail: { tab: id } }));
              else setActiveTab(id);
            }}>
            <Icon size={20} />
            <span>{t(short, lang)}</span>
          </a>
        );
      })}
      <button type="button" onClick={onMore} className={`bottom-nav-item${moreActive ? ' is-active' : ''}`}
        aria-haspopup="dialog" aria-expanded={moreOpen}>
        <IconMore size={20} />
        <span>{moreActive ? t(TABS[activeTab]?.short || 'navMore', lang) : t('navMore', lang)}</span>
      </button>
    </nav>
  );
}
