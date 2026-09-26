import { useCallback } from 'react';
import { loadCustomRecipes, saveCustomRecipes } from '../../hooks/useLocalStorage.js';
import { BUFFER_CATEGORIES } from '../../data/protocolCategories.js';
import { useRecipes } from '../../lib/RecipeProvider.jsx';
import LibraryView from '../library/LibraryView.jsx';

const DISCIPLINES = ['molecular', 'cell', 'protein', 'rna_dna', 'immunology', 'microbiology', 'general'];

// Custom entries saved from the "New recipe" form that belong in this library.
const normalizeCustom = (arr) => arr
  .filter(r => BUFFER_CATEGORIES.includes(r.category))
  .map(r => ({ ...r, _isCustom: true }));
const acceptsExternal = (r) => BUFFER_CATEGORIES.includes(r.category);

function BuffersTab({ externalSelected, setExternalSelected, onCrossNavigate }) {
  const { bufferRecipes } = useRecipes();
  const load = useCallback(() => loadCustomRecipes(), []);
  return (
    <LibraryView
      tab="buffers"
      items={bufferRecipes}
      loadCustom={load}
      saveCustom={saveCustomRecipes}
      normalizeCustom={normalizeCustom}
      acceptsExternal={acceptsExternal}
      disciplines={DISCIPLINES}
      isProtocol={false}
      sidebarKey="labmate_buffers_sidebar_hidden"
      newLabelKey="addCustomRecipe"
      descKey="pageRecipesDesc"
      backKey="allRecipesBack"
      externalSelected={externalSelected}
      setExternalSelected={setExternalSelected}
      onCrossNavigate={onCrossNavigate}
    />
  );
}

export default BuffersTab;
