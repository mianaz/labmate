import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { LangContext } from '../../../i18n/index.js';

// Mock the agent context + media hook so the panel renders with a scripted state
// and without pulling in the network provider / matchMedia.
let agentState;
vi.mock('../../../lib/agent/AgentContext.jsx', () => ({
  __esModule: true,
  default: ({ children }) => children,
  useAgent: () => agentState,
}));
vi.mock('../../../hooks/useMediaQuery.js', () => ({
  useIsMobile: () => false,
  useMediaQuery: () => false,
}));

import AgentPanel from '../AgentPanel.jsx';

const renderPanel = (props = {}) =>
  render(
    <LangContext.Provider value="en">
      <AgentPanel open onClose={props.onClose || (() => {})} />
    </LangContext.Provider>
  );

beforeEach(() => {
  agentState = {
    messages: [
      { role: 'user', content: 'find trizol' },
      { role: 'assistant', content: '', tool_calls: [{ id: 'c1', function: { name: 'searchProtocols', arguments: '{"query":"trizol"}' } }] },
      { role: 'tool', tool_call_id: 'c1', name: 'searchProtocols', content: JSON.stringify({ count: 1, results: [{ name: 'TRIzol RNA Extraction' }] }) },
      { role: 'assistant', content: 'Found **TRIzol RNA Extraction**.' },
    ],
    isRunning: true,
    streamingText: 'Scheduling…',
    model: 'minimax-m3',
    setModel: vi.fn(),
    sendMessage: vi.fn(),
    clear: vi.fn(),
    pendingPermission: { name: 'createExperiment', args: {}, preview: 'Create notebook entry “Prep”' },
    resolvePermission: vi.fn(),
  };
});
afterEach(cleanup);

describe('AgentPanel wiring', () => {
  it('renders user bubbles, tool cards (not raw JSON), and the streaming bubble', () => {
    renderPanel();
    // User message
    expect(screen.getByText('find trizol')).toBeInTheDocument();
    // Tool call rendered as a compact card summary, not raw JSON
    expect(screen.getByText('Searched library')).toBeInTheDocument();
    expect(screen.queryByText(/"count": 1/)).not.toBeInTheDocument();
    // Assistant answer (bold markup)
    expect(screen.getAllByText(/TRIzol RNA Extraction/).length).toBeGreaterThan(0);
    // Streaming bubble text is shown while running
    expect(screen.getByText(/Scheduling/)).toBeInTheDocument();
  });

  it('surfaces the pending permission via the dialog', () => {
    renderPanel();
    expect(screen.getByText('The agent wants to:')).toBeInTheDocument();
    expect(screen.getByText(/Create notebook entry/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Allow once' }));
    expect(agentState.resolvePermission).toHaveBeenLastCalledWith('once');
  });

  it('offers all three models with the default selected', () => {
    renderPanel();
    const select = screen.getByRole('combobox');
    expect(select.value).toBe('minimax-m3');
    expect(screen.getByRole('option', { name: /MiniMax M3/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /DeepSeek V4/ })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /GLM-5.2/ })).toBeInTheDocument();
  });

  it('closes via the header close button', () => {
    const onClose = vi.fn();
    renderPanel({ onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Close assistant' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('shows the empty state (intro + examples) when there are no messages', () => {
    agentState = { ...agentState, messages: [], isRunning: false, streamingText: '', pendingPermission: null };
    renderPanel();
    expect(screen.getByText(/Plans experiments by retrieving/)).toBeInTheDocument();
    // Example prompt chips are clickable and call sendMessage
    const chip = screen.getByText(/Plan a TRIzol RNA extraction/);
    fireEvent.click(chip);
    expect(agentState.sendMessage).toHaveBeenCalled();
  });
});
