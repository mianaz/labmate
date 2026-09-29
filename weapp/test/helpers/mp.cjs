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

// Tap the i-th element matching a selector (id / class), firing its bindtap
// handler the way WeChat would.
async function tap(comp, selector, index) {
  const nodes = comp.querySelectorAll(selector);
  const node = nodes[index || 0];
  if (!node) throw new Error('tap: nothing matches ' + selector);
  node.dispatchEvent('tap');
  await simulate.sleep(0);
  return node;
}

module.exports = { ROOT, load, page, text, tap, simulate };
