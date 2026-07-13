import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';
import { verifyRecipeManifest } from './recipeVerify.js';

const BUFFER_CATEGORIES = ['buffer', 'staining', 'media'];

// Recipe ingestion trust boundary
// ────────────────────────────────
// Recipes feed the agent's createExperiment derivation, which stamps
// provenance.verified — so a poisoned library would launder attacker-authored
// protocol steps into "verified" experiments (see agent/tools.js). Two sources,
// both gated:
//   • Initial load / fallback: the same-origin bundled recipes.json, shipped
//     fresh on every deploy — trusted (whoever deploys controls it).
//   • Manual "Refresh": the remote library at labmate-recipes, ingested ONLY
//     behind a fail-closed ed25519 signed-manifest check (see recipeVerify.js).
//     A monotonic version floor guards against rollback. Any failure — offline,
//     bad signature, hash mismatch, older version — falls back to the trusted
//     bundled copy. An unverified remote payload never reaches the agent.
const recipesUrl = () => import.meta.env.BASE_URL + 'recipes.json';
const REMOTE_BASE = 'https://raw.githubusercontent.com/mianaz/labmate-recipes/main/dist/';
const LAST_VERSION_KEY = 'labmate:recipesVersion'; // monotonic floor; localStorage is fine (not a secret)

const RecipeContext = createContext(null);

export function useRecipes() {
  return useContext(RecipeContext);
}

export default function RecipeProvider({ children }) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  // Derived data
  const bufferRecipes = useMemo(() => recipes.filter(r => BUFFER_CATEGORIES.includes(r.category)), [recipes]);
  const protocolRecipes = useMemo(() => recipes.filter(r => r.category === 'protocol'), [recipes]);
  const recipeById = useMemo(() => {
    const map = {};
    recipes.forEach(r => { map[r.id] = r; });
    return map;
  }, [recipes]);

  // Initial load from local recipes.json
  useEffect(() => {
    // Absolute-from-base (not page-relative): a bare relative fetch resolves
    // against the CURRENT url, which is now one segment deeper under locale-
    // prefixed routing (/labmate/en/recipes vs. the old /labmate/recipes) and
    // would 404. import.meta.env.BASE_URL is always '/labmate/' regardless of
    // route depth.
    fetch(recipesUrl() + '?t=' + Date.now())
      .then(res => res.json())
      .then(data => {
        setRecipes(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load recipes:', err);
        setLoading(false);
      });
  }, []);

  // Fall back to the trusted same-origin library.
  const loadLocal = useCallback(async (prevLen) => {
    const res = await fetch(recipesUrl() + '?t=' + Date.now());
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    setRecipes(data);
    return { total: data.length, newCount: Math.max(0, data.length - (prevLen ?? recipes.length)), verified: false };
  }, [recipes.length]);

  // Manual refresh: fetch the signed remote library + manifest, verify fail-closed
  // against the pinned key with a monotonic version floor, and only then ingest.
  // Any failure falls back to the trusted bundled copy — an unverified payload
  // never reaches the agent. See recipeVerify.js.
  const refresh = useCallback(async () => {
    setSyncing(true);
    const prevLen = recipes.length;
    try {
      const [manifestRes, recipesRes] = await Promise.all([
        fetch(REMOTE_BASE + 'manifest.json?t=' + Date.now()),
        fetch(REMOTE_BASE + 'recipes.json?t=' + Date.now()),
      ]);
      if (!manifestRes.ok || !recipesRes.ok) throw new Error('remote_unavailable');
      const manifest = await manifestRes.json();
      const recipesBytes = new Uint8Array(await recipesRes.arrayBuffer());
      const result = await verifyRecipeManifest(recipesBytes, manifest);
      if (!result.ok) throw new Error('verify_failed:' + result.reason);
      const lastSeen = Number(localStorage.getItem(LAST_VERSION_KEY) || 0);
      if (result.version < lastSeen) throw new Error('rollback');
      const data = JSON.parse(new TextDecoder().decode(recipesBytes));
      setRecipes(data);
      try { localStorage.setItem(LAST_VERSION_KEY, String(result.version)); } catch { /* storage off */ }
      return { total: data.length, newCount: Math.max(0, data.length - prevLen), verified: true };
    } catch (err) {
      // Fail closed: keep the app on the trusted same-origin library.
      console.warn('Verified remote sync unavailable, using local library:', err?.message || err);
      return loadLocal(prevLen);
    } finally {
      setSyncing(false);
    }
  }, [recipes.length, loadLocal]);

  const value = useMemo(() => ({
    recipes, bufferRecipes, protocolRecipes, recipeById,
    loading, syncing, refresh
  }), [recipes, bufferRecipes, protocolRecipes, recipeById, loading, syncing, refresh]);

  return <RecipeContext.Provider value={value}>{children}</RecipeContext.Provider>;
}
