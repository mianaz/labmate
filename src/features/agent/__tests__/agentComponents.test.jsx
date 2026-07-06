import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import ToolCallCard from '../ToolCallCard.jsx';
import PermissionDialog from '../PermissionDialog.jsx';
import AgentMessage from '../AgentMessage.jsx';
import AgentComposer from '../AgentComposer.jsx';

afterEach(cleanup);

describe('ToolCallCard', () => {
  it('shows a human summary and hides raw JSON until Details is opened', () => {
    render(<ToolCallCard name="searchProtocols" args={{ query: 'trizol' }}
      result={{ count: 1, results: [{ name: 'TRIzol RNA Extraction' }] }} lang="en" />);
    expect(screen.getByText('Searched library')).toBeInTheDocument();
    expect(screen.getByText(/TRIzol RNA Extraction/)).toBeInTheDocument();
    // Raw JSON is not present until the user expands Details.
    expect(screen.queryByText(/"count": 1/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(screen.getByText(/"count": 1/)).toBeInTheDocument();
  });
});

describe('AgentMessage', () => {
  it('renders assistant text with bold markup', () => {
    render(<AgentMessage role="assistant" content="Use **PBS** buffer" />);
    expect(screen.getByText('PBS').tagName).toBe('STRONG');
  });
  it('renders nothing for an empty non-streaming message', () => {
    const { container } = render(<AgentMessage role="assistant" content="" />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PermissionDialog', () => {
  it('renders the preview and routes each button to the right decision', () => {
    const onResolve = vi.fn();
    render(<PermissionDialog permission={{ name: 'createExperiment', args: {}, preview: 'Create notebook entry “Prep”' }}
      onResolve={onResolve} lang="en" />);
    expect(screen.getByText(/Create notebook entry/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Allow once' }));
    expect(onResolve).toHaveBeenLastCalledWith('once');
    fireEvent.click(screen.getByRole('button', { name: 'Allow & remember' }));
    expect(onResolve).toHaveBeenLastCalledWith('remember');
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }));
    expect(onResolve).toHaveBeenLastCalledWith('deny');
  });

  it('renders nothing when there is no pending permission', () => {
    const { container } = render(<PermissionDialog permission={null} onResolve={() => {}} lang="en" />);
    expect(container.firstChild).toBeNull();
  });
});

describe('AgentComposer', () => {
  it('sends on Enter but not on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<AgentComposer onSend={onSend} lang="en" />);
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: 'plan a prep' } });

    fireEvent.keyDown(ta, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onSend).toHaveBeenCalledWith('plan a prep');
  });

  it('does not send empty/whitespace input', () => {
    const onSend = vi.fn();
    render(<AgentComposer onSend={onSend} lang="en" />);
    const ta = screen.getByRole('textbox');
    fireEvent.change(ta, { target: { value: '   ' } });
    fireEvent.keyDown(ta, { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('shows a Stop button (not Send) while running and calls onStop', () => {
    const onStop = vi.fn();
    render(<AgentComposer onSend={vi.fn()} onStop={onStop} isRunning disabled lang="en" />);
    expect(screen.queryByRole('button', { name: 'Send' })).not.toBeInTheDocument();
    const stopBtn = screen.getByRole('button', { name: 'Stop' });
    fireEvent.click(stopBtn);
    expect(onStop).toHaveBeenCalled();
  });
});
