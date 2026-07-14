import { describe, it, expect } from 'vitest';
import {
  dilution,
  massCalc,
  formatMass,
  molarityCalc,
  formatConcentration,
  percentCalc,
  deadVolume,
  unitConvert,
  temperatureConvert,
  calcGel,
  evalExpression,
} from '../calculators.js';

// ═══════════════════════════════════════════════
// Dilution Calculator: C1 × V1 = C2 × V2
// ═══════════════════════════════════════════════

describe('dilution', () => {
  it('solves for V1 (happy path)', () => {
    // C1=10M, C2=1M, V2=100mL → V1 = (1×100)/10 = 10 mL
    const result = dilution({ c1: 10, v1: 0, c2: 1, v2: 100, solveFor: 'v1' });
    expect(result).not.toBeNull();
    expect(result.label).toBe('V₁');
    expect(result.val).toBeCloseTo(10, 4);
    expect(result.unit).toBe('mL');
  });

  it('solves for C1', () => {
    // V1=5mL, C2=2M, V2=50mL → C1 = (2×50)/5 = 20 M
    const result = dilution({ c1: 0, v1: 5, c2: 2, v2: 50, solveFor: 'c1' });
    expect(result).not.toBeNull();
    expect(result.val).toBeCloseTo(20, 4);
    expect(result.label).toBe('C₁');
  });

  it('solves for V2', () => {
    // C1=5M, V1=10mL, C2=1M → V2 = (5×10)/1 = 50 mL
    const result = dilution({ c1: 5, v1: 10, c2: 1, v2: 0, solveFor: 'v2' });
    expect(result).not.toBeNull();
    expect(result.val).toBeCloseTo(50, 4);
  });

  it('solves for C2', () => {
    // C1=10M, V1=5mL, V2=100mL → C2 = (10×5)/100 = 0.5 M
    const result = dilution({ c1: 10, v1: 5, c2: 0, v2: 100, solveFor: 'c2' });
    expect(result).not.toBeNull();
    expect(result.val).toBeCloseTo(0.5, 4);
  });

  it('handles unit conversions (mM, µL)', () => {
    // C1=100mM (=0.1M), C2=10mM (=0.01M), V2=1000µL (=1mL)
    // V1 = (0.01×0.001) / 0.1 = 0.0001 L → in µL = 100
    const result = dilution({
      c1: 100, v1: 0, c2: 10, v2: 1000,
      c1Unit: 'mM', v1Unit: 'µL', c2Unit: 'mM', v2Unit: 'µL',
      solveFor: 'v1',
    });
    expect(result).not.toBeNull();
    expect(result.val).toBeCloseTo(100, 2);
    expect(result.unit).toBe('µL');
  });

  it('returns null when needed inputs are zero', () => {
    expect(dilution({ c1: 0, v1: 0, c2: 1, v2: 100, solveFor: 'v1' })).toBeNull();
    expect(dilution({ c1: 10, v1: 0, c2: 0, v2: 100, solveFor: 'v1' })).toBeNull();
    expect(dilution({ c1: 10, v1: 0, c2: 1, v2: 0, solveFor: 'v1' })).toBeNull();
  });

  it('returns null for invalid solveFor', () => {
    expect(dilution({ c1: 10, v1: 5, c2: 1, v2: 50, solveFor: 'x' })).toBeNull();
  });

  it('handles very large numbers', () => {
    const result = dilution({ c1: 1e6, v1: 0, c2: 1, v2: 1e6, solveFor: 'v1' });
    expect(result).not.toBeNull();
    expect(result.val).toBeCloseTo(1, 4);
  });

  it('handles very small numbers', () => {
    const result = dilution({
      c1: 1, v1: 0, c2: 1, v2: 1,
      c1Unit: 'M', v1Unit: 'µL', c2Unit: 'nM', v2Unit: 'µL',
      solveFor: 'v1',
    });
    expect(result).not.toBeNull();
    expect(result.val).toBeCloseTo(1e-9, 15);
  });
});

// ═══════════════════════════════════════════════
// Mass Calculator: m = MW × C × V
// ═══════════════════════════════════════════════

describe('massCalc', () => {
  it('calculates mass in grams (happy path)', () => {
    // NaCl MW=58.44, 1M, 1L → 58.44 g
    const result = massCalc({ mw: 58.44, conc: 1, vol: 1, concUnit: 'M', volUnit: 'L' });
    expect(result).toBeCloseTo(58.44, 2);
  });

  it('handles mM and mL units', () => {
    // MW=100, 10mM (=0.01M), 500mL (=0.5L) → 100 × 0.01 × 0.5 = 0.5 g
    const result = massCalc({ mw: 100, conc: 10, vol: 500, concUnit: 'mM', volUnit: 'mL' });
    expect(result).toBeCloseTo(0.5, 4);
  });

  it('handles µM and µL units', () => {
    // MW=200, 50µM (=5e-5M), 100µL (=1e-4L) → 200 × 5e-5 × 1e-4 = 1e-6 g
    const result = massCalc({ mw: 200, conc: 50, vol: 100, concUnit: 'µM', volUnit: 'µL' });
    expect(result).toBeCloseTo(1e-6, 10);
  });

  it('returns null for zero MW', () => {
    expect(massCalc({ mw: 0, conc: 1, vol: 1 })).toBeNull();
  });

  it('returns null for zero concentration', () => {
    expect(massCalc({ mw: 58.44, conc: 0, vol: 1 })).toBeNull();
  });

  it('returns null for zero volume', () => {
    expect(massCalc({ mw: 58.44, conc: 1, vol: 0 })).toBeNull();
  });
});

describe('formatMass', () => {
  it('formats grams', () => {
    expect(formatMass(5.123)).toEqual({ val: '5.1230', unit: 'g' });
  });

  it('formats milligrams', () => {
    expect(formatMass(0.0053)).toEqual({ val: '5.3000', unit: 'mg' });
  });

  it('formats micrograms', () => {
    expect(formatMass(0.0000023)).toEqual({ val: '2.3000', unit: 'µg' });
  });

  it('formats exactly 1g as grams', () => {
    expect(formatMass(1).unit).toBe('g');
  });

  it('formats exactly 1mg as mg', () => {
    expect(formatMass(0.001).unit).toBe('mg');
  });
});

// ═══════════════════════════════════════════════
// Molarity Calculator: C = m / (MW × V)
// ═══════════════════════════════════════════════

describe('molarityCalc', () => {
  it('calculates molarity (happy path)', () => {
    // 58.44g NaCl, MW=58.44, in 1L → 1 M
    const result = molarityCalc({ mass: 58.44, mw: 58.44, vol: 1, massUnit: 'g', volUnit: 'L' });
    expect(result).toBeCloseTo(1, 4);
  });

  it('handles mg and mL units', () => {
    // 100mg (=0.1g), MW=100, in 100mL (=0.1L) → 0.1 / (100 × 0.1) = 0.01 M
    const result = molarityCalc({ mass: 100, mw: 100, vol: 100, massUnit: 'mg', volUnit: 'mL' });
    expect(result).toBeCloseTo(0.01, 4);
  });

  it('handles µg and µL', () => {
    // 10µg (=1e-5g), MW=200, 50µL (=5e-5L) → 1e-5 / (200 × 5e-5) = 0.001 M = 1 mM
    const result = molarityCalc({ mass: 10, mw: 200, vol: 50, massUnit: 'µg', volUnit: 'µL' });
    expect(result).toBeCloseTo(0.001, 6);
  });

  it('returns null for zero mass', () => {
    expect(molarityCalc({ mass: 0, mw: 58.44, vol: 1 })).toBeNull();
  });

  it('returns null for zero MW', () => {
    expect(molarityCalc({ mass: 10, mw: 0, vol: 1 })).toBeNull();
  });

  it('returns null for zero volume', () => {
    expect(molarityCalc({ mass: 10, mw: 100, vol: 0 })).toBeNull();
  });
});

describe('formatConcentration', () => {
  it('formats M range', () => {
    expect(formatConcentration(2.5).unit).toBe('M');
  });

  it('formats mM range', () => {
    expect(formatConcentration(0.005).unit).toBe('mM');
    expect(formatConcentration(0.005).val).toBe('5.0000');
  });

  it('formats µM range', () => {
    expect(formatConcentration(5e-5).unit).toBe('µM');
  });

  it('formats nM range', () => {
    expect(formatConcentration(5e-8).unit).toBe('nM');
  });
});

// ═══════════════════════════════════════════════
// Percent Solution Calculator
// ═══════════════════════════════════════════════

describe('percentCalc', () => {
  describe('w/v mode', () => {
    it('solves for solute mass', () => {
      // 10% w/v, 100mL → 10g
      const result = percentCalc({ solute: 0, vol: 100, perc: 10, solveFor: 'solute', mode: 'wv' });
      expect(result).not.toBeNull();
      expect(result.val).toBeCloseTo(10, 4);
      expect(result.unit).toBe('g');
    });

    it('solves for volume', () => {
      // 5g solute, 10% → 50 mL
      const result = percentCalc({ solute: 5, vol: 0, perc: 10, solveFor: 'vol', mode: 'wv' });
      expect(result).not.toBeNull();
      expect(result.val).toBeCloseTo(50, 4);
      expect(result.unit).toBe('mL');
    });

    it('solves for percentage', () => {
      // 20g in 200mL → 10%
      const result = percentCalc({ solute: 20, vol: 200, perc: 0, solveFor: 'perc', mode: 'wv' });
      expect(result).not.toBeNull();
      expect(result.val).toBeCloseTo(10, 4);
      expect(result.unit).toBe('%');
    });
  });

  describe('v/v mode', () => {
    it('solves for solute volume', () => {
      // 5% v/v, 200mL → 10mL
      const result = percentCalc({ solute: 0, vol: 200, perc: 5, solveFor: 'solute', mode: 'vv' });
      expect(result).not.toBeNull();
      expect(result.val).toBeCloseTo(10, 4);
      expect(result.unit).toBe('mL');
    });
  });

  it('returns null when inputs are zero', () => {
    expect(percentCalc({ solute: 0, vol: 0, perc: 10, solveFor: 'solute' })).toBeNull();
    expect(percentCalc({ solute: 5, vol: 0, perc: 0, solveFor: 'vol' })).toBeNull();
    expect(percentCalc({ solute: 0, vol: 100, perc: 0, solveFor: 'perc' })).toBeNull();
  });

  it('returns null for invalid solveFor', () => {
    expect(percentCalc({ solute: 5, vol: 100, perc: 10, solveFor: 'x' })).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// Dead Volume Calculator
// ═══════════════════════════════════════════════

describe('deadVolume', () => {
  it('calculates total with dead volume (happy path)', () => {
    // 24 samples × 20µL + 15% dead
    const result = deadVolume({ numSamples: 24, volPerSample: 20, deadPercent: 15 });
    expect(result).not.toBeNull();
    expect(result.base).toBe(480);
    expect(result.deadAmount).toBeCloseTo(72, 4);
    expect(result.total).toBeCloseTo(552, 4);
  });

  it('handles 0% dead volume', () => {
    const result = deadVolume({ numSamples: 10, volPerSample: 50, deadPercent: 0 });
    expect(result).not.toBeNull();
    expect(result.deadAmount).toBe(0);
    expect(result.total).toBe(500);
  });

  it('handles 100% dead volume', () => {
    const result = deadVolume({ numSamples: 10, volPerSample: 100, deadPercent: 100 });
    expect(result).not.toBeNull();
    expect(result.total).toBe(2000);
  });

  it('returns null for zero samples', () => {
    expect(deadVolume({ numSamples: 0, volPerSample: 20, deadPercent: 15 })).toBeNull();
  });

  it('returns null for negative samples', () => {
    expect(deadVolume({ numSamples: -5, volPerSample: 20, deadPercent: 15 })).toBeNull();
  });

  it('returns null for zero volume per sample', () => {
    expect(deadVolume({ numSamples: 10, volPerSample: 0, deadPercent: 15 })).toBeNull();
  });

  it('uses default 15% dead volume', () => {
    const result = deadVolume({ numSamples: 10, volPerSample: 100 });
    expect(result.total).toBeCloseTo(1150, 4);
  });
});

// ═══════════════════════════════════════════════
// Unit Conversion
// ═══════════════════════════════════════════════

describe('unitConvert', () => {
  describe('volume', () => {
    it('converts L to mL', () => {
      expect(unitConvert(1, 'L', 'mL', 'volume')).toBeCloseTo(1000, 4);
    });

    it('converts mL to µL', () => {
      expect(unitConvert(1, 'mL', 'µL', 'volume')).toBeCloseTo(1000, 4);
    });

    it('converts µL to nL', () => {
      expect(unitConvert(1, 'µL', 'nL', 'volume')).toBeCloseTo(1000, 4);
    });

    it('converts gal to L', () => {
      expect(unitConvert(1, 'gal', 'L', 'volume')).toBeCloseTo(3.78541, 3);
    });

    it('round-trips L → mL → L', () => {
      const ml = unitConvert(2.5, 'L', 'mL', 'volume');
      const l = unitConvert(ml, 'mL', 'L', 'volume');
      expect(l).toBeCloseTo(2.5, 8);
    });
  });

  describe('mass', () => {
    it('converts g to mg', () => {
      expect(unitConvert(1, 'g', 'mg', 'mass')).toBeCloseTo(1000, 4);
    });

    it('converts kg to g', () => {
      expect(unitConvert(1, 'kg', 'g', 'mass')).toBeCloseTo(1000, 4);
    });

    it('converts lb to g', () => {
      expect(unitConvert(1, 'lb', 'g', 'mass')).toBeCloseTo(453.592, 2);
    });

    it('converts oz to g', () => {
      expect(unitConvert(1, 'oz', 'g', 'mass')).toBeCloseTo(28.3495, 2);
    });
  });

  describe('length', () => {
    it('converts m to cm', () => {
      expect(unitConvert(1, 'm', 'cm', 'length')).toBeCloseTo(100, 4);
    });

    it('converts in to cm', () => {
      expect(unitConvert(1, 'in', 'cm', 'length')).toBeCloseTo(2.54, 4);
    });

    it('converts nm to µm', () => {
      expect(unitConvert(1000, 'nm', 'µm', 'length')).toBeCloseTo(1, 4);
    });
  });

  describe('pressure', () => {
    it('converts atm to Pa', () => {
      // 1 atm = 101325 Pa (approximately)
      expect(unitConvert(1, 'atm', 'Pa', 'pressure')).toBeCloseTo(101325, -2);
    });

    it('converts atm to bar', () => {
      expect(unitConvert(1, 'atm', 'bar', 'pressure')).toBeCloseTo(1.01325, 3);
    });

    it('converts mmHg to Torr (should be 1:1)', () => {
      expect(unitConvert(760, 'mmHg', 'Torr', 'pressure')).toBeCloseTo(760, 4);
    });
  });

  it('returns null for invalid category', () => {
    expect(unitConvert(1, 'L', 'mL', 'invalid')).toBeNull();
  });

  it('returns null for invalid unit', () => {
    expect(unitConvert(1, 'L', 'bogus', 'volume')).toBeNull();
  });

  it('returns null for NaN input', () => {
    expect(unitConvert(NaN, 'L', 'mL', 'volume')).toBeNull();
  });

  it('handles zero correctly', () => {
    expect(unitConvert(0, 'g', 'mg', 'mass')).toBe(0);
  });
});

describe('temperatureConvert', () => {
  it('converts °C to °F', () => {
    expect(temperatureConvert(0, '°C', '°F')).toBeCloseTo(32, 4);
    expect(temperatureConvert(100, '°C', '°F')).toBeCloseTo(212, 4);
    expect(temperatureConvert(37, '°C', '°F')).toBeCloseTo(98.6, 1);
  });

  it('converts °F to °C', () => {
    expect(temperatureConvert(32, '°F', '°C')).toBeCloseTo(0, 4);
    expect(temperatureConvert(212, '°F', '°C')).toBeCloseTo(100, 4);
  });

  it('converts °C to K', () => {
    expect(temperatureConvert(0, '°C', 'K')).toBeCloseTo(273.15, 4);
    expect(temperatureConvert(-273.15, '°C', 'K')).toBeCloseTo(0, 4);
  });

  it('converts K to °C', () => {
    expect(temperatureConvert(273.15, 'K', '°C')).toBeCloseTo(0, 4);
    expect(temperatureConvert(0, 'K', '°C')).toBeCloseTo(-273.15, 4);
  });

  it('converts K to °F', () => {
    expect(temperatureConvert(373.15, 'K', '°F')).toBeCloseTo(212, 2);
  });

  it('handles negative temperatures', () => {
    expect(temperatureConvert(-40, '°C', '°F')).toBeCloseTo(-40, 4);
    expect(temperatureConvert(-40, '°F', '°C')).toBeCloseTo(-40, 4);
  });

  it('returns null for invalid units', () => {
    expect(temperatureConvert(100, 'X', '°C')).toBeNull();
    expect(temperatureConvert(100, '°C', 'X')).toBeNull();
  });
});

// ═══════════════════════════════════════════════
// SDS-PAGE Gel Calculator
// ═══════════════════════════════════════════════

describe('calcGel', () => {
  it('returns 6 components for resolving gel', () => {
    const result = calcGel(10, 10, 'resolving');
    expect(result).toHaveLength(6);
    expect(result.map((r) => r.name)).toEqual([
      'ddH₂O',
      '30% Acrylamide/Bis (29:1)',
      '1.5 M Tris-HCl pH 8.8',
      '10% SDS',
      '10% APS',
      'TEMED',
    ]);
  });

  it('returns 6 components for stacking gel', () => {
    const result = calcGel(4, 5, 'stacking');
    expect(result).toHaveLength(6);
    expect(result[2].name).toBe('1.0 M Tris-HCl pH 6.8');
  });

  it('acrylamide volume is proportional to percentage', () => {
    const gel10 = calcGel(10, 10, 'resolving');
    const gel15 = calcGel(15, 10, 'resolving');
    const acry10 = gel10.find((r) => r.name.includes('Acrylamide')).vol;
    const acry15 = gel15.find((r) => r.name.includes('Acrylamide')).vol;
    // 10% gel: 10/30 * 10 = 3.333 mL
    expect(acry10).toBeCloseTo(3.333, 2);
    // 15% gel: 15/30 * 10 = 5.0 mL
    expect(acry15).toBeCloseTo(5.0, 2);
  });

  it('total volumes sum to approximately totalVolume', () => {
    const result = calcGel(10, 20, 'resolving');
    const totalMl = result.reduce((sum, r) => sum + (r.unit === 'µL' ? r.vol / 1000 : r.vol), 0);
    expect(totalMl).toBeCloseTo(20, 1);
  });

  it('stacking gel total sums correctly', () => {
    const result = calcGel(4, 5, 'stacking');
    const totalMl = result.reduce((sum, r) => sum + (r.unit === 'µL' ? r.vol / 1000 : r.vol), 0);
    expect(totalMl).toBeCloseTo(5, 1);
  });

  it('water volume is non-negative', () => {
    const result = calcGel(6, 10, 'resolving');
    const h2o = result.find((r) => r.name === 'ddH₂O');
    expect(h2o.vol).toBeGreaterThanOrEqual(0);
  });

  it('TEMED is in µL', () => {
    const result = calcGel(10, 10, 'resolving');
    const temed = result.find((r) => r.name === 'TEMED');
    expect(temed.unit).toBe('µL');
  });

  it('scales linearly with total volume', () => {
    const gel10 = calcGel(10, 10, 'resolving');
    const gel20 = calcGel(10, 20, 'resolving');
    // Each component in gel20 should be 2× the corresponding gel10 component
    for (let i = 0; i < gel10.length; i++) {
      expect(gel20[i].vol).toBeCloseTo(gel10[i].vol * 2, 2);
    }
  });
});

// ═══════════════════════════════════════════════
// Scientific Calculator: evalExpression
// ═══════════════════════════════════════════════

describe('evalExpression', () => {
  it('basic arithmetic with precedence', () => {
    expect(evalExpression('2+3*4')).toBe(14);
    expect(evalExpression('(2+3)*4')).toBe(20);
    expect(evalExpression('10/4')).toBe(2.5);
    expect(evalExpression('7%3')).toBe(1);
  });

  it('normalizes pretty operators', () => {
    expect(evalExpression('6×7')).toBe(42);
    expect(evalExpression('84÷2')).toBe(42);
    expect(evalExpression('5−2')).toBe(3);
  });

  it('unary minus binds looser than exponent (-3^2 = -9)', () => {
    expect(evalExpression('-3^2')).toBe(-9);
    expect(evalExpression('2^-2')).toBeCloseTo(0.25, 10);
  });

  it('exponent is right-associative', () => {
    expect(evalExpression('2^3^2')).toBe(512); // 2^(3^2)
  });

  it('factorial (postfix)', () => {
    expect(evalExpression('5!')).toBe(120);
    expect(evalExpression('3!+1')).toBe(7);
    expect(() => evalExpression('2.5!')).toThrow();
  });

  it('constants π and e', () => {
    expect(evalExpression('π')).toBeCloseTo(Math.PI, 10);
    expect(evalExpression('pi')).toBeCloseTo(Math.PI, 10);
    expect(evalExpression('e')).toBeCloseTo(Math.E, 10);
  });

  it('trig in radians by default, degrees when requested', () => {
    expect(evalExpression('sin(0)')).toBeCloseTo(0, 10);
    expect(evalExpression('cos(π)')).toBeCloseTo(-1, 10);
    expect(evalExpression('sin(30)', { deg: true })).toBeCloseTo(0.5, 10);
    expect(evalExpression('asin(1)', { deg: true })).toBeCloseTo(90, 10);
  });

  it('log, ln, sqrt', () => {
    expect(evalExpression('log(1000)')).toBeCloseTo(3, 10);
    expect(evalExpression('ln(e)')).toBeCloseTo(1, 10);
    expect(evalExpression('√(16)')).toBe(4);
    expect(evalExpression('sqrt(9)+1')).toBe(4);
  });

  it('throws on malformed input rather than returning garbage', () => {
    expect(() => evalExpression('2+')).toThrow();
    expect(() => evalExpression('(2+3')).toThrow();
    expect(() => evalExpression('2 3')).toThrow();
    expect(() => evalExpression('')).toThrow();
    expect(() => evalExpression('1/0')).toThrow(); // non-finite surfaced as error
    expect(() => evalExpression('foo(2)')).toThrow();
  });
});
