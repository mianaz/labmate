const { wxMock } = require('./helpers/setup.cjs');
const { page, text, simulate } = require('./helpers/mp.cjs');

const experiments = require('../miniprogram/lib/experiments.js');
const { isoDate } = require('../miniprogram/lib/format.js');

const KEY = 'labmate_experiments';
const ev = (dataset, value) => ({ currentTarget: { dataset: dataset || {} }, detail: { value } });
const navUrls = () => wxMock.__called('navigateTo').map((c) => c.opts.url);

// Local date `n` days from today.
function day(n) {
  const d = new Date();
  return isoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n));
}
function entry(over) {
  return Object.assign(experiments.createEmptyExperiment(over.date, over.startTime), over);
}
function seed(list) { wxMock.setStorageSync(KEY, list); }

beforeEach(() => wxMock.__reset());

test('Chinese: header, view switch and empty agenda', async () => {
  const comp = await page('packages/lab/calendar/index');
  const txt = text(comp);
  expect(txt).toContain('我的实验室');
  expect(txt).toContain('实验日历');
  expect(txt).toContain('日程');
  expect(txt).toContain('月视图');
  expect(txt).toContain('周视图');
  expect(txt).toContain('暂无实验安排');
  expect(txt).toContain('从方案');
  expect(wxMock.__called('setNavigationBarTitle').pop().opts.title).toBe('实验日历');
});

test('English agenda groups upcoming experiments by day, skips past and cancelled', async () => {
  wxMock.setStorageSync('biolab_lang', 'en');
  seed([
    entry({ id: 'exp_1_a', date: day(0), startTime: '13:00', title: 'Afternoon blot', duration: 90, protocolRef: 'wb_protocol' }),
    entry({ id: 'exp_2_b', date: day(0), startTime: '08:30', title: 'Morning PCR', status: 'in-progress' }),
    entry({ id: 'exp_3_c', date: day(3), title: 'ELISA', color: '#ef4444' }),
    entry({ id: 'exp_4_d', date: day(-2), title: 'Old run' }),
    entry({ id: 'exp_5_e', date: day(1), title: 'Called off', status: 'cancelled' }),
  ]);
  const comp = await page('packages/lab/calendar/index');
  const inst = comp.instance;
  const txt = text(comp);
  expect(txt).toContain('Experiment Calendar');
  expect(txt).toContain('3 upcoming');
  expect(txt).toContain('Upcoming');
  expect(txt).toMatch(/Today · \w{3}, \w+ \d+/);
  expect(txt).toContain('13:00');
  expect(txt).toContain('90 min');
  expect(txt).toContain('In Progress');
  expect(txt).not.toContain('Old run');
  expect(txt).not.toContain('Called off');
  expect(inst.data.groups.map((g) => g.date)).toEqual([day(0), day(3)]);
  // same day in start-time order
  expect(inst.data.groups[0].rows.map((r) => r.title)).toEqual(['Morning PCR', 'Afternoon blot']);
  expect(inst.data.groups[1].rows[0].swatch).toBe('#ef4444');
});

test('month grid shows entries on their dates; tapping a day lists it', async () => {
  const d = day(0);
  seed([
    entry({ id: 'exp_1_a', date: d, title: '细胞传代', status: 'completed' }),
    entry({ id: 'exp_2_b', date: d, startTime: '15:00', title: 'Transfection' }),
    entry({ id: 'exp_3_c', date: day(-40), title: 'Long ago' }),
  ]);
  const comp = await page('packages/lab/calendar/index');
  const inst = comp.instance;
  inst.setView(ev({ mode: 'month' }));
  await simulate.sleep(0);

  const now = new Date();
  const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
  expect(inst.data.periodMain).toBe(months[now.getMonth()]);
  expect(inst.data.periodYear).toBe(String(now.getFullYear()));
  expect(inst.data.cells.length % 7).toBe(0);
  const cell = inst.data.cells.find((c) => c.date === d);
  expect(cell.today).toBe(true);
  expect(cell.n).toBe(2);
  expect(cell.dots.map((x) => x.st)).toEqual(['completed', 'planned']);
  expect(inst.data.cells.filter((c) => c.n).map((c) => c.date)).toEqual([d]);
  expect(text(comp)).toContain('计划中'); // legend

  inst.pickDay(ev({ date: d }));
  await simulate.sleep(0);
  expect(inst.data.dayFilter).toBe(d);
  const txt = text(comp);
  expect(txt).toContain('细胞传代');
  expect(txt).toContain('Transfection');
  expect(txt).toContain('显示全部');

  // Another month: navigate back to where "Long ago" lives.
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 40);
  const back = (now.getFullYear() - target.getFullYear()) * 12 + now.getMonth() - target.getMonth();
  for (let i = 0; i < back; i++) inst.step(ev({ dir: -1 }));
  expect(inst.data.dayFilter).toBe('');
  expect(inst.data.cells.find((c) => c.date === day(-40)).n).toBe(1);

  inst.goToday();
  expect(inst.data.dayFilter).toBe(d);
  expect(inst.data.periodMain).toBe(months[now.getMonth()]);
});

test('an empty day offers to create an experiment on it', async () => {
  const comp = await page('packages/lab/calendar/index');
  const inst = comp.instance;
  inst.setView(ev({ mode: 'month' }));
  inst.pickDay(ev({ date: day(5) }));
  await simulate.sleep(0);
  expect(text(comp)).toContain('这一天没有实验');
  inst.newEvent(ev({ date: day(5) }));
  inst.newEvent(ev({})); // header "New" uses the selected day
  inst.clearDay();
  inst.newEvent(ev({})); // … or today
  expect(navUrls()).toEqual([
    '/packages/lab/notebook/edit?date=' + day(5),
    '/packages/lab/notebook/edit?date=' + day(5),
    '/packages/lab/notebook/edit?date=' + day(0),
  ]);
});

test('opening an experiment goes to the notebook editor', async () => {
  seed([entry({ id: 'exp_1_open', date: day(1), title: 'Open me' })]);
  const comp = await page('packages/lab/calendar/index');
  comp.instance.openEvent(ev({ id: 'exp_1_open' }));
  expect(navUrls()).toEqual(['/packages/lab/notebook/edit?id=exp_1_open']);
});

test('scheduling a protocol opens a new entry from it on the chosen day', async () => {
  const comp = await page('packages/lab/calendar/index');
  const inst = comp.instance;
  inst.openSelector();
  await simulate.sleep(0);
  const picker = comp.querySelector('#protocol-picker');
  expect(picker.instance.data.rows.length).toBeGreaterThan(50);
  expect(text(comp)).toContain('从方案导入');
  picker.instance.pick(ev({ id: 'trizol_extraction' }));
  await simulate.sleep(0);
  expect(inst.data.showSelector).toBe(false);
  expect(navUrls()).toEqual(['/packages/lab/notebook/edit?date=' + day(0) + '&protocol=trizol_extraction']);

  inst.setView(ev({ mode: 'month' }));
  inst.pickDay(ev({ date: day(2) }));
  inst.onProtocolSelect({ detail: { id: 'pcr_standard' } });
  expect(navUrls()[1]).toBe('/packages/lab/notebook/edit?date=' + day(2) + '&protocol=pcr_standard');
});

test('week view lists the seven days with their experiments', async () => {
  wxMock.setStorageSync('biolab_lang', 'en');
  seed([entry({ id: 'exp_1_w', date: day(0), startTime: '11:00', title: 'Weekly check' })]);
  const comp = await page('packages/lab/calendar/index');
  const inst = comp.instance;
  inst.setView(ev({ mode: 'week' }));
  await simulate.sleep(0);
  expect(inst.data.weekDays).toHaveLength(7);
  expect(inst.data.weekDays[0].dow).toBe('calSun');
  const today = inst.data.weekDays.find((w) => w.today);
  expect(today.date).toBe(day(0));
  expect(today.rows.map((r) => r.title)).toEqual(['Weekly check']);
  expect(inst.data.periodMain).toMatch(/^\w{3} \d+ – /);
  const txt = text(comp);
  expect(txt).toContain('Weekly check');
  expect(txt).toContain('Sun');

  inst.step(ev({ dir: 1 }));
  expect(inst.data.weekDays[0].date > day(0)).toBe(true);
  expect(inst.data.weekDays.every((w) => !w.rows.length)).toBe(true);
  inst.newEvent(ev({ date: inst.data.weekDays[2].date }));
  expect(navUrls()).toEqual(['/packages/lab/notebook/edit?date=' + inst.data.weekDays[2].date]);
});

test('opens on a date passed by the notebook, with the entry highlighted', async () => {
  seed([entry({ id: 'exp_1_focus', date: '2026-03-17', title: 'St Patrick assay' })]);
  const comp = await page('packages/lab/calendar/index', { date: '2026-03-17', id: 'exp_1_focus' });
  const inst = comp.instance;
  expect(inst.data.viewMode).toBe('month');
  expect(inst.data.dayFilter).toBe('2026-03-17');
  expect(inst.data.periodMain).toBe('三月');
  expect(inst.data.periodYear).toBe('2026');
  expect(inst.data.dayRows[0]).toMatchObject({ id: 'exp_1_focus', hl: true });
  expect(inst.data.cells.find((c) => c.date === '2026-03-17').sel).toBe(true);
  expect(text(comp)).toContain('3月17日 周二');
});

test('refreshes when experiments are saved or deleted elsewhere', async () => {
  const comp = await page('packages/lab/calendar/index');
  expect(comp.instance.data.upcomingCount).toBe(0);
  const rec = experiments.save(entry({ date: day(1), title: 'Saved in the editor' }));
  await simulate.sleep(0);
  expect(comp.instance.data.upcomingCount).toBe(1);
  expect(text(comp)).toContain('Saved in the editor');
  experiments.remove(rec.id);
  await simulate.sleep(0);
  expect(comp.instance.data.upcomingCount).toBe(0);
});

test('exports an .ics file for a date range', async () => {
  seed([
    entry({ id: 'exp_1_i', date: day(1), startTime: '23:30', duration: 60, title: 'Late run, overnight', status: 'completed', plan: { objectives: 'Line 1\nLine 2', notes: '' } }),
    entry({ id: 'exp_2_i', date: day(-3), title: 'Before range' }),
    entry({ id: 'exp_3_i', date: day(20), title: 'After range' }),
  ]);
  const comp = await page('packages/lab/calendar/index');
  const inst = comp.instance;
  inst.openIcs();
  await simulate.sleep(0);
  expect(inst.data.icsFrom).toBe(day(0));
  expect(inst.data.icsCount).toBe(2);
  expect(text(comp)).toContain('范围内共 2 个实验');
  inst.onIcsTo(ev({}, day(10)));
  expect(inst.data.icsCount).toBe(1);
  inst.exportIcs();
  await simulate.sleep(0);
  const write = wxMock.__called('fs.writeFile')[0].opts;
  expect(write.filePath).toMatch(new RegExp('labmate_calendar_' + day(0) + '\\.ics$'));
  const ics = write.data;
  expect(ics).toContain('BEGIN:VCALENDAR');
  expect(ics).toContain('SUMMARY:Late run  overnight');
  expect(ics).toContain('UID:exp_1_i@labmate.bioinfospace.com');
  expect(ics).toContain('DESCRIPTION:Line 1\\nLine 2');
  expect(ics).toContain('STATUS:CONFIRMED');
  // the end rolls over to the next day
  const next = day(2).replace(/-/g, '');
  expect(ics).toContain('DTEND:' + next + 'T003000');
  expect(ics).not.toContain('Before range');
  expect(ics).not.toContain('After range');
  expect(wxMock.__called('shareFileMessage')).toHaveLength(1);
  expect(inst.data.showIcs).toBe(false);
  expect(wxMock.__called('showToast').pop().opts.title).toBe('日历已导出为 .ics');
});
