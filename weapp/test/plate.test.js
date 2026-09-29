const { wxMock } = require('./helpers/setup.cjs');
const { page, text, simulate } = require('./helpers/mp.cjs');
const { WELL_COLORS } = require('../miniprogram/shared/data.js');

const KEY = 'labmate_plate';
const SIZES = [6, 12, 24, 48, 96, 384];
const ds = (dataset) => ({ currentTarget: { dataset } });
const saved = () => wxMock.getStorageSync(KEY);

beforeEach(() => wxMock.__reset());

function tap(inst, r, c) { inst.tapWell(ds({ r, c })); }

// A plate-reader export with instrument metadata above the grid.
const READER_CSV = [
  'Plate reader export,,,,,,,,,,,,',
  'Measurement,Absorbance 450nm,,,,,,,,,,,',
  '',
  ',1,2,3,4,5,6,7,8,9,10,11,12',
  ...'ABCDEFGH'.split('').map((row, r) =>
    [row].concat(Array.from({ length: 12 }, (_, c) => (0.1 + r * 0.1 + c * 0.01).toFixed(3))).join(',')),
  '',
].join('\n');

// Stub the chat file picker (the mock's default returns no file).
async function withPickedFile(content, fn) {
  const original = wx.chooseMessageFile;
  wxMock.__fileContent = content;
  wx.chooseMessageFile = (opts) => {
    wxMock.__calls.push({ name: 'chooseMessageFile', opts });
    opts.success({ tempFiles: [{ path: 'wxfile://tmp/reader.csv', name: 'reader.csv', size: content.length }] });
  };
  try { return await fn(); } finally { wx.chooseMessageFile = original; }
}

test('renders a 96-well plate in Chinese by default, sized for a 375px phone', async () => {
  const comp = await page('pages/plate/index');
  const txt = text(comp);
  expect(txt).toContain('多孔板设计器');
  expect(txt).toContain('工具');
  expect(txt).toContain('96 孔板');
  expect(txt).toContain('布板设计');
  expect(txt).toContain('读板数据导入');
  expect(txt).toContain('已标记 0/96');
  const { rows, m, colHeads } = comp.instance.data;
  expect(rows).toHaveLength(8);
  expect(rows[0].w).toHaveLength(12);
  expect(colHeads).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  expect(m.ws).toBeGreaterThanOrEqual(22);
  expect(m.ws).toBeLessThanOrEqual(26);
  expect(m.scroll).toBe(false); // the whole 96-well plate fits the width
  expect(m.gridW).toBeLessThanOrEqual(375 - 46);
  expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('多孔板设计');
});

test('English UI', async () => {
  wxMock.setStorageSync('biolab_lang', 'en');
  const comp = await page('pages/plate/index');
  const txt = text(comp);
  expect(txt).toContain('Multi-well Plate Designer');
  expect(txt).toContain('96-well plate');
  expect(txt).toContain('Mark Selected Wells');
  expect(txt).toContain('0/96 labelled');
  expect(txt).toContain('Quick Templates');
  expect(comp.instance.data.plateOptions.map((o) => o.label)).toContain('384-well');
});

test('changing the plate size re-lays the plate; 384 wells scroll sideways and can zoom', async () => {
  const comp = await page('pages/plate/index');
  const inst = comp.instance;
  await inst.onPlateType({ detail: { value: SIZES.indexOf(384) } });
  await simulate.sleep(0);
  expect(inst.data.rows).toHaveLength(16);
  expect(inst.data.rows[15].w).toHaveLength(24);
  expect(inst.data.m.scroll).toBe(true);
  expect(inst.data.m.ws).toBeGreaterThanOrEqual(16);
  expect(text(comp)).toContain('384 孔板');
  expect(saved().plateType).toBe(384);

  expect(inst.data.m.canZoom).toBe(true);
  inst.toggleZoom();
  expect(inst.data.m.ws).toBe(30);
  expect(inst.data.zoom).toBe(true);

  await inst.onPlateType({ detail: { value: SIZES.indexOf(6) } });
  expect(inst.data.rows).toHaveLength(2);
  expect(inst.data.rows[0].w).toHaveLength(3);
  expect(inst.data.m.ws).toBeGreaterThan(60);
  expect(inst.data.zoom).toBe(false);
});

test('switching plate type asks first when wells are labelled', async () => {
  const comp = await page('pages/plate/index');
  const inst = comp.instance;
  tap(inst, 0, 0);
  inst.onLabel({ detail: { value: 'Blank' } });
  inst.assign();
  wxMock.__modalConfirm = false;
  await inst.onPlateType({ detail: { value: SIZES.indexOf(24) } });
  expect(inst.data.plateType).toBe(96);
  expect(saved().wellData.A1.label).toBe('Blank');
  wxMock.__modalConfirm = true;
  await inst.onPlateType({ detail: { value: SIZES.indexOf(24) } });
  expect(inst.data.plateType).toBe(24);
  expect(saved().wellData).toEqual({});
});

test('select wells (tap, long-press block, row, column), then assign a sample', async () => {
  const comp = await page('pages/plate/index');
  const inst = comp.instance;
  tap(inst, 0, 0);
  tap(inst, 0, 1);
  expect(inst.data.rows[0].w[0].sel).toBe(true);
  expect(inst.data.selCount).toBe(2);
  tap(inst, 0, 1); // toggles off
  expect(inst.data.rows[0].w[1].sel).toBe(false);
  expect(inst.data.selCount).toBe(1);

  // long-press selects the block from the last tapped well
  tap(inst, 2, 0);
  inst.pressWell(ds({ r: 3, c: 2 }));
  expect(inst.data.selCount).toBe(1 + 6);
  expect(inst.data.rows[3].w[2].sel).toBe(true);

  inst.selectRow(ds({ r: 7 }));
  expect(inst.data.selCount).toBe(7 + 12);
  inst.selectRow(ds({ r: 7 })); // whole row already selected → drops it
  expect(inst.data.selCount).toBe(7);
  inst.selectCol(ds({ c: 11 }));
  expect(inst.data.selCount).toBe(7 + 8);
  expect(inst.data.selPreview).toMatch(/^A1 C1 C2 C3 D1 D2 D3 A12/);
  expect(inst.data.selPreview).toContain('+3');

  inst.onLabel({ detail: { value: 'Drug A' } });
  inst.assign();
  await simulate.sleep(0);
  const state = saved();
  expect(state.wellData.A1).toEqual({ color: WELL_COLORS[0], label: 'Drug A' });
  expect(Object.keys(state.wellData)).toHaveLength(15);
  expect(state.groups).toEqual([expect.objectContaining({ label: 'Drug A', color: WELL_COLORS[0] })]);
  expect(state.groups[0].wells).toHaveLength(15);
  expect(inst.data.selCount).toBe(0);
  expect(inst.data.label).toBe('');
  expect(inst.data.colorIdx).toBe(1); // next colour for the next sample
  expect(inst.data.rows[0].w[0]).toMatchObject({ has: true, lbl: 'Drug A', sel: false });
  expect(inst.data.rows[0].w[0].st).toContain(WELL_COLORS[0]);
  expect(inst.data.groups).toEqual([{ id: 0, label: 'Drug A', color: WELL_COLORS[0], n: 15 }]);
  expect(text(comp)).toContain('已标记 15/96');

  // relabelling moves the well out of its old group
  tap(inst, 0, 0);
  inst.onLabel({ detail: { value: 'Drug B' } });
  inst.assign();
  const groups = saved().groups;
  expect(groups.map((g) => [g.label, g.wells.length])).toEqual([['Drug A', 14], ['Drug B', 1]]);
  expect(saved().wellData.A1).toEqual({ color: WELL_COLORS[1], label: 'Drug B' });

  // nothing happens without a selection or a label
  inst.onLabel({ detail: { value: 'X' } });
  inst.assign();
  expect(Object.keys(saved().wellData)).toHaveLength(15);
});

test('custom colour, legend selection, clearing selected wells and clearing all', async () => {
  const comp = await page('pages/plate/index');
  const inst = comp.instance;
  expect(inst.onCustomHex({ detail: { value: '#12ab3z4' } })).toBe('12AB34');
  expect(inst.data.useCustom).toBe(true);
  expect(inst.data.activeHex).toBe('#12AB34');
  inst.selectCol(ds({ c: 0 }));
  inst.onLabel({ detail: { value: 'Ctrl' } });
  inst.assign();
  expect(saved().wellData.H1.color).toBe('#12ab34');
  expect(saved().customColor).toBe('#12ab34');
  expect(inst.data.colorIdx).toBe(0); // custom colour does not advance the palette

  inst.selectGroup(ds({ i: 0 }));
  expect(inst.data.selCount).toBe(8);
  expect(inst.data.selLabelled).toBe(true);
  inst.deselect();
  tap(inst, 0, 0);
  tap(inst, 1, 0);
  inst.clearSelected();
  expect(Object.keys(saved().wellData)).toHaveLength(6);
  expect(saved().groups[0].wells).toHaveLength(6);
  expect(inst.data.rows[0].w[0].has).toBe(false);

  await inst.clearAll();
  expect(wxMock.__called('showModal')).toHaveLength(1);
  expect(saved().wellData).toEqual({});
  expect(saved().groups).toEqual([]);
  expect(inst.data.labelled).toBe(0);
});

test('restores the saved layout (web-style wellData/groups) on launch', async () => {
  wxMock.setStorageSync(KEY, {
    plateType: 48,
    wellData: { B3: { color: '#ef4444', label: 'KO' }, B4: { color: '#ef4444', label: 'KO' }, Z9: { color: '#000', label: 'bad' } },
    groups: [{ label: 'KO', color: '#ef4444', wells: ['B3', 'B4'] }],
    colorIdx: 3,
  });
  const comp = await page('pages/plate/index');
  const inst = comp.instance;
  expect(inst.data.plateType).toBe(48);
  expect(inst.data.rows).toHaveLength(6);
  expect(inst.data.rows[1].w[2]).toMatchObject({ k: 'B3', has: true, lbl: 'KO' });
  expect(inst.data.labelled).toBe(2);
  expect(inst.data.colorIdx).toBe(3);
  expect(text(comp)).toContain('KO');
  expect(text(comp)).toContain('48 孔板');

  // a backup restored elsewhere is picked up when the tab is shown again
  wxMock.setStorageSync(KEY, { plateType: 12, wellData: {}, groups: [] });
  inst.onShow();
  expect(inst.data.plateType).toBe(12);
  expect(inst.data.labelled).toBe(0);
});

test('table view lists the labelled wells and sorts them', async () => {
  const comp = await page('pages/plate/index');
  const inst = comp.instance;
  inst.applyTemplate({ detail: { type: 'control', params: {} } });
  inst.setView(ds({ view: 'table' }));
  await simulate.sleep(0);
  const table = comp.querySelector('#table');
  expect(table).toBeTruthy();
  const rows = table.instance.data.rows;
  expect(rows).toHaveLength(16);
  expect(rows.slice(0, 3).map((r) => r.well)).toEqual(['A1', 'A12', 'B1']);
  expect(text(comp)).toContain('16 个已标记孔');
  expect(text(comp)).toContain('阳性对照');
  table.instance.toggleSort(ds({ id: 'col' }));
  expect(table.instance.data.rows[0].well).toBe('A1');
  expect(table.instance.data.rows[8].well).toBe('A12');
  table.instance.toggleSort(ds({ id: 'col' }));
  expect(table.instance.data.rows[0].well).toBe('H12');
  table.instance.toggleSort(ds({ id: 'label' }));
  expect(table.instance.data.rows[0].label).toBe('空白');
});

test('templates build the web layouts through the inline template form', async () => {
  wxMock.setStorageSync('biolab_lang', 'en');
  const comp = await page('pages/plate/index');
  const inst = comp.instance;
  const tpl = comp.querySelector('#templates');
  tpl.instance.toggle(ds({ type: 'serial' }));
  await simulate.sleep(0);
  expect(text(comp)).toContain('Each step divides the concentration');
  tpl.instance.onField({ currentTarget: { dataset: { key: 'startConc' } }, detail: { value: '10' } });
  tpl.instance.apply();
  await simulate.sleep(0);
  let s = saved();
  expect(Object.keys(s.wellData)).toHaveLength(96);
  expect(s.wellData.A1.label).toBe('10.0');
  expect(s.wellData.H2.label).toBe('5.0');
  expect(s.wellData.A12.label).toBe('4.9e-3');
  expect(s.groups).toHaveLength(12);
  expect(tpl.instance.data.open).toBe('');

  tpl.instance.toggle(ds({ type: 'dose' }));
  expect(text(comp)).toContain('Applying a template replaces the current layout.');
  tpl.instance.setParam(ds({ key: 'replicates', val: '2' }));
  tpl.instance.apply();
  s = saved();
  expect(Object.keys(s.wellData)).toHaveLength(3 * 2 * 12);
  expect(s.groups.map((g) => g.label)).toEqual(['Drug 1', 'Drug 2', 'Drug 3']);

  inst.applyTemplate({ detail: { type: 'checkerboard', params: { label1: 'T', label2: 'C', replicates: '2' } } });
  s = saved();
  expect([s.wellData.A1.label, s.wellData.A3.label, s.wellData.C1.label, s.wellData.C3.label]).toEqual(['T', 'C', 'C', 'T']);

  inst.applyTemplate({ detail: { type: 'antibody', params: { antibodies: '2', startConc: '100', dilFactor: '2' } } });
  s = saved();
  expect(s.groups.map((g) => g.label)).toEqual(['Ab 1', 'Ab 2']);
  expect(Object.keys(s.wellData)).toHaveLength(24);

  inst.applyTemplate({ detail: { type: 'control', params: {} } });
  expect(saved().wellData.A12.label).toBe('Positive Control');
  expect(saved().wellData.H12.label).toBe('Negative Control');
});

test('reader import: pick a CSV from a chat → heatmap, tidy table, per-sample stats, export', async () => {
  const comp = await page('pages/plate/index');
  const inst = comp.instance;
  inst.selectRow(ds({ r: 0 }));
  inst.onLabel({ detail: { value: 'Blank' } });
  inst.assign();
  inst.selectRow(ds({ r: 1 }));
  inst.onLabel({ detail: { value: 'Sample' } });
  inst.assign();
  inst.setMode(ds({ mode: 'reader' }));
  await simulate.sleep(0);
  expect(text(comp)).toContain('暂无数据');

  const reader = comp.querySelector('#reader').instance;
  await withPickedFile(READER_CSV, () => reader.loadFile());
  await simulate.sleep(0);
  expect(wxMock.__called('chooseMessageFile')[0].opts.extension).toEqual(['csv', 'tsv', 'txt']);
  const d = reader.data;
  expect(d.state).toBe('ok');
  expect(d.fileName).toBe('reader.csv');
  expect(d.detected).toBe('96 孔板');
  expect(d.parsedCount).toBe(96);
  expect(d.hm.rows).toHaveLength(8);
  expect(d.hm.rows[0].c).toHaveLength(12);
  expect(d.hm.rows[0].c[0].cls).toContain('has-ring'); // designer label ring
  expect(d.hm.rows[7].c[11].cls).toContain('is-hot');
  expect(d.longCount).toBe(96);
  expect(d.tidy).toHaveLength(60);
  expect(d.more).toBe(36);
  expect(d.tidy[0]).toEqual({ well: 'A1', value: '0.100', sample: 'Blank' });
  expect(d.mergeActive).toBe(true);
  expect(d.summary.map((s) => [s.sample, s.n, s.mean])).toEqual([['Blank', 12, '0.155'], ['Sample', 12, '0.255']]);
  expect(d.summary[0].cv).toMatch(/%$/);
  const txt = text(comp);
  expect(txt).toContain('识别到: 96 孔板');
  expect(txt).toContain('按样品分组的统计');

  await reader.sendCSV();
  const write = wxMock.__called('fs.writeFile').pop().opts;
  expect(write.filePath).toBe('wxfile://usr/plate_96well_long.csv');
  expect(write.data.split('\n')[0]).toBe('well,row,col,value,sample');
  expect(write.data).toContain('A1,A,1,0.1,Blank');
  expect(wxMock.__called('shareFileMessage').pop().opts.fileName).toBe('plate_96well_long.csv');

  await reader.copyCSV();
  expect(wxMock.__called('setClipboardData').pop().opts.data).toContain('B12,B,12,0.31,Sample');

  // merge off → no sample column, and the summary explains why
  reader.toggleMerge();
  expect(reader.data.mergeActive).toBe(false);
  expect(reader.data.summary).toEqual([]);
  expect(reader.data.summaryHint).toContain('合并设计器中的样品标签');
});

test('reader: demo data, parse errors and plate-size mismatch (English)', async () => {
  wxMock.setStorageSync('biolab_lang', 'en');
  const comp = await page('pages/plate/index');
  const inst = comp.instance;
  inst.setMode(ds({ mode: 'reader' }));
  const reader = comp.querySelector('#reader').instance;

  reader.loadDemo();
  await simulate.sleep(0);
  expect(reader.data.state).toBe('ok');
  expect(reader.data.summaryHint).toContain('Label wells in the Designer first');
  expect(text(comp)).toContain('Detected plate');

  reader.setText('hello\nworld');
  expect(reader.data.state).toBe('error');
  expect(reader.data.errText).toBe('No numeric block detected.');

  // designer is 24-well with labels, the data is 96-well
  inst.setMode(ds({ mode: 'designer' }));
  await inst.onPlateType({ detail: { value: SIZES.indexOf(24) } });
  inst.applyTemplate({ detail: { type: 'control', params: {} } });
  await simulate.sleep(0);
  reader.loadDemo();
  expect(reader.data.mismatch).toBe(true);
  expect(reader.data.mismatchText).toBe('Designer plate is 24-well, but parsed data is 96-well. Labels cannot be merged.');
  expect(reader.data.mergeActive).toBe(false);

  // cancelling the chat picker is silent
  const original = wx.chooseMessageFile;
  wx.chooseMessageFile = (opts) => opts.fail({ errMsg: 'chooseMessageFile:fail cancel' });
  try { await reader.loadFile(); } finally { wx.chooseMessageFile = original; }
  expect(wxMock.__called('showToast')).toHaveLength(0);
});

test('export sends CSV / SVG files to a chat and copies the layout text', async () => {
  const comp = await page('pages/plate/index');
  const inst = comp.instance;
  tap(inst, 0, 0);
  tap(inst, 0, 1);
  inst.onLabel({ detail: { value: 'Drug "A"' } });
  inst.assign();

  await inst.exportCSV();
  let write = wxMock.__called('fs.writeFile').pop().opts;
  expect(write.filePath).toBe('wxfile://usr/plate_96well.csv');
  expect(write.data.split('\n')[0]).toBe(',1,2,3,4,5,6,7,8,9,10,11,12');
  expect(write.data.split('\n')[1]).toBe('A,"Drug ""A""","Drug ""A""",,,,,,,,,,');
  expect(wxMock.__called('shareFileMessage').pop().opts.fileName).toBe('plate_96well.csv');

  await inst.exportSVG();
  write = wxMock.__called('fs.writeFile').pop().opts;
  expect(write.filePath).toBe('wxfile://usr/plate_96well.svg');
  expect(write.data).toMatch(/^<svg /);
  expect(write.data).toContain('(2 wells)');

  await inst.copyLayout();
  const clip = wxMock.__called('setClipboardData').pop().opts.data;
  expect(clip).toContain('96-well Plate Layout');
  expect(clip).toContain('■ Drug "A": A1, A2');

  // where sending files is unavailable, the file contents are copied instead
  const share = wx.shareFileMessage;
  wx.shareFileMessage = undefined;
  try { await inst.exportCSV(); } finally { wx.shareFileMessage = share; }
  expect(wxMock.__called('setClipboardData').pop().opts.data).toContain('A,"Drug ""A"""');
});
