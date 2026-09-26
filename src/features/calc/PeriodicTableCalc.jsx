import { useState, useMemo } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { ELEMENTS, ELEMENT_CAT_COLORS, PT_LAYOUT } from '../../data/periodicTable.js';
import { IconSearch } from '../../components/icons.jsx';

const CAT_LABELS = {
  'alkali': ['Alkali Metal', '碱金属'], 'alkaline-earth': ['Alkaline Earth', '碱土金属'], 'transition': ['Transition Metal', '过渡金属'],
  'post-transition': ['Post-Transition', '后过渡金属'], 'metalloid': ['Metalloid', '类金属'], 'nonmetal': ['Nonmetal', '非金属'],
  'halogen': ['Halogen', '卤素'], 'noble-gas': ['Noble Gas', '稀有气体'], 'lanthanide': ['Lanthanide', '镧系'], 'actinide': ['Actinide', '锕系'],
};
const catLabel = (cat, lang) => (CAT_LABELS[cat] ? CAT_LABELS[cat][lang === 'zh' ? 1 : 0] : cat);
const catColor = (cat) => ELEMENT_CAT_COLORS[cat] || '#adb5bd';

// Tiles keep their category hue but are tinted against the theme's own card
// colour, so ink text stays legible on paper and light text on the dark CRT
// theme; the full-strength hue runs along the top edge.
const tileBg = (cat) => `color-mix(in srgb, ${catColor(cat)} 40%, var(--card))`;

// 7 periods, a spacer row, then the lanthanide / actinide rows.
const GRID_ROWS = 'repeat(7, auto) 0.5rem repeat(2, auto)';

// Denser cells for the details that sit inside the table.
const CELL_COMPACT = { padding: '0.35rem 0.55rem' };
const DD_COMPACT = { fontSize: '0.75rem', lineHeight: 1.35 };

function ElementTile({ el, big = false }) {
  return (
    <div className="flex flex-col items-center justify-center shrink-0 text-center"
      style={{
        width: big ? '5.5rem' : '4.25rem', minHeight: big ? undefined : '4.25rem', padding: '0.35rem', color: 'var(--text)',
        background: tileBg(el.cat), boxShadow: `inset 0 4px 0 ${catColor(el.cat)}`, border: '1px solid var(--border-strong)',
      }}>
      <span className="mono tabular" style={{ fontSize: '0.6875rem' }}>{el.z}</span>
      <span className="mono" style={{ fontSize: big ? '1.625rem' : '1.5rem', fontWeight: 800, lineHeight: 1.05 }}>{el.sym}</span>
      {big && <span style={{ fontSize: '0.6875rem', fontWeight: 600, lineHeight: 1.3 }}>{el.name}</span>}
      <span className="mono tabular" style={{ fontSize: '0.625rem' }}>{el.mass.toFixed(3)}</span>
    </div>
  );
}

// layout 'side': inside the table's empty block above the transition metals —
//   tile beside compact facts (only used when the panel is wide enough).
// layout 'stack': below the table — tile + name, facts underneath.
function ElementDetails({ el, lang, layout = 'side' }) {
  const side = layout === 'side';
  if (!el) {
    return (
      <p className={side ? 'flex items-center justify-center h-full text-center' : 'text-center py-1'}
        style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', ...(side ? { border: '1px dashed var(--border)' } : null) }}>
        {t('periodicSubtitle', lang)}
      </p>
    );
  }
  const cell = side ? CELL_COMPACT : undefined;
  const dd = side ? DD_COMPACT : undefined;
  const facts = (
    <dl className="meta-grid flex-1 min-w-0" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', alignContent: 'start' }}>
      <div style={cell}><dt>{t('periodicAtomicNum', lang)}</dt><dd style={dd}>{el.z}</dd></div>
      <div style={cell}><dt>{t('periodicAtomicMass', lang)}</dt><dd style={dd}>{el.mass.toFixed(4)} u</dd></div>
      <div style={cell}><dt>{t('periodicCategory', lang)}</dt><dd style={{ ...dd, fontFamily: 'var(--font-body)' }}>{catLabel(el.cat, lang)}</dd></div>
      <div style={cell}><dt>{t('periodicElectronConfig', lang)}</dt><dd style={dd}>{el.econf}</dd></div>
    </dl>
  );
  if (!side) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <ElementTile el={el} />
          <div className="min-w-0">
            <div className="section-title">{el.name}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{catLabel(el.cat, lang)}</div>
          </div>
        </div>
        {facts}
      </div>
    );
  }
  return (
    <div className="flex items-stretch gap-3 h-full min-w-0">
      <ElementTile el={el} big />
      {facts}
    </div>
  );
}

export default function PeriodicTableCalc() {
  const lang = useLang();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  const filteredZ = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return null;
    return new Set(ELEMENTS.filter(el =>
      el.sym.toLowerCase().includes(q) || el.name.toLowerCase().includes(q) || String(el.z) === q
    ).map(el => el.z));
  }, [search]);

  return (
    <section className="panel" aria-labelledby="calc-periodic-title">
      <div className="panel-head">
        <h2 id="calc-periodic-title" className="section-title min-w-0">{t('calcTaskPeriodic', lang)}</h2>
        <span className="badge" style={{ textTransform: 'none', letterSpacing: 0, fontSize: '0.6875rem' }}>{lang === 'zh' ? '118 种元素' : '118 elements'}</span>
      </div>
      <div className="panel-body space-y-4 @container">
        <div className="flex flex-col @xl:flex-row @xl:items-center gap-3">
          <div className="search-field w-full @xl:w-60 shrink-0">
            <IconSearch size={15} />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={t('periodicSearch', lang)} aria-label={t('periodicSearch', lang)} />
          </div>
          {/* Legend */}
          <ul className="flex flex-wrap gap-x-3 gap-y-1" aria-label={t('legend', lang)}>
            {Object.keys(ELEMENT_CAT_COLORS).map(cat => (
              <li key={cat} className="inline-flex items-center gap-1.5" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                <span className="dot" style={{ color: catColor(cat) }} aria-hidden="true" />{catLabel(cat, lang)}
              </li>
            ))}
          </ul>
        </div>

        <div className="overflow-x-auto pb-1">
          {/* Tiles shrink to 26px once the panel can hold all 18 columns (≥504px);
              narrower (phones) keep 34px tiles and scroll sideways. */}
          <div className="grid min-w-[40rem] grid-cols-[repeat(18,minmax(2.125rem,1fr))] @min-[31.5rem]:min-w-0 @min-[31.5rem]:grid-cols-[repeat(18,minmax(1.625rem,1fr))]"
            style={{ gridTemplateRows: GRID_ROWS, gap: 2 }}>
            {ELEMENTS.map(el => {
              const pos = PT_LAYOUT[el.z];
              if (!pos) return null;
              const dimmed = filteredZ && !filteredZ.has(el.z);
              const isSelected = selected && selected.z === el.z;
              return (
                <button key={el.z} type="button" onClick={() => setSelected(el)}
                  title={`${el.name} (${el.mass})`} aria-label={`${el.name}, ${el.z}`} aria-pressed={!!isSelected}
                  className="flex flex-col items-center justify-center min-w-0 transition-opacity"
                  style={{
                    gridRow: pos[0] + 1, gridColumn: pos[1] + 1, aspectRatio: '1 / 1.08', padding: '2px 1px',
                    background: isSelected ? 'var(--primary)' : tileBg(el.cat),
                    color: isSelected ? 'var(--on-primary)' : 'var(--text)',
                    boxShadow: isSelected ? 'inset 0 0 0 2px var(--border-strong)' : `inset 0 3px 0 ${catColor(el.cat)}`,
                    opacity: dimmed ? 0.25 : 1, lineHeight: 1.05, border: 0,
                    outlineColor: 'var(--text)', outlineOffset: '-2px', // focus ring inside the tile (2px gaps)
                  }}>
                  <span className="mono tabular" style={{ fontSize: '0.5625rem', opacity: 0.8 }}>{el.z}</span>
                  <span className="mono" style={{ fontSize: '0.875rem', fontWeight: 800 }}>{el.sym}</span>
                  <span className="mono tabular @min-[31.5rem]:hidden @2xl:block" style={{ fontSize: '0.5rem', opacity: 0.8 }}>{el.mass.toFixed(1)}</span>
                </button>
              );
            })}
            {/* Selected element, shown in the empty block above the transition metals
                when the panel is wide. Absolutely filled so it never resizes the rows. */}
            <div className="hidden @3xl:block relative min-w-0" style={{ gridRow: '1 / 4', gridColumn: '3 / 13' }}>
              <div className="absolute overflow-hidden" style={{ inset: '0 0.75rem 0.5rem' }} aria-live="polite">
                <ElementDetails el={selected} lang={lang} layout="side" />
              </div>
            </div>
          </div>
        </div>

        {/* Narrower panels: details go below the table */}
        <div className="@3xl:hidden" aria-live="polite">
          <ElementDetails el={selected} lang={lang} layout="stack" />
        </div>
      </div>
    </section>
  );
}
