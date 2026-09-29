const { wxMock } = require('./helpers/setup.cjs');
const { page, load, text, simulate } = require('./helpers/mp.cjs');
const calc = require('../miniprogram/shared/calculators.js');
const { calcMW, ELEMENTS } = require('../miniprogram/shared/data.js');

beforeEach(() => wxMock.__reset());

const input = (field, value) => ({ currentTarget: { dataset: { field } }, detail: { value } });
const tapData = (dataset) => ({ currentTarget: { dataset } });

// Render the Calc tab with a calculator already chosen (and optionally English).
async function openCalc(mode, lang) {
  if (lang) wxMock.setStorageSync('biolab_lang', lang);
  if (mode) wxMock.setStorageSync('labmate_calcMode', mode);
  return page('pages/calc/index');
}
function child(comp, id) {
  const c = comp.querySelector('#' + id);
  if (!c) throw new Error('calculator #' + id + ' not rendered');
  return c;
}
const settle = () => simulate.sleep(0);

describe('Calc tab', () => {
  test('renders in Chinese by default with the dilution calculator', async () => {
    const comp = await openCalc();
    const txt = text(comp);
    expect(txt).toContain('工具');
    expect(txt).toContain('计算器');
    expect(txt).toContain('稀释、质量、摩尔浓度、单位换算等');
    // the switcher lists every calculator, the gel calculator included
    for (const name of ['科学计算器', '稀释计算器', '质量计算器', '摩尔浓度计算器', '百分比计算器', '损耗体积计算器', '单位换算', '分子量计算器', '元素周期表', 'SDS-PAGE 配胶']) {
      expect(txt).toContain(name);
    }
    expect(txt).toContain('C₁V₁ = C₂V₂');
    expect(txt).toContain('求解');
    expect(comp.querySelector('#dilution')).toBeTruthy();
    expect(comp.instance.data.tabIndex).toBe(2);
    expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('计算器');
  });

  test('renders in English', async () => {
    const comp = await openCalc(null, 'en');
    const txt = text(comp);
    expect(txt).toContain('Tools');
    expect(txt).toContain('Dilution, mass, molarity, unit conversion and more');
    expect(txt).toContain('Dilution Calculator');
    expect(txt).toContain('Scientific Calculator');
    expect(txt).toContain('SDS-PAGE gel recipe');
    expect(txt).toContain('Solve for');
    expect(txt).toContain('Enter the other 3 values');
    expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('Calculator');
  });

  test('switching calculators renders the chosen one and remembers it', async () => {
    const comp = await openCalc();
    comp.instance.select(tapData({ id: 'mass' }));
    await settle();
    expect(comp.querySelector('#mass')).toBeTruthy();
    expect(comp.querySelector('#dilution')).toBeFalsy();
    expect(text(comp)).toContain('质量计算器');
    expect(wxMock.getStorageSync('labmate_calcMode')).toBe('mass');

    for (const id of ['scientific', 'molarity', 'percent', 'deadvol', 'convert', 'mw', 'periodic', 'gel']) {
      comp.instance.select(tapData({ id }));
      await settle();
      expect(comp.querySelector('#' + id)).toBeTruthy();
    }

    // a fresh page restores the last calculator and scrolls it into view
    const again = await page('pages/calc/index');
    expect(again.instance.data.mode).toBe('gel');
    expect(again.instance.data.scrollTo).toBe('cx-mode-periodic');
    expect(again.querySelector('#gel')).toBeTruthy();
  });

  test('unknown stored mode falls back to dilution; ?mode= and storage open a calculator', async () => {
    let comp = await openCalc('nope');
    expect(comp.instance.data.mode).toBe('dilution');

    comp = load('pages/calc/index');
    global.__pages = [comp.instance];
    comp.instance.onLoad({ mode: 'mw' });
    comp.instance.onShow();
    await settle();
    expect(comp.querySelector('#mw')).toBeTruthy();

    // another page stores a mode, then switches to the tab
    wxMock.setStorageSync('labmate_calcMode', 'periodic');
    comp.instance.onShow();
    await settle();
    expect(comp.instance.data.mode).toBe('periodic');
    expect(comp.querySelector('#periodic')).toBeTruthy();
  });
});

describe('Dilution', () => {
  test('solves each variable like shared/calculators.js', async () => {
    const comp = await openCalc('dilution', 'en');
    const d = child(comp, 'dilution');
    const I = d.instance;
    const vals = { c1: '10', v1: '2', c2: '500', v2: '50' };
    Object.keys(vals).forEach((k) => I.onInput(input(k, vals[k])));
    I.onUnit({ currentTarget: { dataset: { field: 'c2' } }, detail: { value: 1 } }); // mM
    await settle();

    const units = { c1Unit: 'M', v1Unit: 'mL', c2Unit: 'mM', v2Unit: 'mL' };
    const nums = { c1: 10, v1: 2, c2: 500, v2: 50 };
    for (const solveFor of ['v1', 'c1', 'v2', 'c2']) {
      I.setSolve(tapData({ id: solveFor }));
      await settle();
      const r = calc.dilution({ ...nums, ...units, solveFor });
      const expected = r.val < 0.001 ? r.val.toExponential(3) : r.val.toFixed(4);
      expect(I.data.result).toBe(expected);
      expect(text(d)).toContain(expected);
    }
  });

  test('prep instructions, with µL of stock into a mL final volume', async () => {
    const comp = await openCalc('dilution', 'en');
    const I = child(comp, 'dilution').instance;
    I.onUnit({ currentTarget: { dataset: { field: 'v1' } }, detail: { value: 2 } }); // V₁ in µL
    I.onInput(input('c1', '10'));
    I.onInput(input('c2', '1'));
    I.onInput(input('v2', '1'));
    await settle();
    expect(I.data.result).toBe('100.0000'); // 10 M → 1 M, 1 mL: 100 µL stock
    const prep = I.data.prep.map((s) => s.t).join('');
    expect(prep).toBe('How to prepare: Pipette 100.0000 µL of stock solution, then add 0.9000 mL of solvent (water/buffer) to reach 1.0000 mL total');
    expect(text(comp)).toContain('0.9000 mL');
  });

  test('prep instructions in Chinese; incomplete input shows the empty readout', async () => {
    const comp = await openCalc('dilution');
    const d = child(comp, 'dilution');
    const I = d.instance;
    expect(text(d)).toContain('输入其他三个值');
    I.onInput(input('c1', '5'));
    I.onInput(input('v1', '2'));
    I.onInput(input('v2', '10'));
    I.setSolve(tapData({ id: 'c2' }));
    await settle();
    expect(I.data.result).toBe('1.0000');
    expect(I.data.prep.map((s) => s.t).join('')).toBe('配制方法：将母液稀释至 1.0000 M，使用 2.0000 mL 母液，10.0000 mL 终体积');
    // decimal commas from some keyboards are accepted
    I.onInput(input('v1', '2,5'));
    expect(I.data.vals.v1).toBe('2.5');
  });
});

describe('Mass & molarity', () => {
  test('mass: common MW chip, units, readout and prep', async () => {
    const comp = await openCalc('mass', 'en');
    const m = child(comp, 'mass');
    const I = m.instance;
    I.pickCommon(tapData({ mw: 58.44 }));
    I.onInput(input('conc', '150'));
    I.onConcUnit({ detail: { value: 1 } }); // mM
    I.onInput(input('vol', '500'));
    await settle();
    const mass = calc.massCalc({ mw: 58.44, conc: 150, vol: 500, concUnit: 'mM', volUnit: 'mL' });
    const fm = calc.formatMass(mass);
    expect(I.data.value).toBe(fm.val);
    expect(I.data.unit).toBe(fm.unit);
    const txt = text(m);
    expect(txt).toContain(fm.val);
    expect(txt).toContain('= ' + mass.toExponential(4) + ' g');
    expect(txt).toContain('Weigh ' + fm.val + ' ' + fm.unit + ' of reagent and dissolve in 500 mL to make 150 mM solution');
    expect(I.data.mwNum).toBe(58.44); // NaCl chip is active
  });

  test('molarity: mass / (MW × V) in the best unit', async () => {
    const comp = await openCalc('molarity');
    const m = child(comp, 'molarity');
    const I = m.instance;
    expect(text(m)).toContain('输入质量、分子量和体积');
    I.onInput(input('mass', '250'));
    I.onMassUnit({ detail: { value: 1 } }); // mg
    I.onInput(input('mw', '58.44'));
    I.onInput(input('vol', '100'));
    await settle();
    const M = calc.molarityCalc({ mass: 250, mw: 58.44, vol: 100, massUnit: 'mg', volUnit: 'mL' });
    const fc = calc.formatConcentration(M);
    expect(I.data.value).toBe(fc.val);
    expect(I.data.unit).toBe('mM');
    expect(text(m)).toContain(fc.val);
    expect(text(m)).toContain('= ' + M.toExponential(4) + ' M');
  });
});

describe('Percent & dead volume', () => {
  test('percent: w/v and v/v, every solve-for mode', async () => {
    const comp = await openCalc('percent', 'en');
    const p = child(comp, 'percent');
    const I = p.instance;
    expect(text(p)).toContain('% (w/v) = g / 100 mL');
    I.onInput(input('perc', '2'));
    I.onInput(input('vol', '250'));
    await settle();
    let r = calc.percentCalc({ perc: 2, vol: 250, solute: 0, solveFor: 'solute', mode: 'wv' });
    expect(I.data.result).toBe(r.val.toFixed(4)); // 5 g
    expect(text(p)).toContain('5.0000');

    I.setSolve(tapData({ id: 'perc' }));
    I.onInput(input('solute', '10'));
    await settle();
    r = calc.percentCalc({ solute: 10, vol: 250, solveFor: 'perc' });
    expect(I.data.result).toBe(r.val.toFixed(4)); // 4 %

    I.setType(tapData({ id: 'vv' }));
    I.setSolve(tapData({ id: 'vol' }));
    await settle();
    r = calc.percentCalc({ solute: 10, perc: 2, solveFor: 'vol', mode: 'vv' });
    expect(I.data.result).toBe(r.val.toFixed(4)); // 500 mL
    expect(text(p)).toContain('% (v/v) = mL / 100 mL');
    expect(text(p)).toContain('Solute Volume');
  });

  test('dead volume: presets, slider steps and totals', async () => {
    const comp = await openCalc('deadvol', 'en');
    const dv = child(comp, 'deadvol');
    const I = dv.instance;
    expect(text(dv)).toContain('Enter the number of samples and volume per sample');
    I.applyPreset(tapData({ id: 'pcr' }));
    await settle();
    let r = calc.deadVolume({ numSamples: 24, volPerSample: 20, deadPercent: 15 });
    expect(I.data.total).toBe(r.total.toFixed(1)); // 552.0 µL
    expect(text(dv)).toContain('552.0');
    expect(text(dv)).toContain('Without dead volume 480.0 µL · Dead volume portion +72.0 µL');
    expect(text(dv)).toContain('= 24 × 20 µL × (1 + 15%)');

    I.applyPreset(tapData({ id: '96well' })); // 96 × 200 µL + 10 % = 21 120 µL → mL
    await settle();
    expect(I.data.total).toBe('21.12');
    expect(I.data.totalUnit).toBe('mL');

    I.stepDead(tapData({ step: 1 }));
    await settle();
    r = calc.deadVolume({ numSamples: 96, volPerSample: 200, deadPercent: 11 });
    expect(I.data.dead).toBe(11);
    expect(I.data.total).toBe((r.total / 1000).toFixed(2));
    expect(I.data.preset).toBe('custom');

    I.onDead({ detail: { value: 50 } });
    I.stepDead(tapData({ step: 1 })); // clamped at 50 %
    expect(I.data.dead).toBe(50);
  });
});

describe('Unit conversion', () => {
  test('converts, swaps and handles negative temperatures', async () => {
    const comp = await openCalc('convert', 'en');
    const cv = child(comp, 'convert');
    const I = cv.instance;
    I.onInput({ detail: { value: '1.5' } }); // mL → µL
    await settle();
    expect(I.data.result).toBe(String(calc.unitConvert(1.5, 'mL', 'µL', 'volume')));
    expect(text(cv)).toContain('1500');

    I.swap();
    await settle();
    expect(I.data.units[I.data.fromIdx]).toBe('µL');
    expect(I.data.value).toBe('1500');
    expect(I.data.result).toBe('1.5');

    I.pickCategory(tapData({ id: 'temperature' }));
    I.onInput({ detail: { value: '80' } });
    I.toggleSign();
    I.onTo({ detail: { value: 2 } }); // K
    await settle();
    expect(I.data.value).toBe('-80');
    expect(I.data.result).toBe(String(parseFloat(calc.unitConvert(-80, '°C', 'K', 'temperature').toPrecision(8))));
    expect(text(cv)).toContain('193.15');

    I.pickCategory(tapData({ id: 'pressure' }));
    I.onInput({ detail: { value: '1' } }); // atm → Pa
    await settle();
    expect(Number(I.data.result)).toBeCloseTo(calc.unitConvert(1, 'atm', 'Pa', 'pressure'), 0);
  });
});

describe('MW & periodic table', () => {
  test('MW: formula parser, breakdown and unknown elements', async () => {
    const comp = await openCalc('mw', 'en');
    const mw = child(comp, 'mw');
    const I = mw.instance;
    expect(text(mw)).toContain('Enter a chemical formula');
    I.onInput({ detail: { value: 'Ca(OH)₂' } });
    await settle();
    const r = calcMW('Ca(OH)₂');
    expect(I.data.total).toBe(r.total.toFixed(3));
    expect(I.data.rows.map((x) => x.sym)).toEqual(['Ca', 'O', 'H']);
    const txt = text(mw);
    expect(txt).toContain(r.total.toFixed(3));
    expect(txt).toContain('Calcium');
    expect(txt).toContain('31.998');

    I.pick(tapData({ formula: 'C6H12O6' }));
    await settle();
    expect(I.data.total).toBe(calcMW('C6H12O6').total.toFixed(3));

    I.onInput({ detail: { value: 'Xy2O' } });
    await settle();
    expect(I.data.state).toBe('error');
    expect(text(mw)).toContain('Invalid formula: Unknown element "Xy"');
  });

  test('periodic table: all elements, search dims, tap shows details', async () => {
    const comp = await openCalc('periodic');
    const pt = child(comp, 'periodic');
    const I = pt.instance;
    expect(I.data.tiles.length).toBe(ELEMENTS.length);
    expect(text(pt)).toContain('点击元素查看详情');
    expect((pt.dom.innerHTML.match(/is-dim/g) || []).length).toBe(0);

    I.onSearch({ detail: { value: 'Fe' } });
    await settle();
    const q = 'fe';
    const matches = ELEMENTS.filter((el) => el.sym.toLowerCase().includes(q) || el.name.toLowerCase().includes(q));
    expect((pt.dom.innerHTML.match(/is-dim/g) || []).length).toBe(ELEMENTS.length - matches.length);

    I.select(tapData({ z: 26 }));
    await settle();
    const txt = text(pt);
    expect(txt).toContain('Iron');
    expect(txt).toContain('55.8450 u');
    expect(txt).toContain('过渡金属');
    expect(txt).toContain('[Ar] 3d⁶ 4s²');
    expect(pt.dom.innerHTML).toMatch(/is-sel/);

    I.clearSearch();
    await settle();
    expect((pt.dom.innerHTML.match(/is-dim/g) || []).length).toBe(0);
  });
});

describe('Scientific calculator', () => {
  const press = (I, keys) => keys.forEach((k) => I.press(k));

  test('evaluates keypad input with the shared parser', async () => {
    const comp = await openCalc('scientific');
    const sc = child(comp, 'scientific');
    const I = sc.instance;
    press(I, ['sin', 'n3', 'n0', 'rp', 'add', 'sqrt', 'n2', 'rp']);
    await settle();
    expect(I.data.expr).toBe('sin(30)+√(2)');
    const val = calc.evalExpression('sin(30)+√(2)', { deg: true });
    expect(I.data.preview).toBe(String(parseFloat(val.toPrecision(12))));
    expect(text(sc)).toContain('= ' + I.data.preview);

    press(I, ['eq']);
    await settle();
    expect(I.data.expr).toBe(String(parseFloat(val.toPrecision(12))));
    expect(I.data.hasAns).toBe(true);
    expect(text(sc)).toContain('ANS');

    // an operator continues from the answer, a digit starts over
    press(I, ['mul', 'n2', 'eq']);
    expect(Number(I.data.expr)).toBeCloseTo(val * 2, 9);
    press(I, ['n5']);
    expect(I.data.expr).toBe('5');
  });

  test('DEG/RAD, factorial, powers, errors and editing', async () => {
    const comp = await openCalc('scientific', 'en');
    const sc = child(comp, 'scientific');
    const I = sc.instance;
    press(I, ['cos', 'n6', 'n0', 'rp', 'eq']);
    expect(I.data.expr).toBe('0.5'); // degrees by default
    press(I, ['deg', 'ac']);
    await settle();
    expect(I.data.deg).toBe(false);
    expect(text(sc)).toContain('RAD');
    press(I, ['cos', 'pi', 'rp', 'eq']);
    expect(I.data.expr).toBe('-1');
    press(I, ['ac']);
    expect(I.data.expr).toBe('');

    press(I, ['n5', 'fact', 'sub', 'n2', 'pow', 'n3', 'eq']);
    expect(I.data.expr).toBe('112'); // 120 − 8
    press(I, ['n1', 'exp10', 'n3', 'eq']);
    expect(I.data.expr).toBe('1000');

    press(I, ['n1', 'div', 'n0', 'eq']);
    await settle();
    expect(I.data.error).toBe(true);
    expect(text(sc)).toContain('Error');
    press(I, ['back']);
    expect(I.data.error).toBe(false);
    expect(I.data.expr).toBe('1÷');

    press(I, ['ac', 'n9', 'ans']);
    expect(I.data.expr).toBe('91000'); // Ans inserts the last answer (1000)
  });
});

describe('Gel calculator', () => {
  test('gel-calc renders on its own and scales with the number of gels', async () => {
    const g = load('components/gel-calc/index');
    await settle();
    const I = g.instance;
    let txt = text(g);
    expect(txt).toContain('配胶计算器');
    expect(txt).toContain('分离胶');
    expect(txt).toContain('浓缩胶');
    expect(txt).toContain('10% · 10 mL × 2 = 20 mL');
    const base = calc.calcGel(10, 20, 'resolving');
    expect(I.data.tables[0].rows[0].val).toBe(base[0].vol.toFixed(3));
    expect(I.data.tables[0].rows[5].val).toBe(base[5].vol.toFixed(1)); // TEMED in µL
    expect(txt).toContain(base[1].vol.toFixed(3));

    I.onInput(input('numGels', '4'));
    I.onResPerc({ detail: { value: 4 } }); // 12 %
    I.onInput(input('stackVol', '3'));
    await settle();
    const res = calc.calcGel(12, 40, 'resolving');
    const stack = calc.calcGel(4, 12, 'stacking');
    expect(I.data.tables[0].rows.map((r) => r.val)).toEqual(res.map((r) => (r.unit === 'µL' ? r.vol.toFixed(1) : r.vol.toFixed(3))));
    expect(I.data.tables[1].rows.map((r) => r.val)).toEqual(stack.map((r) => (r.unit === 'µL' ? r.vol.toFixed(1) : r.vol.toFixed(3))));
    expect(I.data.tables[0].total).toBe('40.00');
    txt = text(g);
    expect(txt).toContain('12% · 10 mL × 4 = 40 mL');
    expect(txt).toContain('4% · 3 mL × 4 = 12 mL');
    expect(I.data.guide.find((x) => x.current).perc).toBe('12%');
  });

  test('copy and send-to-chat produce the web’s text recipe', async () => {
    const g = load('components/gel-calc/index');
    await settle();
    const I = g.instance;
    await I.copyRecipe();
    const copied = wxMock.__called('setClipboardData')[0].opts.data;
    expect(copied).toContain('SDS-PAGE Gel Recipe');
    expect(copied).toContain('Gels: 2');
    expect(copied).toContain('Resolving Gel (10%, 20 mL)');
    expect(copied).toContain('Stacking Gel (4%, 10 mL)');
    expect(copied).toContain('Ref: Laemmli (1970)');

    await I.sendRecipe();
    const write = wxMock.__called('fs.writeFile')[0].opts;
    expect(write.filePath).toBe('wxfile://usr/SDS-PAGE_10pct_x2.txt');
    expect(write.data).toBe(copied);
    expect(wxMock.__called('shareFileMessage')[0].opts.fileName).toBe('SDS-PAGE_10pct_x2.txt');
  });

  test('send falls back to the clipboard where file sharing is unavailable', async () => {
    const share = global.wx.shareFileMessage;
    global.wx.shareFileMessage = undefined;
    try {
      const g = load('components/gel-calc/index');
      await settle();
      const sent = await g.instance.sendRecipe();
      expect(sent).toBe(false);
      expect(wxMock.__called('setClipboardData').length).toBe(1);
    } finally {
      global.wx.shareFileMessage = share;
    }
  });

  test('the Calc tab offers the gel calculator as a panel', async () => {
    const comp = await openCalc('gel', 'en');
    const g = child(comp, 'gel');
    expect(g.instance.data.variant).toBe('panel');
    const txt = text(g);
    expect(txt).toContain('SDS-PAGE gel recipe');
    expect(txt).toContain('Laemmli discontinuous electrophoresis system');
    expect(txt).toContain('Send to chat');
    expect(txt).toContain('Gel % vs MW Separation Range');
  });
});
