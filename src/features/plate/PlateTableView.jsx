// PlateTableView — Table/CSV preview of well plate data (collapsible panel)
import { useState, useMemo } from 'react';
import { t } from '../../i18n/index.js';
import { S_MUTED } from '../../lib/styleConstants.js';
import { IconChevronDown } from '../../components/icons.jsx';

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
  const zh = lang === 'zh';
  const headers = [
    { id: 'well', l: zh ? '孔位' : 'Well' },
    { id: 'row', l: zh ? '行' : 'Row' },
    { id: 'col', l: zh ? '列' : 'Col' },
    { id: 'label', l: zh ? '标签' : 'Label' },
    { id: 'color', l: zh ? '颜色' : 'Color' },
  ];

  return (
    <section className="panel">
      <button type="button" onClick={() => setShowTable(s => !s)}
        aria-expanded={showTable} aria-controls="plate-table-view"
        className="panel-head w-full text-left bg-transparent hover:bg-[var(--bg-2)]"
        style={{ border: 0, borderBottom: showTable ? '1px solid var(--rule)' : 0, color: 'var(--text)' }}>
        <span className="panel-title">{t('plateViewTable', lang)}</span>
        <span className="flex items-center gap-2 mono tabular text-[11px]" style={S_MUTED}>
          {rows.length} {lang === 'en' ? 'labeled wells' : '个已标记孔'}
          <IconChevronDown size={14} style={{ transform: showTable ? 'rotate(180deg)' : 'none', transition: 'transform var(--duration-base) var(--ease-out)' }} />
        </span>
      </button>

      {showTable && (
        <div id="plate-table-view" className="overflow-auto fade-in" style={{ maxHeight: 320 }}>
          <table className="w-full">
            <thead className="sticky top-0" style={{ background: 'var(--card)', zIndex: 1 }}>
              <tr>
                {headers.map(h => (
                  <th key={h.id} aria-sort={sortCol === h.id ? (sortAsc ? 'ascending' : 'descending') : 'none'}
                    style={{ padding: 0, boxShadow: 'inset 0 -1px 0 var(--border-strong)' }}>
                    <button type="button" onClick={() => toggleSort(h.id)}
                      className="w-full text-left bg-transparent hover:bg-[var(--bg-2)]"
                      style={{
                        padding: '0.55rem 0.75rem', border: 0, font: 'inherit', letterSpacing: 'inherit', textTransform: 'inherit',
                        color: sortCol === h.id ? 'var(--text)' : 'inherit',
                      }}>
                      {h.l}{sortArrow(h.id)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.well}>
                  <td className="mono" style={{ fontSize: '0.8125rem', fontWeight: 700 }}>{r.well}</td>
                  <td>{r.row}</td>
                  <td>{r.col}</td>
                  <td style={{ fontFamily: 'var(--font-body)', fontSize: '0.875rem', fontWeight: 500 }}>{r.label}</td>
                  <td>
                    <span className="inline-flex items-center gap-2" style={S_MUTED}>
                      <span className="rounded-full flex-shrink-0" style={{ width: 10, height: 10, background: r.color }} />
                      {r.color}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

export default PlateTableView;
