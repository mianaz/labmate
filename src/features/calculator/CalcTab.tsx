import { useState } from 'react'
import { useTranslation } from 'react-i18next'

// ─── Types ───────────────────────────────────────────────────────────────────

type CalcMode = 'dilution' | 'mass' | 'molarity' | 'percent' | 'deadvol' | 'convert'

type DilutionSolveFor = 'c1' | 'v1' | 'c2' | 'v2'
type ConcUnit = 'M' | 'mM' | 'µM' | 'nM' | '%'
type VolUnit = 'L' | 'mL' | 'µL'
type MassUnit = 'g' | 'mg' | 'µg'
type PercentMode = 'wv' | 'vv'
type PercentSolveFor = 'solute' | 'vol' | 'perc'

// ─── CalcTab (root) ───────────────────────────────────────────────────────────

export default function CalcTab() {
  const { t } = useTranslation()
  const [mode, setMode] = useState<CalcMode>('dilution')

  const modes: Array<{ id: CalcMode; task: string; formula: string }> = [
    { id: 'dilution', task: t('calc.taskDilution'), formula: 'C₁V₁ = C₂V₂' },
    { id: 'mass',     task: t('calc.taskMass'),     formula: 'm = MW × C × V' },
    { id: 'molarity', task: t('calc.taskMolarity'), formula: 'M = m / (MW × V)' },
    { id: 'percent',  task: t('calc.taskPercent'),  formula: '% (w/v) or (v/v)' },
    { id: 'deadvol',  task: t('calc.taskDeadVol'),  formula: 'V × N × (1 + dead%)' },
    { id: 'convert',  task: t('calc.taskConvert'),   formula: 'Unit \u2194 Unit' },
  ]

  return (
    <div>
      {/* Mode selector card */}
      <div className="card p-5 mb-6">
        <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-heading)' }}>
          {t('calc.title')}
        </h2>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {t('calc.subtitle')}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              className="p-3 rounded-lg text-left transition-all"
              style={{
                background: mode === m.id ? 'var(--color-primary)' : 'var(--color-bg-card)',
                color: mode === m.id ? 'var(--color-text-inverse)' : 'var(--color-text)',
                border: `1px solid ${mode === m.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
                boxShadow: mode === m.id ? 'var(--shadow-md)' : 'none',
              }}
            >
              <span className="text-sm font-semibold block">{m.task}</span>
              <span
                className="text-xs block mt-1"
                style={{ fontFamily: 'var(--font-mono)', opacity: 0.65 }}
              >
                {m.formula}
              </span>
            </button>
          ))}
        </div>
      </div>

      {mode === 'dilution' && <DilutionCalc />}
      {mode === 'mass'     && <MassCalc />}
      {mode === 'molarity' && <MolarityCalc />}
      {mode === 'percent'  && <PercentCalc />}
      {mode === 'deadvol'  && <DeadVolumeCalc />}
      {mode === 'convert'  && <UnitConversionCalc />}
    </div>
  )
}

// ─── Shared InputRow (used by DilutionCalc) ─────────────────────────────────

interface InputRowProps {
  label: string
  value: string
  setValue: (v: string) => void
  unit: string
  setUnit: (u: string) => void
  units: readonly string[]
  isSolveTarget: boolean
}

function InputRow({ label, value, setValue, unit, setUnit, units, isSolveTarget }: InputRowProps) {
  const inputStyle = {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text)',
    padding: '0.375rem 0.5rem',
    fontSize: '0.875rem',
    width: '100%',
  }

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-lg"
      style={{
        background: isSolveTarget
          ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
          : 'var(--color-bg)',
        border: isSolveTarget
          ? '2px solid var(--color-primary)'
          : '1px solid var(--color-border)',
      }}
    >
      <span
        className="text-sm font-bold w-8 text-center"
        style={{
          fontFamily: 'var(--font-mono)',
          color: isSolveTarget ? 'var(--color-primary)' : 'var(--color-text)',
        }}
      >
        {label}
      </span>
      <input
        type="number"
        value={isSolveTarget ? '' : value}
        onChange={e => setValue(e.target.value)}
        disabled={isSolveTarget}
        placeholder={isSolveTarget ? '← solving' : '0'}
        step="any"
        className="flex-1"
        style={{
          ...inputStyle,
          opacity: isSolveTarget ? 0.5 : 1,
        }}
      />
      <select
        value={unit}
        onChange={e => setUnit(e.target.value)}
        className="w-20"
        style={{ ...inputStyle, width: '5rem', padding: '0.375rem 0.25rem' }}
      >
        {units.map(u => <option key={u} value={u}>{u}</option>)}
      </select>
    </div>
  )
}

// ─── Dilution Calculator ──────────────────────────────────────────────────────

function DilutionCalc() {
  const { t } = useTranslation()
  const [c1, setC1] = useState('')
  const [v1, setV1] = useState('')
  const [c2, setC2] = useState('')
  const [v2, setV2] = useState('')
  const [solve, setSolve] = useState<DilutionSolveFor>('v1')
  const [c1Unit, setC1Unit] = useState<ConcUnit>('M')
  const [v1Unit, setV1Unit] = useState<VolUnit>('mL')
  const [c2Unit, setC2Unit] = useState<ConcUnit>('M')
  const [v2Unit, setV2Unit] = useState<VolUnit>('mL')

  const unitFactorsC: Record<ConcUnit, number> = { M: 1, mM: 1e-3, µM: 1e-6, nM: 1e-9, '%': 1 }
  const unitFactorsV: Record<VolUnit, number> = { L: 1, mL: 1e-3, µL: 1e-6 }

  const concUnits: ConcUnit[] = ['M', 'mM', 'µM', 'nM', '%']
  const volUnits: VolUnit[] = ['L', 'mL', 'µL']

  function calculate(): { val: number; unit: string; label: string } | null {
    const C1 = +c1 * unitFactorsC[c1Unit]
    const V1 = +v1 * unitFactorsV[v1Unit]
    const C2 = +c2 * unitFactorsC[c2Unit]
    const V2 = +v2 * unitFactorsV[v2Unit]

    if (solve === 'v1' && C1 && C2 && V2) return { val: (C2 * V2) / C1 / unitFactorsV[v1Unit], unit: v1Unit, label: 'V₁' }
    if (solve === 'c1' && V1 && C2 && V2) return { val: (C2 * V2) / V1 / unitFactorsC[c1Unit], unit: c1Unit, label: 'C₁' }
    if (solve === 'v2' && C1 && V1 && C2) return { val: (C1 * V1) / C2 / unitFactorsV[v2Unit], unit: v2Unit, label: 'V₂' }
    if (solve === 'c2' && C1 && V1 && V2) return { val: (C1 * V1) / V2 / unitFactorsC[c2Unit], unit: c2Unit, label: 'C₂' }
    return null
  }

  const result = calculate()

  return (
    <div className="card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-lg font-bold">{t('calc.dilutionFormula')}</h3>
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <span style={{ color: 'var(--color-text-muted)' }}>{t('calc.solveFor')}:</span>
          {(['c1', 'v1', 'c2', 'v2'] as DilutionSolveFor[]).map(s => (
            <button
              key={s}
              onClick={() => setSolve(s)}
              className="px-2.5 py-1 rounded-md font-bold text-xs transition-all"
              style={{
                fontFamily: 'var(--font-mono)',
                background: solve === s ? 'var(--color-primary)' : 'var(--color-bg)',
                color: solve === s ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                border: `1px solid ${solve === s ? 'var(--color-primary)' : 'var(--color-border)'}`,
              }}
            >
              {s === 'c1' ? 'C₁' : s === 'v1' ? 'V₁' : s === 'c2' ? 'C₂' : 'V₂'}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <InputRow label="C₁" value={c1} setValue={setC1} unit={c1Unit} setUnit={u => setC1Unit(u as ConcUnit)} units={concUnits} isSolveTarget={solve === 'c1'} />
        <InputRow label="V₁" value={v1} setValue={setV1} unit={v1Unit} setUnit={u => setV1Unit(u as VolUnit)} units={volUnits} isSolveTarget={solve === 'v1'} />
        <div
          className="text-center text-lg"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-border)' }}
        >=</div>
        <InputRow label="C₂" value={c2} setValue={setC2} unit={c2Unit} setUnit={u => setC2Unit(u as ConcUnit)} units={concUnits} isSolveTarget={solve === 'c2'} />
        <InputRow label="V₂" value={v2} setValue={setV2} unit={v2Unit} setUnit={u => setV2Unit(u as VolUnit)} units={volUnits} isSolveTarget={solve === 'v2'} />
      </div>

      {result && (
        <div
          className="mt-4 p-4 rounded-lg text-center"
          style={{
            background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
            border: '2px solid var(--color-primary)',
          }}
        >
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{t('calc.result')}</p>
          <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
            {result.label} = {result.val < 0.001 ? result.val.toExponential(3) : result.val.toFixed(4)} {result.unit}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Mass Calculator ──────────────────────────────────────────────────────────

const COMMON_MW = [
  { name: 'NaCl',            mw: 58.44 },
  { name: 'KCl',             mw: 74.55 },
  { name: 'CaCl₂',          mw: 110.98 },
  { name: 'MgCl₂',          mw: 95.21 },
  { name: 'Tris base',       mw: 121.14 },
  { name: 'Tris-HCl',        mw: 157.60 },
  { name: 'EDTA-Na₂',        mw: 372.24 },
  { name: 'HEPES',           mw: 238.30 },
  { name: 'SDS',             mw: 288.38 },
  { name: 'BSA',             mw: 66430 },
  { name: 'Glycine',         mw: 75.03 },
  { name: 'DTT',             mw: 154.25 },
  { name: 'PMSF',            mw: 174.19 },
  { name: 'Glucose',         mw: 180.16 },
  { name: 'Sucrose',         mw: 342.30 },
  { name: 'Na₂HPO₄',        mw: 141.96 },
  { name: 'KH₂PO₄',         mw: 136.09 },
  { name: 'NaOH',            mw: 40.00 },
  { name: 'HCl',             mw: 36.46 },
  { name: 'Acetic acid',     mw: 60.05 },
  { name: 'Ethanol',         mw: 46.07 },
  { name: 'Methanol',        mw: 32.04 },
  { name: 'IPTG',            mw: 238.31 },
  { name: 'Ampicillin',      mw: 349.41 },
  { name: 'Kanamycin',       mw: 484.50 },
  { name: 'Puromycin',       mw: 471.51 },
  { name: 'Doxycycline',     mw: 444.43 },
] as const

function MassCalc() {
  const { t } = useTranslation()
  const [mw, setMw] = useState('')
  const [conc, setConc] = useState('')
  const [vol, setVol] = useState('')
  const [concUnit, setConcUnit] = useState<'M' | 'mM' | 'µM'>('M')
  const [volUnit, setVolUnit] = useState<VolUnit>('mL')

  const concFactors: Record<'M' | 'mM' | 'µM', number> = { M: 1, mM: 1e-3, µM: 1e-6 }
  const volFactors: Record<VolUnit, number> = { L: 1, mL: 1e-3, µL: 1e-6 }

  const mass = (+mw && +conc && +vol)
    ? +mw * (+conc * concFactors[concUnit]) * (+vol * volFactors[volUnit])
    : null

  function formatMass(g: number): { val: string; unit: string } {
    if (g >= 1)    return { val: g.toFixed(4),          unit: 'g' }
    if (g >= 1e-3) return { val: (g * 1e3).toFixed(4),  unit: 'mg' }
    return           { val: (g * 1e6).toFixed(4),        unit: 'µg' }
  }

  const inputStyle = {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text)',
    padding: '0.375rem 0.5rem',
    fontSize: '0.875rem',
    width: '100%',
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-2 card p-6">
        <h3 className="text-lg font-bold mb-1">{t('calc.massCalcTitle')}</h3>
        <p
          className="text-xs mb-4"
          style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
        >
          {t('calc.massFormula')}
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('calc.mwLabel')}
            </label>
            <input
              type="number"
              value={mw}
              onChange={e => setMw(e.target.value)}
              placeholder="e.g. 58.44 (NaCl)"
              step="any"
              style={inputStyle}
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                {t('calc.targetConc')} C
              </label>
              <input type="number" value={conc} onChange={e => setConc(e.target.value)} placeholder="0" step="any" style={inputStyle} />
            </div>
            <div className="w-24">
              <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                {t('calc.unit')}
              </label>
              <select
                value={concUnit}
                onChange={e => setConcUnit(e.target.value as 'M' | 'mM' | 'µM')}
                style={{ ...inputStyle, padding: '0.375rem 0.25rem' }}
              >
                <option>M</option><option>mM</option><option>µM</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                {t('calc.targetVol')} V
              </label>
              <input type="number" value={vol} onChange={e => setVol(e.target.value)} placeholder="0" step="any" style={inputStyle} />
            </div>
            <div className="w-24">
              <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
                {t('calc.unit')}
              </label>
              <select
                value={volUnit}
                onChange={e => setVolUnit(e.target.value as VolUnit)}
                style={{ ...inputStyle, padding: '0.375rem 0.25rem' }}
              >
                <option>L</option><option>mL</option><option>µL</option>
              </select>
            </div>
          </div>
        </div>

        {mass !== null && (
          <div
            className="mt-5 p-4 rounded-lg text-center"
            style={{
              background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
              border: '2px solid var(--color-primary)',
            }}
          >
            <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>{t('calc.massNeededLabel')}</p>
            <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
              {formatMass(mass).val} {formatMass(mass).unit}
            </p>
            <p
              className="text-xs mt-1"
              style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
            >
              = {mass.toExponential(4)} g
            </p>
          </div>
        )}
      </div>

      <div className="card p-5 h-fit">
        <h4 className="text-sm font-bold mb-3">{t('calc.commonMW')}</h4>
        <div className="overflow-y-auto space-y-0" style={{ maxHeight: '420px' }}>
          {COMMON_MW.map(c => (
            <button
              key={c.name}
              onClick={() => setMw(c.mw.toString())}
              className="w-full flex items-center justify-between py-1.5 px-2 text-xs rounded transition-colors"
              style={{ color: 'var(--color-text)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'color-mix(in srgb, var(--color-primary) 10%, transparent)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span className="font-medium">{c.name}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                {c.mw}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Molarity Calculator ──────────────────────────────────────────────────────

function MolarityCalc() {
  const { t } = useTranslation()
  const [mass, setMass] = useState('')
  const [mw, setMw] = useState('')
  const [vol, setVol] = useState('')
  const [massUnit, setMassUnit] = useState<MassUnit>('g')
  const [volUnit, setVolUnit] = useState<VolUnit>('mL')

  const massFactors: Record<MassUnit, number> = { g: 1, mg: 1e-3, µg: 1e-6 }
  const volFactors: Record<VolUnit, number> = { L: 1, mL: 1e-3, µL: 1e-6 }

  const molarity = (+mass && +mw && +vol)
    ? (+mass * massFactors[massUnit]) / +mw / (+vol * volFactors[volUnit])
    : null

  function formatConc(M: number): { val: string; unit: string } {
    if (M >= 1)    return { val: M.toFixed(4),          unit: 'M' }
    if (M >= 1e-3) return { val: (M * 1e3).toFixed(4),  unit: 'mM' }
    if (M >= 1e-6) return { val: (M * 1e6).toFixed(4),  unit: 'µM' }
    return           { val: (M * 1e9).toFixed(4),        unit: 'nM' }
  }

  const inputStyle = {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text)',
    padding: '0.375rem 0.5rem',
    fontSize: '0.875rem',
    width: '100%',
  }

  return (
    <div className="card p-6 max-w-2xl">
      <h3 className="text-lg font-bold mb-1">{t('calc.molarityCalcTitle')}</h3>
      <p
        className="text-xs mb-4"
        style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}
      >
        {t('calc.molarityFormula')}
      </p>

      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('calc.measuredMass')} m
            </label>
            <input type="number" value={mass} onChange={e => setMass(e.target.value)} placeholder="0" step="any" style={inputStyle} />
          </div>
          <div className="w-24">
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('calc.unit')}
            </label>
            <select
              value={massUnit}
              onChange={e => setMassUnit(e.target.value as MassUnit)}
              style={{ ...inputStyle, padding: '0.375rem 0.25rem' }}
            >
              <option>g</option><option>mg</option><option>µg</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('calc.mwLabel')}
          </label>
          <input type="number" value={mw} onChange={e => setMw(e.target.value)} placeholder="e.g. 58.44" step="any" style={inputStyle} />
        </div>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('calc.solnVolume')} V
            </label>
            <input type="number" value={vol} onChange={e => setVol(e.target.value)} placeholder="0" step="any" style={inputStyle} />
          </div>
          <div className="w-24">
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('calc.unit')}
            </label>
            <select
              value={volUnit}
              onChange={e => setVolUnit(e.target.value as VolUnit)}
              style={{ ...inputStyle, padding: '0.375rem 0.25rem' }}
            >
              <option>L</option><option>mL</option><option>µL</option>
            </select>
          </div>
        </div>
      </div>

      {molarity !== null && (
        <div
          className="mt-5 p-4 rounded-lg text-center"
          style={{
            background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)',
            border: '2px solid var(--color-accent)',
          }}
        >
          <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>{t('calc.molConc')}</p>
          <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-accent)' }}>
            {formatConc(molarity).val} {formatConc(molarity).unit}
          </p>
          <p className="text-xs mt-1" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)' }}>
            = {molarity.toExponential(4)} M
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Percent Calculator ───────────────────────────────────────────────────────

function PercentCalc() {
  const { t } = useTranslation()
  const [solute, setSolute] = useState('')
  const [vol, setVol] = useState('')
  const [perc, setPerc] = useState('')
  const [mode, setMode] = useState<PercentMode>('wv')
  const [solve, setSolve] = useState<PercentSolveFor>('solute')

  let result: { val: number; label: string; unit: string } | null = null
  if (solve === 'solute' && +vol && +perc) {
    result = {
      val: (+perc / 100) * +vol,
      label: mode === 'wv' ? t('calc.soluteMass') : t('calc.soluteVol'),
      unit: mode === 'wv' ? 'g' : 'mL',
    }
  } else if (solve === 'vol' && +solute && +perc) {
    result = { val: +solute / (+perc / 100), label: t('calc.finalVol'), unit: 'mL' }
  } else if (solve === 'perc' && +solute && +vol) {
    result = { val: (+solute / +vol) * 100, label: t('calc.percentConc'), unit: '%' }
  }

  const solveOptions = [
    { id: 'solute' as PercentSolveFor, label: mode === 'wv' ? t('calc.soluteG') : t('calc.soluteML') },
    { id: 'vol'    as PercentSolveFor, label: t('calc.volML') },
    { id: 'perc'   as PercentSolveFor, label: t('calc.pctLabel') },
  ]

  function fieldStyle(fieldSolve: PercentSolveFor) {
    return {
      background: solve === fieldSolve
        ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)'
        : 'var(--color-bg)',
      border: solve === fieldSolve
        ? '2px solid var(--color-primary)'
        : '1px solid var(--color-border)',
      borderRadius: 'var(--radius-sm)',
      padding: '0.75rem',
    }
  }

  const inputStyle = {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text)',
    padding: '0.375rem 0.5rem',
    fontSize: '0.875rem',
    width: '100%',
  }

  return (
    <div className="card p-6 max-w-2xl">
      <h3 className="text-lg font-bold mb-1">{t('calc.percentCalcTitle')}</h3>

      {/* Mode: w/v vs v/v */}
      <div className="flex gap-3 mb-4">
        {(['wv', 'vv'] as PercentMode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className="px-4 py-1.5 rounded-lg text-sm font-semibold"
            style={{
              background: mode === m ? 'var(--color-primary)' : 'var(--color-bg)',
              color: mode === m ? 'var(--color-text-inverse)' : 'var(--color-text-muted)',
              border: `1px solid ${mode === m ? 'var(--color-primary)' : 'var(--color-border)'}`,
            }}
          >
            {m === 'wv' ? t('calc.wv') : t('calc.vv')}
          </button>
        ))}
      </div>

      {/* Solve-for selector */}
      <div className="flex gap-2 mb-4 text-xs flex-wrap">
        <span style={{ color: 'var(--color-text-muted)' }}>{t('calc.solveFor')}:</span>
        {solveOptions.map(s => (
          <button
            key={s.id}
            onClick={() => setSolve(s.id)}
            className="px-2.5 py-1 rounded-md font-bold"
            style={{
              background: solve === s.id ? 'var(--color-primary)' : 'var(--color-bg)',
              color: solve === s.id ? 'var(--color-text-inverse)' : 'var(--color-text-muted)',
              border: `1px solid ${solve === s.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {/* % concentration field */}
        <div style={fieldStyle('perc')}>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('calc.percentConc')}
          </label>
          {solve === 'perc' ? (
            result && (
              <p
                className="text-2xl font-bold text-center"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}
              >
                {result.val.toFixed(4)} %
              </p>
            )
          ) : (
            <input type="number" value={perc} onChange={e => setPerc(e.target.value)} placeholder="e.g. 10" step="any" style={inputStyle} />
          )}
        </div>

        {/* Solute field */}
        <div style={fieldStyle('solute')}>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
            {mode === 'wv' ? t('calc.soluteMass') : t('calc.soluteVol')}
          </label>
          {solve === 'solute' ? (
            result && (
              <p
                className="text-2xl font-bold text-center"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}
              >
                {result.val.toFixed(4)} {result.unit}
              </p>
            )
          ) : (
            <input type="number" value={solute} onChange={e => setSolute(e.target.value)} placeholder="0" step="any" style={inputStyle} />
          )}
        </div>

        {/* Volume field */}
        <div style={fieldStyle('vol')}>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('calc.finalVol')}
          </label>
          {solve === 'vol' ? (
            result && (
              <p
                className="text-2xl font-bold text-center"
                style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}
              >
                {result.val.toFixed(4)} mL
              </p>
            )
          ) : (
            <input type="number" value={vol} onChange={e => setVol(e.target.value)} placeholder="0" step="any" style={inputStyle} />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Dead Volume Calculator ───────────────────────────────────────────────────

interface DeadVolPreset {
  id: string
  label: string
  n: string
  vol: string
  unit: VolUnit
  dead: string
}

function DeadVolumeCalc() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  const [nSamples, setNSamples] = useState('')
  const [volPer, setVolPer] = useState('')
  const [volUnit, setVolUnit] = useState<VolUnit>('µL')
  const [deadPct, setDeadPct] = useState('15')
  const [preset, setPreset] = useState('custom')

  const presets: DeadVolPreset[] = [
    { id: 'pcr',         label: 'PCR / qPCR',                                     n: '24', vol: '20',  unit: 'µL', dead: '15' },
    { id: 'wb',          label: 'WB Loading',                                      n: '10', vol: '25',  unit: 'µL', dead: '20' },
    { id: '96well',      label: '96-well plate',                                   n: '96', vol: '200', unit: 'µL', dead: '10' },
    { id: 'transfection', label: lang === 'zh' ? '转染' : 'Transfection',          n: '6',  vol: '500', unit: 'µL', dead: '20' },
    { id: 'mastermix',   label: 'Master Mix',                                      n: '48', vol: '50',  unit: 'µL', dead: '25' },
    { id: 'custom',      label: t('calc.customPreset'),                            n: '',   vol: '',    unit: 'µL', dead: '15' },
  ]

  function applyPreset(p: DeadVolPreset) {
    setPreset(p.id)
    if (p.id !== 'custom') {
      setNSamples(p.n)
      setVolPer(p.vol)
      setVolUnit(p.unit)
      setDeadPct(p.dead)
    }
  }

  const n = parseFloat(nSamples) || 0
  const v = parseFloat(volPer) || 0
  const d = parseFloat(deadPct) || 0
  const base = n * v
  const deadAmt = base * (d / 100)
  const total = base + deadAmt
  const hasResult = n > 0 && v > 0

  const displayTotal = total >= 1000 && volUnit === 'µL'
    ? { val: (total / 1000).toFixed(2), unit: 'mL' }
    : { val: total.toFixed(1), unit: volUnit }

  const inputStyle = {
    background: 'var(--color-bg-card)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text)',
    padding: '0.375rem 0.5rem',
    fontSize: '0.875rem',
    width: '100%',
  }

  return (
    <div className="card p-6 max-w-2xl">
      <h3 className="text-lg font-bold mb-1">{t('calc.deadVolTitle')}</h3>
      <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
        {t('calc.deadVolSubtitle')}
      </p>

      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--color-text-muted)' }}>
        {t('calc.presets')}
      </p>
      <div className="flex flex-wrap gap-2 mb-5">
        {presets.map(p => (
          <button
            key={p.id}
            onClick={() => applyPreset(p)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: preset === p.id ? 'var(--color-primary)' : 'var(--color-bg)',
              color: preset === p.id ? 'var(--color-text-inverse)' : 'var(--color-text-muted)',
              border: `1px solid ${preset === p.id ? 'var(--color-primary)' : 'var(--color-border)'}`,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div className="p-3 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('calc.numSamples')}
          </label>
          <input
            type="number"
            value={nSamples}
            onChange={e => { setNSamples(e.target.value); setPreset('custom') }}
            placeholder="e.g. 24"
            min="1"
            step="1"
            style={inputStyle}
          />
        </div>

        <div className="flex gap-3">
          <div className="flex-1 p-3 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('calc.volPerSample')}
            </label>
            <input
              type="number"
              value={volPer}
              onChange={e => { setVolPer(e.target.value); setPreset('custom') }}
              placeholder="e.g. 200"
              min="0"
              step="any"
              style={inputStyle}
            />
          </div>
          <div className="w-24 p-3 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
              {t('calc.unit')}
            </label>
            <select
              value={volUnit}
              onChange={e => setVolUnit(e.target.value as VolUnit)}
              style={{ ...inputStyle, padding: '0.375rem 0.25rem' }}
            >
              <option value="µL">µL</option>
              <option value="mL">mL</option>
              <option value="L">L</option>
            </select>
          </div>
        </div>

        <div className="p-3 rounded-lg" style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)' }}>
            {t('calc.deadVolPercent')}:{' '}
            <span className="font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
              {deadPct}%
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="50"
            step="1"
            value={deadPct}
            onChange={e => { setDeadPct(e.target.value); setPreset('custom') }}
            className="w-full"
            style={{ accentColor: 'var(--color-primary)' }}
          />
          <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
            <span>0%</span><span>10%</span><span>20%</span><span>30%</span><span>50%</span>
          </div>
        </div>
      </div>

      {hasResult && (
        <div
          className="mt-5 p-4 rounded-xl"
          style={{
            background: 'color-mix(in srgb, var(--color-primary) 12%, transparent)',
            border: '2px solid var(--color-primary)',
          }}
        >
          <p className="text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>{t('calc.totalNeeded')}</p>
          <p className="text-3xl font-bold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-primary)' }}>
            {displayTotal.val} {displayTotal.unit}
          </p>
          <div className="flex gap-4 mt-2 text-xs flex-wrap" style={{ color: 'var(--color-text-muted)' }}>
            <span>
              {t('calc.withoutDead')}:{' '}
              <span className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>{base.toFixed(1)} {volUnit}</span>
            </span>
            <span>
              {t('calc.deadVolAmount')}:{' '}
              <span className="font-bold" style={{ fontFamily: 'var(--font-mono)' }}>+{deadAmt.toFixed(1)} {volUnit}</span>
            </span>
          </div>
          <p className="text-xs mt-2 italic" style={{ color: 'var(--color-text-muted)' }}>
            = {n} × {v} {volUnit} × (1 + {d}%)
          </p>
        </div>
      )}

      <div
        className="mt-4 p-3 rounded-lg text-xs"
        style={{
          background: 'color-mix(in srgb, var(--color-accent) 10%, transparent)',
          color: 'var(--color-accent)',
          border: '1px solid color-mix(in srgb, var(--color-accent) 30%, transparent)',
        }}
      >
        {t('calc.deadVolTip')}
      </div>
    </div>
  )
}

// ─── Unit Conversion Calculator ─────────────────────────────────────────────

interface ConversionCategory {
  labelKey: string
  units: string[]
  toBase?: Record<string, number>
  convert?: (val: number, from: string, to: string) => number
}

const UNIT_CATEGORIES: Record<string, ConversionCategory> = {
  volume: {
    labelKey: 'calc.convertCatVolume',
    units: ['L', 'mL', '\u00B5L', 'nL', 'fl oz', 'cup', 'pt', 'qt', 'gal'],
    toBase: { L: 1, mL: 1e-3, '\u00B5L': 1e-6, nL: 1e-9, 'fl oz': 0.0295735, cup: 0.236588, pt: 0.473176, qt: 0.946353, gal: 3.78541 },
  },
  mass: {
    labelKey: 'calc.convertCatMass',
    units: ['kg', 'g', 'mg', '\u00B5g', 'ng', 'lb', 'oz'],
    toBase: { kg: 1000, g: 1, mg: 1e-3, '\u00B5g': 1e-6, ng: 1e-9, lb: 453.592, oz: 28.3495 },
  },
  length: {
    labelKey: 'calc.convertCatLength',
    units: ['m', 'cm', 'mm', '\u00B5m', 'nm', 'in', 'ft', 'yd'],
    toBase: { m: 1, cm: 0.01, mm: 0.001, '\u00B5m': 1e-6, nm: 1e-9, in: 0.0254, ft: 0.3048, yd: 0.9144 },
  },
  temperature: {
    labelKey: 'calc.convertCatTemp',
    units: ['\u00B0C', '\u00B0F', 'K'],
    convert: (val, from, to) => {
      let c: number
      if (from === '\u00B0C') c = val
      else if (from === '\u00B0F') c = (val - 32) * 5 / 9
      else c = val - 273.15
      if (to === '\u00B0C') return c
      if (to === '\u00B0F') return c * 9 / 5 + 32
      return c + 273.15
    },
  },
  pressure: {
    labelKey: 'calc.convertCatPressure',
    units: ['atm', 'Pa', 'kPa', 'bar', 'psi', 'mmHg', 'Torr'],
    toBase: { atm: 1, Pa: 9.8692e-6, kPa: 0.00986923, bar: 0.986923, psi: 0.068046, mmHg: 0.00131579, Torr: 0.00131579 },
  },
}

function UnitConversionCalc() {
  const { t } = useTranslation()
  const [cat, setCat] = useState('volume')
  const [fromUnit, setFromUnit] = useState('mL')
  const [toUnit, setToUnit] = useState('\u00B5L')
  const [value, setValue] = useState('')

  const catData = UNIT_CATEGORIES[cat]
  const numVal = parseFloat(value)
  let result: number | null = null
  if (!isNaN(numVal) && value !== '') {
    if (catData.convert) {
      result = catData.convert(numVal, fromUnit, toUnit)
    } else if (catData.toBase) {
      result = numVal * catData.toBase[fromUnit] / catData.toBase[toUnit]
    }
  }

  function fmt(n: number | null) {
    if (n === null || n === undefined) return '\u2014'
    if (Math.abs(n) < 0.0001 && n !== 0) return n.toExponential(4)
    if (Math.abs(n) >= 1e7) return n.toExponential(4)
    return parseFloat(n.toPrecision(8)).toString()
  }

  return (
    <div className="fade-in">
      <div className="card p-5">
        <h3 className="text-sm font-bold mb-1">{t('calc.taskConvert')}</h3>
        <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
          {t('calc.convertSubtitle')}
        </p>

        {/* Category pills */}
        <div className="mb-4">
          <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
            {t('calc.convertCategory')}
          </label>
          <div className="flex gap-1.5 flex-wrap">
            {Object.keys(UNIT_CATEGORIES).map(k => (
              <button
                key={k}
                onClick={() => { setCat(k); setFromUnit(UNIT_CATEGORIES[k].units[0]); setToUnit(UNIT_CATEGORIES[k].units[1]); setValue('') }}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: cat === k ? 'var(--color-primary)' : 'var(--color-bg-card)',
                  color: cat === k ? 'white' : 'var(--color-text-muted)',
                  border: `1px solid ${cat === k ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  cursor: 'pointer',
                }}
              >
                {t(UNIT_CATEGORIES[k].labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Conversion inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {t('calc.convertFrom')}
            </label>
            <div className="flex gap-2">
              <input
                type="number" value={value} onChange={e => setValue(e.target.value)}
                placeholder="0" step="any"
                className="flex-1"
                style={{
                  padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--color-border)', background: 'var(--color-bg)',
                  color: 'var(--color-text)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem',
                }}
              />
              <select
                value={fromUnit} onChange={e => setFromUnit(e.target.value)}
                style={{
                  width: '4.5rem', flexShrink: 0, padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)', color: 'var(--color-text)',
                  fontFamily: 'var(--font-mono)', fontSize: '0.875rem',
                }}
              >
                {catData.units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-center text-lg" style={{ color: 'var(--color-text-muted)' }}>
            &rarr;
          </div>

          <div>
            <label className="text-xs font-semibold block mb-1" style={{ color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              {t('calc.convertTo')}
            </label>
            <div className="flex gap-2 items-center">
              <div className="flex-1 p-2 rounded-lg text-center" style={{ background: 'hsl(168, 55%, 92%)', minHeight: '2.5rem' }}>
                <span className="text-xl font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}>
                  {fmt(result)}
                </span>
              </div>
              <select
                value={toUnit} onChange={e => setToUnit(e.target.value)}
                style={{
                  width: '4.5rem', flexShrink: 0, padding: '0.5rem',
                  borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-border)',
                  background: 'var(--color-bg)', color: 'var(--color-text)',
                  fontFamily: 'var(--font-mono)', fontSize: '0.875rem',
                }}
              >
                {catData.units.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
