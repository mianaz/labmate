// Move a sample to an empty position in any box (the web's MoveSampleForm):
// pick the box, then a free position from the list or by tapping the grid.
// Emits move { sampleId, boxId, position }, close.
const U = require('../../lib/utils');
const store = require('../../lib/store');
const langBehavior = require('../../../../../behaviors/lang');

function windowWidth() {
  try {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    return info.windowWidth || 375;
  } catch (err) { return 375; }
}

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  properties: {
    show: { type: Boolean, value: false },
    sampleId: { type: Number, value: 0 },
  },
  data: {
    sampleName: '', from: '', fromPos: '',
    boxOptions: [], boxIndex: 0, free: [], posIndex: 0, target: '',
    gridBox: null, gridSamples: [], avail: 343,
  },
  observers: {
    show(on) { if (on) this.init(); },
  },
  methods: {
    onLangChange() { if (this.data.show) this.init(this.data.boxOptions[this.data.boxIndex]); },
    init(keepBox) {
      const lang = this.data.lang;
      const data = store.load();
      this._data = data;
      const sample = data.samples.find((s) => s.id === this.data.sampleId);
      if (!sample) { this.setData({ boxOptions: [] }); return; }
      const perBox = {};
      data.samples.forEach((s) => { perBox[s.boxId] = (perBox[s.boxId] || 0) + 1; });
      const zh = lang === 'zh';
      const boxOptions = [];
      data.locations.forEach((loc) => {
        data.boxes.filter((b) => b.locationId === loc.id).forEach((b) => {
          const free = b.rows * b.cols - (perBox[b.id] || 0);
          boxOptions.push({
            id: b.id,
            label: U.nameOf(loc, lang) + ' › ' + U.nameOf(b, lang) + ' · ' + free + (zh ? ' 个空位' : ' free'),
          });
        });
      });
      const fromBox = data.boxes.find((b) => b.id === sample.boxId);
      const wantId = keepBox ? keepBox.id : sample.boxId;
      this.setData({
        sampleName: sample.name, from: U.nameOf(fromBox, lang), fromPos: sample.position || '',
        boxOptions, avail: windowWidth() - 32,
      });
      this.selectBox(Math.max(0, boxOptions.findIndex((o) => o.id === wantId)));
    },
    selectBox(boxIndex) {
      const opt = this.data.boxOptions[boxIndex];
      const box = opt ? this._data.boxes.find((b) => b.id === opt.id) : null;
      const samples = box ? U.boxSamples(this._data, box.id) : [];
      const free = U.freePositions(box, samples);
      this.setData({
        boxIndex, free, posIndex: 0, target: free[0] || '',
        gridBox: box ? { id: box.id, name: U.nameOf(box, this.data.lang), rows: box.rows, cols: box.cols } : null,
        gridSamples: samples.map((s) => ({ id: s.id, position: s.position, name: s.name, sampleType: s.sampleType, expiryDate: s.expiryDate })),
      });
    },
    onBox(e) { this.selectBox(Number(e.detail.value)); },
    onPos(e) {
      const posIndex = Number(e.detail.value);
      this.setData({ posIndex, target: this.data.free[posIndex] || '' });
    },
    onCell(e) {
      if (e.detail.sampleId) return;
      const posIndex = this.data.free.indexOf(e.detail.pos);
      if (posIndex >= 0) this.setData({ posIndex, target: e.detail.pos });
    },
    close() { this.triggerEvent('close'); },
    move() {
      const opt = this.data.boxOptions[this.data.boxIndex];
      if (!opt || !this.data.target) return;
      this.triggerEvent('move', { sampleId: this.data.sampleId, boxId: opt.id, position: this.data.target });
    },
  },
});
