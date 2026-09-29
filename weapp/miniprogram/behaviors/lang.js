// Gives a component `lang` ('en' | 'zh') and keeps it current. Templates use the
// WXS twin of the web's t(): <wxs module="i" src=".../shared/i18n.wxs"/> then
// {{i.t('key', lang)}}; JS uses this.t('key').
const bus = require('../lib/bus');
const { getLang } = require('../lib/lang');
const { t, tf } = require('../shared/i18n.js');

module.exports = Behavior({
  data: { lang: 'zh' },
  lifetimes: {
    attached() {
      this.setData({ lang: getLang() });
      this._offLang = bus.on('lang', (lang) => {
        this.setData({ lang });
        if (typeof this.onLangChange === 'function') this.onLangChange(lang);
      });
    },
    detached() {
      if (this._offLang) this._offLang();
    },
  },
  methods: {
    t(key) { return t(key, this.data.lang); },
    tf(key, params) { return tf(key, this.data.lang, params); },
    zh() { return this.data.lang === 'zh'; },
  },
});
