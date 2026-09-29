// Bottom sheet used by every inventory form (the web's InvModal): mask, sticky
// head (title · meta · close), scrolling body (default slot), footer (slot "foot").
const langBehavior = require('../../../../../behaviors/lang');

Component({
  options: { styleIsolation: 'apply-shared', multipleSlots: true },
  behaviors: [langBehavior],
  properties: {
    show: { type: Boolean, value: false },
    title: { type: String, value: '' },
    meta: { type: String, value: '' },
    badge: { type: String, value: '' },
    tall: { type: Boolean, value: false },
    foot: { type: Boolean, value: true },
  },
  methods: {
    close() { this.triggerEvent('close'); },
    noop() {},
  },
});
