import { useIndexedStorage, loadCustomRecipesSync, saveCustomRecipesAsync, loadCustomProtocolsSync, saveCustomProtocolsAsync } from './useIndexedStorage.js';

// Re-export the new hook with same name for backward compatibility
export function useLocalStorage(key, defaultVal) {
  return useIndexedStorage(key, defaultVal);
}

// Sync versions (for initial state) — read from localStorage, async upgrade later
export function loadCustomRecipes() { return loadCustomRecipesSync(); }
export function saveCustomRecipes(arr) { saveCustomRecipesAsync(arr); }
export function loadCustomProtocols() { return loadCustomProtocolsSync(); }
export function saveCustomProtocols(arr) { saveCustomProtocolsAsync(arr); }
