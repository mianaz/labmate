// Links + Guide (packages/tools): the web's ToolsTab and RefsTab.
const { wxMock } = require('./helpers/setup.cjs');
const { page, text, simulate } = require('./helpers/mp.cjs');
const i18n = require('../miniprogram/shared/i18n.js');
const recipes = require('../miniprogram/lib/recipes.js');
const experiments = require('../miniprogram/lib/experiments.js');

const LINKS = 'packages/tools/links/index';
const GUIDE = 'packages/tools/guide/index';

beforeEach(() => wxMock.__reset());

function lastToast() {
  const t = wxMock.__called('showToast');
  return t.length ? t[t.length - 1].opts.title : '';
}

// Tap the first `selector` element whose text includes `label`, through the
// component system (so bindtap handlers and data-* datasets run like on a phone).
async function tap(comp, selector, label) {
  const el = comp.querySelectorAll(selector).find((c) => !label || c.dom.textContent.includes(label));
  if (!el) return false;
  el.dispatchEvent('tap');
  await simulate.sleep(10);
  return true;
}

// wx.* stubs for one test (setup copies the mock onto the global wx).
const restores = [];
function stubWx(name, fn) {
  const prev = wx[name];
  wx[name] = fn;
  restores.push(() => { wx[name] = prev; });
}
afterEach(() => { while (restores.length) restores.pop()(); });

// ── Links ─────────────────────────────────────────────────────────────────

describe('links', () => {
  test('renders the directory in Chinese', async () => {
    const comp = await page(LINKS);
    const txt = text(comp);
    expect(txt).toContain('实用链接');
    expect(txt).toContain('工具');
    expect(txt).toContain('40 个链接');
    expect(txt).toContain('Bioinfospace 应用');
    expect(txt).toContain('单细胞');
    expect(txt).toContain('ELISA Calculator');
    expect(txt).toContain('标准曲线拟合 & 浓度计算');
    expect(txt).toContain('Human Cell Atlas');
    expect(txt).toContain('ncbi.nlm.nih.gov');
    expect(txt).toContain('点击卡片复制链接');
    expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('常用链接');
  });

  test('renders in English', async () => {
    wxMock.setStorageSync('biolab_lang', 'en');
    const comp = await page(LINKS);
    const txt = text(comp);
    expect(txt).toContain('Useful Links');
    expect(txt).toContain('40 links');
    expect(txt).toContain('Primer & Sequence');
    expect(txt).toContain('Standard curve fitting & concentration calculation');
    expect(txt).toContain('paste it into your browser');
    expect(txt).not.toContain('标准曲线拟合');
    expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('Links');
  });

  test('monograms and hostnames match the web rules', async () => {
    const comp = await page(LINKS);
    const tools = {};
    comp.instance.data.groups.forEach((g) => g.tools.forEach((x) => { tools[x.name] = x; }));
    expect(Object.keys(tools)).toHaveLength(40);
    expect(tools['ELISA Calculator'].mono).toBe('EC'); // two words
    expect(tools.freeCount.mono).toBe('FC'); // camel-case hump
    expect(tools['JBrowse 2'].mono).toBe('JB'); // numbers dropped
    expect(tools.Phyre2.mono).toBe('PH'); // first two letters
    expect(tools.PrimerBank.mono).toBe('PR'); // abbr override
    expect(tools['Primer-BLAST'].mono).toBe('PB');
    expect(tools['Primer-BLAST'].host).toBe('ncbi.nlm.nih.gov');
    expect(tools.Phyre2.host).toBe('sbg.bio.ic.ac.uk');
    comp.instance.data.cats.forEach((c) => expect(i18n.has(c.id)).toBe(true));
  });

  test('category chips filter the groups', async () => {
    const comp = await page(LINKS);
    expect(await tap(comp, '.lk-chip', '结构 & 建模')).toBe(true);
    expect(comp.instance.data.filter).toBe('toolCatStructure');
    let txt = text(comp);
    expect(txt).toContain('AlphaFold Protein Structure DB');
    expect(txt).toContain('SWISS-MODEL');
    expect(txt).not.toContain('ELISA Calculator');
    expect(txt).not.toContain('CellxGene');

    await tap(comp, '.lk-chip', '全部');
    txt = text(comp);
    expect(comp.instance.data.filter).toBe('all');
    expect(txt).toContain('ELISA Calculator');
    expect(txt).toContain('CellxGene');
  });

  test('tapping a tool copies its URL and says to paste it into a browser', async () => {
    const comp = await page(LINKS);
    expect(await tap(comp, '.lk-card', 'ELISA Calculator')).toBe(true);
    const clip = wxMock.__called('setClipboardData');
    expect(clip).toHaveLength(1);
    expect(clip[0].opts.data).toBe('https://apps.bioinfospace.com/ELISA_calculator/');
    expect(lastToast()).toBe(i18n.t('lkCopied', 'zh'));
  });
});

// ── Guide ─────────────────────────────────────────────────────────────────

describe('guide', () => {
  test('renders in Chinese with collapsed sections and no web-only sections', async () => {
    const comp = await page(GUIDE);
    let txt = text(comp);
    expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('使用说明');
    expect(txt).toContain('帮助');
    expect(txt).toContain('备份与恢复');
    expect(txt).toContain('上次备份: 从未');
    expect(txt).toContain('请备份您的数据');
    expect(txt).toContain('发送备份文件');
    expect(txt).toContain('从聊天中选择');
    expect(txt).toContain('apps.bioinfospace.com/labmate');
    expect(txt).toContain('本地存储：已用');
    expect(txt).toContain('功能指南');
    expect(txt).toContain('配方库');
    expect(txt).toContain('搜索与计时器');
    expect(txt).toContain('您的数据完全私密');
    expect(txt).toContain('本小程序的本地存储');
    expect(txt).toContain('参考文献');
    expect(txt).not.toContain('键盘快捷键');
    expect(txt).not.toContain('AI 智能助手');
    // collapsed: bodies and references are not rendered yet
    expect(txt).not.toContain('按学科分类浏览');
    expect(txt).not.toContain('Laemmli, U. K.');

    comp.instance.toggleAll();
    await simulate.sleep(0);
    txt = text(comp);
    expect(txt).toContain('按学科分类浏览');
    expect(txt).toContain('全部收起');
    for (const web of ['IndexedDB', '侧边栏', '新标签页', 'ICS', '⌘K', '浏览器本地', '浏览器的']) {
      expect(txt).not.toContain(web);
    }
  });

  test('renders in English; every guide key exists', async () => {
    wxMock.setStorageSync('biolab_lang', 'en');
    const comp = await page(GUIDE);
    const secs = comp.instance.data.sections;
    expect(secs).toHaveLength(12);
    secs.forEach((s) => {
      expect(i18n.has(s.titleKey)).toBe(true);
      expect(i18n.has(s.bodyKey)).toBe(true);
    });
    expect(secs.map((s) => s.titleKey)).not.toContain('guideShortcutsTitle');
    expect(secs.map((s) => s.titleKey)).not.toContain('guideAgentTitle');

    comp.instance.toggleSection({ currentTarget: { dataset: { index: 8 } } }); // links
    await simulate.sleep(0);
    const txt = text(comp);
    expect(txt).toContain('Guide');
    expect(txt).toContain('Backup & restore');
    expect(txt).toContain('Last backup: never');
    expect(txt).toContain('Feature guide');
    expect(txt).toContain('Search & Timers');
    expect(txt).toContain('tapping a card copies its link');
    expect(txt).not.toContain('opens the external site in a new tab');
    expect(txt).toContain('Your Data Stays Private');
    expect(txt).toContain('Literature References');
    expect(comp.instance.data.sections[8].open).toBe(true);
    expect(comp.instance.data.allOpen).toBe(false);
  });

  test('references: English notes, Chinese notes, DOI copied on tap', async () => {
    wxMock.setStorageSync('biolab_lang', 'en');
    let comp = await page(GUIDE);
    comp.instance.toggleRefs();
    await simulate.sleep(0);
    let txt = text(comp);
    expect(txt).toContain('Laemmli, U. K. (1970)');
    expect(txt).toContain('227(5259):680–685');
    expect(txt).toContain('Foundational SDS-PAGE paper');
    expect(txt).not.toContain('SDS-PAGE 奠基文献');
    expect(txt).toContain('doi:10.1038/227680a0');

    expect(await tap(comp, '.gd-ref-doi', 'doi:10.1038/227680a0')).toBe(true);
    const clip = wxMock.__called('setClipboardData');
    expect(clip).toHaveLength(1);
    expect(clip[0].opts.data).toBe('https://doi.org/10.1038/227680a0');

    wxMock.__reset();
    comp = await page(GUIDE);
    comp.instance.toggleRefs();
    await simulate.sleep(0);
    txt = text(comp);
    expect(txt).toContain('SDS-PAGE 奠基文献');
    // references without a DOI copy nothing
    comp.instance.copyRef({ currentTarget: { dataset: { url: '' } } });
    expect(wxMock.__called('setClipboardData')).toHaveLength(0);
  });

  test('last-backup status and the weekly nudge', async () => {
    wxMock.setStorageSync('labmate_lastExport', Date.now() - 2 * 86400000);
    let comp = await page(GUIDE);
    let txt = text(comp);
    expect(txt).toContain('上次备份: 2 天前');
    expect(txt).not.toContain('请备份您的数据');
    expect(comp.instance.data.backupStale).toBe(false);

    wxMock.__reset();
    wxMock.setStorageSync('labmate_lastExport', Date.now() - 9 * 86400000);
    comp = await page(GUIDE);
    txt = text(comp);
    expect(txt).toContain('9 天前');
    expect(txt).toContain('请备份您的数据');
    expect(comp.instance.data.backupStale).toBe(true);
  });

  test('export writes the web backup format, shares it to a chat and records the export', async () => {
    wxMock.setStorageSync('biolab_favorites', ['pbs_10x']);
    wxMock.setStorageSync('labmate_customRecipes', [{ id: 'c1', name: 'My buffer', category: 'buffer' }]);
    wxMock.setStorageSync('labmate_timers', [{ id: 1, label: 'x', totalSeconds: 60, remaining: 60, running: false }]);
    wxMock.setStorageSync('labmate_experiments', [{ id: 'exp_1', date: '2026-09-01', title: 'WB' }]);
    const comp = await page(GUIDE);
    expect(await tap(comp, '.btn-primary', '发送备份文件')).toBe(true);

    const writes = wxMock.__called('fs.writeFile');
    expect(writes).toHaveLength(1);
    expect(writes[0].opts.filePath).toMatch(/^wxfile:\/\/usr\/labmate-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(writes[0].opts.data);
    expect(Object.keys(file).sort()).toEqual(['appVersion', 'data', 'experiments', 'exportedAt', 'schemaVersion']);
    expect(file.schemaVersion).toBe(2);
    expect(typeof file.exportedAt).toBe('string');
    expect(file.data.biolab_favorites).toEqual(['pbs_10x']);
    expect(file.data.labmate_customRecipes[0].id).toBe('c1');
    expect(file.data).not.toHaveProperty('labmate_timers');
    expect(file.data).not.toHaveProperty('labmate_experiments');
    expect(file.experiments.map((e) => e.id)).toEqual(['exp_1']);

    const shares = wxMock.__called('shareFileMessage');
    expect(shares).toHaveLength(1);
    expect(shares[0].opts.filePath).toBe(writes[0].opts.filePath);
    expect(shares[0].opts.fileName).toMatch(/^labmate-backup-/);

    const last = wxMock.getStorageSync('labmate_lastExport');
    expect(typeof last).toBe('number');
    expect(Date.now() - last).toBeLessThan(5000);
    expect(lastToast()).toBe('备份文件已发送');
    expect(text(comp)).toContain('上次备份: 今天');
    expect(text(comp)).not.toContain('请备份您的数据');
  });

  test('a cancelled share is not recorded as a backup', async () => {
    stubWx('shareFileMessage', (opts) => opts.fail({ errMsg: 'shareFileMessage:fail cancel' }));
    const comp = await page(GUIDE);
    await comp.instance.exportData();
    expect(wxMock.getStorageSync('labmate_lastExport')).toBe('');
    expect(wxMock.__called('showToast')).toHaveLength(0);
    expect(text(comp)).toContain('上次备份: 从未');
  });

  test('import restores favorites and custom recipes from a web backup', async () => {
    wxMock.setStorageSync('labmate_customRecipes', [{ id: 'local_1', name: 'Local buffer', category: 'buffer' }]);
    wxMock.__fileContent = JSON.stringify({
      exportedAt: '2026-09-01T08:00:00.000Z',
      appVersion: '2.4.0',
      schemaVersion: 2,
      data: {
        biolab_favorites: ['pbs_10x', 'ripa'],
        labmate_customRecipes: [{ id: 'web_1', name: 'Web Tris buffer', category: 'buffer', components: [] }],
        biolab_lang: 'zh',
        labmate_timers: [{ id: 9 }],
      },
      experiments: [{ id: 'exp_web', date: '2026-08-30', title: 'qPCR' }],
    }, null, 2);
    stubWx('chooseMessageFile', (opts) => opts.success({ tempFiles: [{ path: 'wxfile://tmp/a.json', name: 'labmate-backup-2026-09-01.json', size: 900 }] }));

    const comp = await page(GUIDE);
    expect(await tap(comp, '.btn', '从聊天中选择')).toBe(true);

    const modal = wxMock.__called('showModal');
    expect(modal).toHaveLength(1);
    expect(modal[0].opts.content).toContain('labmate-backup-2026-09-01.json');
    expect(wxMock.getStorageSync('biolab_favorites')).toEqual(['pbs_10x', 'ripa']);
    expect(wxMock.getStorageSync('labmate_customRecipes').map((r) => r.id)).toEqual(['local_1', 'web_1']);
    expect(recipes.libraryItems('buffers').some((r) => r.id === 'web_1' && r._isCustom)).toBe(true);
    expect(experiments.all().map((e) => e.id)).toContain('exp_web');
    expect(wxMock.getStorageSync('labmate_timers')).toBe('');
    // 1 experiment + favorites + custom recipes + lang
    expect(lastToast()).toBe('已恢复 4 项数据');
  });

  test('import applies the backup language, like the web’s reload', async () => {
    wxMock.__fileContent = JSON.stringify({ exportedAt: '2026-09-01T08:00:00.000Z', schemaVersion: 2, data: { biolab_lang: 'en', biolab_favorites: ['tae'] } });
    stubWx('chooseMessageFile', (opts) => opts.success({ tempFiles: [{ path: 'wxfile://tmp/b.json', name: 'b.json' }] }));
    const comp = await page(GUIDE);
    await comp.instance.importData();
    await simulate.sleep(0);
    expect(comp.instance.data.lang).toBe('en');
    expect(lastToast()).toBe('Restored 2 items');
    expect(text(comp)).toContain('Backup & restore');
  });

  test('declining the confirmation or picking a bad file changes nothing', async () => {
    wxMock.setStorageSync('biolab_favorites', ['tae']);
    wxMock.__fileContent = JSON.stringify({ exportedAt: 'x', data: { biolab_favorites: ['ripa'] } });
    stubWx('chooseMessageFile', (opts) => opts.success({ tempFiles: [{ path: 'wxfile://tmp/c.json', name: 'c.json' }] }));
    wxMock.__modalConfirm = false;
    const comp = await page(GUIDE);
    await comp.instance.importData();
    expect(wxMock.getStorageSync('biolab_favorites')).toEqual(['tae']);
    expect(wxMock.__called('showToast')).toHaveLength(0);

    wxMock.__modalConfirm = true;
    wxMock.__fileContent = '{ not json';
    await comp.instance.importData();
    expect(wxMock.getStorageSync('biolab_favorites')).toEqual(['tae']);
    expect(lastToast()).toBe('备份文件格式无效');
  });

  test('closing the chat file picker is silent', async () => {
    stubWx('chooseMessageFile', (opts) => opts.fail({ errMsg: 'chooseMessageFile:fail cancel' }));
    const comp = await page(GUIDE);
    await comp.instance.importData();
    expect(wxMock.__called('showModal')).toHaveLength(0);
    expect(wxMock.__called('showToast')).toHaveLength(0);
  });

  test('the web app address is copied on tap', async () => {
    const comp = await page(GUIDE);
    expect(await tap(comp, '.gd-weburl')).toBe(true);
    expect(wxMock.__called('setClipboardData')[0].opts.data).toBe('https://apps.bioinfospace.com/labmate/');
  });
});
