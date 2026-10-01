// Single source of truth for the app's sections: URL paths, labels, icons and the
// grouping shared by the desktop sidebar, the mobile bottom nav and the More sheet.
import {
  IconFlask, IconClipboard, IconCalculator, IconPlate, IconLink,
  IconBox, IconNotebook, IconCalendar, IconBook, IconGraph,
} from '../components/icons.jsx';

// Tab <-> URL path mapping. The /labmate/ basename is applied by BrowserRouter and
// the active locale is prefixed on top (/en/recipes, /zh/recipes).
export const TAB_TO_PATH = {
  buffers:   '/recipes',
  protocols: '/protocols',
  calc:      '/calc',
  plate:     '/plate',
  tools:     '/tools',
  inventory: '/inventory',
  evidence:  '/evidence',
  notebook:  '/notebook',
  calendar:  '/calendar',
  refs:      '/guide',
};
export const PATH_TO_TAB = Object.fromEntries(Object.entries(TAB_TO_PATH).map(([k, v]) => [v, k]));

// label: full name (sidebar, page titles) · short: bottom-nav label
export const TABS = {
  buffers:   { label: 'tabBuffers',   short: 'tabBuffers',    Icon: IconFlask,      group: 'library' },
  protocols: { label: 'tabProtocols', short: 'tabProtocols',  Icon: IconClipboard,  group: 'library' },
  calc:      { label: 'tabCalc',      short: 'tabCalcShort',  Icon: IconCalculator, group: 'tools' },
  plate:     { label: 'tabPlate',     short: 'tabPlateShort', Icon: IconPlate,      group: 'tools' },
  tools:     { label: 'tabTools',     short: 'tabTools',      Icon: IconLink,       group: 'tools' },
  inventory: { label: 'tabInventory', short: 'tabInventory',  Icon: IconBox,        group: 'lab' },
  evidence:  { label: 'tabEvidence',  short: 'tabEvidenceShort', Icon: IconGraph,   group: 'lab' },
  notebook:  { label: 'tabNotebook',  short: 'tabNotebook',   Icon: IconNotebook,   group: 'lab' },
  calendar:  { label: 'tabCalendar',  short: 'tabCalendar',   Icon: IconCalendar,   group: 'lab' },
  refs:      { label: 'tabRefs',      short: 'tabRefs',       Icon: IconBook,       group: 'help' },
};

export const NAV_GROUPS = [
  { id: 'library', label: 'navLibrary', tabs: ['buffers', 'protocols'] },
  { id: 'tools',   label: 'navTools',   tabs: ['calc', 'plate', 'tools'] },
  { id: 'lab',     label: 'navMyLab',   tabs: ['inventory', 'evidence', 'notebook', 'calendar'] },
  { id: 'help',    label: 'navHelp',    tabs: ['refs'] },
];

// Mobile bottom bar: the four most-used sections; everything else lives in More.
export const BOTTOM_NAV_TABS = ['buffers', 'protocols', 'calc', 'plate'];

export function groupLabelKey(tabId) {
  const group = NAV_GROUPS.find(g => g.tabs.includes(tabId));
  return group ? group.label : null;
}

export function tabHref(tabId, lang) {
  return `${import.meta.env.BASE_URL}${lang}${TAB_TO_PATH[tabId] || '/recipes'}`;
}

// Let modified clicks (new tab/window) fall through to the browser; handle plain
// clicks client-side.
export function isPlainClick(e) {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}
