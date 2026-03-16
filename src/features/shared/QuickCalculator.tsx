import { useState } from 'react'
import { useTranslation } from 'react-i18next'

export default function QuickCalculatorButton() {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [display, setDisplay] = useState('0')
  const [prev, setPrev] = useState<number | null>(null)
  const [op, setOp] = useState<string | null>(null)
  const [reset, setReset] = useState(false)

  function input(d: string) {
    if (reset) { setDisplay(d); setReset(false); return }
    setDisplay(display === '0' ? d : display + d)
  }
  function decimal() {
    if (reset) { setDisplay('0.'); setReset(false); return }
    if (!display.includes('.')) setDisplay(display + '.')
  }
  function clear() { setDisplay('0'); setPrev(null); setOp(null); setReset(false) }
  function toggleSign() { setDisplay(String(-parseFloat(display))) }
  function percent() { setDisplay(String(parseFloat(display) / 100)) }
  function operate(nextOp: string) {
    if (prev !== null && op) {
      const result = calc(prev, parseFloat(display), op)
      setDisplay(String(result))
      setPrev(result)
    } else {
      setPrev(parseFloat(display))
    }
    setOp(nextOp)
    setReset(true)
  }
  function equals() {
    if (prev !== null && op) {
      const result = calc(prev, parseFloat(display), op)
      setDisplay(String(result))
      setPrev(null)
      setOp(null)
      setReset(true)
    }
  }
  function calc(a: number, b: number, op: string) {
    if (op === '+') return a + b
    if (op === '-') return a - b
    if (op === '*') return a * b
    if (op === '/') return b !== 0 ? a / b : 0
    return b
  }

  const btnStyle = (bg: string, col: string): React.CSSProperties => ({
    background: bg, color: col, border: 'none', cursor: 'pointer',
    borderRadius: 'var(--radius-sm)', fontFamily: 'var(--font-mono)',
    fontSize: '0.95rem', fontWeight: 600,
  })

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-20 left-4 z-50 w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110"
        style={{ background: 'var(--color-primary)', color: 'white', opacity: 0.85, border: 'none', cursor: 'pointer', boxShadow: 'var(--shadow-lg)' }}
        title={t('quickCalc.title')}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="2" width="16" height="20" rx="2" />
          <line x1="8" y1="6" x2="16" y2="6" />
          <line x1="8" y1="10" x2="10" y2="10" />
          <line x1="14" y1="10" x2="16" y2="10" />
          <line x1="8" y1="14" x2="10" y2="14" />
          <line x1="14" y1="14" x2="16" y2="14" />
          <line x1="8" y1="18" x2="16" y2="18" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed bottom-36 left-4 z-50 rounded-xl overflow-hidden" style={{
      background: 'var(--color-bg-card)', border: '1px solid var(--color-border)',
      width: 240, boxShadow: 'var(--shadow-lg)',
    }}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <span className="text-xs font-bold" style={{ color: 'var(--color-text)' }}>{t('quickCalc.title')}</span>
        <button onClick={() => setOpen(false)} className="text-xs px-2 py-0.5 rounded"
          style={{ color: 'var(--color-text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>
          &times;
        </button>
      </div>
      {/* Display */}
      <div className="px-3 py-2 text-right" style={{
        fontFamily: 'var(--font-mono)', fontSize: '1.5rem', fontWeight: 700,
        color: 'var(--color-text)', minHeight: '2.5rem', overflow: 'hidden',
        textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {display}
      </div>
      {/* Buttons */}
      <div className="grid grid-cols-4 gap-1 p-2" style={{ gridAutoRows: '2.2rem' }}>
        <button onClick={clear} style={btnStyle('var(--color-border-light)', 'var(--color-text-muted)')}>C</button>
        <button onClick={toggleSign} style={btnStyle('var(--color-border-light)', 'var(--color-text-muted)')}>+/-</button>
        <button onClick={percent} style={btnStyle('var(--color-border-light)', 'var(--color-text-muted)')}>%</button>
        <button onClick={() => operate('/')} style={btnStyle('hsl(168,55%,92%)', 'var(--color-primary)')}>&divide;</button>
        {['7', '8', '9'].map(d => <button key={d} onClick={() => input(d)} style={btnStyle('var(--color-bg)', 'var(--color-text)')}>{d}</button>)}
        <button onClick={() => operate('*')} style={btnStyle('hsl(168,55%,92%)', 'var(--color-primary)')}>&times;</button>
        {['4', '5', '6'].map(d => <button key={d} onClick={() => input(d)} style={btnStyle('var(--color-bg)', 'var(--color-text)')}>{d}</button>)}
        <button onClick={() => operate('-')} style={btnStyle('hsl(168,55%,92%)', 'var(--color-primary)')}>-</button>
        {['1', '2', '3'].map(d => <button key={d} onClick={() => input(d)} style={btnStyle('var(--color-bg)', 'var(--color-text)')}>{d}</button>)}
        <button onClick={() => operate('+')} style={btnStyle('hsl(168,55%,92%)', 'var(--color-primary)')}>+</button>
        <button onClick={() => input('0')} style={{ ...btnStyle('var(--color-bg)', 'var(--color-text)'), gridColumn: 'span 2' }}>0</button>
        <button onClick={decimal} style={btnStyle('var(--color-bg)', 'var(--color-text)')}>.</button>
        <button onClick={equals} style={btnStyle('var(--color-primary)', 'white')}>=</button>
      </div>
    </div>
  )
}
