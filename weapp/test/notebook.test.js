const { wxMock } = require('./helpers/setup.cjs');
const { page, text, simulate } = require('./helpers/mp.cjs');

const experiments = require('../miniprogram/lib/experiments.js');
const { isoDate } = require('../miniprogram/lib/format.js');
const { PROTOCOLS } = require('../miniprogram/lib/recipes.js');
const { normalizeProtocolSteps } = require('../miniprogram/shared/protocolImport.js');

const KEY = 'labmate_experiments';
const stored = () => wxMock.getStorageSync(KEY) || [];
const ev = (dataset, value) => ({ currentTarget: { dataset: dataset || {} }, detail: { value } });

function entry(over) {
  return Object.assign(experiments.createEmptyExperiment('2026-10-02', '10:00'), over);
}

function seed(list) {
  wxMock.setStorageSync(KEY, list);
}

beforeEach(() => wxMock.__reset());

// ── List ────────────────────────────────────────────────────────────────────
describe('notebook list', () => {
  test('first run in Chinese: empty state, header actions, section overview', async () => {
    const comp = await page('packages/lab/notebook/index');
    const txt = text(comp);
    expect(txt).toContain('我的实验室');
    expect(txt).toContain('实验记录本');
    expect(txt).toContain('暂无实验记录');
    expect(txt).toContain('新建记录');
    expect(txt).toContain('导入');
    expect(txt).toContain('实验计划');
    expect(txt).toContain('实验结果');
    expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('实验记录');
  });

  test('lists entries in English with status, priority and linked protocol', async () => {
    wxMock.setStorageSync('biolab_lang', 'en');
    seed([
      entry({ id: 'exp_1_aaaaaa', title: 'Western blot of lysates', status: 'in-progress', priority: 'high', protocolRef: 'wb_protocol', date: '2026-10-03' }),
      entry({ id: 'exp_2_bbbbbb', title: '', titleZh: '', status: 'completed', date: '2026-09-01' }),
    ]);
    const comp = await page('packages/lab/notebook/index');
    const txt = text(comp);
    expect(txt).toContain('Experiment Notebook');
    expect(txt).toContain('2 entries');
    expect(txt).toContain('Western blot of lysates');
    expect(txt).toContain('In Progress');
    expect(txt).toContain('high priority');
    expect(txt).toContain('Untitled entry');
    expect(txt).toContain('Completed');
    // newest date first
    expect(comp.instance.data.rows.map((r) => r.id)).toEqual(['exp_1_aaaaaa', 'exp_2_bbbbbb']);
  });

  test('search and status chips filter; clear filters restores', async () => {
    seed([
      entry({ id: 'exp_1_a', title: 'PCR genotyping', status: 'planned' }),
      entry({ id: 'exp_2_b', title: 'Cell passage', titleZh: '细胞传代', status: 'completed' }),
      entry({ id: 'exp_3_c', title: 'Transfection', status: 'completed', plan: { objectives: 'knock down GAPDH', notes: '' } }),
    ]);
    const comp = await page('packages/lab/notebook/index');
    const inst = comp.instance;
    expect(inst.data.chips.find((c) => c.id === 'completed').count).toBe(2);

    inst.setStatus(ev({ id: 'completed' }));
    expect(inst.data.rows.map((r) => r.id).sort()).toEqual(['exp_2_b', 'exp_3_c']);
    expect(inst.data.listLabel).toBe('2 / 3 条记录');

    inst.onSearch(ev({}, '细胞'));
    await simulate.sleep(200);
    expect(inst.data.rows.map((r) => r.id)).toEqual(['exp_2_b']);

    inst.onSearch(ev({}, 'gapdh')); // objectives are searched too
    await simulate.sleep(200);
    expect(inst.data.rows.map((r) => r.id)).toEqual(['exp_3_c']);

    inst.onSearch(ev({}, 'nothing like this'));
    await simulate.sleep(200);
    expect(text(comp)).toContain('没有匹配的记录');
    inst.clearFilters();
    expect(inst.data.rows).toHaveLength(3);
  });

  test('rows open the editor; New opens a blank entry for today', async () => {
    seed([entry({ id: 'exp_9_zzz', title: 'Miniprep' })]);
    const comp = await page('packages/lab/notebook/index');
    comp.instance.open(ev({ id: 'exp_9_zzz' }));
    comp.instance.newEntry();
    const urls = wxMock.__called('navigateTo').map((c) => c.opts.url);
    expect(urls).toEqual([
      '/packages/lab/notebook/edit?id=exp_9_zzz',
      '/packages/lab/notebook/edit?date=' + isoDate(),
    ]);
  });

  test('refreshes when experiments change', async () => {
    const comp = await page('packages/lab/notebook/index');
    expect(comp.instance.data.total).toBe(0);
    experiments.save(entry({ id: 'exp_5_new', title: 'Added elsewhere' }));
    await simulate.sleep(0);
    expect(comp.instance.data.total).toBe(1);
    expect(text(comp)).toContain('Added elsewhere');
  });

  test('export sends the web JSON format to a chat', async () => {
    seed([entry({ id: 'exp_1_a', title: 'Gel' })]);
    const comp = await page('packages/lab/notebook/index');
    comp.instance.exportJson();
    await simulate.sleep(0);
    const write = wxMock.__called('fs.writeFile')[0].opts;
    expect(write.filePath).toMatch(/labmate_experiments_\d{4}-\d{2}-\d{2}\.json$/);
    const parsed = JSON.parse(write.data);
    expect(parsed.type).toBe('experiments');
    expect(parsed.data.map((e) => e.id)).toEqual(['exp_1_a']);
    expect(wxMock.__called('shareFileMessage')).toHaveLength(1);
  });

  test('import merges entries from a JSON file', async () => {
    seed([entry({ id: 'exp_1_a', title: 'Old title' })]);
    const orig = wx.chooseMessageFile;
    wx.chooseMessageFile = (opts) => opts.success({ tempFiles: [{ path: 'wxfile://tmp/x.json', name: 'x.json' }] });
    wxMock.__fileContent = JSON.stringify({
      exportedAt: '2026-09-01T00:00:00Z',
      type: 'experiments',
      data: [entry({ id: 'exp_1_a', title: 'New title' }), entry({ id: 'exp_2_b', title: 'Imported entry' })],
    });
    try {
      const comp = await page('packages/lab/notebook/index');
      comp.instance.importJson();
      await simulate.sleep(0);
      expect(stored().map((e) => e.title).sort()).toEqual(['Imported entry', 'New title']);
      expect(comp.instance.data.total).toBe(2);
      expect(wxMock.__called('showToast').pop().opts.title).toBe('已导入 2 条记录');

      wxMock.__fileContent = '{ not json';
      comp.instance.importJson();
      await simulate.sleep(0);
      expect(wxMock.__called('showToast').pop().opts.title).toBe('导入失败');
    } finally {
      wx.chooseMessageFile = orig;
    }
  });
});

// ── Editor ──────────────────────────────────────────────────────────────────
describe('notebook editor', () => {
  test('new entry: opens in edit mode, is stored on save', async () => {
    const comp = await page('packages/lab/notebook/edit', { date: '2026-10-05', startTime: '14:30' });
    const inst = comp.instance;
    expect(inst.data.editing).toBe(true);
    expect(inst.data.isNew).toBe(true);
    expect(inst.data.doc.date).toBe('2026-10-05');
    expect(inst.data.doc.startTime).toBe('14:30');
    expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('新建记录');
    expect(text(comp)).toContain('编辑中');
    expect(stored()).toHaveLength(0); // nothing stored until something changes

    inst.onField(ev({ path: 'title' }, 'qPCR of knockdown'));
    inst.onField(ev({ path: 'plan.objectives' }, 'Check GAPDH knockdown'));
    inst.onDuration(ev({}, '90'));
    inst.onStatus(ev({}, '1'));
    inst.setPriority(ev({ value: 'high' }));
    inst.setColor(ev({ color: '#ef4444' }));
    expect(inst.data.doc.title).toBe('qPCR of knockdown');
    inst.saveEdit();

    const list = stored();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      date: '2026-10-05', startTime: '14:30', title: 'qPCR of knockdown', duration: 90,
      status: 'in-progress', priority: 'high', color: '#ef4444',
    });
    expect(list[0].plan.objectives).toBe('Check GAPDH knockdown');
    expect(inst.data.editing).toBe(false);
    expect(wxMock.__called('showToast').pop().opts.title).toBe('记录已保存');
    await simulate.sleep(0);
    const txt = text(comp);
    expect(txt).toContain('qPCR of knockdown');
    expect(txt).toContain('14:30–16:00');
    expect(txt).toContain('进行中');
  });

  test('cancelling a new entry discards it and goes back', async () => {
    const comp = await page('packages/lab/notebook/edit', { date: '2026-10-05' });
    comp.instance.onField(ev({ path: 'title' }, 'Throwaway'));
    comp.instance.cancelEdit();
    comp.instance.onUnload();
    expect(stored()).toHaveLength(0);
    expect(wxMock.__called('navigateBack')).toHaveLength(1);
  });

  test('pending edits are written when the page unloads', async () => {
    const comp = await page('packages/lab/notebook/edit', { date: '2026-10-06' });
    comp.instance.onField(ev({ path: 'results.summary' }, 'Bands at 37 kDa'));
    expect(stored()).toHaveLength(0);
    comp.instance.onUnload();
    expect(stored()[0].results.summary).toBe('Bands at 37 kDa');
  });

  test('changes auto-save after a pause', async () => {
    seed([entry({ id: 'exp_1_auto', title: 'Before' })]);
    const comp = await page('packages/lab/notebook/edit', { id: 'exp_1_auto' });
    comp.instance.startEdit();
    comp.instance.onField(ev({ path: 'title' }, 'After'));
    expect(stored()[0].title).toBe('Before');
    await simulate.sleep(1700);
    expect(stored()[0].title).toBe('After');
    expect(comp.instance.data.savedAt).toMatch(/^\d{2}:\d{2}$/);
  });

  test('existing entry in English: document view with all sections', async () => {
    wxMock.setStorageSync('biolab_lang', 'en');
    seed([entry({
      id: 'exp_1_abc123',
      title: 'Plasmid miniprep',
      titleZh: '质粒小提',
      status: 'completed',
      priority: 'high',
      protocolRef: 'miniprep_protocol',
      plan: { objectives: 'Isolate pUC19', notes: '' },
      materials: {
        reagents: [{ name: 'Buffer P1', amount: '250', unit: 'µL', location: '4 °C fridge', inventoryRef: null }],
        equipment: [{ name: 'Microcentrifuge', status: 'ready' }],
        checklist: [{ item: 'Label tubes', checked: true }, { item: 'Pre-warm EB', checked: false }],
        plateLayout: null,
      },
      procedure: { mode: 'template', protocolSteps: [
        { stepText: 'Pellet cells', completed: true, deviation: 'spun 5 min longer', actualParams: '' },
        { stepText: 'Resuspend in P1', completed: false, deviation: '', actualParams: '250 µL' },
      ], freeText: '' },
      results: { summary: 'Good yield', dataProcessing: '', figures: [{ description: 'Gel photo', notes: 'lane 2' }], backupStatus: 'NAS /lab/2026' },
    })]);
    const comp = await page('packages/lab/notebook/edit', { id: 'exp_1_abc123' });
    expect(comp.instance.data.editing).toBe(false);
    const txt = text(comp);
    ['Entry · ABC123', 'Plasmid miniprep', '质粒小提', 'Completed', 'High', 'Plan', 'Isolate pUC19',
      'Materials', '1 reagent · 1 equipment · checklist 1/2', 'Buffer P1', '250 µL', '4 °C fridge', 'Microcentrifuge', 'Ready',
      'Label tubes', 'Procedure', '1/2 done', 'Pellet cells', 'spun 5 min longer', 'Actual Parameters',
      'Results', 'Good yield', 'Fig. 1', 'Gel photo', 'lane 2', 'NAS /lab/2026']
      .forEach((s) => expect(txt).toContain(s));
    expect(comp.instance.data.protoLabel).toBeTruthy();
  });

  test('ticking steps and checklist items in read mode stores them at once', async () => {
    seed([entry({
      id: 'exp_1_tick',
      materials: { reagents: [], equipment: [], checklist: [{ item: 'Thaw cells', checked: false }], plateLayout: null },
      procedure: { mode: 'template', protocolSteps: [{ stepText: 'A', completed: false, deviation: '', actualParams: '' }, { stepText: 'B', completed: false, deviation: '', actualParams: '' }], freeText: '' },
    })]);
    const comp = await page('packages/lab/notebook/edit', { id: 'exp_1_tick' });
    comp.instance.toggleStep(ev({ index: 1 }));
    comp.instance.toggleCheck(ev({ index: 0 }));
    const rec = stored()[0];
    expect(rec.procedure.protocolSteps.map((s) => s.completed)).toEqual([false, true]);
    expect(rec.materials.checklist[0].checked).toBe(true);
    expect(comp.instance.data.meta.pct).toBe(50);
    expect(text(comp)).toContain('已完成 1/2');
  });

  test('materials, figures and step notes can be added, edited and removed', async () => {
    seed([entry({ id: 'exp_1_lists' })]);
    const comp = await page('packages/lab/notebook/edit', { id: 'exp_1_lists' });
    const inst = comp.instance;
    inst.startEdit();
    inst.addItem(ev({ list: 'materials.reagents' }));
    inst.addItem(ev({ list: 'materials.reagents' }));
    inst.onItemField(ev({ list: 'materials.reagents', index: 0, field: 'name' }, 'Tris'));
    inst.onItemField(ev({ list: 'materials.reagents', index: 1, field: 'name' }, 'NaCl'));
    inst.onItemField(ev({ list: 'materials.reagents', index: 1, field: 'amount' }, '5'));
    inst.removeItem(ev({ list: 'materials.reagents', index: 0 }));
    inst.addItem(ev({ list: 'materials.equipment' }));
    inst.onItemField(ev({ list: 'materials.equipment', index: 0, field: 'name' }, 'Thermocycler'));
    inst.setEquipStatus(ev({ index: 0, value: 'ready' }));
    inst.addItem(ev({ list: 'materials.checklist' }));
    inst.onItemField(ev({ list: 'materials.checklist', index: 0, field: 'item' }, 'Book the hood'));
    inst.addItem(ev({ list: 'results.figures' }));
    inst.onItemField(ev({ list: 'results.figures', index: 0, field: 'description' }, 'Fig A'));
    inst.setMode(ev({ mode: 'freetext' }));
    inst.onField(ev({ path: 'procedure.freeText' }, '1. mix\n2. spin'));
    // view rows carry a wx:key, the stored record does not
    expect(inst.data.doc.materials.reagents[0]._k).toBeDefined();
    inst.saveEdit();

    const rec = stored()[0];
    expect(rec.materials.reagents).toEqual([{ name: 'NaCl', amount: '5', unit: '', location: '', inventoryRef: null }]);
    expect(rec.materials.equipment).toEqual([{ name: 'Thermocycler', status: 'ready' }]);
    expect(rec.materials.checklist).toEqual([{ item: 'Book the hood', checked: false }]);
    expect(rec.results.figures).toEqual([{ description: 'Fig A', notes: '' }]);
    expect(rec.procedure).toMatchObject({ mode: 'freetext', freeText: '1. mix\n2. spin' });
    await simulate.sleep(0);
    expect(text(comp)).toContain('1. mix');
  });

  test('cancel restores the entry as it was before editing', async () => {
    seed([entry({ id: 'exp_1_cancel', title: 'Original' })]);
    const comp = await page('packages/lab/notebook/edit', { id: 'exp_1_cancel' });
    comp.instance.startEdit();
    comp.instance.onField(ev({ path: 'title' }, 'Changed'));
    comp.instance.cancelEdit();
    comp.instance.onUnload();
    expect(comp.instance.data.editing).toBe(false);
    expect(comp.instance.data.doc.title).toBe('Original');
    expect(stored()[0].title).toBe('Original');
  });

  test('imports a protocol’s steps and materials', async () => {
    const recipe = PROTOCOLS.find((r) => r.id === 'pcr_standard');
    const comp = await page('packages/lab/notebook/edit', { date: '2026-10-07' });
    const inst = comp.instance;
    inst.openSelector();
    await simulate.sleep(0);
    const picker = comp.querySelector('#protocol-picker');
    expect(picker.instance.data.rows.length).toBeGreaterThanOrEqual(PROTOCOLS.length);
    picker.instance.onSearch(ev({}, 'pcr'));
    await simulate.sleep(200);
    expect(picker.instance.data.rows.some((r) => r.id === 'pcr_standard')).toBe(true);

    inst.onProtocolSelect({ detail: { id: 'pcr_standard' } });
    const steps = normalizeProtocolSteps(recipe, 'zh');
    expect(inst.data.showSelector).toBe(false);
    expect(inst.data.doc.protocolRef).toBe('pcr_standard');
    expect(inst.data.doc.title).toBe(recipe.nameCn);
    expect(inst.data.doc.procedure.mode).toBe('template');
    expect(inst.data.doc.procedure.protocolSteps.map((s) => s.stepText)).toEqual(steps);
    expect(inst.data.doc.materials.reagents).toHaveLength((recipe.materials || []).length);
    expect(wxMock.__called('showToast').pop().opts.title).toBe('已从方案导入');
    await simulate.sleep(0);
    expect(text(comp)).toContain(steps[0].slice(0, 12));

    inst.onItemField(ev({ list: 'procedure.protocolSteps', index: 0, field: 'deviation' }, 'used 55 °C'));
    inst.toggleStep(ev({ index: 0 }));
    inst.saveEdit();
    const rec = stored()[0];
    expect(rec.procedure.protocolSteps[0]).toMatchObject({ completed: true, deviation: 'used 55 °C' });
    expect(rec.procedure.protocolSteps).toHaveLength(steps.length);
  });

  test('a new entry from a protocol (calendar) is prefilled and kept', async () => {
    const comp = await page('packages/lab/notebook/edit', { date: '2026-10-08', protocol: 'wb_protocol' });
    expect(comp.instance.data.doc.protocolRef).toBe('wb_protocol');
    expect(comp.instance.data.doc.procedure.protocolSteps.length).toBeGreaterThan(0);
    comp.instance.onUnload();
    expect(stored()[0]).toMatchObject({ date: '2026-10-08', protocolRef: 'wb_protocol' });
  });

  test('delete asks first, removes the entry and goes back', async () => {
    seed([entry({ id: 'exp_1_del', title: 'Doomed' }), entry({ id: 'exp_2_keep', title: 'Keep' })]);
    const comp = await page('packages/lab/notebook/edit', { id: 'exp_1_del' });
    wxMock.__modalConfirm = false;
    comp.instance.deleteEntry();
    await simulate.sleep(0);
    expect(stored()).toHaveLength(2);

    wxMock.__modalConfirm = true;
    comp.instance.deleteEntry();
    await simulate.sleep(0);
    const modal = wxMock.__called('showModal').pop().opts;
    expect(modal.content).toContain('删除此实验记录');
    expect(modal.content).toContain('Doomed');
    expect(stored().map((e) => e.id)).toEqual(['exp_2_keep']);
    expect(wxMock.__called('navigateBack')).toHaveLength(1);
    comp.instance.onUnload();
    expect(stored()).toHaveLength(1);
  });

  test('exports Markdown and links to the calendar day', async () => {
    seed([entry({ id: 'exp_1_md', title: 'ELISA', date: '2026-11-12' })]);
    const comp = await page('packages/lab/notebook/edit', { id: 'exp_1_md' });
    comp.instance.exportMarkdown();
    await simulate.sleep(0);
    const write = wxMock.__called('fs.writeFile')[0].opts;
    expect(write.filePath).toMatch(/experiment_2026-11-12_p_1_md\.md$/);
    expect(write.data).toContain('# ELISA');
    expect(write.data).toContain('## Procedure');

    comp.instance.viewInCalendar();
    expect(wxMock.__called('navigateTo').pop().opts.url).toBe('/packages/lab/calendar/index?date=2026-11-12&id=exp_1_md');
  });

  test('“View in calendar” goes back to the calendar it came from, on the entry’s day', async () => {
    seed([entry({ id: 'exp_1_back', date: '2026-12-01', title: 'Round trip' })]);
    const cal = await page('packages/lab/calendar/index');
    const ed = await page('packages/lab/notebook/edit', { id: 'exp_1_back' });
    cal.instance.route = 'packages/lab/calendar/index';
    global.__pages = [cal.instance, ed.instance];
    ed.instance.viewInCalendar();
    expect(wxMock.__called('navigateBack')).toHaveLength(1);
    expect(wxMock.__called('navigateTo')).toHaveLength(0);
    expect(cal.instance.data).toMatchObject({ viewMode: 'month', dayFilter: '2026-12-01', periodMain: '十二月' });
    expect(cal.instance.data.dayRows[0]).toMatchObject({ id: 'exp_1_back', hl: true });
  });

  test('sections collapse and expand', async () => {
    seed([entry({ id: 'exp_1_fold', plan: { objectives: 'Fold me', notes: '' } })]);
    const comp = await page('packages/lab/notebook/edit', { id: 'exp_1_fold' });
    expect(text(comp)).toContain('Fold me');
    comp.instance.toggleSection(ev({ key: 'plan' }));
    await simulate.sleep(0);
    expect(text(comp)).not.toContain('Fold me');
    comp.instance.toggleSection(ev({ key: 'plan' }));
    await simulate.sleep(0);
    expect(text(comp)).toContain('Fold me');
  });

  test('unknown id shows a not-found state', async () => {
    const comp = await page('packages/lab/notebook/edit', { id: 'exp_missing' });
    expect(comp.instance.data.missing).toBe(true);
    expect(text(comp)).toContain('该记录已不存在');
  });

  test('switching language relabels the document', async () => {
    seed([entry({ id: 'exp_1_lang', title: 'Blot', titleZh: '印迹', status: 'planned' })]);
    const comp = await page('packages/lab/notebook/edit', { id: 'exp_1_lang' });
    expect(text(comp)).toContain('计划中');
    require('../miniprogram/lib/lang.js').setLang('en');
    await simulate.sleep(0);
    const txt = text(comp);
    expect(txt).toContain('Planned');
    expect(txt).toContain('Blot');
    expect(comp.instance.data.statusLabels[0]).toBe('Planned');
  });
});
