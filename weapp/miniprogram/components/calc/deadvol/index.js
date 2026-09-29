// Dead volume calculator — V × N × (1 + dead%) (web: DeadVolumeCalc.jsx).
const langBehavior = require('../../../behaviors/lang');
const { deadVolume } = require('../../../shared/calculators.js');
const { cleanNumber } = require('../shared');

const VOL_UNITS = ['µL', 'mL', 'L'];
const TICKS = [0, 10, 20, 30, 40, 50];
// `key` = translated label.
const PRESETS = [
  { id: 'pcr', label: 'PCR / qPCR', n: '24', vol: '20', unit: 'µL', dead: 15 },
  { id: 'wb', label: 'WB Loading', n: '10', vol: '25', unit: 'µL', dead: 20 },
  { id: '96well', label: '96-well plate', n: '96', vol: '200', unit: 'µL', dead: 10 },
  { id: 'transfection', key: 'calcTransfection', n: '6', vol: '500', unit: 'µL', dead: 20 },
  { id: 'mastermix', label: 'Master Mix', n: '48', vol: '50', unit: 'µL', dead: 25 },
  { id: 'custom', key: 'customPreset' },
];

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  data: {
    presets: PRESETS,
    volUnits: VOL_UNITS,
    ticks: TICKS,
    preset: 'custom',
    n: '',
    vol: '',
    volIdx: 0,
    dead: 15,
    deadLabel: '',
    has: false,
    total: '',
    totalUnit: '',
    sub1: '',
    sub2: '',
  },
  lifetimes: {
    attached() { this.recalc(); },
  },
  methods: {
    onLangChange() { this.recalc(); },

    applyPreset(e) {
      const p = PRESETS.find((x) => x.id === e.currentTarget.dataset.id);
      if (!p) return;
      if (p.id === 'custom') this.setData({ preset: 'custom' });
      else this.setData({ preset: p.id, n: p.n, vol: p.vol, volIdx: VOL_UNITS.indexOf(p.unit), dead: p.dead });
      this.recalc();
    },
    onInput(e) {
      this.setData({ [e.currentTarget.dataset.field]: cleanNumber(e.detail.value), preset: 'custom' });
      this.recalc();
    },
    onVolUnit(e) { this.setData({ volIdx: Number(e.detail.value) }); this.recalc(); },
    // Slider (live while dragging) and the ± 1 % step buttons.
    onDead(e) {
      this.setData({ dead: Number(e.detail.value), preset: 'custom' });
      this.recalc();
    },
    stepDead(e) {
      const next = Math.min(50, Math.max(0, Number(this.data.dead) + Number(e.currentTarget.dataset.step)));
      if (next === this.data.dead) return;
      this.setData({ dead: next, preset: 'custom' });
      this.recalc();
    },

    recalc() {
      const t = (k) => this.t(k);
      const unit = VOL_UNITS[this.data.volIdx];
      const n = parseFloat(this.data.n) || 0;
      const v = parseFloat(this.data.vol) || 0;
      const d = Number(this.data.dead) || 0;
      const r = deadVolume({ numSamples: n, volPerSample: v, deadPercent: d });
      const patch = {
        deadLabel: t('deadVolPercent').replace(/\s*[(（]%[)）]\s*$/, ''),
        has: !!r,
      };
      if (r) {
        const big = r.total >= 1000 && unit === 'µL';
        patch.total = big ? (r.total / 1000).toFixed(2) : r.total.toFixed(1);
        patch.totalUnit = big ? 'mL' : unit;
        patch.sub1 = t('withoutDead') + ' ' + r.base.toFixed(1) + ' ' + unit + ' · ' + t('deadVolAmount') + ' +' + r.deadAmount.toFixed(1) + ' ' + unit;
        patch.sub2 = '= ' + n + ' × ' + v + ' ' + unit + ' × (1 + ' + d + '%)';
      }
      this.setData(patch);
    },
  },
});
