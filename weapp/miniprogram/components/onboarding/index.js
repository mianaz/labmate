// First-run tour (the web's OnboardingModal) as a bottom sheet.
const storage = require('../../lib/storage');
const langBehavior = require('../../behaviors/lang');

const DONE_KEY = 'labmate_onboardingDone';
const SLIDES = [
  { title: 'onboardingWelcomeTitle', body: 'onboardingWelcomeBody', icon: 'i-spark' },
  { title: 'onboardingRecipesTitle', body: 'onboardingRecipesBody', icon: 'i-flask' },
  { title: 'onboardingCalcTitle', body: 'onboardingCalcBody', icon: 'i-calculator' },
  { title: 'onboardingPlateTitle', body: 'onboardingPlateBody', icon: 'i-plate' },
  { title: 'onboardingToolsTitle', body: 'onboardingToolsBody', icon: 'i-timer' },
  { title: 'onboardingNavTitle', body: 'onboardingNavBody', icon: 'i-more' },
  { title: 'onboardingPrivacyTitle', body: 'onboardingPrivacyBody', icon: 'i-shield' },
];

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  data: { open: false, step: 0, slides: SLIDES, total: SLIDES.length },
  lifetimes: {
    attached() {
      const done = storage.get(DONE_KEY, false);
      if (done !== true && done !== 'true') this.setData({ open: true });
    },
  },
  methods: {
    next() {
      if (this.data.step >= SLIDES.length - 1) { this.close(); return; }
      this.setData({ step: this.data.step + 1 });
    },
    prev() { if (this.data.step > 0) this.setData({ step: this.data.step - 1 }); },
    close() {
      storage.set(DONE_KEY, true);
      this.setData({ open: false, step: 0 });
    },
    noop() {},
  },
});
