// Experiment calendar (web: src/features/calendar/CalendarTab.jsx, phone layout).
//   Agenda — upcoming experiments grouped by day (the web's mobile default)
//   Month  — compact month grid with status dots; tap a day to list it
//   Week   — the web's desktop hour grid folded into seven day rows for 375 px
// Experiments open in notebook/edit (which replaces the web's quick-edit dialog);
// "New", a day's + and "From protocol" create one there on the chosen day.
// Also: .ics export over a date range. Query ?date=YYYY-MM-DD[&id=…] opens the
// month on that day with the entry highlighted (the notebook's "View in calendar").
const pageBehavior = require('../../../behaviors/page');
const bus = require('../../../lib/bus');
const experiments = require('../../../lib/experiments');
const ui = require('../../../lib/ui');
const { isoDate } = require('../../../lib/format');
const { t, tf } = require('../../../shared/i18n.js');
const nb = require('../components/nb-shared/model');

const EDIT = '/packages/lab/notebook/edit';

function byTime(a, b) { return (a.startTime || '').localeCompare(b.startTime || ''); }

// Whole weeks covering the month, padded with the neighbouring months' days.
function monthCells(cursor, byDate, today, selected) {
  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const first = new Date(y, m, 1);
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(y, m, 1 - first.getDay() + i);
    const date = nb.ymd(d);
    const list = byDate[date] || [];
    cells.push({
      date,
      day: d.getDate(),
      out: d.getMonth() !== m,
      today: date === today,
      sel: date === selected,
      n: list.length,
      dots: list.slice(0, 3).map((e, k) => ({ k, st: nb.statusOf(e) })),
    });
  }
  return cells;
}

function weekStart(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
}

function weekLabel(a, b, lang) {
  const same = a.getMonth() === b.getMonth();
  return lang === 'zh'
    ? (a.getMonth() + 1) + '月' + a.getDate() + '日 – ' + (same ? '' : (b.getMonth() + 1) + '月') + b.getDate() + '日'
    : nb.monthShort(a, lang) + ' ' + a.getDate() + ' – ' + (same ? '' : nb.monthShort(b, lang) + ' ') + b.getDate();
}

Component({
  behaviors: [pageBehavior],
  data: {
    titleKey: 'tabCalendar',
    viewMode: 'agenda', // agenda | month | week
    dayKeys: nb.DAY_KEYS,
    statuses: nb.STATUSES,
    periodMain: '',
    periodYear: '',
    cells: [],
    weekDays: [],
    dayFilter: '',
    dayLabel: '',
    dayRows: [],
    groups: [],
    upcomingCount: 0,
    upcomingLabel: '',
    showSelector: false,
    showIcs: false,
    icsFrom: '',
    icsTo: '',
    icsCount: 0,
    icsLabel: '',
  },
  lifetimes: {
    attached() {
      this._cursor = new Date();
      this._highlight = '';
      this._off = bus.on('experiments', () => this.reload());
    },
    detached() { if (this._off) this._off(); },
  },
  methods: {
    onLoad(query) {
      const q = query || {};
      if (nb.isDateStr(q.date)) this.focusDate(q.date, q.id ? nb.dec(q.id) : '', true);
    },
    // Every show: entries may have changed, and "today" may have moved on.
    onPageShow() { this.reload(); },
    onLangChange() { this.render(); },

    // Open the month on `date` with that day listed (and `id` highlighted).
    focusDate(date, id, silent) {
      if (!nb.isDateStr(date)) return;
      this._cursor = nb.parseDate(date);
      this._highlight = id || '';
      this.setData({ viewMode: 'month', dayFilter: date });
      if (!silent) this.reload();
    },

    reload() {
      this._entries = experiments.all();
      this.render();
    },

    render() {
      const lang = this.data.lang;
      const today = isoDate();
      const entries = this._entries || [];
      const byDate = {};
      entries.forEach((e) => {
        if (!e.date) return;
        (byDate[e.date] = byDate[e.date] || []).push(e);
      });
      Object.keys(byDate).forEach((k) => byDate[k].sort(byTime));
      const row = (e) => nb.calendarRow(e, lang, this._highlight);

      const upcoming = entries
        .filter((e) => e.date && e.date >= today && e.status !== 'cancelled')
        .sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b));
      const patch = {
        upcomingCount: upcoming.length,
        upcomingLabel: tf('calUpcomingN', lang, { n: upcoming.length }),
      };

      const mode = this.data.viewMode;
      const cur = this._cursor;
      if (mode === 'week') {
        const start = weekStart(cur);
        const days = [];
        for (let i = 0; i < 7; i++) days.push(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
        patch.periodMain = weekLabel(days[0], days[6], lang);
        patch.periodYear = String(days[6].getFullYear());
        patch.weekDays = days.map((d) => {
          const date = nb.ymd(d);
          return { date, dow: nb.DAY_KEYS[d.getDay()], day: d.getDate(), today: date === today, rows: (byDate[date] || []).map(row) };
        });
      } else {
        patch.periodMain = t(nb.MONTH_KEYS[cur.getMonth()], lang);
        patch.periodYear = String(cur.getFullYear());
        if (mode === 'month') patch.cells = monthCells(cur, byDate, today, this.data.dayFilter);
        const day = this.data.dayFilter;
        if (day) {
          patch.dayLabel = nb.shortDate(nb.parseDate(day), lang);
          patch.dayRows = (byDate[day] || []).map(row);
        } else {
          const groups = [];
          upcoming.forEach((e) => {
            const g = groups[groups.length - 1];
            if (g && g.date === e.date) g.rows.push(row(e));
            else {
              const short = nb.shortDate(nb.parseDate(e.date), lang);
              groups.push({
                date: e.date,
                today: e.date === today,
                label: e.date === today ? t('calToday', lang) + ' · ' + short : short,
                rows: [row(e)],
              });
            }
          });
          patch.groups = groups;
        }
      }
      this.setData(patch);
    },

    // ── Navigation ──
    setView(e) {
      const mode = e.currentTarget.dataset.mode;
      if (mode === this.data.viewMode) return;
      this._highlight = '';
      this.setData({ viewMode: mode, dayFilter: '' });
      this.render();
    },
    step(e) {
      const dir = Number(e.currentTarget.dataset.dir) || 0;
      const c = this._cursor;
      this._highlight = '';
      this._cursor = this.data.viewMode === 'week'
        ? new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7 * dir)
        : new Date(c.getFullYear(), c.getMonth() + dir, 1);
      this.setData({ dayFilter: '' });
      this.render();
    },
    goToday() {
      this._highlight = '';
      this._cursor = new Date();
      this.setData({ dayFilter: this.data.viewMode === 'month' ? isoDate() : '' });
      this.render();
    },
    pickDay(e) {
      const date = e.currentTarget.dataset.date;
      this.setData({ dayFilter: this.data.dayFilter === date ? '' : date });
      this.render();
    },
    clearDay() {
      this.setData({ dayFilter: '' });
      this.render();
    },

    // ── Experiments ──
    newEvent(e) {
      const date = (e && e.currentTarget && e.currentTarget.dataset.date) || this.data.dayFilter || isoDate();
      ui.go(EDIT + '?date=' + date);
    },
    openEvent(e) {
      ui.go(EDIT + '?id=' + encodeURIComponent(e.currentTarget.dataset.id));
    },
    openSelector() { this.setData({ showSelector: true }); },
    closeSelector() { this.setData({ showSelector: false }); },
    // Schedule a protocol: a new entry on the selected day (or today) with the
    // protocol's steps and materials, opened in the editor.
    onProtocolSelect(e) {
      this.setData({ showSelector: false });
      ui.go(EDIT + '?date=' + (this.data.dayFilter || isoDate()) + '&protocol=' + encodeURIComponent(e.detail.id));
    },

    // ── .ics export ──
    openIcs() {
      this.setData({ showIcs: true, icsFrom: isoDate(), icsTo: '' });
      this.updateIcs();
    },
    closeIcs() { this.setData({ showIcs: false }); },
    onIcsFrom(e) { this.setData({ icsFrom: e.detail.value }); this.updateIcs(); },
    onIcsTo(e) { this.setData({ icsTo: e.detail.value }); this.updateIcs(); },
    clearIcsTo() { this.setData({ icsTo: '' }); this.updateIcs(); },
    updateIcs() {
      const n = nb.icsEntries(experiments.all(), this.data.icsFrom, this.data.icsTo).length;
      this.setData({ icsCount: n, icsLabel: n === 1 ? this.t('calIcsCountOne') : this.tf('calIcsCount', { n }) });
    },
    exportIcs() {
      const from = this.data.icsFrom;
      const list = nb.icsEntries(experiments.all(), from, this.data.icsTo);
      if (!list.length) { ui.toast(this.t('calIcsNone')); return; }
      ui.shareTextFile('labmate_calendar_' + from + '.ics', nb.buildICS(list))
        .then(() => {
          this.setData({ showIcs: false });
          ui.toast(this.t('calIcsExported'));
        })
        .catch((err) => { if (!nb.isCancelError(err)) ui.toast(this.t('nbShareFailed')); });
    },
    noop() {},
  },
});
