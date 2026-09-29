// Screen wake lock with reasons: the detail page's "Keep screen on" toggle and
// running timers each hold one; the screen stays on while any is held.
const reasons = new Set();

function apply() {
  try { wx.setKeepScreenOn({ keepScreenOn: reasons.size > 0 }); } catch (err) { /* unsupported */ }
}

function acquire(reason) {
  if (reasons.has(reason)) return;
  reasons.add(reason);
  apply();
}

function release(reason) {
  if (!reasons.delete(reason)) return;
  apply();
}

// WeChat drops the flag when the mini program goes to the background.
function reapply() { if (reasons.size) apply(); }

module.exports = { acquire, release, reapply };
