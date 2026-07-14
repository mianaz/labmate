/**
 * Pure calculator functions extracted from the LabMate monolith.
 * No React, no DOM — just math. Easily testable.
 */

// ══════════════════════════════════════════════
// Unit conversion factors
// ══════════════════════════════════════════════

export const CONC_FACTORS = { M: 1, mM: 1e-3, 'µM': 1e-6, nM: 1e-9, '%': 1 };
export const VOL_FACTORS = { L: 1, mL: 1e-3, 'µL': 1e-6 };
export const MASS_FACTORS = { kg: 1000, g: 1, mg: 1e-3, 'µg': 1e-6, ng: 1e-9, lb: 453.592, oz: 28.3495 };
export const LENGTH_FACTORS = { m: 1, cm: 0.01, mm: 0.001, 'µm': 1e-6, nm: 1e-9, in: 0.0254, ft: 0.3048, yd: 0.9144 };
export const PRESSURE_FACTORS = {
  atm: 1,
  Pa: 9.8692e-6,
  kPa: 0.00986923,
  bar: 0.986923,
  psi: 0.068046,
  mmHg: 0.00131579,
  Torr: 0.00131579,
};

// ══════════════════════════════════════════════
// Dilution Calculator: C1 × V1 = C2 × V2
// ══════════════════════════════════════════════

/**
 * Solve C1V1 = C2V2 for the specified variable.
 * @param {Object} params - { c1, v1, c2, v2, c1Unit, v1Unit, c2Unit, v2Unit, solveFor }
 * @returns {{ val: number, unit: string, label: string } | null}
 */
export function dilution({ c1, v1, c2, v2, c1Unit = 'M', v1Unit = 'mL', c2Unit = 'M', v2Unit = 'mL', solveFor = 'v1' }) {
  const C1 = c1 * CONC_FACTORS[c1Unit];
  const V1 = v1 * VOL_FACTORS[v1Unit];
  const C2 = c2 * CONC_FACTORS[c2Unit];
  const V2 = v2 * VOL_FACTORS[v2Unit];

  switch (solveFor) {
    case 'v1':
      if (!C1 || !C2 || !V2) return null;
      return { val: (C2 * V2) / C1 / VOL_FACTORS[v1Unit], unit: v1Unit, label: 'V₁' };
    case 'c1':
      if (!V1 || !C2 || !V2) return null;
      return { val: (C2 * V2) / V1 / CONC_FACTORS[c1Unit], unit: c1Unit, label: 'C₁' };
    case 'v2':
      if (!C1 || !V1 || !C2) return null;
      return { val: (C1 * V1) / C2 / VOL_FACTORS[v2Unit], unit: v2Unit, label: 'V₂' };
    case 'c2':
      if (!C1 || !V1 || !V2) return null;
      return { val: (C1 * V1) / V2 / CONC_FACTORS[c2Unit], unit: c2Unit, label: 'C₂' };
    default:
      return null;
  }
}

// ══════════════════════════════════════════════
// Mass Calculator: m = MW × C × V
// ══════════════════════════════════════════════

/**
 * Calculate mass needed for a target molar concentration.
 * @param {Object} params - { mw, conc, vol, concUnit, volUnit }
 * @returns {number|null} mass in grams, or null if inputs invalid
 */
export function massCalc({ mw, conc, vol, concUnit = 'M', volUnit = 'mL' }) {
  const concFactors = { M: 1, mM: 1e-3, 'µM': 1e-6 };
  if (!mw || !conc || !vol) return null;
  return mw * (conc * concFactors[concUnit]) * (vol * VOL_FACTORS[volUnit]);
}

/**
 * Format mass in grams to a human-friendly unit.
 * @param {number} grams
 * @returns {{ val: string, unit: string }}
 */
export function formatMass(grams) {
  if (grams >= 1) return { val: grams.toFixed(4), unit: 'g' };
  if (grams >= 1e-3) return { val: (grams * 1e3).toFixed(4), unit: 'mg' };
  return { val: (grams * 1e6).toFixed(4), unit: 'µg' };
}

// ══════════════════════════════════════════════
// Molarity Calculator: C = m / (MW × V)
// ══════════════════════════════════════════════

/**
 * Calculate molar concentration from mass, MW, and volume.
 * @param {Object} params - { mass, mw, vol, massUnit, volUnit }
 * @returns {number|null} concentration in M (mol/L), or null
 */
export function molarityCalc({ mass, mw, vol, massUnit = 'g', volUnit = 'mL' }) {
  const massFactors = { g: 1, mg: 1e-3, 'µg': 1e-6 };
  if (!mass || !mw || !vol) return null;
  return (mass * massFactors[massUnit]) / mw / (vol * VOL_FACTORS[volUnit]);
}

/**
 * Format concentration in M to human-friendly unit.
 * @param {number} M
 * @returns {{ val: string, unit: string }}
 */
export function formatConcentration(M) {
  if (M >= 1) return { val: M.toFixed(4), unit: 'M' };
  if (M >= 1e-3) return { val: (M * 1e3).toFixed(4), unit: 'mM' };
  if (M >= 1e-6) return { val: (M * 1e6).toFixed(4), unit: 'µM' };
  return { val: (M * 1e9).toFixed(4), unit: 'nM' };
}

// ══════════════════════════════════════════════
// Percent Solution Calculator: w/v and v/v
// ══════════════════════════════════════════════

/**
 * Percent solution calculator (w/v or v/v).
 * For w/v: solute is in grams, volume in mL. % = (g / mL) × 100
 * For v/v: solute is in mL, volume in mL. % = (mL / mL) × 100
 *
 * @param {Object} params - { solute, vol, perc, solveFor }
 *   solveFor: 'solute' | 'vol' | 'perc'
 * @returns {{ val: number, label: string, unit: string } | null}
 */
export function percentCalc({ solute, vol, perc, solveFor = 'solute', mode = 'wv' }) {
  switch (solveFor) {
    case 'solute':
      if (!vol || !perc) return null;
      return {
        val: (perc / 100) * vol,
        label: mode === 'wv' ? 'Solute Mass' : 'Solute Volume',
        unit: mode === 'wv' ? 'g' : 'mL',
      };
    case 'vol':
      if (!solute || !perc) return null;
      return { val: solute / (perc / 100), label: 'Final Volume', unit: 'mL' };
    case 'perc':
      if (!solute || !vol) return null;
      return { val: (solute / vol) * 100, label: 'Percentage', unit: '%' };
    default:
      return null;
  }
}

// ══════════════════════════════════════════════
// Dead Volume Calculator: (N × V) × (1 + dead%)
// ══════════════════════════════════════════════

/**
 * Calculate total preparation volume with dead volume compensation.
 * @param {Object} params - { numSamples, volPerSample, deadPercent }
 * @returns {{ base: number, deadAmount: number, total: number } | null}
 */
export function deadVolume({ numSamples, volPerSample, deadPercent = 15 }) {
  if (!numSamples || numSamples <= 0 || !volPerSample || volPerSample <= 0) return null;
  const base = numSamples * volPerSample;
  const deadAmount = base * (deadPercent / 100);
  const total = base + deadAmount;
  return { base, deadAmount, total };
}

// ══════════════════════════════════════════════
// Unit Conversion
// ══════════════════════════════════════════════

/**
 * Convert between units of the same category.
 * @param {number} value - input value
 * @param {string} fromUnit
 * @param {string} toUnit
 * @param {string} category - 'volume' | 'mass' | 'length' | 'temperature' | 'pressure'
 * @returns {number|null}
 */
export function unitConvert(value, fromUnit, toUnit, category) {
  if (value === null || value === undefined || isNaN(value)) return null;

  if (category === 'temperature') {
    return temperatureConvert(value, fromUnit, toUnit);
  }

  const factorMaps = {
    volume: { L: 1, mL: 1e-3, 'µL': 1e-6, nL: 1e-9, 'fl oz': 0.0295735, cup: 0.236588, pt: 0.473176, qt: 0.946353, gal: 3.78541 },
    mass: MASS_FACTORS,
    length: LENGTH_FACTORS,
    pressure: PRESSURE_FACTORS,
  };

  const factors = factorMaps[category];
  if (!factors || !(fromUnit in factors) || !(toUnit in factors)) return null;

  return value * factors[fromUnit] / factors[toUnit];
}

/**
 * Temperature conversion.
 * @param {number} value
 * @param {string} from - '°C' | '°F' | 'K'
 * @param {string} to   - '°C' | '°F' | 'K'
 * @returns {number}
 */
export function temperatureConvert(value, from, to) {
  // Convert to Celsius first
  let celsius;
  if (from === '°C') celsius = value;
  else if (from === '°F') celsius = (value - 32) * 5 / 9;
  else if (from === 'K') celsius = value - 273.15;
  else return null;

  // Convert from Celsius to target
  if (to === '°C') return celsius;
  if (to === '°F') return celsius * 9 / 5 + 32;
  if (to === 'K') return celsius + 273.15;
  return null;
}

// ══════════════════════════════════════════════
// SDS-PAGE Gel Calculator
// ══════════════════════════════════════════════

const GEL_DEFAULTS = {
  resolving: {
    trisVolFrac: 0.25,     // 25% of total
    sdsVolFrac: 0.01,      // 1% of 10% SDS stock
    apsVolFrac: 0.01,      // 1% of 10% APS
    temedPerMl: 0.0006,    // mL TEMED per mL gel
    acrylamideStock: 30,   // % stock
  },
  stacking: {
    trisConc: 1.0,         // M stock concentration
    trisVolFrac: 0.125,    // fraction giving 125 mM final (from 1M stock)
    sdsVolFrac: 0.01,
    apsVolFrac: 0.01,
    temedPerMl: 0.001,
    acrylamideStock: 30,
  },
};

/**
 * Calculate SDS-PAGE gel recipe.
 * @param {number} percentage - gel acrylamide percentage
 * @param {number} totalVolume - total gel volume in mL
 * @param {'resolving'|'stacking'} type
 * @returns {Array<{name: string, vol: number, unit: string}>}
 */
export function calcGel(percentage, totalVolume, type = 'resolving') {
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

  const trisLabel =
    type === 'resolving' ? '1.5 M Tris-HCl pH 8.8' : '1.0 M Tris-HCl pH 6.8';

  return [
    { name: 'ddH₂O', vol: Math.max(0, h2o), unit: 'mL' },
    { name: '30% Acrylamide/Bis (29:1)', vol: acryVol, unit: 'mL' },
    { name: trisLabel, vol: trisVol, unit: 'mL' },
    { name: '10% SDS', vol: sdsVol, unit: 'mL' },
    { name: '10% APS', vol: apsVol, unit: 'mL' },
    { name: 'TEMED', vol: temedVol * 1000, unit: 'µL' },
  ];
}

// ══════════════════════════════════════════════
// Scientific expression evaluator
// Safe recursive-descent parser (no eval / Function).
// Grammar (lowest → highest precedence):
//   expr    := term (('+' | '-') term)*
//   term    := factor (('*' | '/' | '%') factor)*
//   factor  := ('-' | '+') factor | power          // unary sign binds looser than ^
//   power   := postfix ('^' factor)?               // right-associative
//   postfix := primary ('!')*                       // factorial
//   primary := number | const | func '(' expr ')' | '(' expr ')'
// ══════════════════════════════════════════════

function factorial(n) {
  if (n < 0 || !Number.isInteger(n)) throw new Error('factorial requires a non-negative integer');
  if (n > 170) return Infinity; // beyond Number range
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

/**
 * Evaluate a mathematical expression string.
 * Supports + - × ÷ ^, %, parentheses, factorial (!), constants (π/pi, e),
 * and functions: sin cos tan asin acos atan sinh cosh tanh ln log log2 sqrt cbrt exp abs.
 * @param {string} input
 * @param {{deg?: boolean}} opts - deg: interpret/return trig angles in degrees (default radians)
 * @returns {number} the numeric result
 * @throws {Error} on malformed input
 */
export function evalExpression(input, { deg = false } = {}) {
  const src = String(input)
    .replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-')
    .replace(/π/g, 'pi').replace(/√/g, 'sqrt');

  const toRad = (x) => (deg ? (x * Math.PI) / 180 : x);
  const fromRad = (x) => (deg ? (x * 180) / Math.PI : x);
  const FUNCS = {
    sin: (x) => Math.sin(toRad(x)), cos: (x) => Math.cos(toRad(x)), tan: (x) => Math.tan(toRad(x)),
    asin: (x) => fromRad(Math.asin(x)), acos: (x) => fromRad(Math.acos(x)), atan: (x) => fromRad(Math.atan(x)),
    sinh: Math.sinh, cosh: Math.cosh, tanh: Math.tanh,
    ln: Math.log, log: Math.log10, log2: Math.log2,
    sqrt: Math.sqrt, cbrt: Math.cbrt, exp: Math.exp, abs: Math.abs,
  };
  const CONSTS = { pi: Math.PI, e: Math.E };

  // Tokenize
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === ' ') { i++; continue; }
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < src.length && /[0-9.]/.test(src[i])) num += src[i++];
      if ((num.match(/\./g) || []).length > 1) throw new Error('malformed number');
      tokens.push({ type: 'num', value: parseFloat(num) });
      continue;
    }
    if (/[a-z]/i.test(ch)) {
      let name = '';
      while (i < src.length && /[a-z0-9]/i.test(src[i])) name += src[i++];
      tokens.push({ type: 'name', value: name.toLowerCase() });
      continue;
    }
    if ('+-*/%^()!'.includes(ch)) { tokens.push({ type: 'op', value: ch }); i++; continue; }
    throw new Error('unexpected character: ' + ch);
  }

  let pos = 0;
  const peek = () => tokens[pos];
  const eat = (val) => {
    const tk = tokens[pos];
    if (!tk || (val !== undefined && tk.value !== val)) throw new Error('expected ' + val);
    pos++;
    return tk;
  };

  function parseExpr() {
    let val = parseTerm();
    while (peek() && (peek().value === '+' || peek().value === '-')) {
      const op = eat().value;
      const rhs = parseTerm();
      val = op === '+' ? val + rhs : val - rhs;
    }
    return val;
  }
  function parseTerm() {
    let val = parseFactor();
    while (peek() && (peek().value === '*' || peek().value === '/' || peek().value === '%')) {
      const op = eat().value;
      const rhs = parseFactor();
      val = op === '*' ? val * rhs : op === '/' ? val / rhs : val % rhs;
    }
    return val;
  }
  function parseFactor() {
    if (peek() && (peek().value === '-' || peek().value === '+')) {
      const op = eat().value;
      const v = parseFactor();
      return op === '-' ? -v : v;
    }
    return parsePower();
  }
  function parsePower() {
    const base = parsePostfix();
    if (peek() && peek().value === '^') {
      eat('^');
      return Math.pow(base, parseFactor()); // right-associative, allows ^-exp
    }
    return base;
  }
  function parsePostfix() {
    let val = parsePrimary();
    while (peek() && peek().value === '!') { eat('!'); val = factorial(val); }
    return val;
  }
  function parsePrimary() {
    const tk = peek();
    if (!tk) throw new Error('unexpected end of expression');
    if (tk.type === 'num') { eat(); return tk.value; }
    if (tk.value === '(') { eat('('); const v = parseExpr(); eat(')'); return v; }
    if (tk.type === 'name') {
      eat();
      if (peek() && peek().value === '(') {
        const fn = FUNCS[tk.value];
        if (!fn) throw new Error('unknown function: ' + tk.value);
        eat('('); const arg = parseExpr(); eat(')');
        return fn(arg);
      }
      if (tk.value in CONSTS) return CONSTS[tk.value];
      throw new Error('unknown identifier: ' + tk.value);
    }
    throw new Error('unexpected token: ' + tk.value);
  }

  if (tokens.length === 0) throw new Error('empty expression');
  const result = parseExpr();
  if (pos !== tokens.length) throw new Error('unexpected trailing input');
  if (!Number.isFinite(result)) {
    if (Number.isNaN(result)) throw new Error('result is not a number');
    // ±Infinity (e.g. 1/0) — surface as an error for the UI
    throw new Error('result is not finite');
  }
  return result;
}
