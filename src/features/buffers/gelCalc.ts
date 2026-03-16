// ── SDS-PAGE Gel Calculator — pure logic ──

export interface GelRow {
  name: string
  vol: number
  unit: 'mL' | 'µL'
}

export const GEL_DEFAULTS = {
  resolving: {
    trisStock: 1.5,
    trisVolFrac: 0.25,
    sdsVolFrac: 0.01,
    apsVolFrac: 0.01,
    temedPerMl: 0.0006,
    acrylamideStock: 30,
  },
  stacking: {
    trisConc: 1.0,
    trisVolFrac: 0.125,
    sdsVolFrac: 0.01,
    apsVolFrac: 0.01,
    temedPerMl: 0.001,
    acrylamideStock: 30,
    percentage: 4,
  },
} as const

type GelType = 'resolving' | 'stacking'

export function calcGel(percentage: number, totalVolume: number, type: GelType = 'resolving'): GelRow[] {
  const cfg = GEL_DEFAULTS[type]
  const acryVol = (percentage / cfg.acrylamideStock) * totalVolume
  const trisVol = type === 'resolving'
    ? GEL_DEFAULTS.resolving.trisVolFrac * totalVolume
    : (0.125 / GEL_DEFAULTS.stacking.trisConc) * totalVolume
  const sdsVol = cfg.sdsVolFrac * totalVolume
  const apsVol = cfg.apsVolFrac * totalVolume
  const temedVol = cfg.temedPerMl * totalVolume
  const h2o = totalVolume - acryVol - trisVol - sdsVol - apsVol - temedVol

  return [
    { name: '30% Acrylamide/Bis', vol: acryVol, unit: 'mL' },
    { name: type === 'resolving' ? '1.5 M Tris-HCl pH 8.8' : '1.0 M Tris-HCl pH 6.8', vol: trisVol, unit: 'mL' },
    { name: '10% SDS', vol: sdsVol, unit: 'mL' },
    { name: 'ddH₂O', vol: h2o, unit: 'mL' },
    { name: '10% APS', vol: apsVol, unit: 'mL' },
    { name: 'TEMED', vol: temedVol * 1000, unit: 'µL' },
  ]
}

export const RESOLVING_PERC_OPTIONS = [6, 7.5, 8, 10, 12, 15] as const

export const MW_GUIDE = [
  { perc: '6%',   range: '60–200 kDa' },
  { perc: '7.5%', range: '40–150 kDa' },
  { perc: '8%',   range: '35–120 kDa' },
  { perc: '10%',  range: '20–80 kDa' },
  { perc: '12%',  range: '15–60 kDa' },
  { perc: '15%',  range: '10–40 kDa' },
] as const

export function gelToText(title: string, data: GelRow[]): string {
  let txt = title + '\n' + '\u2500'.repeat(50) + '\n'
  txt += 'Reagent'.padEnd(35) + 'Amount'.padStart(10) + '  Unit\n'
  txt += '\u2500'.repeat(50) + '\n'
  data.forEach(row => {
    const val = row.unit === '\u00B5L' ? row.vol.toFixed(1) : row.vol.toFixed(3)
    txt += row.name.padEnd(35) + val.padStart(10) + '  ' + row.unit + '\n'
  })
  const total = data.reduce((s, r) => s + (r.unit === '\u00B5L' ? r.vol / 1000 : r.vol), 0)
  txt += '\u2500'.repeat(50) + '\n'
  txt += 'Total'.padEnd(35) + total.toFixed(2).padStart(10) + '  mL\n'
  return txt
}

export function downloadFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
