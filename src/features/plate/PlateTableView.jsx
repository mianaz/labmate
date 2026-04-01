// PlateTableView — Table/CSV preview of well plate data
import React, { useState, useMemo } from 'react';
import { t } from '../../i18n/index.js';
import { S_MUTED, S_TEXT, S_BORDER } from '../../lib/styleConstants.js';

function PlateTableView({ wellData, config, lang }) {
  const [showTable, setShowTable] = useState(false);
  const [sortCol, setSortCol] = useState('well');
  const [sortAsc, setSortAsc] = useState(true);

  const rows = useMemo(() => {
    const entries = Object.entries(wellData).map(([key, data]) => ({
      well: key,
      row: key[0],
      col: parseInt(key.slice(1)),
      label: data.label,
      color: data.color,
    }));
    entries.sort((a, b) => {
      let cmp = 0;
      if (sortCol === 'well') cmp = a.well.localeCompare(b.well, undefined, { numeric: true });
      else if (sortCol === 'row') cmp = a.row.localeCompare(b.row) || a.col - b.col;
      else if (sortCol === 'col') cmp = a.col - b.col || a.row.localeCompare(b.row);
      else if (sortCol === 'label') cmp = a.label.localeCompare(b.label);
      return sortAsc ? cmp : -cmp;
    });
    return entries;
  }, [wellData, sortCol, sortAsc]);

  function toggleSort(col) {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(true); }
  }

  const sortArrow = (col) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : '';

  if (!showTable) {
    return (
      <div className="mt-4 flex justify-center">
        <button onClick={() => setShowTable(true)}
          className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{background:'var(--bg-2)', color:'var(--text-muted)', border:'1px solid var(--border)'}}>
          {t('plateViewTable', lang)}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 card p-4 fade-in">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-bold">{t('plateViewTable', lang)}</h4>
        <button onClick={() => setShowTable(false)}
          className="text-xs px-3 py-1 rounded-lg"
          style={{background:'var(--bg-2)', color:'var(--text-muted)', border:'1px solid var(--border)'}}>
          {t('plateViewGrid', lang)}
        </button>
      </div>
      <div className="overflow-x-auto" style={{maxHeight:'320px', overflowY:'auto'}}>
        <table className="w-full text-sm">
          <thead className="sticky top-0" style={{background:'var(--card)'}}>
            <tr className="border-b" style={S_BORDER}>
              {[{id:'well',l:'Well'},{id:'row',l:'Row'},{id:'col',l:'Col'},{id:'label',l:'Label'},{id:'color',l:'Color'}].map(h => (
                <th key={h.id} onClick={() => toggleSort(h.id)}
                  className="text-left py-2 px-2 text-xs cursor-pointer select-none"
                  style={S_MUTED}>
                  {h.l}{sortArrow(h.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.well} className="border-b" style={S_BORDER}>
                <td className="py-1.5 px-2 mono font-semibold text-xs">{r.well}</td>
                <td className="py-1.5 px-2 text-xs">{r.row}</td>
                <td className="py-1.5 px-2 text-xs mono">{r.col}</td>
                <td className="py-1.5 px-2 text-xs font-medium">{r.label}</td>
                <td className="py-1.5 px-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{background:r.color}} />
                    <span className="text-[10px] mono" style={S_MUTED}>{r.color}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] mt-2" style={S_MUTED}>{rows.length} {lang === 'en' ? 'labeled wells' : '个已标记孔'}</p>
    </div>
  );
}

export default PlateTableView;
