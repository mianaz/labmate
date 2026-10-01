// Create or edit one node of an evidence map: its statement, conditions,
// kind-specific fields and its links. Everything is a draft until Save; saving
// also marks a split-from-text node as reviewed (the researcher has now read
// and owned it).
import { useMemo, useState, useId } from 'react';
import Dialog from '../../components/Dialog.jsx';
import { useRecipes } from '../../lib/RecipeProvider.jsx';
import {
  NODE_KINDS, KIND_PREFIX, createNode, addNode, updateNode, connect, linkOptions, nodeLabels,
} from '../../lib/evidence.js';
import { tx, KIND_META, relPhrase } from './evidenceText.js';
import { IconClose, IconPlus, IconSearch, IconTrash, IconClipboard, IconInfo } from '../../components/icons.jsx';

const clip = (s, n) => { const t = String(s || '').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export function KindTag({ kind, label, lang }) {
  const m = KIND_META[kind] || KIND_META.claim;
  return (
    <span className="badge" style={{ '--badge-fg': m.fg, '--badge-bg': m.bg, flexShrink: 0 }} title={tx(`kind_${kind}`, lang)}>
      {label || tx(`kind_${kind}`, lang)}
    </span>
  );
}

/**
 * @param {object}   map
 * @param {string}   [nodeId]      existing node to edit
 * @param {object}   [create]      { kind, edges?: [{ from:'@new'|id, to, rel }] } for a new node
 * @param {object[]} notebookEntries  experiments, for linking own-data evidence
 * @param {Function} onSave(map, nodeId)
 * @param {Function} onDelete(nodeId)
 */
export default function NodeDialog({ lang, map, nodeId, create, notebookEntries = [], onSave, onDelete, onClose }) {
  const uid = useId();
  const { protocolRecipes, recipeById } = useRecipes();
  const zh = lang === 'zh';
  const existing = nodeId ? map.nodes.find((n) => n.id === nodeId) : null;
  const isNew = !existing;

  // Draft node + the links touching it. A new node may arrive with links
  // prepared ("Plan experiment" on a claim), written against '@new'.
  const [init] = useState(() => {
    const n = existing ? { ...existing } : createNode(create?.kind || 'claim');
    const es = existing
      ? map.edges.filter((e) => e.from === n.id || e.to === n.id)
      : (create?.edges || []).map((e, i) => ({
        id: `draft_${i}`, rel: e.rel, from: e.from === '@new' ? n.id : e.from, to: e.to === '@new' ? n.id : e.to,
      }));
    return { n, es };
  });
  const [node, setNode] = useState(init.n);
  const [edges, setEdges] = useState(init.es);

  const others = map.nodes.filter((n) => n.id !== node.id);
  const byId = new Map([...others, node].map((n) => [n.id, n]));
  const labels = useMemo(() => {
    const l = nodeLabels(map);
    if (isNew) l[node.id] = `${KIND_PREFIX[node.kind]}${map.nodes.filter((n) => n.kind === node.kind).length + 1}`;
    return l;
  }, [map, isNew, node.id, node.kind]);

  // Links still valid for the node's current kind (a kind change can void some).
  const isValid = (e) => {
    const a = byId.get(e.from); const b = byId.get(e.to);
    return !!(a && b && linkOptions(a, b).some((o) => o.from === e.from && o.to === e.to && o.rel === e.rel));
  };
  const validEdges = edges.filter(isValid);
  const droppedCount = edges.length - validEdges.length;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [target, setTarget] = useState('');
  const [optIdx, setOptIdx] = useState(0);
  const [protoOpen, setProtoOpen] = useState(false);
  const [protoQuery, setProtoQuery] = useState('');

  const set = (patch) => setNode((n) => ({ ...n, ...patch }));
  const setKind = (kind) => setNode((n) => (kind === n.kind ? n : { ...n, ...kindDefaults(kind), kind }));

  const targets = others.filter((o) => linkOptions(node, o).length);
  const targetNode = target ? byId.get(target) : null;
  const options = targetNode ? linkOptions(node, targetNode) : [];
  const addLink = () => {
    const opt = options[Math.min(optIdx, options.length - 1)];
    if (!opt) return;
    // One link per ordered pair, as in the map itself.
    setEdges((es) => [...es.filter((e) => !(e.from === opt.from && e.to === opt.to)), { id: `draft_${Date.now()}`, ...opt }]);
    setTarget('');
    setOptIdx(0);
  };
  const removeLink = (e) => setEdges((es) => es.filter((d) => d.id !== e.id));

  const protoMatches = useMemo(() => {
    const q = protoQuery.trim().toLowerCase();
    const list = q
      ? protocolRecipes.filter((r) => (r.name || '').toLowerCase().includes(q) || (r.nameCn || '').toLowerCase().includes(q) || (r.tags || []).some((t) => String(t).toLowerCase().includes(q)))
      : protocolRecipes;
    return list.slice(0, 8);
  }, [protoQuery, protocolRecipes]);
  const protoName = (ref) => {
    const r = ref ? recipeById[ref] : null;
    return r ? (zh ? r.nameCn || r.name : r.name) : ref || '';
  };

  const canSave = String(node.text || '').trim().length > 0;
  const save = (e) => {
    e?.preventDefault?.();
    if (!canSave) return;
    const fields = { ...node, text: node.text.trim(), note: (node.note || '').trim(), reviewed: true };
    let next = isNew ? addNode(map, fields) : updateNode(map, node.id, fields);
    next = { ...next, edges: next.edges.filter((d) => d.from !== node.id && d.to !== node.id) };
    for (const d of validEdges) {
      const r = connect(next, d.from, d.to, d.rel);
      if (!r.error) next = r.map;
    }
    onSave(next, node.id);
  };

  const title = isNew
    ? tx('newNode', lang, { kind: zh ? tx(`kind_${node.kind}`, lang) : tx(`kind_${node.kind}`, lang).toLowerCase() })
    : tx('editNode', lang, { label: labels[node.id] });

  const footer = confirmDelete ? (
    <>
      <span className="mr-auto" style={{ fontSize: '0.8125rem' }}>
        {tx('deleteNodeConfirm', lang, { label: labels[node.id], n: map.edges.filter((d) => d.from === node.id || d.to === node.id).length })}
      </span>
      <button type="button" className="btn" onClick={() => setConfirmDelete(false)}>{tx('cancel', lang)}</button>
      <button type="button" className="btn-danger" onClick={() => onDelete(node.id)}><IconTrash size={14} />{tx('delete', lang)}</button>
    </>
  ) : (
    <>
      {!isNew && (
        <button type="button" className="btn-ghost btn-sm mr-auto" style={{ color: 'var(--danger-text)' }} onClick={() => setConfirmDelete(true)}>
          <IconTrash size={14} />{tx('deleteNode', lang)}
        </button>
      )}
      <button type="button" className="btn" onClick={onClose}>{tx('cancel', lang)}</button>
      <button type="submit" className="btn-primary" disabled={!canSave}>{tx('save', lang)}</button>
    </>
  );

  return (
    <Dialog title={title} onClose={onClose} lang={lang} size="lg" onSubmit={save} footer={footer}>
      {!node.reviewed && node.origin !== 'user' && (
        <div className="notice notice-info">
          <IconInfo size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <span>{tx('unreviewedNote', lang)}</span>
        </div>
      )}

      <div>
        <span className="eyebrow" id={`${uid}-kind`}>{tx('fieldKind', lang)}</span>
        <div className="chip-row mt-1.5" role="group" aria-labelledby={`${uid}-kind`}>
          {NODE_KINDS.map((k) => (
            <button key={k} type="button" className="chip" aria-pressed={node.kind === k} onClick={() => setKind(k)}>
              <span className="dot" aria-hidden="true" style={{ color: node.kind === k ? 'currentColor' : KIND_META[k].fg }} />
              {tx(`kind_${k}`, lang)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor={`${uid}-text`}>{tx('fieldText', lang)}</label>
        <textarea id={`${uid}-text`} className="w-full" rows={3} value={node.text} data-autofocus
          onChange={(e) => set({ text: e.target.value })} aria-describedby={`${uid}-hint`} />
        <p id={`${uid}-hint`} style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{tx(`hint_${node.kind}`, lang)}</p>
      </div>

      {node.sourceQuote && node.sourceQuote !== node.text && (
        <div>
          <div className="eyebrow">{tx('fromText', lang)}</div>
          <blockquote style={{ marginTop: '0.25rem', padding: '0.375rem 0.625rem', borderLeft: '3px solid var(--rule)', fontSize: '0.8125rem', color: 'var(--text-muted)', overflowWrap: 'anywhere' }}>
            {node.sourceQuote}
          </blockquote>
        </div>
      )}

      {node.kind !== 'question' && (
        <div>
          <label htmlFor={`${uid}-note`}>{tx('fieldNote', lang)}</label>
          <textarea id={`${uid}-note`} className="w-full" rows={2} value={node.note || ''}
            onChange={(e) => set({ note: e.target.value })} placeholder={tx('fieldNotePh', lang)} />
        </div>
      )}

      {node.kind === 'evidence' && (
        <>
          <div>
            <span className="eyebrow" id={`${uid}-src`}>{tx('fieldSource', lang)}</span>
            <div className="seg mt-1.5" role="group" aria-labelledby={`${uid}-src`}>
              {['literature', 'own', 'observation'].map((s) => (
                <button key={s} type="button" aria-pressed={(node.source || 'literature') === s} onClick={() => set({ source: s })}>{tx(`src_${s}`, lang)}</button>
              ))}
            </div>
          </div>
          {node.source === 'own' ? (
            <div>
              <label htmlFor={`${uid}-entry`}>{tx('fieldEntry', lang)}</label>
              <select id={`${uid}-entry`} className="w-full" value={node.experimentId || ''} onChange={(e) => set({ experimentId: e.target.value || null })}>
                <option value="">{tx('noEntry', lang)}</option>
                {notebookEntries.map((en) => (
                  <option key={en.id} value={en.id}>{`${en.date || ''} · ${clip((zh ? en.titleZh || en.title : en.title || en.titleZh) || en.id, 60)}`}</option>
                ))}
              </select>
            </div>
          ) : (
            <div>
              <label htmlFor={`${uid}-cite`}>{tx('fieldCitation', lang)}</label>
              <input id={`${uid}-cite`} type="text" className="w-full" value={node.citation || ''}
                onChange={(e) => set({ citation: e.target.value })} placeholder={tx('fieldCitationPh', lang)} />
            </div>
          )}
        </>
      )}

      {node.kind === 'experiment' && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor={`${uid}-iftrue`}>{tx('fieldIfTrue', lang)}</label>
              <textarea id={`${uid}-iftrue`} className="w-full" rows={2} value={node.predictIfTrue || ''}
                onChange={(e) => set({ predictIfTrue: e.target.value })} placeholder={tx('fieldIfTruePh', lang)} />
            </div>
            <div>
              <label htmlFor={`${uid}-iffalse`}>{tx('fieldIfFalse', lang)}</label>
              <textarea id={`${uid}-iffalse`} className="w-full" rows={2} value={node.predictIfFalse || ''}
                onChange={(e) => set({ predictIfFalse: e.target.value })} placeholder={tx('fieldIfFalsePh', lang)} />
            </div>
          </div>
          <div>
            <label htmlFor={`${uid}-controls`}>{tx('fieldControls', lang)}</label>
            <input id={`${uid}-controls`} type="text" className="w-full" value={node.controls || ''}
              onChange={(e) => set({ controls: e.target.value })} placeholder={tx('fieldControlsPh', lang)} />
          </div>
          <div>
            <span className="eyebrow">{tx('fieldProtocol', lang)}</span>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              {node.protocolRef ? (
                <span className="flex items-center gap-1.5 min-w-0" style={{ fontSize: '0.875rem' }}>
                  <IconClipboard size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                  <span className="truncate">{protoName(node.protocolRef)}</span>
                </span>
              ) : (
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{tx('noEntry', lang)}</span>
              )}
              <button type="button" className="btn btn-sm" onClick={() => setProtoOpen((o) => !o)} aria-expanded={protoOpen}>
                {tx('chooseProtocol', lang)}
              </button>
              {node.protocolRef && <button type="button" className="btn-ghost btn-sm" onClick={() => set({ protocolRef: null })}>{tx('clear', lang)}</button>}
            </div>
            {protoOpen && (
              <div className="panel mt-2">
                <div className="p-2" style={{ borderBottom: '1px solid var(--rule)' }}>
                  <div className="search-field">
                    <IconSearch size={15} />
                    <input type="search" value={protoQuery} onChange={(e) => setProtoQuery(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
                      placeholder={tx('chooseProtocol', lang)} aria-label={tx('chooseProtocol', lang)} />
                  </div>
                </div>
                <div className="list" style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {protoMatches.map((r) => (
                    <button key={r.id} type="button" className="list-row" style={{ minHeight: '2.5rem' }}
                      onClick={() => { set({ protocolRef: r.id }); setProtoOpen(false); setProtoQuery(''); }}>
                      <span className="list-row-title truncate">{zh ? r.nameCn || r.name : r.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      <div>
        <div className="eyebrow">{tx('links', lang)}</div>
        {validEdges.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>{tx('noLinks', lang)}</p>
        ) : (
          <ul className="mt-1">
            {validEdges.map((e) => {
              const otherId = e.from === node.id ? e.to : e.from;
              const other = byId.get(otherId);
              return (
                <li key={e.id} className="flex items-center gap-2 py-1.5" style={{ borderTop: '1px solid var(--rule)', fontSize: '0.8125rem' }}>
                  <span className="mono flex-none" style={{ fontWeight: 700 }}>{relPhrase(e.rel, labels[e.from], labels[e.to], lang)}</span>
                  <span className="min-w-0 truncate" style={{ color: 'var(--text-muted)' }}>{clip(other?.text, 80)}</span>
                  <button type="button" className="btn-ghost btn-icon btn-sm ml-auto flex-none" onClick={() => removeLink(e)} aria-label={tx('removeLink', lang)}>
                    <IconClose size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        {droppedCount > 0 && (
          <p style={{ fontSize: '0.75rem', color: 'var(--warning-text)', marginTop: '0.25rem' }}>
            {zh ? `更改类型后，${droppedCount} 条连接不再适用，保存时将删除。` : `${droppedCount} link(s) no longer fit this type and will be removed on save.`}
          </p>
        )}
        {targets.length === 0 ? (
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem' }}>{tx('noLinkTargets', lang)}</p>
        ) : (
          <div className="grid gap-2 mt-2 grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end">
            <div className="min-w-0">
              <label htmlFor={`${uid}-target`}>{tx('linkTo', lang)}</label>
              <select id={`${uid}-target`} className="w-full" value={target} onChange={(e) => { setTarget(e.target.value); setOptIdx(0); }}>
                <option value="">—</option>
                {NODE_KINDS.map((k) => {
                  const group = targets.filter((o) => o.kind === k);
                  if (!group.length) return null;
                  return (
                    <optgroup key={k} label={tx(`kind_${k}`, lang)}>
                      {group.map((o) => <option key={o.id} value={o.id}>{`${labels[o.id]} · ${clip(o.text, 50)}`}</option>)}
                    </optgroup>
                  );
                })}
              </select>
            </div>
            <div className="min-w-0">
              <label htmlFor={`${uid}-rel`}>{tx('linkAs', lang)}</label>
              <select id={`${uid}-rel`} className="w-full" value={optIdx} disabled={!options.length} onChange={(e) => setOptIdx(Number(e.target.value))}>
                {options.length === 0 && <option value={0}>—</option>}
                {options.map((o, i) => <option key={i} value={i}>{relPhrase(o.rel, labels[o.from], labels[o.to], lang)}</option>)}
              </select>
            </div>
            <button type="button" className="btn" onClick={addLink} disabled={!options.length}><IconPlus size={14} />{tx('addLink', lang)}</button>
          </div>
        )}
      </div>
    </Dialog>
  );
}

// Fresh defaults for a kind's own fields (not text/note/origin/id).
function kindDefaults(kind) {
  const fresh = createNode(kind);
  const keep = ['id', 'text', 'note', 'origin', 'reviewed', 'sourceQuote', 'createdAt', 'updatedAt', 'kind'];
  return Object.fromEntries(Object.entries(fresh).filter(([k]) => !keep.includes(k)));
}
