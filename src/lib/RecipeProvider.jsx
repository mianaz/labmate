import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

const BUFFER_CATEGORIES = ['buffer', 'staining', 'media'];

// Recipe ingestion trust boundary
// ────────────────────────────────
// Recipes feed the agent's createExperiment derivation, which stamps
// provenance.verified — so a poisoned library would launder attacker-authored
// protocol steps into "verified" experiments (see agent/tools.js). The ONLY
// trusted source is the same-origin bundled recipes.json, shipped fresh on every
// deploy. The old cross-origin "sync from GitHub" (raw.githubusercontent.com)
// had NO integrity check, so it is DISABLED. Re-enable a remote source ONLY
// behind a fail-closed signed-manifest verifier: an ed25519 detached signature
// over {version, generatedAt, sha256(recipes.json)}, public key pinned in the
// bundle, hash checked against the RAW bytes, and a monotonic version floor for
// rollback protection. Until that ships, the untrusted path stays off.
const recipesUrl = () => import.meta.env.BASE_URL + 'recipes.json';

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

  // Reload the trusted same-origin library (each deploy ships the latest recipes).
  // Deliberately NO cross-origin fetch — an unverified remote payload must never
  // reach the agent's derivation. See the trust-boundary note above.
  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      const res = await fetch(recipesUrl() + '?t=' + Date.now());
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const prevLen = recipes.length;
      setRecipes(data);
      return { total: data.length, newCount: Math.max(0, data.length - prevLen) };
    } catch (err) {
      console.error('Refresh failed:', err);
      throw err;
    } finally {
      setSyncing(false);
    }
  }, [recipes.length]);

  const value = useMemo(() => ({
    recipes, bufferRecipes, protocolRecipes, recipeById,
    loading, syncing, refresh
  }), [recipes, bufferRecipes, protocolRecipes, recipeById, loading, syncing, refresh]);

  return <RecipeContext.Provider value={value}>{children}</RecipeContext.Provider>;
}
