// DATA: SDS-PAGE Gel Formulas

export const GEL_DEFAULTS = {
  resolving: {
    trisStock: 1.5,    // M, pH 8.8
    trisVolFrac: 0.25, // 25% of total
    sdsVolFrac: 0.01,  // 1% of 10% SDS stock
    apsVolFrac: 0.01,  // 1% of 10% APS
    temedPerMl: 0.0006,// mL TEMED per mL gel
    acrylamideStock: 30, // % stock
  },
  stacking: {
    trisStock: 0.5,    // M, pH 6.8 (or 1.0M with 0.125 vol fraction)
    trisConc: 1.0,     // M stock concentration
    trisVolFrac: 0.125,// fraction giving 125 mM final
    sdsVolFrac: 0.01,
    apsVolFrac: 0.01,
    temedPerMl: 0.001,
    acrylamideStock: 30,
    percentage: 4,
  }
};

export function calcGel(percentage, totalVolume, type='resolving') {
  const cfg = GEL_DEFAULTS[type];
  const acryVol = (percentage / cfg.acrylamideStock) * totalVolume;
  let trisVol;
  if (type === 'resolving') {
    trisVol = cfg.trisVolFrac * totalVolume;
  } else {
    trisVol = (0.125 / cfg.trisConc) * totalVolume;
  }
  const sdsVol = cfg.sdsVolFrac * totalVolume;
  const apsVol = cfg.apsVolFrac * totalVolume;
  const temedVol = cfg.temedPerMl * totalVolume;
  const h2o = totalVolume - acryVol - trisVol - sdsVol - apsVol - temedVol;
  
  const trisLabel = type === 'resolving'
    ? '1.5 M Tris-HCl pH 8.8'
    : '1.0 M Tris-HCl pH 6.8';
  
  return [
    { name: 'ddH₂O', vol: Math.max(0, h2o), unit: 'mL' },
    { name: `30% Acrylamide/Bis (29:1)`, vol: acryVol, unit: 'mL' },
    { name: trisLabel, vol: trisVol, unit: 'mL' },
    { name: '10% SDS', vol: sdsVol, unit: 'mL' },
    { name: '10% APS (新鲜配制)', vol: apsVol, unit: 'mL' },
    { name: 'TEMED', vol: temedVol * 1000, unit: 'µL' },
  ];
}
