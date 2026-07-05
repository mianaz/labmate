import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';

export default function QuickCalculatorButton() {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState(null);
  const [op, setOp] = useState(null);
  const [reset, setReset] = useState(false);

  function input(d) {
    if (reset) { setDisplay(d); setReset(false); return; }
    setDisplay(display === '0' ? d : display + d);
  }
  function decimal() {
    if (reset) { setDisplay('0.'); setReset(false); return; }
    if (!display.includes('.')) setDisplay(display + '.');
  }
  function clear() { setDisplay('0'); setPrev(null); setOp(null); setReset(false); }
  function toggleSign() { setDisplay(String(-parseFloat(display))); }
  function percent() { setDisplay(String(parseFloat(display) / 100)); }
  function operate(nextOp) {
    if (prev !== null && op) {
      const result = calc(prev, parseFloat(display), op);
      setDisplay(String(result));
      setPrev(result);
    } else {
      setPrev(parseFloat(display));
    }
    setOp(nextOp);
    setReset(true);
  }
  function equals() {
    if (prev !== null && op) {
      const result = calc(prev, parseFloat(display), op);
      setDisplay(String(result));
      setPrev(null);
      setOp(null);
      setReset(true);
    }
  }
  function calc(a, b, op) {
    if (op === '+') return a + b;
    if (op === '-') return a - b;
    if (op === '*') return a * b;
    if (op === '/') return b !== 0 ? a / b : 0;
    return b;
  }

  if (!open) {
    return (
      React.createElement('button', {onClick: () => setOpen(true),
        className:'fixed bottom-20 right-4 z-50 w-12 h-12 flex items-center justify-center shadow-lg transition-transform hover:scale-110',
        style:{background:'var(--primary)', color:'var(--on-primary)', border:'2px solid var(--border-strong)', opacity: 0.92}, title: t('quickCalc', lang)},
        React.createElement('svg', {width:20, height:20, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2, strokeLinecap:'round', strokeLinejoin:'round'},
          React.createElement('rect', {x:4, y:2, width:16, height:20, rx:2}),
          React.createElement('line', {x1:8, y1:6, x2:16, y2:6}),
          React.createElement('line', {x1:8, y1:10, x2:10, y2:10}),
          React.createElement('line', {x1:14, y1:10, x2:16, y2:10}),
          React.createElement('line', {x1:8, y1:14, x2:10, y2:14}),
          React.createElement('line', {x1:14, y1:14, x2:16, y2:14}),
          React.createElement('line', {x1:8, y1:18, x2:16, y2:18})
        )
      )
    );
  }

  const btnStyle = (bg, col) => ({background: bg, color: col, border: 'none', cursor: 'pointer', borderRadius: 'var(--radius)', fontFamily: 'var(--font-mono)', fontSize: '0.95rem', fontWeight: 600});

  return (
    React.createElement('div', {className:'fixed bottom-36 right-4 z-50 shadow-lg', style:{background:'var(--card)', border:'2px solid var(--border-strong)', width:'240px', overflow:'hidden'}},
      React.createElement('div', {className:'flex items-center justify-between px-3 py-2', style:{borderBottom:'1px solid var(--border)'}},
        React.createElement('span', {className:'text-xs font-bold', style:{color:'var(--text)'}}, t('quickCalc', lang)),
        React.createElement('button', {onClick: () => setOpen(false), className:'text-xs px-2 py-0.5 rounded', style:{color:'var(--text-muted)'}},
          React.createElement('svg', {width:12, height:12, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:2},
            React.createElement('line', {x1:18, y1:6, x2:6, y2:18}), React.createElement('line', {x1:6, y1:6, x2:18, y2:18}))
        )
      ),
      React.createElement('div', {className:'px-3 py-2 text-right', style:{fontFamily:'var(--font-mono)', fontSize:'1.5rem', fontWeight:700, color:'var(--text)', minHeight:'2.5rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}},
        display
      ),
      React.createElement('div', {className:'grid grid-cols-4 gap-1 p-2', style:{gridAutoRows:'2.2rem'}},
        React.createElement('button', {onClick: clear, style: btnStyle('var(--bg-2)','var(--text-muted)')}, 'C'),
        React.createElement('button', {onClick: toggleSign, style: btnStyle('var(--bg-2)','var(--text-muted)')}, '+/-'),
        React.createElement('button', {onClick: percent, style: btnStyle('var(--bg-2)','var(--text-muted)')}, '%'),
        React.createElement('button', {onClick: () => operate('/'), style: btnStyle('var(--primary-light)','var(--accent)')}, '\u00F7'),
        ...['7','8','9'].map(d => React.createElement('button', {key:d, onClick: () => input(d), style: btnStyle('var(--bg)','var(--text)')}, d)),
        React.createElement('button', {onClick: () => operate('*'), style: btnStyle('var(--primary-light)','var(--accent)')}, '\u00D7'),
        ...['4','5','6'].map(d => React.createElement('button', {key:d, onClick: () => input(d), style: btnStyle('var(--bg)','var(--text)')}, d)),
        React.createElement('button', {onClick: () => operate('-'), style: btnStyle('var(--primary-light)','var(--accent)')}, '-'),
        ...['1','2','3'].map(d => React.createElement('button', {key:d, onClick: () => input(d), style: btnStyle('var(--bg)','var(--text)')}, d)),
        React.createElement('button', {onClick: () => operate('+'), style: btnStyle('var(--primary-light)','var(--accent)')}, '+'),
        React.createElement('button', {onClick: () => input('0'), style: {...btnStyle('var(--bg)','var(--text)'), gridColumn:'span 2'}}, '0'),
        React.createElement('button', {onClick: decimal, style: btnStyle('var(--bg)','var(--text)')}, '.'),
        React.createElement('button', {onClick: equals, style: btnStyle('var(--primary)','var(--on-primary)')}, '=')
      )
    )
  );
}
