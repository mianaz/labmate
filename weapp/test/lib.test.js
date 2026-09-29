// Unit tests for miniprogram/lib — the parts that must agree with the web app.
const { wxMock } = require('./helpers/setup.cjs');
const fmt = require('../miniprogram/lib/format');
const timers = require('../miniprogram/lib/timers');
const backup = require('../miniprogram/lib/backup');
const experiments = require('../miniprogram/lib/experiments');
const recipes = require('../miniprogram/lib/recipes');
const favorites = require('../miniprogram/lib/favorites');
const i18n = require('../miniprogram/shared/i18n.js');

beforeEach(() => wxMock.__reset());

describe('format', () => {
  test('step time parsing matches the web rules', () => {
    expect(fmt.parseTimePatternsFromText('Incubate 15-30 min at RT')).toEqual([{ seconds: 1800, label: '15-30 min' }]);
    expect(fmt.parseTimePatternsFromText('室温孵育 1 小时')).toEqual([{ seconds: 3600, label: '1 小时' }]);
    expect(fmt.parseTimePatternsFromText('95°C 30 s, 35 cycles')).toEqual([]);
    expect(fmt.parseTimePatternsFromText('Centrifuge 12,000 × g')).toEqual([]);
    expect(fmt.parseTimePatternsFromText('Sonicate 30s on/30s off')).toEqual([]);
    expect(fmt.parseTimePatternsFromText('about 5 min')).toEqual([]);
  });

  test('dynamic step values scale', () => {
    expect(fmt.renderDynamicStep('Add ~{v:800:mL} ddH₂O', 0.5)).toBe('Add ~400 mL ddH₂O');
    expect(fmt.renderDynamicStep('Top up to {v:1000:mL}', 1)).toBe('Top up to 1000 mL');
  });

  test('bold segments', () => {
    expect(fmt.boldSegments('**Lysis**: add buffer')).toEqual([{ text: 'Lysis', bold: true }, { text: ': add buffer', bold: false }]);
  });

  test('timer and amount formatting', () => {
    expect(fmt.formatTimer(90)).toBe('1:30');
    expect(fmt.formatTimer(3700)).toBe('1:01:40');
    expect(fmt.fmtAmount(0.005)).toBe('5.00e-3');
    expect(fmt.fmtAmount(12.345)).toBe('12.35');
    expect(fmt.fmtAmount(170)).toBe('170.0');
  });

  test('recipe text export includes scaled amounts and prep', () => {
    const pbs = recipes.getById('pbs_10x');
    const txt = fmt.recipeToText(pbs, 500, 'zh');
    expect(txt).toContain('10× 磷酸盐缓冲液');
    expect(txt).toContain('NaCl  40.00 g');
    expect(txt).toContain('400 mL');
    const prot = fmt.recipeToText(recipes.getById('wb_protocol'), 1, 'en');
    expect(prot).toContain('Steps:');
    expect(prot).toMatch(/1\. /);
  });
});

describe('timers', () => {
  test('add / pause / resume / finish with the web model', () => {
    const id = timers.add('Blocking', 60);
    let [tm] = timers.list();
    expect(tm).toMatchObject({ id, label: 'Blocking', running: true, done: false, remaining: 60, display: '1:00' });
    expect(wxMock.getStorageSync('labmate_timers')[0]).toMatchObject({ totalSeconds: 60, running: true });
    timers.pause(id);
    [tm] = timers.list();
    expect(tm.running).toBe(false);
    timers.resume(id);
    expect(timers.list()[0].running).toBe(true);
    expect(wxMock.__called('setKeepScreenOn').pop().opts.keepScreenOn).toBe(true);
    timers.remove(id);
    expect(timers.list()).toEqual([]);
    expect(wxMock.__called('setKeepScreenOn').pop().opts.keepScreenOn).toBe(false);
  });

  test('timers that ran out while closed come back finished without an alarm', () => {
    const now = Date.now();
    wxMock.setStorageSync('labmate_timers', [
      { id: 1, label: 'old', totalSeconds: 60, running: true, endsAt: now - 1000, remaining: 60 },
      { id: 2, label: 'bad' },
    ]);
    timers.init();
    const list = timers.list();
    expect(list).toHaveLength(1);
    expect(list[0].done).toBe(true);
    expect(wxMock.__called('showModal')).toHaveLength(0);
  });

  test('a timer that ends while open alerts', () => {
    const now = Date.now();
    wxMock.setStorageSync('labmate_timers', [{ id: 1, label: 'soon', totalSeconds: 60, running: true, endsAt: now + 60000, remaining: 60 }]);
    timers.init();
    const spy = vi.spyOn(Date, 'now').mockReturnValue(now + 61000);
    timers.wake();
    spy.mockRestore();
    expect(timers.list()[0].done).toBe(true);
    expect(wxMock.__called('showModal')[0].opts.content).toBe('soon');
    expect(wxMock.__called('vibrateLong').length).toBeGreaterThan(0);
    timers.clearDone();
    expect(timers.list()).toEqual([]);
  });
});

describe('backup (web file format)', () => {
  test('export collects web keys, skips timers and secrets, carries experiments', () => {
    wxMock.setStorageSync('biolab_favorites', ['pbs_10x']);
    wxMock.setStorageSync('labmate_customRecipes', [{ id: 'custom_1', name: 'Mine', category: 'buffer' }]);
    wxMock.setStorageSync('labmate_timers', [{ id: 1 }]);
    wxMock.setStorageSync('labmate_api_key', 'sk-secret');
    wxMock.setStorageSync('unrelated', 1);
    experiments.save({ title: 'WB run', date: '2026-09-01' });
    const b = backup.buildBackup();
    expect(b.schemaVersion).toBe(2);
    expect(b.data).toEqual({
      biolab_favorites: ['pbs_10x'],
      labmate_customRecipes: [{ id: 'custom_1', name: 'Mine', category: 'buffer' }],
    });
    expect(b.experiments).toHaveLength(1);
    expect(b.experiments[0].title).toBe('WB run');
  });

  test('import merges custom arrays by id and restores experiments', () => {
    wxMock.setStorageSync('labmate_customRecipes', [{ id: 'a', name: 'old' }, { id: 'b', name: 'keep' }]);
    const n = backup.importBackup(JSON.stringify({
      exportedAt: '2026-01-01T00:00:00.000Z',
      schemaVersion: 2,
      data: {
        labmate_customRecipes: [{ id: 'a', name: 'new' }, { id: 'c', name: 'added' }],
        biolab_lang: 'en',
        labmate_timers: [{ id: 9 }],
        my_token: 'x',
      },
      experiments: [{ id: 'exp_1', title: 'Restored', date: '2026-01-01' }],
    }));
    expect(n).toBe(3); // 1 experiment + 2 data keys
    expect(wxMock.getStorageSync('labmate_customRecipes').map((r) => r.name)).toEqual(['new', 'keep', 'added']);
    expect(wxMock.getStorageSync('biolab_lang')).toBe('en');
    expect(wxMock.getStorageSync('labmate_timers')).toBe('');
    expect(wxMock.getStorageSync('my_token')).toBe('');
    expect(experiments.get('exp_1').title).toBe('Restored');
  });

  test('rejects files that are not backups', () => {
    expect(() => backup.importBackup('{"foo":1}')).toThrow();
  });

  test('last backup description', () => {
    expect(backup.describeLastBackup(0, 'zh')).toBe('从未');
    expect(backup.describeLastBackup(Date.now() - 3 * 86400000, 'en')).toBe('3 d ago');
    expect(backup.isDue(Date.now())).toBe(false);
  });
});

describe('recipes + favorites', () => {
  test('library split matches the web', () => {
    expect(recipes.BUFFERS.length + recipes.PROTOCOLS.length).toBe(recipes.LIBRARY.length);
    expect(recipes.BUFFERS.every((r) => ['buffer', 'staining', 'media'].includes(r.category))).toBe(true);
  });

  test('custom entries join their library', () => {
    recipes.saveCustomRecipes([{ id: 'custom_1', name: 'My buffer', category: 'buffer' }]);
    recipes.saveCustomProtocols([{ id: 'custom_2', name: 'My protocol', briefSteps: ['a'] }]);
    expect(recipes.libraryItems('buffers').some((r) => r.id === 'custom_1' && r._isCustom)).toBe(true);
    expect(recipes.getById('custom_2').category).toBe('protocol');
    expect(recipes.search('my protocol')[0].recipe.id).toBe('custom_2');
  });

  test('favorites toggle and recent list', () => {
    expect(favorites.toggle('ripa')).toBe(true);
    expect(favorites.isFav('ripa')).toBe(true);
    expect(favorites.toggle('ripa')).toBe(false);
    for (let k = 0; k < 10; k++) favorites.addRecent('r' + k);
    expect(favorites.recent()).toHaveLength(8);
    expect(favorites.recent()[0]).toBe('r9');
  });
});

test('i18n falls back like the web', () => {
  expect(i18n.t('tabBuffers', 'zh')).toBe('配方库');
  expect(i18n.t('tabBuffers', 'en')).toBe('Recipes');
  expect(i18n.t('no_such_key', 'en')).toBe('no_such_key');
  expect(i18n.tf('itemsCount', 'en', { n: 5 })).toBe('5 items');
});

test('restoring a backup applies its language immediately', () => {
  const lang = require('../miniprogram/lib/lang');
  expect(lang.getLang()).toBe('zh');
  backup.importBackup({ exportedAt: 'x', data: { biolab_lang: 'en' } });
  expect(lang.getLang()).toBe('en');
});

describe('review fixes', () => {
  test('experiments live one per key and migrate from the old single array', () => {
    wxMock.setStorageSync('labmate_experiments', [
      { id: 'exp_a', date: '2026-01-02', title: 'A', createdAt: 1 },
      { id: 'exp_b', date: '2026-01-03', title: 'B', createdAt: 2 },
    ]);
    expect(experiments.all().map((e) => e.id)).toEqual(['exp_b', 'exp_a']);
    expect(wxMock.getStorageSync('labmate_experiments')).toBe('');
    expect(wxMock.getStorageSync('nb:exp_a').title).toBe('A');
    experiments.remove('exp_a');
    expect(experiments.get('exp_a')).toBeNull();
    // entries never leak into a backup's `data`
    expect(Object.keys(backup.buildBackup().data)).toEqual([]);
    expect(backup.buildBackup().experiments.map((e) => e.id)).toEqual(['exp_b']);
  });

  test('a restore that runs out of storage says so instead of claiming success', () => {
    const orig = wx.setStorageSync;
    wx.setStorageSync = (key, value) => {
      if (key === 'labmate_inventory') throw new Error('setStorageSync:fail exceed storage max size');
      return orig(key, value);
    };
    let err = null;
    try {
      backup.importBackup({ exportedAt: 'x', data: { biolab_favorites: ['a'], labmate_inventory: { locations: [] } } });
    } catch (e) { err = e; }
    wx.setStorageSync = orig;
    expect(err && err.message).toBe('storage_full');
    expect(err.failed).toEqual(['labmate_inventory']);
    expect(wxMock.getStorageSync('biolab_favorites')).toEqual(['a']);
  });

  test('comma decimal separators parse', () => {
    expect(fmt.parseNum('2,5')).toBe(2.5);
    expect(fmt.parseNum('0。5')).toBe(0.5);
    expect(fmt.parseNum('')).toBeNaN();
  });

  test('picked files lose a UTF-8 byte-order mark', async () => {
    const ui = require('../miniprogram/lib/ui');
    wxMock.__pickedFile = { name: 'b.json', content: '﻿{"a":1}' };
    const file = await ui.pickTextFile(['json']);
    expect(JSON.parse(file.content)).toEqual({ a: 1 });
  });

  test('shareTextFile calls wx.shareFileMessage synchronously (tap gesture)', () => {
    const ui = require('../miniprogram/lib/ui');
    ui.shareTextFile('x.txt', 'hello');
    // no await: the share must already have been requested
    expect(wxMock.__called('shareFileMessage')).toHaveLength(1);
    expect(wxMock.__called('fs.writeFile')[0].opts.data).toBe('hello');
  });
});
