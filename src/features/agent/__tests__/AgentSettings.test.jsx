import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { LangContext } from '../../../i18n/index.js';

// Mock the agent context (same pattern as AgentPanel.test) and the network
// probes, so the modal renders with scripted state and no real fetches.
let agentState;
vi.mock('../../../lib/agent/AgentContext.jsx', () => ({
  __esModule: true,
  default: ({ children }) => children,
  useAgent: () => agentState,
}));

const probes = { fetchByokModels: vi.fn(), testByokConnection: vi.fn() };
vi.mock('../../../lib/agent/providers/byokProbe.js', () => ({
  __esModule: true,
  fetchByokModels: (...a) => probes.fetchByokModels(...a),
  testByokConnection: (...a) => probes.testByokConnection(...a),
}));

import AgentSettings from '../AgentSettings.jsx';

const renderSettings = (props = {}) =>
  render(
    <LangContext.Provider value="en">
      <AgentSettings open onClose={props.onClose || (() => {})} lang="en" />
    </LangContext.Provider>
  );

beforeEach(() => {
  agentState = { byokConfig: null, updateByokConfig: vi.fn(async () => {}) };
  probes.fetchByokModels.mockReset();
  probes.testByokConnection.mockReset();
});
afterEach(cleanup);

describe('AgentSettings', () => {
  it('renders all presets, a masked key input, and the egress disclosure', () => {
    renderSettings();
    for (const label of ['OpenRouter', 'Groq', 'DeepSeek', 'Gemini (OpenAI-compatible)',
      'Ollama (local)', 'LM Studio (local)', 'Anthropic (direct)', 'Custom']) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
    }
    expect(screen.getByLabelText('API key')).toHaveAttribute('type', 'password');
    expect(screen.getByText(/sent directly from this browser to the provider/)).toBeInTheDocument();
    // Redaction defaults ON, no warning shown
    expect(screen.getByLabelText(/Redact on-device data/)).toBeChecked();
    expect(screen.queryByText(/Warning: with redaction off/)).not.toBeInTheDocument();
  });

  it('fills the base URL from the chosen preset', () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'groq' } });
    expect(screen.getByLabelText('Base URL').value).toBe('https://api.groq.com/openai/v1');
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'gemini' } });
    expect(screen.getByLabelText('Base URL').value).toBe('https://generativelanguage.googleapis.com/v1beta/openai');
  });

  it('hides the key input and redaction toggle for a local preset', () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'ollama' } });
    expect(screen.getByLabelText('Base URL').value).toBe('http://localhost:11434/v1');
    expect(screen.queryByLabelText('API key')).not.toBeInTheDocument();
    expect(screen.getByText(/no API key needed/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Redact on-device data/)).not.toBeInTheDocument();
    expect(screen.getByText(/requests stay on this device/)).toBeInTheDocument();
  });

  it('shows the redaction warning when the toggle is turned off', () => {
    renderSettings();
    fireEvent.click(screen.getByLabelText(/Redact on-device data/));
    expect(screen.getByText(/Warning: with redaction off/)).toBeInTheDocument();
  });

  it('saves the select.js config shape via updateByokConfig and closes', async () => {
    const onClose = vi.fn();
    renderSettings({ onClose });
    fireEvent.click(screen.getByLabelText('Use my own AI provider'));
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'groq' } });
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: ' gsk_secret ' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'llama-3.3-70b' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(agentState.updateByokConfig).toHaveBeenCalledWith({
      enabled: true,
      preset: 'groq',
      provider: 'openaiCompat',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: 'gsk_secret', // trimmed
      model: 'llama-3.3-70b',
      local: false,
      disableRedaction: false,
    });
  });

  it('saves a local preset with no key and redaction forced off', async () => {
    renderSettings();
    fireEvent.click(screen.getByLabelText('Use my own AI provider'));
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'lmstudio' } });
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'qwen-2.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(agentState.updateByokConfig).toHaveBeenCalled());
    expect(agentState.updateByokConfig).toHaveBeenCalledWith(expect.objectContaining({
      preset: 'lmstudio', local: true, apiKey: '', disableRedaction: false,
      baseUrl: 'http://localhost:1234/v1',
    }));
  });

  it('fetch-models lists the returned ids and reports the count', async () => {
    probes.fetchByokModels.mockResolvedValue(['a-model', 'b-model']);
    renderSettings();
    fireEvent.click(screen.getByRole('button', { name: 'Fetch models' }));
    await waitFor(() => expect(screen.getByText('Found 2 models.')).toBeInTheDocument());
    expect(probes.fetchByokModels).toHaveBeenCalledWith(expect.objectContaining({
      baseUrl: 'https://openrouter.ai/api/v1', provider: 'openaiCompat',
    }));
    // datalist options for the model field
    expect(document.querySelectorAll('#byok-model-options option')).toHaveLength(2);
  });

  it('hides the fetch-models button for Anthropic-direct paths without modelsPath', () => {
    renderSettings();
    fireEvent.change(screen.getByLabelText('Provider'), { target: { value: 'anthropic' } });
    expect(screen.queryByRole('button', { name: 'Fetch models' })).not.toBeInTheDocument();
  });

  it('test-connection reports failure with the provider message', async () => {
    probes.testByokConnection.mockResolvedValue({ ok: false, status: 401, message: 'invalid api key' });
    renderSettings();
    fireEvent.change(screen.getByLabelText('Model'), { target: { value: 'm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByText(/Connection failed — invalid api key/)).toBeInTheDocument());
  });

  it('loads the saved config into the form when opened', () => {
    agentState.byokConfig = {
      enabled: true, preset: 'deepseek', provider: 'openaiCompat',
      baseUrl: 'https://api.deepseek.com', apiKey: 'sk-d', model: 'deepseek-chat',
      local: false, disableRedaction: true,
    };
    renderSettings();
    expect(screen.getByLabelText('Use my own AI provider')).toBeChecked();
    expect(screen.getByLabelText('Provider').value).toBe('deepseek');
    expect(screen.getByLabelText('Model').value).toBe('deepseek-chat');
    expect(screen.getByLabelText(/Redact on-device data/)).not.toBeChecked();
    expect(screen.getByText(/Warning: with redaction off/)).toBeInTheDocument();
  });
});
