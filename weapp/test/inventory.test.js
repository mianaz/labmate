const { wxMock } = require('./helpers/setup.cjs');
const { page, text, simulate } = require('./helpers/mp.cjs');
const store = require('../miniprogram/packages/lab/inventory/lib/store.js');
const U = require('../miniprogram/packages/lab/inventory/lib/utils.js');

const KEY = 'labmate_inventory';
const INDEX = 'packages/lab/inventory/index';
const BOX = 'packages/lab/inventory/box';
const DAY = 86400000;

// Inventory in the web app's shape (src/features/inventory/inventoryUtils.js).
function seed() {
  const now = Date.now();
  return {
    locations: [
      { id: 1, name: 'Freezer A', nameZh: '冰箱 A', type: 'freezer', temperature: '-80°C', parentId: null, order: 0 },
      { id: 2, name: 'Cold room shelf', nameZh: '', type: 'shelf', temperature: '4°C', parentId: null, order: 1 },
    ],
    boxes: [
      { id: 1, name: 'Cell lines — Box 1', nameZh: '细胞系 1 号盒', boxType: 'cryo_81', rows: 9, cols: 9, color: '#16B364', locationId: 1 },
      { id: 2, name: 'Antibodies', nameZh: '', boxType: 'tube', rows: 4, cols: 6, color: '', locationId: 2 },
      { id: 3, name: 'Empty box', nameZh: '', boxType: 'cryo_100', rows: 10, cols: 10, color: '', locationId: 1 },
    ],
    samples: [
      { id: 1, boxId: 1, position: 'A1', name: 'HEK293T', sampleType: 'cell_line', quantity: '1 mL', concentration: '', passage: 'P5', dateStored: Date.UTC(2024, 2, 10), expiryDate: null, owner: 'Mia', tags: ['frozen', 'validated'], description: 'Human embryonic kidney cells', notes: 'Passage 5, "thaw fast"\nsecond line' },
      { id: 2, boxId: 1, position: 'A2', name: 'HeLa', sampleType: 'cell_line', quantity: '1 mL', concentration: '', passage: 'P12', dateStored: now - 2 * DAY, expiryDate: null, owner: 'Jun', tags: [], description: '', notes: '' },
      { id: 3, boxId: 1, position: 'B3', name: 'anti-GAPDH', sampleType: 'antibody', quantity: '50 µL', concentration: '1 mg/mL', passage: '', dateStored: now - 40 * DAY, expiryDate: now - 5 * DAY, owner: 'Alex', tags: ['WB'], description: '', notes: '' },
      { id: 4, boxId: 2, position: 'A1', name: 'anti-Actin', sampleType: 'antibody', quantity: '100 µL', concentration: '', passage: '', dateStored: now - 10 * DAY, expiryDate: now + 5 * DAY, owner: 'Jun', tags: [], description: '', notes: '' },
    ],
    nextId: { locations: 3, boxes: 4, samples: 5 },
  };
}

const saved = () => wxMock.getStorageSync(KEY);
const toasts = () => wxMock.__called('showToast').map((c) => c.opts.title);
const mounted = [];
async function open(path, query) {
  const comp = await page(path, query);
  mounted.push(comp);
  return comp;
}

// A chat file for ui.pickTextFile: chooseMessageFile → fs.readFile(__fileContent).
function withPickedFile(content, fn) {
  const orig = global.wx.chooseMessageFile;
  global.wx.chooseMessageFile = (opts) => opts.success({ tempFiles: [{ path: 'wxfile://tmp/in.csv', name: 'in.csv' }] });
  wxMock.__fileContent = content;
  return Promise.resolve(fn()).finally(() => { global.wx.chooseMessageFile = orig; });
}
// The text last written by ui.shareTextFile.
function sharedFile() {
  const writes = wxMock.__called('fs.writeFile');
  const shares = wxMock.__called('shareFileMessage');
  return { content: writes.length ? writes[writes.length - 1].opts.data : '', name: shares.length ? shares[shares.length - 1].opts.fileName : '' };
}

beforeEach(() => {
  wxMock.__reset();
  store._reset();
});
afterEach(() => {
  while (mounted.length) { try { mounted.pop().detach(); } catch (e) { /* already detached */ } }
});

describe('inventory home', () => {
  test('renders seeded web data in Chinese', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(INDEX);
    const txt = text(comp);
    expect(txt).toContain('样品库存');
    expect(txt).toContain('我的实验室');
    expect(txt).toContain('4 个样品');
    expect(txt).toContain('冰箱 A');
    expect(txt).toContain('细胞系 1 号盒');
    expect(txt).toContain('3/81');
    expect(txt).toContain('Cold room shelf'); // no nameZh → falls back to name
    expect(txt).toContain('库存统计'); // overview strip
    expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('样品库存');
  });

  test('renders in English', async () => {
    wxMock.setStorageSync('biolab_lang', 'en');
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(INDEX);
    const txt = text(comp);
    expect(txt).toContain('Inventory');
    expect(txt).toContain('My lab');
    expect(txt).toContain('Freezer A');
    expect(txt).toContain('Cell lines — Box 1');
    expect(txt).toContain('Add Location');
    expect(txt).toContain('Storage Utilization');
  });

  test('empty state explains the hierarchy', async () => {
    const comp = await open(INDEX);
    const txt = text(comp);
    expect(txt).toContain('建立你的样品库存');
    expect(txt).toContain('添加位置');
    expect(comp.instance.data.hasLocations).toBe(false);
  });

  test('creates a location and a box through the forms, in the web shape', async () => {
    const comp = await open(INDEX);
    comp.instance.openAddLocation();
    await simulate.sleep(0);
    const locForm = comp.querySelector('#locForm');
    locForm.instance.onInput({ currentTarget: { dataset: { k: 'name' } }, detail: { value: 'Freezer B' } });
    locForm.instance.pickType({ currentTarget: { dataset: { index: 3 } } }); // tank
    locForm.instance.save();
    await simulate.sleep(0);
    let d = saved();
    expect(d.locations).toEqual([{ id: 1, name: 'Freezer B', nameZh: '', type: 'tank', temperature: '-80°C', parentId: null, order: 0 }]);
    expect(d.nextId).toEqual({ locations: 2, boxes: 1, samples: 1 });
    expect(comp.instance.data.locFormShow).toBe(false);
    expect(text(comp)).toContain('Freezer B');

    comp.instance.addBoxTap({ currentTarget: { dataset: { id: 1 } } });
    await simulate.sleep(0);
    const boxForm = comp.querySelector('#boxForm');
    boxForm.instance.onInput({ currentTarget: { dataset: { k: 'name' } }, detail: { value: 'Stocks' } });
    boxForm.instance.onType({ detail: { value: 5 } }); // custom
    boxForm.instance.onDim({ currentTarget: { dataset: { k: 'rows' } }, detail: { value: '3' } });
    boxForm.instance.onDim({ currentTarget: { dataset: { k: 'cols' } }, detail: { value: '4' } });
    boxForm.instance.pickColor({ currentTarget: { dataset: { color: '#1D5FD6' } } });
    boxForm.instance.save();
    await simulate.sleep(0);
    d = saved();
    expect(d.boxes).toEqual([{ id: 1, name: 'Stocks', nameZh: '', boxType: 'custom', rows: 3, cols: 4, color: '#1D5FD6', locationId: 1 }]);
    expect(text(comp)).toContain('0/12');
  });

  test('a location needs a name', async () => {
    const comp = await open(INDEX);
    comp.instance.openAddLocation();
    await simulate.sleep(0);
    comp.querySelector('#locForm').instance.save();
    expect(toasts()).toContain('请输入名称');
    expect(saved()).toBe('');
  });

  test('search matches name, owner, description and tags across boxes', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(INDEX);
    comp.instance.onSearch({ detail: { value: 'jun' } });
    await simulate.sleep(200);
    expect(comp.instance.data.results.map((r) => r.id).sort()).toEqual([2, 4]);
    comp.instance.onSearch({ detail: { value: 'WB' } });
    await simulate.sleep(200);
    expect(comp.instance.data.results.map((r) => r.id)).toEqual([3]);
    const txt = text(comp);
    expect(txt).toContain('anti-GAPDH');
    expect(txt).toContain('冰箱 A / 细胞系 1 号盒');
    expect(txt).toContain('B3');
    comp.instance.openSample({ currentTarget: { dataset: { id: 3, box: 1 } } });
    expect(wxMock.__called('navigateTo').pop().opts.url).toBe('/packages/lab/inventory/box?id=1&sample=3');
    comp.instance.clearSearch();
    await simulate.sleep(0);
    expect(comp.instance.data.searching).toBe(false);
  });

  test('all samples view filters and sorts', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(INDEX);
    const p = comp.instance;
    p.setView({ currentTarget: { dataset: { view: 'list' } } });
    await simulate.sleep(0);
    expect(p.data.listRows.map((r) => r.name)).toEqual(['anti-Actin', 'anti-GAPDH', 'HEK293T', 'HeLa']);
    const abIdx = p.data.typeOpts.findIndex((o) => o.v === 'antibody');
    p.onFilter({ currentTarget: { dataset: { k: 'type' } }, detail: { value: abIdx } });
    expect(p.data.listRows.map((r) => r.id)).toEqual([4, 3]);
    expect(p.data.hasFilters).toBe(true);
    p.toggleDir();
    expect(p.data.listRows.map((r) => r.id)).toEqual([3, 4]);
    p.clearFilters();
    p.onSort({ detail: { value: 6 } }); // date, oldest first
    expect(p.data.listRows[0].id).toBe(1);
    expect(text(comp)).toContain('全部样品');
  });

  test('deleting a location takes its boxes and samples, and undo restores them', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(INDEX);
    const p = comp.instance;
    wxMock.__modalConfirm = false;
    await p.deleteLocation(p._data.locations[0]);
    expect(saved().locations).toHaveLength(2);
    wxMock.__modalConfirm = true;
    await p.deleteLocation(p._data.locations[0]);
    const d = saved();
    expect(d.locations.map((l) => l.id)).toEqual([2]);
    expect(d.boxes.map((b) => b.id)).toEqual([2]);
    expect(d.samples.map((s) => s.id)).toEqual([4]);
    expect(wxMock.__called('showModal').pop().opts.content).toContain('冰箱 A');
    expect(toasts()).toContain('已删除位置');
    expect(text(comp)).not.toContain('细胞系 1 号盒');
    p.undo();
    await simulate.sleep(0);
    expect(saved().locations).toEqual(seed().locations);
    expect(saved().boxes).toEqual(seed().boxes);
    expect(saved().samples.map((s) => s.id)).toEqual([1, 2, 3, 4]);
    expect(text(comp)).toContain('细胞系 1 号盒');
  });

  test('a backup restore (shared with the web) refreshes the page and drops stale undo', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(INDEX);
    await comp.instance.deleteBox(comp.instance._data.boxes[1]);
    expect(store.canUndo()).toBe(true);
    const backup = require('../miniprogram/lib/backup.js');
    const restored = seed();
    restored.locations[0].name = 'Freezer Z';
    restored.locations[0].nameZh = '';
    backup.importBackup(JSON.stringify({ exportedAt: '2026-01-01T00:00:00.000Z', data: { [KEY]: restored } }));
    await simulate.sleep(0);
    expect(store.canUndo()).toBe(false);
    expect(comp.instance.data.canUndo).toBe(false);
    expect(text(comp)).toContain('Freezer Z');
    expect(backup.collectBackupData()[KEY]).toEqual(restored);
  });

  test('stats sheet and overview strip', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(INDEX);
    comp.instance.openStats();
    await simulate.sleep(0);
    const vm = comp.querySelector('#stats').instance.data.vm;
    expect(vm.tiles.map((x) => x.v)).toEqual([2, 3, 4, '2%']);
    expect(vm.types).toContainEqual(expect.objectContaining({ type: 'antibody', n: 2 }));
    expect(vm.expiring.map((x) => x.n)).toEqual([1, 1, 1]);
    expect(text(comp)).toContain('按类型分类');
    comp.querySelector('#stats').instance.toggleDashboard();
    expect(wxMock.getStorageSync('labmate_inv_dashboard_dismissed')).toBe('true');
    await simulate.sleep(0);
    expect(comp.instance.data.dash).toBe(null);
  });
});

describe('box page', () => {
  test('renders the grid, legend and sample list', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(BOX, { id: '1' });
    const txt = text(comp);
    expect(txt).toContain('细胞系 1 号盒');
    expect(txt).toContain('3/81');
    expect(txt).toContain('HEK293T');
    expect(txt).toContain('已过期'); // expired antibody
    const grid = comp.querySelector('#grid').instance.data;
    expect(grid.grid).toHaveLength(9);
    expect(grid.grid[0].cells).toHaveLength(9);
    expect(grid.grid[0].cells[0]).toMatchObject({ p: 'A1', t: 'cell_line', n: 'HEK' });
    expect(grid.grid[1].cells[2]).toMatchObject({ p: 'B3', t: 'antibody', x: 1 });
    expect(grid.cell * 9 + 3 * 9 + 18 + 8).toBeLessThanOrEqual(375 - 50); // 9×9 fits a phone
    expect(grid.emptyCount).toBe(78);
    expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('细胞系 1 号盒');
  });

  test('10×10 fits at 375px', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(BOX, { id: '3' });
    const g = comp.querySelector('#grid').instance.data;
    expect(g.gridWidth).toBeLessThanOrEqual(375 - 50);
    expect(g.cell).toBeGreaterThanOrEqual(26);
  });

  test('English box page', async () => {
    wxMock.setStorageSync('biolab_lang', 'en');
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(BOX, { id: '1', sample: '1' });
    const txt = text(comp);
    expect(txt).toContain('Cell lines — Box 1');
    expect(txt).toContain('Box Contents');
    expect(txt).toContain('Cell Line');
    // ?sample= opens the detail sheet
    expect(comp.instance.data.detail).toMatchObject({ id: 1, name: 'HEK293T', pos: 'A1' });
    expect(txt).toContain('Human embryonic kidney cells');
    expect(txt).toContain('2024-03-10');
  });

  test('tap an empty cell to add a sample there', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(BOX, { id: '1' });
    comp.querySelector('#grid').instance.onTap({ currentTarget: { dataset: { pos: 'C4' } } });
    await simulate.sleep(0);
    expect(comp.instance.data.formShow).toBe(true);
    expect(comp.instance.data.formPos).toBe('C4');
    const form = comp.querySelector('#sampleForm').instance;
    const set = (k, value) => form.onInput({ currentTarget: { dataset: { k } }, detail: { value } });
    set('name', 'pLKO.1');
    form.onType({ detail: { value: 1 } }); // plasmid
    set('quantity', '20 µL');
    set('dateStored', '2025-01-02');
    set('expiryDate', '2027-01-02');
    set('tags', 'shRNA, lenti');
    form.save();
    await simulate.sleep(0);
    const s = saved().samples.find((x) => x.name === 'pLKO.1');
    expect(s).toEqual({
      id: 5, boxId: 1, position: 'C4', name: 'pLKO.1', sampleType: 'plasmid', quantity: '20 µL', concentration: '',
      passage: '', dateStored: Date.UTC(2025, 0, 2), expiryDate: Date.UTC(2027, 0, 2), owner: '', tags: ['shRNA', 'lenti'],
      description: '', notes: '',
    });
    expect(saved().nextId.samples).toBe(6);
    expect(comp.instance.data.formShow).toBe(false);
    expect(comp.instance.data.activePos).toBe('C4');
    expect(text(comp)).toContain('pLKO.1');
  });

  test('tap a sample to view it, then edit, move within and across boxes, duplicate and delete', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(BOX, { id: '1' });
    const p = comp.instance;
    comp.querySelector('#grid').instance.onTap({ currentTarget: { dataset: { pos: 'A2' } } });
    await simulate.sleep(0);
    expect(p.data.detail.name).toBe('HeLa');
    expect(text(comp)).toContain('P12');

    // edit
    p.detailEdit();
    await simulate.sleep(0);
    const form = comp.querySelector('#sampleForm').instance;
    expect(form.data.form.name).toBe('HeLa');
    form.onInput({ currentTarget: { dataset: { k: 'owner' } }, detail: { value: 'Lin' } });
    form.save();
    await simulate.sleep(0);
    expect(saved().samples.find((s) => s.id === 2).owner).toBe('Lin');
    expect(p.data.detail && p.data.detail.id).toBe(2); // back to the detail sheet

    // move within the box
    p.detailMove();
    await simulate.sleep(0);
    const move = comp.querySelector('#moveForm').instance;
    expect(move.data.target).toBe('A3'); // first free
    move.onCell({ detail: { pos: 'A1', sampleId: 1 } }); // occupied: ignored
    move.onCell({ detail: { pos: 'E5', sampleId: null } });
    move.move();
    await simulate.sleep(0);
    expect(saved().samples.find((s) => s.id === 2)).toMatchObject({ boxId: 1, position: 'E5' });
    expect(toasts()).toContain('已移动到 细胞系 1 号盒 · E5');
    expect(p.data.detail.pos).toBe('E5');

    // move to another box → follows the sample
    p.detailMove();
    await simulate.sleep(0);
    const idx = move.data.boxOptions.findIndex((o) => o.id === 2);
    move.onBox({ detail: { value: idx } });
    expect(move.data.target).toBe('A2');
    move.move();
    await simulate.sleep(0);
    expect(saved().samples.find((s) => s.id === 2)).toMatchObject({ boxId: 2, position: 'A2' });
    expect(wxMock.__called('redirectTo').pop().opts.url).toBe('/packages/lab/inventory/box?id=2&sample=2');

    // duplicate → next free slot
    p.openDetail(1);
    p.detailDuplicate();
    const dup = saved().samples.find((s) => s.id === 5);
    expect(dup).toMatchObject({ name: 'HEK293T', boxId: 1, position: 'A2', tags: ['frozen', 'validated'] });
    expect(toasts()).toContain('已复制到 A2');

    // delete (confirmed)
    p.openDetail(5);
    await p.detailDelete();
    expect(saved().samples.some((s) => s.id === 5)).toBe(false);
    expect(p.data.detail).toBe(null);
    expect(toasts()).toContain('已删除样品');
  });

  test('moving onto an occupied position is refused', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(BOX, { id: '1' });
    comp.instance.onMove({ detail: { sampleId: 2, boxId: 1, position: 'A1' } });
    expect(toasts()).toContain('该孔位已被占用');
    expect(saved().samples.find((s) => s.id === 2).position).toBe('A2');
  });

  test('select mode: range, row, bulk add, bulk edit, bulk delete, undo', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(BOX, { id: '1' });
    const p = comp.instance;
    const grid = comp.querySelector('#grid').instance;
    p.toggleSelect();
    await simulate.sleep(0);
    grid.onLong({ currentTarget: { dataset: { pos: 'A1' } } });
    grid.onTap({ currentTarget: { dataset: { pos: 'B3' } } });
    await simulate.sleep(0);
    expect(p.data.selected.sort()).toEqual(['A1', 'A2', 'A3', 'B1', 'B2', 'B3']);
    expect(p.data.selOcc).toBe(3);
    expect(p.data.selEmpty).toBe(3);
    expect(text(comp)).toContain('已选 6');

    p.openBulkAdd();
    p.onBulkAddInput({ currentTarget: { dataset: { k: 'name' } }, detail: { value: 'PBS aliquot' } });
    p.saveBulkAdd();
    let d = saved();
    expect(d.samples.filter((s) => s.name === 'PBS aliquot').map((s) => s.position).sort()).toEqual(['A3', 'B1', 'B2']);
    expect(d.samples.find((s) => s.name === 'PBS aliquot').sampleType).toBe('reagent');
    expect(toasts()).toContain('已添加 3 个样品');

    grid.onRow({ currentTarget: { dataset: { r: 0 } } }); // whole row A
    expect(p.data.selected).toHaveLength(9);
    p.openBulkEdit();
    p.onBulkEditInput({ currentTarget: { dataset: { k: 'owner' } }, detail: { value: 'Kim' } });
    p.saveBulkEdit();
    d = saved();
    expect(d.samples.filter((s) => s.owner === 'Kim').map((s) => s.position).sort()).toEqual(['A1', 'A2', 'A3']);
    expect(d.samples.find((s) => s.id === 1).sampleType).toBe('cell_line'); // untouched field

    grid.onCol({ currentTarget: { dataset: { c: 0 } } }); // column 1: A1, B1
    await p.bulkDelete();
    d = saved();
    expect(d.samples.some((s) => s.position === 'A1' && s.boxId === 1)).toBe(false);
    expect(d.samples.some((s) => s.position === 'B1' && s.boxId === 1)).toBe(false);
    expect(toasts()).toContain('已删除 2 个样品');

    p.undo();
    expect(saved().samples.some((s) => s.position === 'A1' && s.boxId === 1)).toBe(true);
    expect(toasts()).toContain('已撤销');
  });

  test('editing a box keeps its stored size and warns before shrinking past samples', async () => {
    const d = seed();
    delete d.boxes[0].boxType; // older web data
    d.boxes[0].rows = 5;
    d.boxes[0].cols = 7;
    wxMock.setStorageSync(KEY, d);
    const comp = await open(BOX, { id: '1' });
    comp.instance.editBox();
    await simulate.sleep(0);
    const bf = comp.querySelector('#boxForm').instance;
    expect(bf.data.dims).toContain('5 × 7 = 35');
    bf.onInput({ currentTarget: { dataset: { k: 'name' } }, detail: { value: 'Renamed' } });
    bf.onType({ detail: { value: 5 } }); // custom 8 × 8…
    bf.onDim({ currentTarget: { dataset: { k: 'rows' } }, detail: { value: '1' } }); // …then 1 row: B3 falls off
    expect(bf.data.outside).toBe(1);
    expect(text(comp)).toContain('1 个样品的孔位超出新尺寸');
    bf.onDim({ currentTarget: { dataset: { k: 'rows' } }, detail: { value: '5' } });
    bf.onDim({ currentTarget: { dataset: { k: 'cols' } }, detail: { value: '7' } });
    bf.save();
    await simulate.sleep(0);
    expect(saved().boxes[0]).toMatchObject({ id: 1, name: 'Renamed', rows: 5, cols: 7, locationId: 1 });
    expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('细胞系 1 号盒'); // nameZh still wins in Chinese
  });

  test('deleting the box goes back', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(BOX, { id: '1' });
    await comp.instance.deleteBox();
    expect(saved().boxes.map((b) => b.id)).toEqual([2, 3]);
    expect(saved().samples.map((s) => s.id)).toEqual([4]);
    expect(wxMock.__called('navigateBack')).toHaveLength(1);
    expect(comp.instance.data.found).toBe(false);
  });

  test('a failed write keeps the stored data and shows a toast', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(BOX, { id: '1' });
    const before = saved();
    const orig = global.wx.setStorageSync;
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    global.wx.setStorageSync = () => { throw new Error('setStorageSync:fail exceed storage max size 1MB'); };
    try {
      comp.instance.openAdd('D4');
      await simulate.sleep(0);
      const form = comp.querySelector('#sampleForm').instance;
      form.onInput({ currentTarget: { dataset: { k: 'name' } }, detail: { value: 'Too big' } });
      form.save();
    } finally {
      global.wx.setStorageSync = orig;
      quiet.mockRestore();
    }
    expect(toasts()).toContain('存储空间已满，未保存');
    expect(saved()).toEqual(before);
    expect(comp.instance.data.formShow).toBe(true); // the form stays open
    expect(store.canUndo()).toBe(false);
  });
});

describe('CSV and JSON', () => {
  test('export all samples sends a CSV to a chat', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(INDEX);
    await comp.instance.exportAllCsv();
    expect(wxMock.__called('shareFileMessage')).toHaveLength(1);
    const { content, name } = sharedFile();
    expect(name).toMatch(/^inventory-all-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = content.split('\n');
    expect(lines[0]).toBe('"Location","Box","Position","Name","Type","Quantity","Concentration","Passage","Date Stored","Expiry","Owner","Tags","Description","Notes"');
    expect(lines[1]).toBe('"Freezer A","Cell lines — Box 1","A1","HEK293T","cell_line","1 mL","","P5","2024-03-10","","Mia","frozen; validated","Human embryonic kidney cells","Passage 5, ""thaw fast""');
  });

  test('export menu, template and JSON backup', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(INDEX);
    wxMock.__actionSheetIndex = 2;
    comp.instance.openExport();
    await simulate.sleep(0);
    expect(sharedFile()).toEqual({ name: 'inventory-template.csv', content: U.invCsvTemplate() });
    await comp.instance.exportJson();
    const backup = JSON.parse(sharedFile().content);
    expect(backup.type).toBe('inventory');
    expect(backup.data).toEqual(saved());
  });

  test('box CSV round-trips through import into another box', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(BOX, { id: '1' });
    await comp.instance.exportBox();
    const { content, name } = sharedFile();
    expect(name).toBe('inventory-Cell-lines-—-Box-1.csv'); // the web names it after box.name
    expect(content.split('\n')[0]).toBe('"Position","Name","Type","Quantity","Concentration","Passage","Date Stored","Expiry","Owner","Tags","Description","Notes"');

    const target = await open(BOX, { id: '3' });
    await withPickedFile(content, () => target.instance.importCsv());
    expect(wxMock.__called('chooseMessageFile')).toHaveLength(0); // patched, not the recorder
    const imported = saved().samples.filter((s) => s.boxId === 3);
    const original = seed().samples.filter((s) => s.boxId === 1);
    expect(imported).toHaveLength(3);
    const strip = (s) => ({
      position: s.position, name: s.name, sampleType: s.sampleType, quantity: s.quantity, concentration: s.concentration,
      passage: s.passage, dateStored: U.isoDate(s.dateStored), expiryDate: U.isoDate(s.expiryDate), owner: s.owner,
      tags: s.tags, description: s.description, notes: s.notes,
    });
    expect(imported.map(strip)).toEqual(original.map(strip));
    expect(toasts()).toContain('已恢复 3 项数据');

    // Again into the source box: every position is taken → all skipped.
    await withPickedFile(content, () => comp.instance.importCsv());
    expect(toasts().pop()).toBe('已恢复 0 项数据（3 个位置冲突跳过）');
    expect(saved().samples.filter((s) => s.boxId === 1)).toHaveLength(3);
  });

  test('the CSV template imports through the index import sheet', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(INDEX);
    comp.instance.openImport();
    await simulate.sleep(0);
    const boxes = comp.instance.data.importBoxes;
    expect(boxes.map((b) => b.id)).toEqual([1, 3, 2]); // grouped by location
    comp.instance.onImportBox({ detail: { value: 2 } }); // Antibodies
    await withPickedFile('﻿' + U.invCsvTemplate().replace(/\n/g, '\r\n').replace('A1,', 'b2,'), () => comp.instance.importCsv());
    const s = saved().samples.find((x) => x.name === 'HEK293T' && x.boxId === 2);
    expect(s).toMatchObject({ position: 'B2', sampleType: 'cell_line', quantity: '500 uL', passage: 'P5', owner: 'John', tags: ['frozen', 'validated'], expiryDate: null, dateStored: Date.UTC(2024, 2, 10) });
    expect(comp.instance.data.importShow).toBe(false);
  });

  test('a file that is not an inventory CSV is rejected', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(BOX, { id: '3' });
    const before = saved();
    await withPickedFile('just one line', () => comp.instance.importCsv());
    expect(toasts()).toContain('备份文件格式无效');
    expect(saved()).toEqual(before);
  });

  test('JSON backup import merges with fresh ids', async () => {
    wxMock.setStorageSync(KEY, seed());
    const comp = await open(INDEX);
    const backup = JSON.stringify({ exportedAt: '2026-01-01T00:00:00.000Z', type: 'inventory', data: seed() });
    await withPickedFile(backup, () => comp.instance.importJson());
    const d = saved();
    expect(d.locations).toHaveLength(4);
    expect(d.boxes).toHaveLength(6);
    expect(d.samples).toHaveLength(8);
    const newHek = d.samples.filter((s) => s.name === 'HEK293T')[1];
    const newBox = d.boxes.find((b) => b.id === newHek.boxId);
    expect(newBox).toMatchObject({ name: 'Cell lines — Box 1', locationId: 3 });
    expect(d.nextId).toEqual({ locations: 5, boxes: 7, samples: 9 });
    expect(toasts()).toContain('已恢复 9 项数据');
  });
});

describe('utils', () => {
  test('CSV parser handles quotes, commas, doubled quotes and line breaks', () => {
    const rows = U.parseCsvImport('Position,Name,Notes\n"A1","a, b","say ""hi""\nnext"\r\nA2,plain,\n');
    expect(rows).toEqual([
      { position: 'A1', name: 'a, b', notes: 'say "hi"\nnext' },
      { position: 'A2', name: 'plain', notes: '' },
    ]);
  });

  test('positions sort naturally and web data without nextId is normalized', () => {
    expect(['A10', 'B1', 'A2'].sort(U.comparePos)).toEqual(['A2', 'A10', 'B1']);
    const d = U.normalize({ locations: [{ id: 7 }] });
    expect(d.nextId).toEqual({ locations: 8, boxes: 1, samples: 1 });
    expect(d.boxes).toEqual([]);
  });
});
