import React, { useState, useEffect } from 'react';
import { t, useLang } from '../../i18n/index.js';
import DilutionCalc from './DilutionCalc.jsx';
import MassCalc from './MassCalc.jsx';
import MolarityCalc from './MolarityCalc.jsx';
import PercentCalc from './PercentCalc.jsx';
import DeadVolumeCalc from './DeadVolumeCalc.jsx';
import UnitConversionCalc from './UnitConversionCalc.jsx';
import MWCalc from './MWCalc.jsx';
import PeriodicTableCalc from './PeriodicTableCalc.jsx';

export default function CalcTab({ initialMode }) {
  const [mode, setMode] = useState(initialMode || 'dilution');

  useEffect(() => { if (initialMode) setMode(initialMode); }, [initialMode]);

  const lang = useLang();
  const modes = [
    { id: 'dilution', task: t('calcTaskDilution', lang), formula: 'C\u2081V\u2081 = C\u2082V\u2082' },
    { id: 'mass', task: t('calcTaskMass', lang), formula: 'm = MW \u00D7 C \u00D7 V' },
    { id: 'molarity', task: t('calcTaskMolarity', lang), formula: 'M = m / (MW \u00D7 V)' },
    { id: 'percent', task: t('calcTaskPercent', lang), formula: '% (w/v) or (v/v)' },
    { id: 'deadvol', task: t('calcTaskDeadVol', lang), formula: 'V \u00D7 N \u00D7 (1 + dead%)' },
    { id: 'convert', task: t('calcTaskConvert', lang), formula: 'Unit ↔ Unit' },
    { id: 'mw', task: t('calcTaskMW', lang), formula: 'Σ(n × Aᵣ)' },
    { id: 'periodic', task: t('calcTaskPeriodic', lang), formula: '118 Elements' },
  ];

  return (
    <div className="fade-in">
      {/* ── DESKTOP: side column + calc area ── */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-6" style={{alignItems:'start'}}>
        <div className="lg:col-span-3">
          <div className="card p-4">
            <div className="space-y-1.5">
              {modes.map(m => (
                <button key={m.id} onClick={() => setMode(m.id)}
                  className="w-full p-2.5 rounded-lg text-left transition-all"
                  style={{
                    background: mode === m.id ? 'var(--primary)' : 'transparent',
                    color: mode === m.id ? 'var(--on-primary)' : 'var(--text)',
                    border: mode === m.id ? '1px solid var(--primary)' : '1px solid transparent',
                  }}>
                  <span className="text-base font-semibold block">{m.task}</span>
                  <span className="text-[10px] mono block" style={{opacity: 0.6}}>{m.formula}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-9">
          {mode === 'dilution' && <DilutionCalc />}
          {mode === 'mass' && <MassCalc />}
          {mode === 'molarity' && <MolarityCalc />}
          {mode === 'percent' && <PercentCalc />}
          {mode === 'deadvol' && <DeadVolumeCalc />}
          {mode === 'convert' && <UnitConversionCalc />}
          {mode === 'mw' && <MWCalc />}
          {mode === 'periodic' && <PeriodicTableCalc />}
        </div>
      </div>
      {/* ── MOBILE: horizontal pills + calc area ── */}
      <div className="lg:hidden">
        <div className="card p-4 mb-4">
          <div className="flex gap-2 overflow-x-auto pb-1" style={{WebkitOverflowScrolling:'touch'}}>
            {modes.map(m => (
              <button key={m.id} onClick={() => setMode(m.id)}
                className="px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap flex-shrink-0"
                style={{
                  background: mode === m.id ? 'var(--primary)' : 'var(--card)',
                  color: mode === m.id ? 'var(--on-primary)' : 'var(--text-muted)',
                  border: `1px solid ${mode === m.id ? 'var(--primary)' : 'var(--border)'}`,
                }}>{m.task}</button>
            ))}
          </div>
        </div>
        {mode === 'dilution' && <DilutionCalc />}
        {mode === 'mass' && <MassCalc />}
        {mode === 'molarity' && <MolarityCalc />}
        {mode === 'percent' && <PercentCalc />}
        {mode === 'deadvol' && <DeadVolumeCalc />}
        {mode === 'convert' && <UnitConversionCalc />}
        {mode === 'mw' && <MWCalc />}
        {mode === 'periodic' && <PeriodicTableCalc />}
      </div>
    </div>
  );
}
