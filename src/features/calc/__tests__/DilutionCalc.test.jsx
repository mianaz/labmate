import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import DilutionCalc from '../DilutionCalc.jsx';
import { LangContext, t } from '../../../i18n/index.js';

afterEach(cleanup);

function renderIn(lang) {
  return render(<LangContext.Provider value={lang}><DilutionCalc /></LangContext.Provider>);
}

const type = (label, value) => fireEvent.change(screen.getByLabelText(label, { exact: false }), { target: { value } });
const unit = (name, value) => fireEvent.change(screen.getByRole('combobox', { name }), { target: { value } });
const prepText = () => screen.getByText(/How to prepare|配制方法/).closest('p').textContent.replace(/\s+/g, ' ');

describe('DilutionCalc preparation instructions', () => {
  it('works out the solvent in V₂ units when V₁ is in µL (solving V₁)', () => {
    renderIn('en');
    // 1 M stock → 5 mM in 10 mL: V₁ = 50 µL, solvent = 9.95 mL
    type('Stock Concentration', '1');
    type('Desired (Target) Concentration', '5');
    unit('C₂ unit', 'mM');
    type('Total Final Volume', '10');
    unit('V₁ unit', 'µL');
    const prep = prepText();
    expect(prep).toContain('Pipette 50.0000 µL of stock solution');
    expect(prep).toContain('then add 9.9500 mL of solvent');
    expect(prep).toContain('to reach 10.0000 mL total');
  });

  it('works out the solvent in V₂ units when V₁ is in µL (solving V₂)', () => {
    renderIn('en');
    fireEvent.click(screen.getByRole('button', { name: 'V₂' }));
    // 100 µL of 10 mM stock → 1 mM: V₂ = 1 mL, solvent = 0.9 mL
    type('Stock Concentration', '10');
    unit('C₁ unit', 'mM');
    type('Volume of Stock to Pipette', '100');
    unit('V₁ unit', 'µL');
    type('Desired (Target) Concentration', '1');
    unit('C₂ unit', 'mM');
    const prep = prepText();
    expect(prep).toContain('then add 0.9000 mL of solvent');
    expect(prep).toContain('to reach 1.0000 mL total');
  });

  it('Chinese instructions do not end in the English word "total"', () => {
    renderIn('zh');
    type('母液浓度', '10');
    type('目标浓度', '1');
    type('最终总体积', '100');
    const prep = prepText();
    expect(prep).toContain('至总体积 100.0000 mL');
    expect(prep).not.toMatch(/total/);
  });
});

describe('t()', () => {
  it('honours a deliberately empty translation and falls back only when one is missing', () => {
    expect(t('dilPrepTotal', 'zh')).toBe('');
    expect(t('dilPrepTotal', 'en')).toBe('total');
    expect(t('tabBuffers', 'fr')).toBe('Recipes');
    expect(t('no_such_key', 'zh')).toBe('no_such_key');
  });
});
