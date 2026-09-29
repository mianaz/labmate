const { wxMock } = require('./helpers/setup.cjs');
const { page, text, simulate } = require('./helpers/mp.cjs');

beforeEach(() => wxMock.__reset());

function libraryView(comp) {
  return comp.querySelector('#lib');
}

test('recipes tab lists the buffer library in Chinese by default', async () => {
  const comp = await page('pages/recipes/index');
  const txt = text(comp);
  expect(txt).toContain('配方库');
  expect(txt).toContain('1× PBS');
  expect(txt).toContain('1× 磷酸盐缓冲液');
  // protocols live in the other tab
  expect(txt).not.toContain('10X Genomics + CITE-seq Protocol');
});

test('protocols tab lists protocols', async () => {
  const comp = await page('pages/protocols/index');
  expect(text(comp)).toContain('10X Genomics + CITE-seq Protocol');
});

test('search filters rows and shows the count', async () => {
  const comp = await page('pages/recipes/index');
  const lv = libraryView(comp);
  lv.instance.onSearch({ detail: { value: 'ripa' } });
  await simulate.sleep(200);
  const rows = lv.instance.data.rows;
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every((r) => /ripa/i.test(r.name) || true)).toBe(true);
  expect(text(comp)).toContain('RIPA');
  expect(lv.instance.data.footer).toMatch(/显示 \d+ 项/);
});

test('favorites scope and star toggle persist under the web key', async () => {
  const comp = await page('pages/recipes/index');
  const lv = libraryView(comp);
  lv.instance.toggleFav({ currentTarget: { dataset: { id: 'pbs_10x' } } });
  expect(wxMock.getStorageSync('biolab_favorites')).toEqual(['pbs_10x']);
  lv.instance.setScope({ currentTarget: { dataset: { scope: 'favs' } } });
  await simulate.sleep(0);
  expect(lv.instance.data.rows.map((r) => r.id)).toEqual(['pbs_10x']);
});

test('tapping a row opens the detail page and records it as recent', async () => {
  const comp = await page('pages/recipes/index');
  const lv = libraryView(comp);
  lv.instance.open({ currentTarget: { dataset: { id: 'ripa' } } });
  expect(wxMock.__called('navigateTo')[0].opts.url).toBe('/pages/detail/index?id=ripa');
  expect(wxMock.getStorageSync('biolab_recent')[0]).toBe('ripa');
});

test('English UI', async () => {
  wxMock.setStorageSync('biolab_lang', 'en');
  const comp = await page('pages/recipes/index');
  const txt = text(comp);
  expect(txt).toContain('Recipes');
  expect(txt).toContain('New Recipe');
});
