import { useState } from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ScientificCalc from '../ScientificCalc.jsx';
import QuickCalculatorButton, { QuickCalcPanel } from '../QuickCalculatorButton.jsx';
import { LangContext } from '../../../i18n/index.js';

afterEach(cleanup);

const click = (name) => fireEvent.click(screen.getByRole('button', { name }));

// The app lifts open/closed state into App.jsx (one panel, triggers in the
// sidebar and the mobile top bar); this harness mirrors that wiring.
function QuickCalcHarness() {
  const [open, setOpen] = useState(false);
  return (
    <LangContext.Provider value="en">
      <QuickCalculatorButton open={open} onToggle={() => setOpen(o => !o)} />
      <QuickCalcPanel open={open} onClose={() => setOpen(false)} />
    </LangContext.Provider>
  );
}
const renderFab = () => render(<QuickCalcHarness />);

describe('QuickCalculatorButton (quick basic calculator)', () => {
  it('opens from its trigger and adds 12 + 3 = 15', () => {
    renderFab();
    click('Calculator'); // open the panel
    click('1'); click('2'); click('add'); click('3'); click('equals');
    expect(screen.getByText('15')).toBeInTheDocument();
  });

  it('divides with a decimal result: 10 ÷ 4 = 2.5', () => {
    renderFab();
    click('Calculator');
    click('1'); click('0'); click('divide'); click('4'); click('equals');
    expect(screen.getByText('2.5')).toBeInTheDocument();
  });

  it('trims floating-point noise: 0.1 + 0.2 = 0.3', () => {
    renderFab();
    click('Calculator');
    click('decimal point'); click('1'); click('add'); click('decimal point'); click('2'); click('equals');
    expect(screen.getByText('0.3')).toBeInTheDocument();
  });

  it('clear resets the display to 0', () => {
    renderFab();
    click('Calculator');
    click('9'); click('9');
    expect(screen.getByText('99')).toBeInTheDocument();
    click('clear');
    expect(screen.getByText('0', { selector: 'div' })).toBeInTheDocument();
  });
});

describe('QuickCalculatorButton panel (docked tool, never a floating FAB)', () => {
  it('reports its state on the trigger and opens a labelled dialog', () => {
    renderFab();
    const trigger = screen.getByRole('button', { name: 'Calculator' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog', { name: 'Calculator' })).not.toBeInTheDocument();
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('dialog', { name: 'Calculator' })).toBeInTheDocument();
  });

  it('closes on Escape and from its close button', () => {
    renderFab();
    click('Calculator');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Calculator' })).not.toBeInTheDocument();
    click('Calculator');
    click('Close');
    expect(screen.queryByRole('dialog', { name: 'Calculator' })).not.toBeInTheDocument();
  });
});

describe('ScientificCalc', () => {
  it('evaluates sin(30) = 0.5 in DEG mode (default)', () => {
    render(<ScientificCalc />);
    click('sin'); click('3'); click('0'); click(')'); click('equals');
    expect(screen.getByText('0.5')).toBeInTheDocument();
  });

  it('respects operator precedence: 2 + 3 × 4 = 14', () => {
    render(<ScientificCalc />);
    click('2'); click('add'); click('3'); click('multiply'); click('4'); click('equals');
    expect(screen.getByText('14')).toBeInTheDocument();
  });

  it('AC clears the expression', () => {
    render(<ScientificCalc />);
    click('7'); click('7');
    expect(screen.getByText('77')).toBeInTheDocument();
    click('clear all');
    expect(screen.getByText('0', { selector: 'div' })).toBeInTheDocument();
  });
});
