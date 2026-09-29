// Load and render a page or component from miniprogram/.
const path = require('path');
const simulate = require('miniprogram-simulate');

const ROOT = path.resolve(__dirname, '../../miniprogram');

function load(relPath, props) {
  const id = simulate.load(path.join(ROOT, relPath), { rootPath: ROOT, compiler: 'official' });
  const comp = simulate.render(id, props || {});
  const parent = document.createElement('parent-wrapper');
  comp.attach(parent);
  return comp;
}

// Render a page: attach, then run its onLoad(query) / onShow() like WeChat does.
async function page(relPath, query) {
  const comp = load(relPath);
  const inst = comp.instance;
  global.__pages = [inst];
  if (typeof inst.onLoad === 'function') await inst.onLoad(query || {});
  if (typeof inst.onShow === 'function') await inst.onShow();
  await simulate.sleep(0);
  return comp;
}

function text(comp) {
  return comp.dom.textContent.replace(/\s+/g, ' ').trim();
}

// Tap the first element whose text includes `label` (or matching a selector).
function tapText(comp, label) {
  const all = comp.dom.querySelectorAll('*');
  for (const el of all) {
    if (el.children.length === 0 && el.textContent.includes(label)) {
      let node = el;
      while (node && node !== comp.dom) {
        node.dispatchEvent(new Event('tap', { bubbles: false }));
        node = node.parentNode;
      }
      return true;
    }
  }
  return false;
}

module.exports = { ROOT, load, page, text, tapText, simulate };
