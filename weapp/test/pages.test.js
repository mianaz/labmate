// Detail, search, timer, More and custom-form pages.
const { wxMock } = require('./helpers/setup.cjs');
const { page, text, simulate } = require('./helpers/mp.cjs');
const timers = require('../miniprogram/lib/timers');
const bus = require('../miniprogram/lib/bus');

beforeEach(() => wxMock.__reset());

const ev = (dataset, detail) => ({ currentTarget: { dataset: dataset || {} }, detail: detail || {} });

describe('detail', () => {
  test('buffer: facts, components and scaling', async () => {
    const comp = await page('pages/detail/index', { id: 'pbs_10x' });
    const inst = comp.instance;
    let txt = text(comp);
    expect(txt).toContain('10× PBS');
    expect(txt).toContain('10× 磷酸盐缓冲液');
    expect(txt).toContain('NaCl');
    expect(txt).toContain('80.0'); // 80 g at 1000 mL
    expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('10× 磷酸盐缓冲液');
    inst.setPreset(ev({ m: 0.5 }));
    await simulate.sleep(0);
    txt = text(comp);
    expect(inst.data.targetVol).toBe(500);
    expect(txt).toContain('40.00');
    expect(txt).toContain('倍数 ×0.50');
    // prep steps follow the scale
    expect(inst.data.prep.join(' ')).toContain('400 mL');
    inst.onVolume(ev({}, { value: '250' }));
    expect(inst.data.components.find((c) => c.name === 'NaCl').amount).toBe('20.00');
  });

  test('protocol: steps checklist persists under stepTracker_<id>, timers start', async () => {
    const comp = await page('pages/detail/index', { id: 'wb_protocol' });
    const inst = comp.instance;
    expect(inst.data.doc.hasStepToggle).toBe(true);
    inst.setStepMode(ev({ mode: 'detailed' }));
    await simulate.sleep(0);
    const first = inst.data.doc.steps.find((s) => !s.header);
    inst.toggleStep(ev({ i: first.i }));
    expect(wxMock.getStorageSync('stepTracker_wb_protocol')).toEqual([first.i]);
    expect(inst.data.doneCount).toBe(1);
    expect(text(comp)).toContain('1/' + inst.data.doc.actionCount);
    const withTimer = inst.data.doc.steps.find((s) => s.timers.length);
    inst.startTimer(ev({ seconds: withTimer.timers[0].seconds, label: withTimer.timers[0].label }));
    expect(timers.list()[0].label).toContain('Western Blot');
    inst.resetSteps();
    expect(wxMock.getStorageSync('stepTracker_wb_protocol')).toBe('');
    expect(inst.data.doneCount).toBe(0);
  });

  test('favorite, copy, share and keep-screen-on', async () => {
    const comp = await page('pages/detail/index', { id: 'ripa' });
    const inst = comp.instance;
    inst.toggleFav();
    expect(wxMock.getStorageSync('biolab_favorites')).toEqual(['ripa']);
    inst.copyText();
    expect(wxMock.__called('setClipboardData')[0].opts.data).toContain('RIPA');
    expect(inst.onShareAppMessage()).toEqual({ title: 'RIPA 裂解液', path: '/pages/detail/index?id=ripa' });
    inst.toggleKeepAwake();
    expect(wxMock.getStorageSync('labmate_keepScreenOn')).toBe(true);
    expect(wxMock.__called('setKeepScreenOn').pop().opts.keepScreenOn).toBe(true);
    inst.onUnload();
    expect(wxMock.__called('setKeepScreenOn').pop().opts.keepScreenOn).toBe(false);
  });

  test('related protocol chips navigate', async () => {
    const comp = await page('pages/detail/index', { id: 'ripa' });
    const related = comp.instance.data.doc.related;
    expect(related.length).toBeGreaterThan(0);
    comp.instance.openRecipe(ev({ id: related[0].id }));
    expect(wxMock.__called('navigateTo')[0].opts.url).toBe('/pages/detail/index?id=' + related[0].id);
  });

  test('unknown id shows the empty state', async () => {
    const comp = await page('pages/detail/index', { id: 'nope' });
    expect(comp.instance.data.missing).toBe(true);
    expect(text(comp)).toContain('未找到匹配结果');
  });

  test('English', async () => {
    wxMock.setStorageSync('biolab_lang', 'en');
    const comp = await page('pages/detail/index', { id: 'pbs_10x' });
    const txt = text(comp);
    expect(txt).toContain('Components');
    expect(txt).toContain('Target Volume');
    expect(txt).not.toContain('磷酸盐');
  });
});

describe('search', () => {
  test('finds by reagent and opens the detail', async () => {
    const comp = await page('pages/search/index');
    expect(text(comp)).toContain('CRISPR'); // suggestions
    comp.instance.run('Tris');
    await simulate.sleep(0);
    const results = comp.instance.data.results;
    expect(results.length).toBeGreaterThan(3);
    expect(text(comp)).toContain('含有');
    comp.instance.open(ev({ id: results[0].id }));
    expect(wxMock.__called('navigateTo')[0].opts.url).toBe('/pages/detail/index?id=' + results[0].id);
  });

  test('no results', async () => {
    const comp = await page('pages/search/index');
    comp.instance.run('zzzzqqq');
    await simulate.sleep(0);
    expect(text(comp)).toContain('未找到匹配结果');
  });
});

describe('timer page', () => {
  test('quick and custom timers', async () => {
    const comp = await page('pages/timer/index');
    comp.instance.startQuick(ev({ min: 5 }));
    await simulate.sleep(0);
    expect(comp.instance.data.timers[0]).toMatchObject({ label: '5 min', display: '5:00' });
    comp.instance.onLabel(ev({}, { value: 'Blocking' }));
    comp.instance.onMinutes(ev({}, { value: '1.5' }));
    comp.instance.startCustom();
    await simulate.sleep(0);
    expect(comp.instance.data.timers[1]).toMatchObject({ label: 'Blocking', display: '1:30' });
    expect(text(comp)).toContain('Blocking');
    comp.instance.pause(ev({ id: comp.instance.data.timers[1].id }));
    expect(comp.instance.data.timers[1].running).toBe(false);
    comp.instance.remove(ev({ id: comp.instance.data.timers[0].id }));
    expect(comp.instance.data.timers).toHaveLength(1);
  });
});

describe('more', () => {
  test('sections, language switch and backup export', async () => {
    const comp = await page('pages/more/index');
    const txt = text(comp);
    expect(txt).toContain('样品库存');
    expect(txt).toContain('实验记录');
    expect(txt).toContain('上次备份');
    comp.instance.go(ev({ url: '/packages/lab/notebook/index' }));
    expect(wxMock.__called('navigateTo')[0].opts.url).toBe('/packages/lab/notebook/index');

    let langEvent = null;
    const off = bus.on('lang', (l) => { langEvent = l; });
    comp.instance.setLangTo(ev({ lang: 'en' }));
    off();
    await simulate.sleep(0);
    expect(langEvent).toBe('en');
    expect(wxMock.getStorageSync('biolab_lang')).toBe('en');
    expect(text(comp)).toContain('Inventory');

    await comp.instance.exportBackup();
    const write = wxMock.__called('fs.writeFile')[0].opts;
    expect(write.filePath).toMatch(/labmate-backup-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(write.data)).toMatchObject({ schemaVersion: 2, data: { biolab_lang: 'en' } });
    expect(wxMock.__called('shareFileMessage')).toHaveLength(1);
    expect(wxMock.getStorageSync('labmate_lastExport')).toBeGreaterThan(0);
  });

  test('restore from a web backup picked in a chat', async () => {
    const comp = await page('pages/more/index');
    const orig = wx.chooseMessageFile;
    wx.chooseMessageFile = (o) => o.success({ tempFiles: [{ path: 'wxfile://tmp/b.json', name: 'labmate-backup.json' }] });
    wxMock.__fileContent = JSON.stringify({ exportedAt: '2026-09-01T00:00:00Z', schemaVersion: 2, data: { biolab_favorites: ['tbst'] }, experiments: [] });
    await comp.instance.importBackup();
    wx.chooseMessageFile = orig;
    expect(wxMock.getStorageSync('biolab_favorites')).toEqual(['tbst']);
    expect(wxMock.__called('showToast').pop().opts.title).toBe('已恢复 1 项数据');
  });
});

describe('custom form', () => {
  test('new custom recipe is saved in the web shape and opened', async () => {
    const comp = await page('pages/custom-form/index', { type: 'recipe' });
    const inst = comp.instance;
    expect(inst.data.canSave).toBe(false);
    inst.onField({ currentTarget: { dataset: { key: 'name' } }, detail: { value: 'My Lysis Buffer' } });
    inst.onField({ currentTarget: { dataset: { key: 'defaultVolume' } }, detail: { value: '50' } });
    inst.onListField({ currentTarget: { dataset: { list: 'components', index: 0, key: 'name' } }, detail: { value: 'NaCl' } });
    inst.onListField({ currentTarget: { dataset: { list: 'components', index: 0, key: 'amount' } }, detail: { value: '0.44' } });
    inst.addRow(ev({ list: 'components' }));
    inst.onTemp(ev({}, { value: 1 }));
    inst.save();
    const saved = wxMock.getStorageSync('labmate_customRecipes');
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({
      name: 'My Lysis Buffer', category: 'buffer', defaultVolume: 50, _isCustom: true,
      components: [{ name: 'NaCl', amount: 0.44, unit: 'g', note: '' }],
      storage: { temp: '4°C', duration: '', label: { en: '', zh: '' } },
    });
    expect(saved[0].id).toMatch(/^custom_\d+$/);
    expect(wxMock.__called('redirectTo')[0].opts.url).toBe('/pages/detail/index?id=' + saved[0].id);

    // …and it shows up on the detail page with Edit/Delete.
    const detail = await page('pages/detail/index', { id: saved[0].id });
    expect(text(detail)).toContain('My Lysis Buffer');
    expect(text(detail)).toContain('编辑');
    expect(detail.instance.data.components[0].amount).toBe('0.440');
    await detail.instance.deleteCustom();
    expect(wxMock.getStorageSync('labmate_customRecipes')).toEqual([]);
  });

  test('custom protocol: steps and materials', async () => {
    const comp = await page('pages/custom-form/index', { type: 'protocol' });
    const inst = comp.instance;
    inst.onField({ currentTarget: { dataset: { key: 'name' } }, detail: { value: 'Quick lysis' } });
    inst.onListField({ currentTarget: { dataset: { list: 'steps', index: 0, key: 'zh' } }, detail: { value: '加入裂解液' } });
    inst.addRow(ev({ list: 'steps' }));
    inst.onListField({ currentTarget: { dataset: { list: 'steps', index: 1, key: 'zh' } }, detail: { value: '冰上 10 分钟' } });
    inst.onListField({ currentTarget: { dataset: { list: 'materials', index: 0 } }, detail: { value: 'RIPA' } });
    inst.save();
    const saved = wxMock.getStorageSync('labmate_customProtocols')[0];
    expect(saved).toMatchObject({ name: 'Quick lysis', category: 'protocol', briefSteps: ['加入裂解液', '冰上 10 分钟'], materials: ['RIPA'], components: [] });
    const detail = await page('pages/detail/index', { id: saved.id });
    expect(text(detail)).toContain('冰上 10 分钟');
  });
});
