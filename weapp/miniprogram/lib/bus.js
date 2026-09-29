// Tiny app-wide event bus. Pages and components subscribe in attached/onLoad and
// call the returned function to unsubscribe in detached/onUnload.
//   'lang'     → 'en' | 'zh'
//   'favs'     → { favs, recent }
//   'custom'   → void (custom recipes/protocols changed)
//   'timers'   → timer view list (every second while one runs)
//   'experiments' → void
//   'inventory'   → void
const handlers = {};

function on(event, fn) {
  (handlers[event] = handlers[event] || []).push(fn);
  return () => off(event, fn);
}

function off(event, fn) {
  const list = handlers[event];
  if (!list) return;
  const i = list.indexOf(fn);
  if (i >= 0) list.splice(i, 1);
}

function emit(event, payload) {
  (handlers[event] || []).slice().forEach((fn) => {
    try { fn(payload); } catch (err) { console.error('[bus]', event, err); }
  });
}

module.exports = { on, off, emit };
