// Inventory statistics (the web's Stats dialog): totals, utilisation per
// location, samples by type, expiring / recently added, latest samples, and the
// switch for the overview strip on the inventory page. Emits close.
const U = require('../../lib/utils');
const store = require('../../lib/store');
const { t } = require('../../../../../shared/i18n.js');
const langBehavior = require('../../../../../behaviors/lang');

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    show: { type: Boolean, value: false },
  },
  data: { vm: null, dashboard: true },
  observers: {
    show(on) { if (on) this.build(); },
  },
  methods: {
    onLangChange() { if (this.data.show) this.build(); },
    build() {
      const lang = this.data.lang;
      const data = store.load();
      const hasData = data.samples.length > 0 || data.boxes.length > 0;
      if (!hasData) { this.setData({ vm: { empty: true }, dashboard: store.dashboardShown() }); return; }
      const st = U.computeStats(data);
      const days = t('invStatsDays', lang);
      const boxById = {};
      data.boxes.forEach((b) => { boxById[b.id] = b; });
      const vm = {
        empty: false,
        tiles: [
          { k: 'loc', v: data.locations.length, label: t('invStatsLocations', lang) },
          { k: 'box', v: data.boxes.length, label: t('invStatsBoxes', lang) },
          { k: 'smp', v: data.samples.length, label: t('invStatsSamples', lang) },
          { k: 'pct', v: st.utilPct + '%', label: t('invStatsUtilization', lang) },
        ],
        util: st.utilPct,
        utilTone: U.utilTone(st.utilPct),
        utilText: st.occupiedPositions + ' ' + t('invStatsOccupied', lang) + ' / ' + st.totalPositions + ' ' + t('invStatsTotal', lang) + ' (' + st.utilPct + '%)',
        locs: U.locationOccupancy(data).map((l) => {
          const pct = l.totalSlots > 0 ? Math.round(l.usedSlots / l.totalSlots * 100) : 0;
          return { id: l.id, name: U.nameOf(l, lang), used: l.usedSlots + '/' + l.totalSlots, pct, tone: U.utilTone(pct) };
        }),
        types: Object.keys(st.byType).sort((a, b) => st.byType[b] - st.byType[a]).map((tp) => ({
          type: U.normalizeSampleType(tp),
          label: t(U.typeLabelKey(tp), lang),
          n: st.byType[tp],
          pct: Math.round(st.byType[tp] / st.maxTypeCount * 100),
        })),
        expiring: [['7', st.expiring7], ['30', st.expiring30], ['90', st.expiring90]].map((x) => ({ k: x[0], label: '≤ ' + x[0] + ' ' + days, n: x[1] })),
        added: [['7', st.added7], ['30', st.added30]].map((x) => ({ k: x[0], label: '≤ ' + x[0] + ' ' + days, n: x[1] })),
        latest: data.samples.slice().sort((a, b) => (b.dateStored || 0) - (a.dateStored || 0)).slice(0, 5).map((s) => {
          const box = boxById[s.boxId];
          return {
            id: s.id, name: s.name, type: U.normalizeSampleType(s.sampleType),
            typeLabel: t(U.typeLabelKey(s.sampleType), lang),
            where: box ? U.nameOf(box, lang) + (s.position ? ' · ' + s.position : '') : '',
            date: U.isoDate(s.dateStored),
          };
        }),
      };
      this.setData({ vm, dashboard: store.dashboardShown() });
    },
    toggleDashboard() {
      const on = !this.data.dashboard;
      store.setDashboardShown(on);
      this.setData({ dashboard: on });
    },
    close() { this.triggerEvent('close'); },
  },
});
