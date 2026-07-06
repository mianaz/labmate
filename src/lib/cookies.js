// Tiny cookie reader — used to inherit theme/lang from the main bioinfospace.com
// site on first load (see App.jsx's getDefaultLang/getDefaultTheme). The main
// site writes `bis_theme`/`bis_lang` on the shared `.bioinfospace.com` domain
// (src/utils/crossDomainCookie.ts in the website repo) so that apps.bioinfospace.com
// (Apps Portal, LabMate) can pick them up. This only ever READS them — LabMate
// never writes back to bis_theme/bis_lang, it only seeds its own local storage.
export function readCookie(name) {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}
