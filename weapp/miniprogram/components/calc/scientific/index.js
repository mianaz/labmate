// Scientific calculator (web: ScientificCalc.jsx). Builds an expression string
// from the keypad and evaluates it with the shared, unit-tested evalExpression
// parser (no eval). The web's keyboard shortcuts have no touch equivalent and
// are left out; everything is on the keypad.
const langBehavior = require('../../../behaviors/lang');
const { evalExpression } = require('../../../shared/calculators.js');

// Trim floating-point noise; exponential for very large/small values.
function fmtNum(n) {
  if (!Number.isFinite(n)) return 'Error';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs >= 1e12 || abs < 1e-6)) return parseFloat(n.toExponential(9)).toExponential();
  return String(parseFloat(n.toPrecision(12)));
}

// k: id · label · tok: text inserted · op: operator (continues from Ans after =)
// v: key face (num | fn | op | eq | ctl) · act: special action · span: columns
const KEYS = [
  { k: 'deg', act: 'deg', v: 'ctl', aria: 'calcAngleMode' },
  { k: 'ac', label: 'AC', act: 'clear', v: 'ctl', aria: 'clearAll' },
  { k: 'back', label: '⌫', act: 'back', v: 'ctl', ariaEn: 'Backspace', ariaZh: '退格' },
  { k: 'lp', label: '(', tok: '(', v: 'fn' },
  { k: 'rp', label: ')', tok: ')', v: 'fn' },

  { k: 'sin', label: 'sin', tok: 'sin(', v: 'fn' },
  { k: 'cos', label: 'cos', tok: 'cos(', v: 'fn' },
  { k: 'tan', label: 'tan', tok: 'tan(', v: 'fn' },
  { k: 'ln', label: 'ln', tok: 'ln(', v: 'fn' },
  { k: 'log', label: 'log', tok: 'log(', v: 'fn' },

  { k: 'pi', label: 'π', tok: 'π', v: 'fn' },
  { k: 'e', label: 'e', tok: 'e', v: 'fn' },
  { k: 'sqrt', label: '√', tok: '√(', v: 'fn', ariaEn: 'Square root', ariaZh: '平方根' },
  { k: 'sq', label: 'x²', tok: '^2', op: true, v: 'fn', ariaEn: 'Square', ariaZh: '平方' },
  { k: 'pow', label: 'xʸ', tok: '^', op: true, v: 'fn', ariaEn: 'Power', ariaZh: '乘方' },

  { k: 'n7', label: '7', tok: '7', v: 'num' },
  { k: 'n8', label: '8', tok: '8', v: 'num' },
  { k: 'n9', label: '9', tok: '9', v: 'num' },
  { k: 'div', label: '÷', tok: '÷', op: true, v: 'op', ariaEn: 'Divide', ariaZh: '除' },
  { k: 'fact', label: 'x!', tok: '!', op: true, v: 'fn', ariaEn: 'Factorial', ariaZh: '阶乘' },

  { k: 'n4', label: '4', tok: '4', v: 'num' },
  { k: 'n5', label: '5', tok: '5', v: 'num' },
  { k: 'n6', label: '6', tok: '6', v: 'num' },
  { k: 'mul', label: '×', tok: '×', op: true, v: 'op', ariaEn: 'Multiply', ariaZh: '乘' },
  { k: 'exp10', label: '×10ⁿ', tok: '×10^', op: true, v: 'fn', ariaEn: 'Times ten to the power', ariaZh: '乘以 10 的幂' },

  { k: 'n1', label: '1', tok: '1', v: 'num' },
  { k: 'n2', label: '2', tok: '2', v: 'num' },
  { k: 'n3', label: '3', tok: '3', v: 'num' },
  { k: 'sub', label: '−', tok: '−', op: true, v: 'op', ariaEn: 'Subtract', ariaZh: '减' },
  { k: 'ans', label: 'Ans', act: 'ans', v: 'fn', ariaEn: 'Last answer', ariaZh: '上次结果' },

  { k: 'n0', label: '0', tok: '0', v: 'num', span: 2 },
  { k: 'dot', label: '.', tok: '.', v: 'num', ariaEn: 'Decimal point', ariaZh: '小数点' },
  { k: 'add', label: '+', tok: '+', op: true, v: 'op', ariaEn: 'Add', ariaZh: '加' },
  { k: 'eq', label: '=', act: 'eq', v: 'eq', ariaEn: 'Equals', ariaZh: '等于' },
];
const BY_K = {};
KEYS.forEach((key) => { BY_K[key.k] = key; });

Component({
  options: { styleIsolation: 'apply-shared' },
  behaviors: [langBehavior],
  data: {
    keys: KEYS,
    expr: '',
    deg: true,
    error: false,
    preview: '', // live "= …" while typing
    hasAns: false,
  },
  lifetimes: {
    attached() {
      this._justEvaluated = false;
      this._lastAns = null;
    },
  },
  methods: {
    onKey(e) { this.press(e.currentTarget.dataset.k); },

    // Press a key by id (see KEYS) — also the entry point for tests.
    press(k) {
      const key = BY_K[k];
      if (!key) return;
      if (key.act === 'deg') this.setExpr(this.data.expr, { deg: !this.data.deg });
      else if (key.act === 'clear') { this._justEvaluated = false; this.setExpr('', { error: false }); }
      else if (key.act === 'back') { this._justEvaluated = false; this.setExpr(this.data.expr.slice(0, -1), { error: false }); }
      else if (key.act === 'eq') this.equals();
      else if (key.act === 'ans') this.insert(this._lastAns !== null ? fmtNum(this._lastAns) : '', false);
      else this.insert(key.tok, !!key.op);
    },

    // After "=", an operator continues from the answer; anything else starts over.
    insert(tok, isOperator) {
      let expr = this.data.expr + tok;
      if (this._justEvaluated) {
        this._justEvaluated = false;
        expr = isOperator ? (this._lastAns !== null ? fmtNum(this._lastAns) : '') + tok : tok;
      }
      this.setExpr(expr, { error: false });
    },

    equals() {
      const { expr, deg } = this.data;
      if (!expr.trim()) return;
      try {
        const val = evalExpression(expr, { deg });
        this._lastAns = val;
        this._justEvaluated = true;
        this.setExpr(fmtNum(val), { error: false, hasAns: true });
      } catch (err) {
        this.setData({ error: true, preview: '' });
      }
    },

    setExpr(expr, extra) {
      const patch = Object.assign({ expr }, extra || {});
      const deg = patch.deg !== undefined ? patch.deg : this.data.deg;
      let preview = '';
      if (!this._justEvaluated && expr.trim()) {
        try { preview = fmtNum(evalExpression(expr, { deg })); } catch (err) { preview = ''; }
      }
      patch.preview = preview;
      this.setData(patch);
    },
  },
});
