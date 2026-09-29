// Page header — eyebrow (nav group · count), title, description, actions slot.
// Same anatomy as the web's PageHeader.jsx.
Component({
  options: { styleIsolation: 'apply-shared' },
  properties: {
    eyebrow: { type: String, value: '' },
    meta: { type: String, value: '' },
    title: { type: String, value: '' },
    desc: { type: String, value: '' },
  },
});
