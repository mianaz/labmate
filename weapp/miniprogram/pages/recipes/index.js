const pageBehavior = require('../../behaviors/page');

Component({
  behaviors: [pageBehavior],
  data: { tabIndex: 0, titleKey: 'tabBuffers' },
  methods: {
    onShareAppMessage() {
      return { title: this.data.lang === 'zh' ? 'LabMate 配方库' : 'LabMate recipes', path: '/pages/recipes/index' };
    },
  },
});
