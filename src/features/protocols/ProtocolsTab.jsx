import { useCallback } from 'react';
import { loadCustomProtocols, saveCustomProtocols } from '../../hooks/useLocalStorage.js';
import { useRecipes } from '../../lib/RecipeProvider.jsx';
import LibraryView from '../library/LibraryView.jsx';

const DISCIPLINES = ['protein', 'cell', 'molecular', 'rna_dna', 'immunology', 'microbiology', 'genomics'];

// Every custom protocol is shown here, tagged as a protocol.
const normalizeCustom = (arr) => arr.map(r => ({ ...r, _isCustom: true, category: 'protocol' }));
const acceptsExternal = (r) => r.category === 'protocol';

function ProtocolsTab({ externalSelected, setExternalSelected, onCrossNavigate }) {
  const { protocolRecipes } = useRecipes();
  const load = useCallback(() => loadCustomProtocols(), []);
  return (
    <LibraryView
      tab="protocols"
      items={protocolRecipes}
      loadCustom={load}
      saveCustom={saveCustomProtocols}
      normalizeCustom={normalizeCustom}
      acceptsExternal={acceptsExternal}
      disciplines={DISCIPLINES}
      isProtocol
      sidebarKey="labmate_protocols_sidebar_hidden"
      newLabelKey="addCustomProtocol"
      descKey="pageProtocolsDesc"
      backKey="allProtocolsBack"
      externalSelected={externalSelected}
      setExternalSelected={setExternalSelected}
      onCrossNavigate={onCrossNavigate}
    />
  );
}

export default ProtocolsTab;
