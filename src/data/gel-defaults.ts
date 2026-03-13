// SDS-PAGE Gel Calculator defaults (v1.9.2)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GEL_DEFAULTS: Record<string, any> = {
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
