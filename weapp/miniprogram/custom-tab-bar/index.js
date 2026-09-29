// Bottom navigation — mirrors the web app's phone bottom nav (BottomNav.jsx):
// the four most-used sections plus More.
const langBehavior = require('../behaviors/lang');

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  data: {
    selected: 0,
    tabs: [
      { path: '/pages/recipes/index', icon: 'i-flask', label: 'tabBuffers' },
      { path: '/pages/protocols/index', icon: 'i-clipboard', label: 'tabProtocols' },
      { path: '/pages/calc/index', icon: 'i-calculator', label: 'tabCalcShort' },
      { path: '/pages/plate/index', icon: 'i-plate', label: 'tabPlateShort' },
      { path: '/pages/more/index', icon: 'i-more', label: 'navMore' },
    ],
  },
  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index);
      const tab = this.data.tabs[index];
      if (!tab) return;
      if (index === this.data.selected) {
        // Re-tapping the current section scrolls it back to the top.
        wx.pageScrollTo({ scrollTop: 0, duration: 200 });
        return;
      }
      wx.switchTab({ url: tab.path });
    },
  },
});
