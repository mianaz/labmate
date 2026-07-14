import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ScientificCalc from '../ScientificCalc.jsx';
import QuickCalculatorButton from '../QuickCalculatorButton.jsx';
import { LangContext } from '../../../i18n/index.js';

afterEach(cleanup);

const click = (name) => fireEvent.click(screen.getByRole('button', { name }));
const renderFab = () => render(
  <LangContext.Provider value="en"><QuickCalculatorButton /></LangContext.Provider>
);

describe('QuickCalculatorButton (floating basic calculator)', () => {
  it('opens from the FAB and adds 12 + 3 = 15', () => {
    renderFab();
    click('Calculator'); // open the FAB
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

describe('QuickCalculatorButton positioning (never overlaps timer / agent FABs)', () => {
  const bottomOf = (agentAvailable) => {
    render(
      <LangContext.Provider value="en"><QuickCalculatorButton agentAvailable={agentAvailable} /></LangContext.Provider>
    );
    return screen.getByRole('button', { name: 'Calculator' }).style.bottom;
  };
  it('sits one row above the timer when the agent launcher is absent', () => {
    // Timer is at row 0 (var(--fab-b)); calc takes row 1 (+3.75rem).
    expect(bottomOf(false)).toContain('3.75rem');
  });
  it('sits one row above the agent launcher when it is present', () => {
    // Timer row 0, agent launcher row 1 (+3.75rem); calc takes row 2 (+7.5rem).
    expect(bottomOf(true)).toContain('7.5rem');
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
