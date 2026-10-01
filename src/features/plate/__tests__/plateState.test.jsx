import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import PlateTab from '../PlateTab.jsx';
import ToastProvider from '../../../components/Toast.jsx';
import { LangContext } from '../../../i18n/index.js';
import { PLATE_STORE_KEY, loadPlateState, toStoredPlate } from '../plateState.js';

const stored = () => JSON.parse(localStorage.getItem(PLATE_STORE_KEY));

function renderPlate() {
  return render(
    <LangContext.Provider value="en">
      <ToastProvider><PlateTab /></ToastProvider>
    </LangContext.Provider>
  );
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('loadPlateState', () => {
  it('cleans up a saved layout from an old or hand-edited backup', () => {
    const s = loadPlateState({
      plateType: 24,
      wellData: { A1: { color: '#3b82f6', label: 'DMSO' }, Z9: { color: 'red', label: 'bad key' }, D7: { color: 'red', label: 'off the plate' }, B2: { color: 'url(x)', label: 5 } },
      groups: [{ label: 'DMSO', color: '#3b82f6', wells: ['A1', 'D7'] }, { label: 'gone', wells: ['C3'] }, null],
      colorIdx: 27, useCustom: 1, customColor: 'nope',
    });
    expect(s.plateType).toBe(24);
    expect(s.wellData).toEqual({ A1: { color: '#3b82f6', label: 'DMSO' }, B2: { color: '#3b82f6', label: '5' } });
    expect(s.groups).toEqual([{ label: 'DMSO', color: '#3b82f6', wells: ['A1'] }]);
    expect(s.colorIdx).toBe(2);
    expect(s.useCustom).toBe(true);
    expect(s.customColor).toBe('#ff0000');
  });

  it('falls back to an empty 96-well plate', () => {
    expect(loadPlateState(null)).toEqual({ plateType: 96, wellData: {}, groups: [], colorIdx: 0, useCustom: false, customColor: '#ff0000' });
    expect(loadPlateState({ plateType: 7 }).plateType).toBe(96);
  });
});

describe('toStoredPlate', () => {
  it('keeps nothing for an untouched 96-well plate', () => {
    expect(toStoredPlate({ plateType: 96, wellData: {}, groups: [], colorIdx: 0, useCustom: false, customColor: '#ff0000' })).toBeNull();
  });

  it('round-trips through loadPlateState', () => {
    const layout = { plateType: 384, wellData: { P24: { color: '#ef4444', label: 'blank' } }, groups: [{ label: 'blank', color: '#ef4444', wells: ['P24'] }], colorIdx: 26, useCustom: false, customColor: '#00ff00' };
    expect(loadPlateState(JSON.parse(JSON.stringify(toStoredPlate(layout))))).toEqual({ ...layout, colorIdx: 1 });
  });
});

describe('PlateTab persistence (labmate_plate)', () => {
  it('restores a saved layout on load', () => {
    localStorage.setItem(PLATE_STORE_KEY, JSON.stringify({
      plateType: 24,
      wellData: { A1: { color: '#3b82f6', label: 'DMSO' } },
      groups: [{ label: 'DMSO', color: '#3b82f6', wells: ['A1'] }],
      colorIdx: 1,
    }));
    renderPlate();
    expect(screen.getByLabelText('Plate Type')).toHaveValue('24');
    expect(screen.getByTitle('A1: DMSO')).toBeInTheDocument();
    // …and mounting did not wipe it.
    expect(stored().wellData.A1.label).toBe('DMSO');
  });

  it('saves a newly labelled well, and a plate-type change starts over', () => {
    renderPlate();
    expect(localStorage.getItem(PLATE_STORE_KEY)).toBeNull();
    fireEvent.mouseDown(screen.getByTitle('B3'), { button: 0 });
    act(() => { window.dispatchEvent(new window.MouseEvent('mouseup')); });
    fireEvent.change(screen.getByLabelText('Label / Condition'), { target: { value: 'siRNA #1' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm/ }));
    expect(stored().plateType).toBe(96);
    expect(stored().wellData.B3.label).toBe('siRNA #1');
    expect(stored().groups[0]).toMatchObject({ label: 'siRNA #1', wells: ['B3'] });

    fireEvent.change(screen.getByLabelText('Plate Type'), { target: { value: '48' } });
    expect(stored()).toMatchObject({ plateType: 48, wellData: {}, groups: [] });
  });
});
