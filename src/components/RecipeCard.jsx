import { t, useLang } from '../i18n/index.js';
import { S_TEXT, S_MUTED } from '../lib/styleConstants.js';
import { useFavs } from './Favorites.jsx';
import { useToast } from './Toast.jsx';
import { PROTOCOL_SUBCAT_BY_ID, CATEGORY_DISPLAY } from '../data/protocolCategories.js';

function RecipeCard({ recipe, onSelect, selected }) {
  const lang = useLang();
  const { isFav, toggle } = useFavs();
  const toast = useToast();
  const catColors = {
    buffer: { bg: 'var(--cat-buffer-bg)', text: 'var(--cat-buffer)' },
    protocol: { bg: 'var(--cat-protocol-bg)', text: 'var(--cat-protocol)' },
    staining: { bg: 'var(--cat-staining-bg)', text: 'var(--cat-staining)' },
    media: { bg: 'var(--cat-media-bg)', text: 'var(--cat-media)' },
  };
  const cc = catColors[recipe.category] || catColors.buffer;
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
            style={{color: fav ? 'var(--fav-star)' : 'var(--text-muted)', opacity: fav ? 1 : 0.4, background: 'none', border: 'none', padding: 0, lineHeight: 1}}>
            {fav ? '★' : '☆'}
          </button>
          <span className="text-[10px] font-semibold whitespace-nowrap" style={{ color: cc.text }}>
            {(() => {
              const disc = (recipe.discipline || [])[0];
              const discLabels = { molecular: t('discMolecular', lang), cell: t('discCell', lang), protein: t('discProtein', lang), rna_dna: t('discRnaDna', lang), immunology: t('discImmunology', lang), microbiology: t('discMicrobiology', lang), biochemistry: t('discBiochemistry', lang), histology: t('discHistology', lang), genomics: t('discGenomics', lang), general: t('discGeneral', lang) };
              if (disc && discLabels[disc]) return discLabels[disc];
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

export default RecipeCard;
