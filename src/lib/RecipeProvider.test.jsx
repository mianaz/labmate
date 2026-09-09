import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';

// Control the verifier so we can prove the fail-closed wiring without real crypto.
vi.mock('./recipeVerify.js', () => ({ verifyRecipeManifest: vi.fn() }));
import { verifyRecipeManifest } from './recipeVerify.js';
import RecipeProvider, { useRecipes } from './RecipeProvider.jsx';

const LOCAL = [{ id: 'L1', category: 'protocol', title: 'Local A' }, { id: 'L2', category: 'buffer', title: 'Local B' }];
// A verified remote must be a superset of the bundled ids (favorites/progress/notebook
// entries are keyed by id), so the "good" remote carries L1+L2 plus one new recipe.
const REMOTE = [{ id: 'L1', category: 'protocol', title: 'Local A v2' }, { id: 'L2', category: 'buffer', title: 'Local B v2' }, { id: 'R3', category: 'buffer', title: 'Remote 3' }];
const REMOTE_DROPS_IDS = [{ id: 'R1', category: 'protocol', title: 'Remote 1' }, { id: 'R2', category: 'protocol', title: 'Remote 2' }, { id: 'R3', category: 'buffer', title: 'Remote 3' }];

function bufOf(obj) { return new TextEncoder().encode(JSON.stringify(obj)).buffer; }

function Probe() {
  const { recipes, refresh } = useRecipes();
  return (<div><span data-testid="count">{recipes.length}</span><button onClick={() => refresh()}>refresh</button></div>);
}

describe('RecipeProvider — verified remote refresh, fail-closed', () => {
  let calls;
  let remotePayload;
  beforeEach(() => {
    calls = [];
    remotePayload = REMOTE;
    const store = new Map(); // jsdom localStorage is unreliable under vitest — stub it
    vi.stubGlobal('localStorage', {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      clear: () => store.clear(),
    });
    vi.stubGlobal('fetch', vi.fn((url) => {
      const u = String(url); calls.push(u);
      if (u.includes('manifest.json')) return Promise.resolve({ ok: true, json: () => Promise.resolve({ alg: 'ed25519', version: 5, generatedAt: 't', sha256: 'h', sig: 's' }) });
      if (u.includes('raw.githubusercontent.com')) return Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(bufOf(remotePayload)) });
      return Promise.resolve({ ok: true, json: () => Promise.resolve(LOCAL) }); // same-origin local
    }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it('ingests the remote library when the manifest verifies', async () => {
    verifyRecipeManifest.mockResolvedValue({ ok: true, version: 5 });
    render(<RecipeProvider><Probe /></RecipeProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2')); // local on mount

    await act(async () => { fireEvent.click(screen.getByText('refresh')); });
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('3')); // remote after verify

    expect(calls.some((u) => u.includes('manifest.json'))).toBe(true);
    expect(calls.some((u) => u.includes('raw.githubusercontent.com'))).toBe(true);
  });

  it('falls back to the trusted local library when verification fails (fail-closed)', async () => {
    verifyRecipeManifest.mockResolvedValue({ ok: false, reason: 'bad_signature' });
    render(<RecipeProvider><Probe /></RecipeProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    calls.length = 0;

    await act(async () => { fireEvent.click(screen.getByText('refresh')); });
    // stays on local (2), and a local (same-origin) recipes.json fetch happened during the fallback
    await waitFor(() => expect(calls.some((u) => u.includes('recipes.json') && !u.includes('raw.githubusercontent.com'))).toBe(true));
    expect(screen.getByTestId('count').textContent).toBe('2');
  });

  it('rejects a verified remote that drops ids present in the bundled library', async () => {
    remotePayload = REMOTE_DROPS_IDS; // valid signature, but L1/L2 are gone
    verifyRecipeManifest.mockResolvedValue({ ok: true, version: 5 });
    render(<RecipeProvider><Probe /></RecipeProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));
    calls.length = 0;

    await act(async () => { fireEvent.click(screen.getByText('refresh')); });
    // missing ids → fail-closed → stays on local (2) and does not record the new version floor
    await waitFor(() => expect(calls.some((u) => u.includes('recipes.json') && !u.includes('raw'))).toBe(true));
    expect(screen.getByTestId('count').textContent).toBe('2');
    expect(globalThis.localStorage.getItem('labmate:recipesVersion')).toBe(null);
  });

  it('rejects a rolled-back version even if the signature is valid', async () => {
    globalThis.localStorage.setItem('labmate:recipesVersion', '10'); // last seen newer than remote v5
    verifyRecipeManifest.mockResolvedValue({ ok: true, version: 5 });
    render(<RecipeProvider><Probe /></RecipeProvider>);
    await waitFor(() => expect(screen.getByTestId('count').textContent).toBe('2'));

    await act(async () => { fireEvent.click(screen.getByText('refresh')); });
    // rollback → fail-closed → stays on local (2), does not ingest the 3-item remote
    await waitFor(() => expect(calls.some((u) => u.includes('recipes.json') && !u.includes('raw'))).toBe(true));
    expect(screen.getByTestId('count').textContent).toBe('2');
  });
});
