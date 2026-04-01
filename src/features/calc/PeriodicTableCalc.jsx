import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { ELEMENTS, ELEMENT_CAT_COLORS, PT_LAYOUT } from '../../data/periodicTable.js';

export default function PeriodicTableCalc() {
  const lang = useLang();
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState('');

  const filteredZ = search.trim() ? ELEMENTS.filter(el =>
    el.sym.toLowerCase().includes(search.toLowerCase()) ||
    el.name.toLowerCase().includes(search.toLowerCase()) ||
    String(el.z) === search.trim()
  ).map(el => el.z) : null;

  // Build grid: 10 rows x 18 cols
  const grid = Array.from({length: 10}, () => Array(18).fill(null));
  ELEMENTS.forEach(el => {
    const pos = PT_LAYOUT[el.z];
    if (pos) grid[pos[0]][pos[1]] = el;
  });

  const catLabels = {
    'alkali': 'Alkali Metal', 'alkaline-earth': 'Alkaline Earth', 'transition': 'Transition Metal',
    'post-transition': 'Post-Transition', 'metalloid': 'Metalloid', 'nonmetal': 'Nonmetal',
    'halogen': 'Halogen', 'noble-gas': 'Noble Gas', 'lanthanide': 'Lanthanide', 'actinide': 'Actinide',
  };

  return (
    <div className="card p-5 fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-xl font-bold mb-1">{t('periodicTitle', lang)}</h2>
          <p className="text-sm" style={{color:'var(--text-muted)'}}>{t('periodicSubtitle', lang)}</p>
        </div>
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder={t('periodicSearch', lang)}
          className="w-48 text-sm" />
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mb-3">
        {Object.entries(ELEMENT_CAT_COLORS).map(([cat, color]) => (
          <div key={cat} className="flex items-center gap-1 text-[10px]">
            <div className="w-3 h-3 rounded" style={{background: color}} />
            <span style={{color:'var(--text-muted)'}}>{catLabels[cat]}</span>
          </div>
        ))}
      </div>

      {/* Periodic Table Grid */}
      <div className="overflow-x-auto pb-2">
        <div style={{display:'inline-grid', gridTemplateColumns:'repeat(18, 1fr)', gap: 2, minWidth: 620}}>
          {grid.map((row, ri) => (
            <React.Fragment key={ri}>
              {ri === 7 && <div style={{gridColumn:'1 / -1', height: 6}} />}
              {row.map((el, ci) => {
                if (!el) return <div key={`${ri}-${ci}`} style={{width: 34, height: 38}} />;
                const dimmed = filteredZ && !filteredZ.includes(el.z);
                const isSelected = selected && selected.z === el.z;
                return (
                  <div key={el.z}
                    onClick={() => setSelected(el)}
                    title={`${el.name} (${el.mass})`}
                    className="cursor-pointer transition-all rounded"
                    style={{
                      width: 34, height: 38, padding: '1px 2px',
                      background: isSelected ? 'var(--primary)' : (ELEMENT_CAT_COLORS[el.cat] || '#adb5bd') + (dimmed ? '30' : 'cc'),
                      color: isSelected ? 'white' : dimmed ? 'var(--text-muted)' : '#1a1a2e',
                      border: isSelected ? '2px solid var(--primary)' : '1px solid ' + (dimmed ? 'transparent' : 'rgba(0,0,0,0.1)'),
                      opacity: dimmed ? 0.4 : 1,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1.1, fontSize: 9, fontWeight: 600,
                    }}>
                    <span style={{fontSize: 7, opacity: 0.7}}>{el.z}</span>
                    <span style={{fontSize: 12, fontWeight: 800, fontFamily: 'var(--font-mono)'}}>{el.sym}</span>
                    <span style={{fontSize: 6, opacity: 0.7}}>{el.mass.toFixed(1)}</span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Selected element details */}
      {selected && (
        <div className="mt-4 p-4 rounded-xl fade-in" style={{background:'var(--bg-2)', border:'1px solid var(--border)'}}>
          <div className="flex items-start gap-4 flex-wrap">
            <div className="text-center p-3 rounded-xl" style={{
              background: ELEMENT_CAT_COLORS[selected.cat] + 'cc', color: '#1a1a2e', minWidth: 80
            }}>
              <div className="text-xs opacity-70">{selected.z}</div>
              <div className="text-3xl font-black mono">{selected.sym}</div>
              <div className="text-xs font-semibold">{selected.name}</div>
              <div className="text-[10px] mono mt-0.5">{selected.mass.toFixed(3)}</div>
            </div>
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div><span className="font-semibold" style={{color:'var(--text-muted)'}}>{t('periodicAtomicNum', lang)}:</span> {selected.z}</div>
              <div><span className="font-semibold" style={{color:'var(--text-muted)'}}>{t('periodicAtomicMass', lang)}:</span> {selected.mass.toFixed(4)} u</div>
              <div><span className="font-semibold" style={{color:'var(--text-muted)'}}>{t('periodicCategory', lang)}:</span> {catLabels[selected.cat]}</div>
              <div><span className="font-semibold" style={{color:'var(--text-muted)'}}>{t('periodicElectronConfig', lang)}:</span> <span className="mono text-xs">{selected.econf}</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
