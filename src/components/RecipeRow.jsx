import { memo } from 'react';
import { t, useLang } from '../i18n/index.js';
import { useFavs } from './Favorites.jsx';
import { useToast } from './Toast.jsx';
import { PROTOCOL_SUBCAT_BY_ID, CATEGORY_DISPLAY } from '../data/protocolCategories.js';
import { IconStar } from './icons.jsx';

export const CAT_COLORS = {
  buffer: { bg: 'var(--cat-buffer-bg)', text: 'var(--cat-buffer)' },
  protocol: { bg: 'var(--cat-protocol-bg)', text: 'var(--cat-protocol)' },
  staining: { bg: 'var(--cat-staining-bg)', text: 'var(--cat-staining)' },
  media: { bg: 'var(--cat-media-bg)', text: 'var(--cat-media)' },
};

export const DISC_KEYS = {
  molecular: 'discMolecular', cell: 'discCell', protein: 'discProtein', rna_dna: 'discRnaDna',
  immunology: 'discImmunology', microbiology: 'discMicrobiology', biochemistry: 'discBiochemistry',
  histology: 'discHistology', genomics: 'discGenomics', general: 'discGeneral',
};

export function categoryLabel(recipe, lang) {
  const displayCat = recipe.category === 'protocol' ? (PROTOCOL_SUBCAT_BY_ID[recipe.id] || 'protocol') : recipe.category;
  const label = CATEGORY_DISPLAY[displayCat];
  return label ? (label[lang] || label.en) : displayCat;
}

// `discipline` is usually an array of ids, but a few library entries carry free
// text ("cell biology", "genome engineering"). Matching mirrors the original
// filter: exact id for arrays, substring for strings.
export function matchesDiscipline(recipe, id) {
  const d = recipe.discipline;
  if (!d) return false;
  return Array.isArray(d) ? d.includes(id) : String(d).toLowerCase().includes(id);
}

export function disciplineLabel(recipe, lang) {
  const d = recipe.discipline;
  if (!d) return null;
  if (Array.isArray(d)) return d[0] && DISC_KEYS[d[0]] ? t(DISC_KEYS[d[0]], lang) : null;
  const known = Object.keys(DISC_KEYS).find(id => String(d).toLowerCase().includes(id));
  if (known) return t(DISC_KEYS[known], lang);
  const text = String(d);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Short facts for list rows: storage temperature + pH for reagents, duration for protocols.
export function recipeFacts(recipe) {
  const facts = [];
  const s = recipe.storage || {};
  if (recipe.category === 'protocol') {
    if (s.duration && s.duration !== 'N/A') facts.push(s.duration);
  } else {
    const temp = s.temp || s.temperature;
    if (temp && temp !== 'N/A') facts.push(temp);
    if (recipe.ph) facts.push('pH ' + recipe.ph);
  }
  return facts;
}

function RecipeRow({ recipe, onSelect, selected }) {
  const lang = useLang();
  const { isFav, toggle } = useFavs();
  const toast = useToast();
  const fav = isFav(recipe.id);
  const cc = CAT_COLORS[recipe.category] || CAT_COLORS.buffer;
  const isProtocol = recipe.category === 'protocol';
  const disc = disciplineLabel(recipe, lang);
  const facts = recipeFacts(recipe);

  return (
    <div className={`list-row group${selected ? ' is-selected' : ''}`} style={{ padding: 0 }}>
      <button type="button" data-row onClick={() => onSelect(recipe)} aria-current={selected ? 'true' : undefined}
        className="flex-1 min-w-0 text-left"
        style={{ padding: '0.6rem 0.25rem 0.6rem 0.875rem', background: 'transparent', border: 0, color: 'inherit' }}>
        <span className="list-row-title block">{recipe.name}</span>
        {lang === 'zh' && recipe.nameCn && <span className="list-row-sub block">{recipe.nameCn}</span>}
        <span className="list-row-meta">
          {!isProtocol && (
            <span className="inline-flex items-center gap-1" style={{ color: cc.text, fontWeight: 700 }}>
              <span className="dot" style={{ width: 6, height: 6 }} aria-hidden="true" />{categoryLabel(recipe, lang)}
            </span>
          )}
          {disc && <span>{!isProtocol && <span aria-hidden="true">· </span>}{disc}</span>}
          {facts.map(f => <span key={f}><span aria-hidden="true">· </span>{f}</span>)}
          {recipe._isCustom && <span className="badge badge-green" style={{ height: '1rem' }}>{t('customBadge', lang)}</span>}
        </span>
      </button>
      <button type="button" tabIndex={-1}
        className={`fav-star self-stretch flex items-center justify-center${fav ? ' active' : ''}`}
        aria-label={fav ? t('favRemove', lang) : t('favAdd', lang)} aria-pressed={fav}
        onClick={() => { toggle(recipe.id); toast.show(fav ? t('removedFav', lang) : t('addedFav', lang), ''); }}
        style={{ width: '2.5rem', flexShrink: 0, background: 'transparent', border: 0, color: fav ? 'var(--fav-star)' : 'var(--text-muted)', opacity: fav ? 1 : 0.45 }}>
        <IconStar size={15} filled={fav} />
      </button>
    </div>
  );
}

// The list renders up to ~230 of these; memo so a toast, a favorite toggle or a
// search keystroke elsewhere doesn't re-render every row.
export default memo(RecipeRow);
