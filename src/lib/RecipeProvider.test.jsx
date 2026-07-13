import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import RecipeProvider, { useRecipes } from './RecipeProvider.jsx';

// Guards the recipe-ingestion trust boundary: recipes feed the agent's
// createExperiment derivation (stamped provenance.verified), so the app must
// only ever ingest the trusted same-origin library. The old cross-origin
// "sync from GitHub" (raw.githubusercontent.com) had no integrity check and is
// disabled — this test fails if any code path reaches for a remote/absolute URL.

const SAMPLE = [
  { id: 'p1', category: 'protocol', title: 'Protocol A' },
  { id: 'b1', category: 'buffer', title: 'Buffer B' },
];

function Probe() {
  const { recipes, refresh } = useRecipes();
  return (
    <div>
      <span data-testid="count">{recipes.length}</span>
      <button onClick={() => refresh()}>refresh</button>
    </div>
  );
}

describe('RecipeProvider — recipe ingestion trust boundary', () => {
  let fetchCalls;

  beforeEach(() => {
    fetchCalls = [];
    vi.stubGlobal('fetch', vi.fn((url) => {
      fetchCalls.push(String(url));
      return Promise.resolve({ ok: true, json: () => Promise.resolve(SAMPLE) });
    }));
  });

  afterEach(() => { vi.unstubAllGlobals(); });

  it('loads from the same-origin bundle on mount — no cross-origin fetch', async () => {
    render(<RecipeProvider><Probe /></RecipeProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));

    expect(fetchCalls.length).toBeGreaterThan(0);
    for (const u of fetchCalls) {
      expect(u).toMatch(/recipes\.json/);
      expect(u).not.toMatch(/githubusercontent|raw\.github|:\/\//);
    }
  });

  it('manual refresh reloads the trusted copy and still never fetches cross-origin', async () => {
    render(<RecipeProvider><Probe /></RecipeProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    fetchCalls.length = 0;

    await act(async () => { fireEvent.click(screen.getByText('refresh')); });
    await waitFor(() => expect(fetchCalls.length).toBeGreaterThan(0));

    for (const u of fetchCalls) {
      expect(u).toMatch(/recipes\.json/);
      expect(u).not.toMatch(/githubusercontent|raw\.github|:\/\//);
    }
  });
});
