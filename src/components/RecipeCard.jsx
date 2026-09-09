import { memo } from 'react';
import { t, useLang } from '../i18n/index.js';
import { S_TEXT, S_MUTED } from '../lib/styleConstants.js';
import { useFavs } from './Favorites.jsx';
import { useToast } from './Toast.jsx';
import { PROTOCOL_SUBCAT_BY_ID, CATEGORY_DISPLAY } from '../data/protocolCategories.js';

const CAT_COLORS = {
  buffer: { bg: 'var(--cat-buffer-bg)', text: 'var(--cat-buffer)' },
  protocol: { bg: 'var(--cat-protocol-bg)', text: 'var(--cat-protocol)' },
  staining: { bg: 'var(--cat-staining-bg)', text: 'var(--cat-staining)' },
  media: { bg: 'var(--cat-media-bg)', text: 'var(--cat-media)' },
};
const DISC_KEYS = {
  molecular: 'discMolecular', cell: 'discCell', protein: 'discProtein', rna_dna: 'discRnaDna',
  immunology: 'discImmunology', microbiology: 'discMicrobiology', biochemistry: 'discBiochemistry',
  histology: 'discHistology', genomics: 'discGenomics', general: 'discGeneral',
};

function RecipeCard({ recipe, onSelect, selected }) {
  const lang = useLang();
  const { isFav, toggle } = useFavs();
  const toast = useToast();
  const cc = CAT_COLORS[recipe.category] || CAT_COLORS.buffer;
  const fav = isFav(recipe.id);
  return (
    <div
      onClick={() => onSelect(recipe)}
      className={`card p-5 cursor-pointer transition-all ${selected ? 'recipe-selected' : ''}`}>
      <div className="flex items-start justify-between mb-2">
        <div style={{flex:1, minWidth:0}}>
          <h3 className="font-semibold text-sm" style={S_TEXT}>{recipe.name}</h3>
          {lang === 'zh' && <p className="text-xs" style={S_MUTED}>{recipe.nameCn}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          <button className={`fav-star text-sm ${fav ? 'active' : ''}`}
            aria-label={fav ? t('removedFav', lang) : t('addedFav', lang)}
            onClick={e => { e.stopPropagation(); toggle(recipe.id); toast.show(fav ? t('removedFav', lang) : t('addedFav', lang), ''); }}
            style={{color: fav ? 'var(--fav-star)' : 'var(--text-muted)', opacity: fav ? 1 : 0.4, background: 'none', border: 'none', lineHeight: 1, padding: 13, margin: -13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0}}>
            {fav ? '★' : '☆'}
          </button>
          <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: cc.text }}>
            {(() => {
              const disc = (recipe.discipline || [])[0];
              if (disc && DISC_KEYS[disc]) return t(DISC_KEYS[disc], lang);
              const displayCat = recipe.category === 'protocol' ? (PROTOCOL_SUBCAT_BY_ID[recipe.id] || 'protocol') : recipe.category;
              const label = CATEGORY_DISPLAY[displayCat];
              return label ? (label[lang] || label.en) : displayCat;
            })()}
          </span>
          {recipe._isCustom && <span className="text-[10px] font-semibold px-1.5 py-0.5"
            style={{background:'var(--accent-light)', color:'var(--accent)'}}>{t('customBadge', lang)}</span>}
        </div>
      </div>

    </div>
  );
}

// The list renders up to ~230 of these; memo so a toast, a favorite toggle or a
// search keystroke elsewhere doesn't re-render every card.
export default memo(RecipeCard);
