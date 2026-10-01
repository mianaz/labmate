// The map as a graph. Auto layout reads in columns from experiments → evidence
// & assumptions → claims → questions; once a node is dragged the map keeps a
// manual layout (positions saved on the nodes) until "Auto layout" resets it.
// Nodes are real buttons laid over an SVG link layer, so they wrap text, take
// focus and work with a keyboard (arrow keys nudge the focused node).
//
// Pointer interactions:
//   click            select (dims everything not connected to it)
//   drag a node      move it (touch: select it first, so a swipe still scrolls)
//   drag the handle  on the selected node's right edge onto another node: link them
//   double-click     edit
// In connect mode (the Connect button) a click picks the other end of the link.
import { useMemo, useId, useRef, useState } from 'react';
import { layoutGraph, linkOptions, setNodePosition, RELATION_IDS, GRAPH } from '../../lib/evidence.js';
import { tx, KIND_META, STATUS_META, REL_META } from './evidenceText.js';
import { IconRefresh } from '../../components/icons.jsx';

const HEADER_H = 26;
const DRAG_THRESHOLD = 5;

const nodeAt = (x, y) => document.elementFromPoint?.(x, y)?.closest?.('[data-node-id]')?.dataset.nodeId || null;

export default function EvidenceGraph({
  lang, map, statuses, labels, selectedId, connectFrom,
  onNodeClick, onNodeOpen, onMoveNode, onConnectDrop, onAutoLayout,
}) {
  const rawId = useId();
  const uid = rawId.replace(/[^a-zA-Z0-9_-]/g, '');
  const canvasRef = useRef(null);
  const dragRef = useRef(null);        // node move in progress
  const suppressRef = useRef(null);    // { id, at } — swallow the click that ends a drag
  const [live, setLive] = useState(null); // { id, x, y } while a node is being dragged
  const [wire, setWire] = useState(null); // { from, x, y, over } while dragging a new link

  // While dragging, draw the map as it will be once dropped.
  const shown = useMemo(() => (live ? setNodePosition(map, live.id, live.x, live.y) : map), [map, live]);
  const layout = useMemo(() => layoutGraph(shown), [shown]);
  const byId = useMemo(() => new Map(map.nodes.map((n) => [n.id, n])), [map]);

  const linkFrom = connectFrom || wire?.from || null;
  const focus = linkFrom || selectedId;
  const near = useMemo(() => {
    if (!focus) return null;
    const s = new Set([focus]);
    map.edges.forEach((e) => { if (e.from === focus) s.add(e.to); if (e.to === focus) s.add(e.from); });
    return s;
  }, [focus, map.edges]);
  const from = linkFrom ? byId.get(linkFrom) : null;

  // Auto layout: one header per column, naming the kinds it holds.
  const columns = useMemo(() => {
    if (layout.manual) return [];
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

  const toCanvas = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top - HEADER_H };
  };

  // ── Moving nodes ──
  const onNodePointerDown = (e, id, isSel) => {
    if (e.button !== 0 || connectFrom) return;
    // On touch, only a selected node drags; elsewhere a swipe scrolls the canvas.
    if (e.pointerType === 'touch' && !isSel) return;
    const b = layout.boxes.get(id);
    dragRef.current = { id, sx: e.clientX, sy: e.clientY, ox: b.x, oy: b.y, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onNodePointerMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    d.moved = true;
    setLive({ id: d.id, x: Math.max(0, d.ox + dx), y: Math.max(0, d.oy + dy) });
  };
  const onNodePointerUp = (e) => {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d?.moved) return;
    suppressRef.current = { id: d.id, at: Date.now() };
    onMoveNode(d.id, Math.max(0, d.ox + e.clientX - d.sx), Math.max(0, d.oy + e.clientY - d.sy));
    setLive(null);
  };
  const onNodePointerCancel = () => { dragRef.current = null; setLive(null); };
  const onNodeClickGuarded = (id) => {
    const s = suppressRef.current;
    if (s && s.id === id && Date.now() - s.at < 400) { suppressRef.current = null; return; }
    onNodeClick(id);
  };
  const onNodeKeyDown = (e, id) => {
    const step = e.shiftKey ? 40 : 8;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d || connectFrom) return;
    e.preventDefault();
    const b = layout.boxes.get(id);
    onMoveNode(id, b.x + d[0], b.y + d[1]);
  };

  // ── Drawing a link from the handle ──
  const onHandlePointerDown = (e, id) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setWire({ from: id, ...toCanvas(e), over: null });
  };
  const onHandlePointerMove = (e) => {
    if (!wire) return;
    const over = nodeAt(e.clientX, e.clientY);
    setWire((w) => (w ? { ...w, ...toCanvas(e), over: over !== w.from ? over : null } : w));
  };
  const onHandlePointerUp = (e) => {
    if (!wire) return;
    const over = nodeAt(e.clientX, e.clientY);
    const origin = wire.from;
    setWire(null);
    if (over && over !== origin) onConnectDrop(origin, over);
  };

  const width = layout.width;
  const height = layout.height + HEADER_H;
  const sel = selectedId && !connectFrom && !live ? layout.boxes.get(selectedId) : null;
  const wireStart = wire ? layout.boxes.get(wire.from) : null;

  return (
    <div>
      <div className="evidence-graph" style={{ overflow: 'auto', maxHeight: '72vh', border: '1px solid var(--rule)', background: 'var(--bg)' }}>
        <div ref={canvasRef} style={{ position: 'relative', width, height, minWidth: '100%', userSelect: live || wire ? 'none' : undefined }}>
          {columns.map((c) => (
            <div key={c.x} className="eyebrow" aria-hidden="true"
              style={{ position: 'absolute', left: c.x, top: 8, width: GRAPH.nodeW, fontSize: '0.625rem' }}>
              {['experiment', 'evidence', 'assumption', 'claim', 'question'].filter((k) => c.kinds.has(k)).map((k) => tx(`kind_${k}`, lang)).join(' · ')}
            </div>
          ))}
          <svg width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible', pointerEvents: 'none' }} aria-hidden="true" focusable="false">
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
              {wire && wireStart && (
                <path d={`M${wireStart.x + wireStart.w},${wireStart.y + wireStart.h / 2} L${wire.x},${wire.y}`}
                  fill="none" strokeWidth="2" strokeDasharray="5 4" style={{ stroke: 'var(--accent)' }} />
              )}
            </g>
          </svg>
          {map.nodes.map((n) => {
            const b = layout.boxes.get(n.id);
            if (!b) return null;
            const km = KIND_META[n.kind] || KIND_META.claim;
            const status = statuses[n.id];
            const sm = status ? STATUS_META[status] : null;
            const isSel = n.id === selectedId || n.id === linkFrom;
            const target = from && n.id !== from.id ? linkOptions(from, n).length > 0 : null;
            const hovered = wire && wire.over === n.id;
            const dim = (near && !near.has(n.id) && !target) || (from && n.id !== from.id && !target);
            const unreviewed = n.origin !== 'user' && !n.reviewed;
            const dragging = live?.id === n.id;
            return (
              <button key={n.id} type="button" data-node-id={n.id}
                onClick={() => onNodeClickGuarded(n.id)} onDoubleClick={() => onNodeOpen(n.id)}
                onPointerDown={(e) => onNodePointerDown(e, n.id, isSel)} onPointerMove={onNodePointerMove}
                onPointerUp={onNodePointerUp} onPointerCancel={onNodePointerCancel}
                onKeyDown={(e) => onNodeKeyDown(e, n.id)}
                aria-pressed={isSel}
                aria-keyshortcuts="ArrowUp ArrowDown ArrowLeft ArrowRight"
                aria-label={`${labels[n.id]} ${tx(`kind_${n.kind}`, lang)}${status ? ` · ${tx(`status_${status}`, lang)}` : ''}: ${n.text}`}
                style={{
                  position: 'absolute', left: b.x, top: b.y + HEADER_H, width: b.w, height: b.h,
                  display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4, textAlign: 'left',
                  padding: '7px 10px 8px 12px', background: 'var(--card)', color: 'var(--text)',
                  border: `1px ${unreviewed ? 'dashed' : 'solid'} ${isSel || hovered ? 'var(--border-strong)' : target ? 'var(--accent)' : 'var(--border)'}`,
                  boxShadow: dragging ? '5px 5px 0 0 var(--shadow-ink)' : isSel || hovered ? '3px 3px 0 0 var(--shadow-ink)' : target ? '0 0 0 2px var(--primary-light)' : 'none',
                  opacity: dim ? 0.38 : 1, overflow: 'hidden', zIndex: dragging ? 3 : undefined,
                  cursor: connectFrom ? 'pointer' : dragging ? 'grabbing' : 'grab',
                  touchAction: isSel ? 'none' : 'manipulation',
                  transition: dragging ? 'none' : 'opacity var(--duration-fast) ease, box-shadow var(--duration-fast) ease',
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
          {sel && (
            // Link handle on the selected node. Keyboard users have the Connect button.
            <span aria-hidden="true" title={tx('handleTitle', lang)} data-link-handle=""
              onPointerDown={(e) => onHandlePointerDown(e, selectedId)} onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp} onPointerCancel={() => setWire(null)}
              style={{
                position: 'absolute', left: sel.x + sel.w - 8, top: sel.y + HEADER_H + sel.h / 2 - 8, width: 16, height: 16,
                background: 'var(--primary)', border: '1px solid var(--border-strong)', boxShadow: '2px 2px 0 0 var(--shadow-ink)',
                cursor: 'crosshair', touchAction: 'none', zIndex: 4,
              }} />
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-2.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 flex-1 min-w-0" aria-label={tx('legend', lang)}>
          {RELATION_IDS.map((rel) => (
            <span key={rel} className="flex items-center gap-1.5" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <svg width="26" height="8" aria-hidden="true" focusable="false">
                <line x1="0" y1="4" x2="26" y2="4" strokeWidth="2" strokeDasharray={REL_META[rel].dash} style={{ stroke: REL_META[rel].stroke }} />
              </svg>
              {tx(`rel_${rel}`, lang)}
            </span>
          ))}
        </div>
        {map.manualLayout && (
          <button type="button" className="btn btn-sm flex-none" onClick={onAutoLayout}>
            <IconRefresh size={13} />{tx('autoLayout', lang)}
          </button>
        )}
      </div>
    </div>
  );
}
