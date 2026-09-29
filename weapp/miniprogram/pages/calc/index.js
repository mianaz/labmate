// Calculator tab (web: src/features/calc/CalcTab.jsx). A scrollable row of
// calculators — task name + formula — above the active one. The SDS-PAGE gel
// calculator, which the web only shows inside the sds_page_gel recipe, is
// offered here too. The last calculator used is remembered.
//
// Opening a given calculator from elsewhere: store its id under
// 'labmate_calcMode' and wx.switchTab here (onPageShow picks it up), or
// reLaunch with ?mode=<id>.
const pageBehavior = require('../../behaviors/page');
const storage = require('../../lib/storage');

const MODE_KEY = 'labmate_calcMode';
const DEFAULT_MODE = 'dilution';

// Same order as the web; `fkey` = translated formula.
const MODES = [
  { id: 'scientific', key: 'calcTaskScientific', formula: 'sin · log · xʸ' },
  { id: 'dilution', key: 'calcTaskDilution', formula: 'C₁V₁ = C₂V₂' },
  { id: 'mass', key: 'calcTaskMass', formula: 'm = MW × C × V' },
  { id: 'molarity', key: 'calcTaskMolarity', formula: 'C = m / (MW × V)' },
  { id: 'percent', key: 'calcTaskPercent', fkey: 'calcFormulaPercent' },
  { id: 'deadvol', key: 'calcTaskDeadVol', formula: 'V × N × (1 + dead%)' },
  { id: 'convert', key: 'calcTaskConvert', fkey: 'calcFormulaConvert' },
  { id: 'mw', key: 'calcTaskMW', formula: 'Σ(n × Aᵣ)' },
  { id: 'periodic', key: 'calcTaskPeriodic', fkey: 'calcFormulaPeriodic' },
  { id: 'gel', key: 'calcTaskGel', formula: 'Laemmli · 6–15%' },
];
const IDS = MODES.map((m) => m.id);
const isMode = (id) => IDS.indexOf(id) >= 0;

Component({
  behaviors: [pageBehavior],
  data: {
    tabIndex: 2,
    titleKey: 'tabCalc',
    modes: MODES,
    mode: DEFAULT_MODE,
    scrollTo: '',
  },
  methods: {
    onLoad(query) {
      const q = query && query.mode;
      const stored = storage.get(MODE_KEY, DEFAULT_MODE);
      this.setMode(isMode(q) ? q : (isMode(stored) ? stored : DEFAULT_MODE), true);
    },

    onPageShow() {
      const stored = storage.get(MODE_KEY, '');
      if (isMode(stored) && stored !== this.data.mode) this.setMode(stored, true);
    },

    select(e) {
      this.setMode(e.currentTarget.dataset.id, false);
    },

    // reveal: scroll the chip row so the active chip shows (with its left
    // neighbour still peeking in, so the row reads as scrollable).
    setMode(mode, reveal) {
      if (!isMode(mode)) return;
      const patch = {};
      if (mode !== this.data.mode) patch.mode = mode;
      if (reveal) {
        const i = IDS.indexOf(mode);
        patch.scrollTo = i > 0 ? 'cx-mode-' + IDS[i - 1] : '';
      }
      if (Object.keys(patch).length) this.setData(patch);
      storage.set(MODE_KEY, mode);
    },

    onShareAppMessage() {
      return { title: this.data.lang === 'zh' ? 'LabMate 计算器' : 'LabMate calculators', path: '/pages/calc/index' };
    },
  },
});
