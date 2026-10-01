// The Evidence map's smaller dialogs: split a draft into nodes, record an
// experiment's result, pick a relation for a new link, edit map details,
// export (Markdown / AI-native JSON) and import JSON.
import { useState, useId, useMemo, useRef } from 'react';
import Dialog from '../../components/Dialog.jsx';
import { NODE_KINDS, splitIntoPropositions } from '../../lib/evidence.js';
import { mapFromJSON } from '../../lib/evidenceFormat.js';
import { tx, KIND_META, relPhrase } from './evidenceText.js';
import { IconPlus, IconTrash, IconDownload, IconCopy, IconUpload, IconFile, IconAlert, IconInfo } from '../../components/icons.jsx';

// ── Split a draft into propositions ────────────────────────────────────────────
export function SplitDialog({ lang, agentAvailable, onAdd, onClose }) {
  const uid = useId();
  const [text, setText] = useState('');
  const [items, setItems] = useState(null); // null = still editing the draft

  const run = () => setItems(splitIntoPropositions(text).map((it) => ({ ...it, include: true })));
  const setItem = (i, patch) => setItems((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const chosen = (items || []).filter((it) => it.include && it.text.trim());

  const footer = items ? (
    <>
      <button type="button" className="btn mr-auto" onClick={() => setItems(null)}>{tx('splitEdit', lang)}</button>
      <button type="button" className="btn" onClick={onClose}>{tx('cancel', lang)}</button>
      <button type="button" className="btn-primary" disabled={!chosen.length}
        onClick={() => onAdd(chosen.map(({ kind, text: t, citation }) => ({ kind, text: t.trim(), quote: t.trim(), citation })))}>
        <IconPlus size={14} />{tx('splitAdd', lang, { n: chosen.length })}
      </button>
    </>
  ) : (
    <>
      <button type="button" className="btn" onClick={onClose}>{tx('cancel', lang)}</button>
      <button type="button" className="btn-primary" disabled={!text.trim()} onClick={run}>{tx('splitGo', lang)}</button>
    </>
  );

  return (
    <Dialog title={tx('splitTitle', lang)} onClose={onClose} lang={lang} size="lg" footer={footer}>
      {!items ? (
        <>
          <div>
            <label htmlFor={`${uid}-draft`}>{tx('splitDraft', lang)}</label>
            <textarea id={`${uid}-draft`} className="w-full" rows={10} value={text} data-autofocus
              onChange={(e) => setText(e.target.value)} placeholder={tx('splitPh', lang)} />
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{tx('splitHelp', lang)}</p>
          {agentAvailable && <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{tx('splitAssistant', lang)}</p>}
        </>
      ) : items.length === 0 ? (
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{tx('splitNone', lang)}</p>
      ) : (
        <>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{tx('splitHelp', lang)}</p>
          <ol>
            {items.map((it, i) => (
              <li key={i} className="grid gap-2 py-2.5 grid-cols-[auto_minmax(0,1fr)]" style={{ borderTop: '1px solid var(--rule)', opacity: it.include ? 1 : 0.55 }}>
                <input type="checkbox" checked={it.include} onChange={(e) => setItem(i, { include: e.target.checked })}
                  aria-label={`${tx('splitInclude', lang)} ${i + 1}`} style={{ width: 16, height: 16, marginTop: 8 }} />
                <div className="min-w-0 space-y-1.5">
                  <textarea className="w-full" rows={2} value={it.text} onChange={(e) => setItem(i, { text: e.target.value })}
                    aria-label={`${tx('fieldText', lang)} ${i + 1}`} style={{ minHeight: 0 }} />
                  <div className="flex flex-wrap items-center gap-2">
                    <select value={it.kind} onChange={(e) => setItem(i, { kind: e.target.value })}
                      aria-label={`${tx('fieldKind', lang)} ${i + 1}`} style={{ minHeight: '1.875rem', width: 'auto', color: KIND_META[it.kind].fg }}>
                      {NODE_KINDS.map((k) => <option key={k} value={k}>{tx(`kind_${k}`, lang)}</option>)}
                    </select>
                    {it.kind === 'evidence' && it.citation && (
                      <span className="mono truncate" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{it.citation}</span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </Dialog>
  );
}

// ── Record what an experiment showed ───────────────────────────────────────────
export function OutcomeDialog({ lang, label, targets, initialText, onSave, onClose }) {
  const uid = useId();
  const [outcome, setOutcome] = useState('supports');
  const [text, setText] = useState(initialText || '');
  const [chosen, setChosen] = useState(() => targets.map((t) => t.id));
  const toggle = (id, on) => setChosen((c) => (on ? [...c, id] : c.filter((x) => x !== id)));
  const canSave = text.trim() && (outcome === 'inconclusive' || chosen.length > 0);
  return (
    <Dialog title={tx('outcomeTitle', lang, { label })} onClose={onClose} lang={lang}
      onSubmit={(e) => { e.preventDefault(); if (canSave) onSave({ outcome, text: text.trim(), targets: chosen }); }}
      footer={(
        <>
          <button type="button" className="btn" onClick={onClose}>{tx('cancel', lang)}</button>
          <button type="submit" className="btn-primary" disabled={!canSave}>{tx('save', lang)}</button>
        </>
      )}>
      <div>
        <span className="eyebrow" id={`${uid}-out`}>{tx('outcomeShowed', lang)}</span>
        <div className="seg mt-1.5" role="group" aria-labelledby={`${uid}-out`}>
          {['supports', 'contradicts', 'inconclusive'].map((o) => (
            <button key={o} type="button" aria-pressed={outcome === o} onClick={() => setOutcome(o)}>{tx(`out_${o}`, lang)}</button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor={`${uid}-text`}>{tx('outcomeText', lang)}</label>
        <textarea id={`${uid}-text`} className="w-full" rows={4} value={text} data-autofocus
          onChange={(e) => setText(e.target.value)} placeholder={tx('outcomePh', lang)} />
      </div>
      {outcome !== 'inconclusive' && targets.length > 0 && (
        <fieldset>
          <legend className="eyebrow">{tx('outcomeFor', lang)}</legend>
          {targets.map((t) => (
            <label key={t.id} className="label-inline flex gap-2.5 py-1.5" style={{ alignItems: 'flex-start' }}>
              <input type="checkbox" checked={chosen.includes(t.id)} onChange={(e) => toggle(t.id, e.target.checked)}
                style={{ width: 16, height: 16, marginTop: 3, flexShrink: 0 }} />
              <span style={{ fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 }}>
                <span className="mono" style={{ fontWeight: 700 }}>{t.label}</span> {t.text}
              </span>
            </label>
          ))}
        </fieldset>
      )}
    </Dialog>
  );
}

// ── Choose a relation when two nodes can be linked more than one way ───────────
export function RelationChooser({ lang, options, labels, onPick, onClose }) {
  return (
    <Dialog title={tx('chooseRelTitle', lang)} onClose={onClose} lang={lang} size="sm">
      <div className="flex flex-col gap-2">
        {options.map((o, i) => (
          <button key={i} type="button" className="btn btn-block" onClick={() => onPick(o)} data-autofocus={i === 0 ? true : undefined}
            style={{ justifyContent: 'flex-start' }}>
            <span className="mono">{relPhrase(o.rel, labels[o.from], labels[o.to], lang)}</span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

// ── Map title / description, and delete ───────────────────────────────────────
export function MapDetailsDialog({ lang, map, onSave, onDelete, onClose }) {
  const uid = useId();
  const [title, setTitle] = useState(map.title || '');
  const [description, setDescription] = useState(map.description || '');
  const [confirm, setConfirm] = useState(false);
  return (
    <Dialog title={tx('detailsTitle', lang)} onClose={onClose} lang={lang}
      onSubmit={(e) => { e.preventDefault(); onSave({ title: title.trim(), description: description.trim() }); }}
      footer={confirm ? (
        <>
          <span className="mr-auto" style={{ fontSize: '0.8125rem', maxWidth: '36ch' }}>{tx('deleteMapConfirm', lang)}</span>
          <button type="button" className="btn" onClick={() => setConfirm(false)}>{tx('cancel', lang)}</button>
          <button type="button" className="btn-danger" onClick={onDelete}><IconTrash size={14} />{tx('deleteMap', lang)}</button>
        </>
      ) : (
        <>
          <button type="button" className="btn-ghost btn-sm mr-auto" style={{ color: 'var(--danger-text)' }} onClick={() => setConfirm(true)}>
            <IconTrash size={14} />{tx('deleteMap', lang)}
          </button>
          <button type="button" className="btn" onClick={onClose}>{tx('cancel', lang)}</button>
          <button type="submit" className="btn-primary">{tx('save', lang)}</button>
        </>
      )}>
      <div>
        <label htmlFor={`${uid}-title`}>{tx('fieldTitle', lang)}</label>
        <input id={`${uid}-title`} type="text" className="w-full" value={title} data-autofocus
          onChange={(e) => setTitle(e.target.value)} placeholder={tx('untitledMap', lang)} />
      </div>
      <div>
        <label htmlFor={`${uid}-desc`}>{tx('fieldDesc', lang)}</label>
        <textarea id={`${uid}-desc`} className="w-full" rows={3} value={description}
          onChange={(e) => setDescription(e.target.value)} placeholder={tx('fieldDescPh', lang)} />
      </div>
    </Dialog>
  );
}

// ── Export: Markdown for people, JSON for AI tools ─────────────────────────────
export function ExportDialog({ lang, onMarkdown, onJson, onCopyJson, onClose }) {
  const option = (Icon, title, desc, actions) => (
    <div className="panel" style={{ padding: '0.875rem 1rem' }}>
      <div className="flex items-center gap-2">
        <Icon size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{title}</span>
      </div>
      <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '0.25rem', lineHeight: 1.5 }}>{desc}</p>
      <div className="flex flex-wrap gap-2" style={{ marginTop: '0.625rem' }}>{actions}</div>
    </div>
  );
  return (
    <Dialog title={tx('exportTitle', lang)} onClose={onClose} lang={lang}>
      {option(IconFile, tx('exportMdTitle', lang), tx('exportMdDesc', lang), (
        <button type="button" className="btn btn-sm" onClick={() => { onMarkdown(); onClose(); }} data-autofocus>
          <IconDownload size={13} />{tx('download', lang)} .md
        </button>
      ))}
      {option(IconCopy, tx('exportJsonTitle', lang), tx('exportJsonDesc', lang), (
        <>
          <button type="button" className="btn-primary btn-sm" onClick={() => { onCopyJson(); onClose(); }}>
            <IconCopy size={13} />{tx('copy', lang)}
          </button>
          <button type="button" className="btn btn-sm" onClick={() => { onJson(); onClose(); }}>
            <IconDownload size={13} />{tx('download', lang)} .json
          </button>
        </>
      ))}
    </Dialog>
  );
}

// ── Import JSON (pasted or from a file) as a new map ───────────────────────────
export function ImportDialog({ lang, onImport, onClose }) {
  const uid = useId();
  const fileRef = useRef(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState(null);

  // Parse as you paste, to show what will come in before anything is saved.
  const preview = useMemo(() => {
    if (!text.trim()) return null;
    try { return { ok: mapFromJSON(text) }; } catch (e) { return { error: e.code || 'parse' }; }
  }, [text]);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setText(await file.text()); setFailure(null); } catch { setFailure('parse'); }
  };
  const run = async (e) => {
    e?.preventDefault?.();
    if (!preview?.ok || busy) return;
    setBusy(true);
    try { await onImport(text); } catch (err) { setFailure(err?.code || 'parse'); setBusy(false); }
  };

  const err = failure || preview?.error;
  const r = preview?.ok?.report;
  return (
    <Dialog title={tx('importTitle', lang)} onClose={onClose} lang={lang} size="lg" onSubmit={run}
      footer={(
        <>
          <button type="button" className="btn mr-auto" onClick={() => fileRef.current?.click()}><IconUpload size={14} />{tx('importFile', lang)}</button>
          <button type="button" className="btn" onClick={onClose}>{tx('cancel', lang)}</button>
          <button type="submit" className="btn-primary" disabled={!preview?.ok || busy}>{tx('importGo', lang)}</button>
        </>
      )}>
      <input ref={fileRef} type="file" accept=".json,application/json" onChange={onFile} className="hidden" tabIndex={-1} aria-hidden="true" />
      <div>
        <label htmlFor={`${uid}-json`}>{tx('importPaste', lang)}</label>
        <textarea id={`${uid}-json`} className="w-full mono" rows={9} value={text} data-autofocus spellCheck={false}
          onChange={(e) => { setText(e.target.value); setFailure(null); }} placeholder={tx('importPh', lang)}
          style={{ fontSize: '0.75rem' }} />
      </div>
      {err ? (
        <div className="notice notice-danger" role="alert">
          <IconAlert size={15} style={{ color: 'var(--danger-text)', flexShrink: 0, marginTop: 2 }} />
          <span>{tx(`importErr_${err}`, lang)}</span>
        </div>
      ) : r ? (
        <div className="notice notice-info" role="status">
          <IconInfo size={15} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
          <span>
            {tx('importSummary', lang, { title: preview.ok.map.title || tx('untitledMap', lang), nodes: r.nodes, links: r.links })}
            {r.needsReview > 0 && <> {tx('importReview', lang, { n: r.needsReview })}</>}
            {r.droppedNodes > 0 && <> {tx('importDroppedNodes', lang, { n: r.droppedNodes })}</>}
            {r.droppedLinks > 0 && <> {tx('importDroppedLinks', lang, { n: r.droppedLinks })}</>}
          </span>
        </div>
      ) : (
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>{tx('importHelp', lang)}</p>
      )}
    </Dialog>
  );
}
