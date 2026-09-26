import { useState, useEffect } from 'react';
import { t, useLang } from '../../i18n/index.js';
import PageHeader from '../../components/PageHeader.jsx';
import ScientificCalc from './ScientificCalc.jsx';
import DilutionCalc from './DilutionCalc.jsx';
import MassCalc from './MassCalc.jsx';
import MolarityCalc from './MolarityCalc.jsx';
import PercentCalc from './PercentCalc.jsx';
import DeadVolumeCalc from './DeadVolumeCalc.jsx';
import UnitConversionCalc from './UnitConversionCalc.jsx';
import MWCalc from './MWCalc.jsx';
import PeriodicTableCalc from './PeriodicTableCalc.jsx';

const CALCS = {
  scientific: ScientificCalc,
  dilution: DilutionCalc,
  mass: MassCalc,
  molarity: MolarityCalc,
  percent: PercentCalc,
  deadvol: DeadVolumeCalc,
  convert: UnitConversionCalc,
  mw: MWCalc,
  periodic: PeriodicTableCalc,
};

// Calculator tab: a sticky master list on desktop (≥1024px), a native <select>
// below that. The active calculator is rendered exactly once (the old layout
// mounted every calculator twice — once per breakpoint).
export default function CalcTab({ initialMode }) {
  const [mode, setMode] = useState(initialMode || 'dilution');

  useEffect(() => { if (initialMode) setMode(initialMode); }, [initialMode]);

  const lang = useLang();
  const zh = lang === 'zh';
  const modes = [
    { id: 'scientific', task: t('calcTaskScientific', lang), formula: 'sin · log · xʸ' },
    { id: 'dilution', task: t('calcTaskDilution', lang), formula: 'C₁V₁ = C₂V₂' },
    { id: 'mass', task: t('calcTaskMass', lang), formula: 'm = MW × C × V' },
    { id: 'molarity', task: t('calcTaskMolarity', lang), formula: 'C = m / (MW × V)' },
    { id: 'percent', task: t('calcTaskPercent', lang), formula: zh ? '% (w/v) 或 (v/v)' : '% (w/v) or (v/v)' },
    { id: 'deadvol', task: t('calcTaskDeadVol', lang), formula: 'V × N × (1 + dead%)' },
    { id: 'convert', task: t('calcTaskConvert', lang), formula: zh ? '单位 ↔ 单位' : 'unit ↔ unit' },
    { id: 'mw', task: t('calcTaskMW', lang), formula: 'Σ(n × Aᵣ)' },
    { id: 'periodic', task: t('calcTaskPeriodic', lang), formula: zh ? '118 种元素' : '118 elements' },
  ];
  const Active = CALCS[mode] || DilutionCalc;
  const listLabel = zh ? '计算器列表' : 'Calculators';

  return (
    <div className="fade-in">
      <PageHeader tab="calc" title={t('tabCalc', lang)} description={t('pageCalcDesc', lang)} />

      <div className="lg:grid lg:grid-cols-[13.5rem_minmax(0,1fr)] xl:grid-cols-[15rem_minmax(0,1fr)] lg:gap-5 xl:gap-6 lg:items-start">
        {/* Desktop: sticky master list */}
        <nav aria-label={listLabel} className="hidden lg:block lg:sticky lg:top-8">
          <div className="panel">
            <div className="panel-head">
              <span className="panel-title">{listLabel}</span>
              <span className="mono tabular" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{modes.length}</span>
            </div>
            <div className="list">
              {modes.map(m => {
                const active = mode === m.id;
                return (
                  <button key={m.id} type="button" onClick={() => setMode(m.id)}
                    className={active ? 'list-row is-selected' : 'list-row'}
                    aria-current={active ? 'true' : undefined}
                    style={{ minHeight: '3rem' }}>
                    <span className="flex flex-col min-w-0">
                      <span className="list-row-title truncate">{m.task}</span>
                      <span className="list-row-meta" style={{ marginTop: '0.1rem' }}>{m.formula}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Phones / tablets: compact native picker */}
        <div className="lg:hidden mb-4">
          <label htmlFor="calc-picker">{t('tabCalc', lang)}</label>
          <select id="calc-picker" className="w-full" value={mode} onChange={e => setMode(e.target.value)}>
            {modes.map(m => <option key={m.id} value={m.id}>{m.task}</option>)}
          </select>
        </div>

        <div key={mode} className="min-w-0 fade-in">
          <Active />
        </div>
      </div>
    </div>
  );
}
