import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

const BUFFER_CATEGORIES = ['buffer', 'staining', 'media'];
const GITHUB_RECIPES_URL = 'https://raw.githubusercontent.com/mianaz/labmate-recipes/main/dist/recipes.json';

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
    fetch(import.meta.env.BASE_URL + 'recipes.json?t=' + Date.now())
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

  // Refresh from GitHub
  const refresh = useCallback(async () => {
    setSyncing(true);
    try {
      let data;
      try {
        const res = await fetch(GITHUB_RECIPES_URL + '?t=' + Date.now());
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json();
      } catch {
        const res2 = await fetch(import.meta.env.BASE_URL + 'recipes.json?t=' + Date.now());
        data = await res2.json();
      }
      setRecipes(data);
      return { total: data.length, newCount: Math.max(0, data.length - recipes.length) };
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
