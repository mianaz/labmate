const pageBehavior = require('../../behaviors/page');

Component({
  behaviors: [pageBehavior],
  data: { tabIndex: 1, titleKey: 'tabProtocols' },
  methods: {
    onShareAppMessage() {
      return { title: this.data.lang === 'zh' ? 'LabMate 实验方案' : 'LabMate protocols', path: '/pages/protocols/index' };
    },
  },
});
