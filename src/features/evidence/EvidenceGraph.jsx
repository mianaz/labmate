// The map as a graph: columns from experiments → evidence → assumptions →
// claims → questions, links drawn as arrows. Nodes are real buttons laid over
// an SVG link layer, so they wrap text, take focus and work with a keyboard.
// Click selects (and dims everything not connected to it); in connect mode a
// click picks the other end of a new link.
import { useMemo, useId } from 'react';
import { layoutGraph, linkOptions, RELATION_IDS, GRAPH } from '../../lib/evidence.js';
import { tx, KIND_META, STATUS_META, REL_META } from './evidenceText.js';

const HEADER_H = 26;

export default function EvidenceGraph({ lang, map, statuses, labels, selectedId, connectFrom, onNodeClick, onNodeOpen }) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const layout = useMemo(() => layoutGraph(map), [map]);
  const byId = useMemo(() => new Map(map.nodes.map((n) => [n.id, n])), [map]);

  const focus = connectFrom || selectedId;
  const near = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    map.edges.forEach((e) => { if (e.from === focus) s.add(e.to); if (e.to === focus) s.add(e.from); });
    return s;
  }, [focus, map.edges]);
  const from = connectFrom ? byId.get(connectFrom) : null;

  // One header per column, naming the kinds it holds (evidence and assumptions share one).
  const columns = useMemo(() => {
    const cols = new Map();
    for (const b of layout.boxes.values()) {
      if (!cols.has(b.col)) cols.set(b.col, { x: b.x, kinds: new Set() });
      cols.get(b.col).kinds.add(byId.get(b.id)?.kind);
    }
    return [...cols.values()];
  }, [layout, byId]);

  if (!map.nodes.length) {
    return <p style={{ padding: '2rem 0', textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>{tx('graphEmpty', lang)}</p>;
  }

  const width = layout.width;
  const height = layout.height + HEADER_H;
  return (
    <div>
      <div className="evidence-graph" style={{ overflow: 'auto', maxHeight: '72vh', border: '1px solid var(--rule)', background: 'var(--bg)' }}>
        <div style={{ position: 'relative', width, height, minWidth: '100%' }}>
          {columns.map((c) => (
            <div key={c.x} className="eyebrow" aria-hidden="true"
              style={{ position: 'absolute', left: c.x, top: 8, width: GRAPH.nodeW, fontSize: '0.625rem' }}>
              {['experiment', 'evidence', 'assumption', 'claim', 'question'].filter((k) => c.kinds.has(k)).map((k) => tx(`kind_${k}`, lang)).join(' · ')}
            </div>
          ))}
          <svg width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true" focusable="false">
            <defs>
              {RELATION_IDS.map((rel) => (
                <marker key={rel} id={`${uid}-a-${rel}`} viewBox="0 0 8 8" refX="7.5" refY="4" markerWidth="7" markerHeight="7" orient="auto">
                  <path d="M0,0 L8,4 L0,8 z" style={{ fill: REL_META[rel].stroke }} />
                </marker>
              ))}
            </defs>
            <g transform={`translate(0,${HEADER_H})`}>
              {layout.edges.map((e) => {
                const m = REL_META[e.rel] || REL_META.supports;
                const lit = !focus || e.from === focus || e.to === focus;
                return (
                  <path key={e.id} d={e.path} fill="none" strokeWidth={lit && focus ? 2 : 1.5}
                    strokeDasharray={m.dash} markerEnd={`url(#${uid}-a-${e.rel})`}
                    style={{ stroke: m.stroke, opacity: lit ? 1 : 0.18, transition: 'opacity var(--duration-fast) ease' }} />
                );
              })}
            </g>
          </svg>
          {map.nodes.map((n) => {
            const b = layout.boxes.get(n.id);
            if (!b) return null;
            const km = KIND_META[n.kind] || KIND_META.claim;
            const status = statuses[n.id];
            const sm = status ? STATUS_META[status] : null;
            const isSel = n.id === selectedId || n.id === connectFrom;
            const target = from && n.id !== from.id ? linkOptions(from, n).length > 0 : null;
            const dim = (near && !near.has(n.id) && !target) || (from && n.id !== from.id && !target);
            const unreviewed = n.origin !== 'user' && !n.reviewed;
            return (
              <button key={n.id} type="button" data-node-id={n.id}
                onClick={() => onNodeClick(n.id)} onDoubleClick={() => onNodeOpen(n.id)}
                aria-pressed={isSel}
                aria-label={`${labels[n.id]} ${tx(`kind_${n.kind}`, lang)}${status ? ` · ${tx(`status_${status}`, lang)}` : ''}: ${n.text}`}
                style={{
                  position: 'absolute', left: b.x, top: b.y + HEADER_H, width: b.w, height: b.h,
                  display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, textAlign: 'left',
                  padding: '7px 10px 8px 12px', background: 'var(--card)', color: 'var(--text)',
                  border: `1px ${unreviewed ? 'dashed' : 'solid'} ${isSel ? 'var(--border-strong)' : target ? 'var(--accent)' : 'var(--border)'}`,
                  boxShadow: isSel ? '3px 3px 0 0 var(--shadow-ink)' : target ? '0 0 0 2px var(--primary-light)' : 'none',
                  opacity: dim ? 0.38 : 1, cursor: 'pointer', overflow: 'hidden',
                  transition: 'opacity var(--duration-fast) ease, box-shadow var(--duration-fast) ease',
                }}>
                <span aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, background: km.fg }} />
                <span className="flex items-center gap-1.5" style={{ minHeight: 16 }}>
                  <span className="mono" style={{ fontSize: '0.6875rem', fontWeight: 700, color: km.fg }}>{labels[n.id]}</span>
                  {sm && (
                    <span className="mono truncate" style={{ fontSize: '0.625rem', fontWeight: 700, color: sm.fg, marginLeft: 'auto' }}>
                      {tx(`status_${status}`, lang)}
                    </span>
                  )}
                </span>
                <span style={{
                  fontSize: '0.8125rem', lineHeight: `${GRAPH.lineH}px`, overflow: 'hidden', overflowWrap: 'anywhere',
                  display: '-webkit-box', WebkitLineClamp: GRAPH.maxLines, WebkitBoxOrient: 'vertical',
                  color: n.text ? 'var(--text)' : 'var(--text-muted)',
                }}>
                  {n.text || '—'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5" aria-label={tx('legend', lang)}>
        {RELATION_IDS.map((rel) => (
          <span key={rel} className="flex items-center gap-1.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <svg width="26" height="8" aria-hidden="true" focusable="false">
              <line x1="0" y1="4" x2="26" y2="4" strokeWidth="2" strokeDasharray={REL_META[rel].dash} style={{ stroke: REL_META[rel].stroke }} />
            </svg>
            {tx(`rel_${rel}`, lang)}
          </span>
        ))}
      </div>
    </div>
  );
}
