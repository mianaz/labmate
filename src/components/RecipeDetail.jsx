import React, { useState, useMemo, useEffect } from 'react';
import { t, useLang, NOTES_EN } from '../i18n/index.js';
import { safeText, BoldText, getRecipeNotes, downloadFile, renderDynamicStep } from '../lib/utils.js';
import { useToast } from './Toast.jsx';
import { useTimers } from './Timer.jsx';
import { useFavs } from './Favorites.jsx';
import { useRecipes } from '../lib/RecipeProvider.jsx';
import GelTab from '../features/calc/GelTab.jsx';
import db from '../lib/db.js';
import { CAT_COLORS, categoryLabel, disciplineLabel } from './RecipeRow.jsx';
import {
  IconStar, IconDownload, IconCopy, IconEdit, IconTrash, IconArrowRight, IconArrowUpRight,
  IconTimer, IconCheck, IconPause, IconInfo,
} from './icons.jsx';

// Helper: convert recipe to text for download/clipboard
function recipeToText(recipe, targetVol, lang) {
  const scale = targetVol / recipe.defaultVolume;
  let txt = `${'═'.repeat(50)}\n`;
  txt += recipe.name + '\n' + (lang === 'zh' ? recipe.nameCn + '\n' : '');
  if (recipe.ph) txt += `pH: ${recipe.ph}\n`;
  txt += `${'─'.repeat(50)}\n`;
  txt += `目标体积: ${targetVol} ${recipe.unit}`;
  if (scale !== 1) txt += `  (×${scale.toFixed(2)})`;
  txt += '\n\n';
  txt += '试剂'.padEnd(35) + '用量'.padStart(10) + '  单位\n';
  txt += '─'.repeat(50) + '\n';
  (recipe.components || []).forEach(c => {
    const scaled = c.amount * scale;
    const val = scaled < 0.01 ? scaled.toExponential(2) : scaled < 1 ? scaled.toFixed(3) : scaled < 100 ? scaled.toFixed(2) : scaled.toFixed(1);
    txt += c.name.padEnd(35) + val.padStart(10) + '  ' + c.unit;
    if (c.note) txt += '  (' + safeText(c.note, lang) + ')';
    txt += '\n';
  });
  const noteTxt = getRecipeNotes(recipe, 'en'); if (noteTxt) txt += '\nNote: ' + noteTxt + '\n';
  if (recipe.ref) txt += '\nRef: ' + recipe.ref + '\n';
  return txt;
}

// Regexes hoisted to module scope: this runs for every step of a protocol, and
// the detail view re-renders on each timer tick and volume-scale keystroke.
// The two global ones are reset before each scan.
const PCR_DEG_RE = /°C/;
const PCR_CYCLE_RE = /[×x]\s*\d+|cycles?|\d+\s*轮/i;
const CENTRIFUGE_RE = /\d+\s*[×x]\s*g\b/i;
const HAS_TIME_UNIT_RE = /\d+\s*(min|h|s|分|秒|小时)/i;
const RATIO_S_RE = /\d+S\/\d+S/g;
const RATIO_A_RE = /A\d+\/\d+/g;
// English time regex — captures optional range (takes the LAST/max number before unit)
const EN_TIME_RE = /(?:(\d+(?:\.\d+)?)\s*[-–]\s*)?(\d+(?:\.\d+)?)\s*(min(?:utes?)?|h(?:ours?|rs?)?|s(?:ec(?:onds?)?)?)\b/gi;
// Chinese time regex — same range-aware pattern
const ZH_TIME_RE = /(?:(\d+(?:\.\d+)?)\s*[-–]\s*)?(\d+(?:\.\d+)?)\s*(分钟|分|小时|秒)/g;
const APPROX_RE = /[~≈约大约]/;
const APPROX_EN_RE = /about|approx/i;
const ON_OFF_RE = /^\s*(on|off)\b/i;

// Parse time patterns in step text and return array of {text, seconds, label} matches
export function parseTimePatternsFromText(text) {
  if (!text) return [];
  const matches = [];
  // Skip entire text if it's a PCR cycling line (contains °C + cycles/×)
  if (PCR_DEG_RE.test(text) && PCR_CYCLE_RE.test(text)) return matches;
  // Skip centrifuge lines (×g or rpm with no actionable timer)
  if (CENTRIFUGE_RE.test(text) && !HAS_TIME_UNIT_RE.test(text)) return matches;
  // Skip ratio patterns like 28S/18S, A260/280
  const cleaned = text.replace(RATIO_S_RE, '').replace(RATIO_A_RE, '');
  const enRegex = EN_TIME_RE; enRegex.lastIndex = 0;
  const zhRegex = ZH_TIME_RE; zhRegex.lastIndex = 0;
  let m;
  while ((m = enRegex.exec(cleaned)) !== null) {
    // Skip approximate/informational markers
    const before = cleaned.slice(Math.max(0, m.index - 10), m.index);
    if (APPROX_RE.test(before) || APPROX_EN_RE.test(before)) continue;
    // Skip sonication on/off patterns (e.g., "30s on/30s off")
    const after = cleaned.slice(m.index + m[0].length, m.index + m[0].length + 10);
    if (ON_OFF_RE.test(after)) continue;
    // Use max of range (group 2) or single value
    const val = parseFloat(m[2]);
    const unit = m[3].toLowerCase();
    let seconds;
    if (unit.startsWith('h')) seconds = val * 3600;
    else if (unit.startsWith('s')) seconds = val;
    else seconds = val * 60;
    if (seconds >= 5 && seconds <= 86400) {
      matches.push({ seconds, label: m[0].trim() });
    }
  }
  while ((m = zhRegex.exec(cleaned)) !== null) {
    const before = cleaned.slice(Math.max(0, m.index - 10), m.index);
    if (APPROX_RE.test(before)) continue;
    const val = parseFloat(m[2]);
    const unit = m[3];
    let seconds;
    if (unit === '小时') seconds = val * 3600;
    else if (unit === '秒') seconds = val;
    else seconds = val * 60;
    if (seconds >= 5 && seconds <= 86400 && !matches.some(x => x.seconds === seconds)) {
      matches.push({ seconds, label: m[0].trim() });
    }
  }
  return matches;
}

// Number formatting shared by the table, legacy timeline and text export.
function fmtAmount(v) {
  return v < 0.01 ? v.toExponential(2) : v < 1 ? v.toFixed(3) : v < 100 ? v.toFixed(2) : v.toFixed(1);
}

const SCALE_PRESETS = [0.5, 1, 2, 5];
const RELATED_PREVIEW = 4;

function SectionHead({ title, children, id }) {
  return (
    <div className="doc-section-head">
      <h3 id={id} className="eyebrow" style={{ color: 'var(--text)' }}>{title}</h3>
      {children && <div className="flex items-center gap-2 flex-wrap justify-end">{children}</div>}
    </div>
  );
}

function RecipeDetail({ recipe, onNavigateRecipe, onCrossNavigate, onEditCustom, onDeleteCustom }) {
  const lang = useLang();
  const toast = useToast();
  const { addTimer } = useTimers();
  const { isFav, toggle } = useFavs();
  const { recipeById: RECIPE_BY_ID } = useRecipes();
  const [targetVol, setTargetVol] = useState(recipe.defaultVolume);
  const [showDetailed, setShowDetailed] = useState(false);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const scale = targetVol / recipe.defaultVolume;
  const isProtocol = recipe.category === 'protocol';
  const isGel = recipe.id === 'sds_page_gel';
  const hasStepToggle = recipe.briefSteps && recipe.detailedSteps;
  const fav = isFav(recipe.id);
  const cc = CAT_COLORS[recipe.category] || CAT_COLORS.buffer;
  const disc = disciplineLabel(recipe, lang);

  // Step tracker state (persisted in localStorage + IndexedDB per recipe)
  const storageKey = 'stepTracker_' + recipe.id;
  const [completedSteps, setCompletedSteps] = useState(() => {
    try { const s = localStorage.getItem(storageKey); return s ? new Set(JSON.parse(s)) : new Set(); }
    catch { return new Set(); }
  });

  useEffect(() => {
    setTargetVol(recipe.defaultVolume);
    setShowDetailed(false);
    setShowAllRelated(false);
    // Load step tracker for new recipe (sync from localStorage, then async from IndexedDB)
    try { const s = localStorage.getItem('stepTracker_' + recipe.id); setCompletedSteps(s ? new Set(JSON.parse(s)) : new Set()); }
    catch { setCompletedSteps(new Set()); }
    // Async load from IndexedDB (overrides if found)
    db.stepProgress.get(recipe.id).then(row => {
      if (row && row.completedSteps) setCompletedSteps(new Set(row.completedSteps));
    }).catch(() => {});
  }, [recipe.id]);

  const toggleStep = (idx) => {
    setCompletedSteps(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      const arr = [...next];
      // Dual-write: localStorage + IndexedDB
      try { localStorage.setItem(storageKey, JSON.stringify(arr)); } catch {}
      db.stepProgress.put({ recipeId: recipe.id, completedSteps: arr }).catch(() => {});
      return next;
    });
  };
  const resetSteps = () => {
    setCompletedSteps(new Set());
    try { localStorage.removeItem(storageKey); } catch {}
    db.stepProgress.delete(recipe.id).catch(() => {});
  };

  // Timer suggestions per step, computed once per recipe/language rather than
  // inside the step map on every render.
  const stepTimeMatches = useMemo(
    () => (recipe.detailedSteps || []).map(step =>
      step.isHeader ? [] : parseTimePatternsFromText(step[lang] || step.zh || step.en || '')),
    [recipe.detailedSteps, lang]
  );

  // Find related protocol names (memoized — RECIPES lookup is O(n) per id)
  const relatedProtos = useMemo(() =>
    (recipe.relatedProtocols || []).map(pid => RECIPE_BY_ID[pid]).filter(Boolean),
    [recipe.relatedProtocols, RECIPE_BY_ID]
  );

  // Storage (reagents) / duration (protocols). Two recipe shapes exist: protocols
  // carry `storage.label.{en,zh}`, buffers carry `{temperature, duration, sterile, notes}`.
  const storageText = useMemo(() => {
    const { storage } = recipe;
    if (!storage) return '';
    if (storage.label) {
      const rawLabel = storage.label[lang] || storage.label.zh || storage.label.en;
      return (rawLabel || '').replace(/^(Protocol|实验方案)\s*[—–-]\s*/i, '');
    }
    return [storage.temperature || storage.temp, storage.duration].filter(Boolean).join(', ');
  }, [recipe, lang]);

  const actionSteps = (recipe.detailedSteps || []).filter(s => !s.isHeader);
  const doneCount = [...completedSteps].filter(idx => recipe.detailedSteps?.[idx] && !recipe.detailedSteps[idx].isHeader).length;
  const noteText = (NOTES_EN[recipe.id] || recipe.notes)
    ? (lang === 'en' && NOTES_EN[recipe.id] ? NOTES_EN[recipe.id] : getRecipeNotes(recipe, lang))
    : '';
  const showComponentsNotes = (recipe.components || []).some(c => c.note);

  const facts = [];
  if (recipe.ph) facts.push({ k: t('phLabel', lang), v: recipe.ph });
  if (storageText) facts.push({ k: isProtocol ? t('durationLabel', lang) : t('storageLabel', lang), v: storageText, wide: storageText.length > 26 });
  if (!isProtocol && !isGel && recipe.defaultVolume) facts.push({ k: t('defaultVolLabel', lang), v: `${recipe.defaultVolume} ${recipe.unit}` });
  if (isProtocol && actionSteps.length) facts.push({ k: t('stepsLabel', lang), v: String(actionSteps.length) });
  if (isProtocol && recipe.materials?.length) facts.push({ k: t('materialsLabel', lang), v: String(recipe.materials.length) });
  if (!isProtocol && !isGel && recipe.components?.length) facts.push({ k: t('componentsLabel', lang), v: String(recipe.components.length) });

  const openLinked = (linked) => {
    const sameTab = (recipe.category === 'protocol' && linked.category === 'protocol') || (recipe.category !== 'protocol' && linked.category !== 'protocol');
    if (sameTab && onNavigateRecipe) onNavigateRecipe(linked);
    else if (onCrossNavigate) onCrossNavigate(linked);
  };

  return (
    <article className="panel fade-in" aria-labelledby="recipe-detail-title">
      {/* ── Header ─────────────────────────────── */}
      <header className="px-4 pt-4 pb-4 sm:px-6 sm:pt-5 lg:px-7 lg:pt-6">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 min-w-0 pt-1">
            <span className="eyebrow inline-flex items-center gap-1.5" style={{ color: cc.text }}>
              <span className="dot" aria-hidden="true" />{categoryLabel(recipe, lang)}
            </span>
            {disc && <span className="eyebrow">· {disc}</span>}
            <span className={recipe._isCustom ? 'badge badge-green' : 'badge'}>{recipe._isCustom ? t('customBadge', lang) : t('systemBadge', lang)}</span>
          </div>
          <div className="flex items-center gap-0.5 flex-shrink-0 no-print">
            <button type="button" className="btn-ghost btn-icon btn-sm" aria-pressed={fav}
              aria-label={fav ? t('favRemove', lang) : t('favAdd', lang)} title={fav ? t('favRemove', lang) : t('favAdd', lang)}
              onClick={() => { toggle(recipe.id); toast.show(fav ? t('removedFav', lang) : t('addedFav', lang), ''); }}
              style={fav ? { color: 'var(--fav-star)' } : undefined}>
              <IconStar size={16} filled={fav} />
            </button>
            <button type="button" className="btn-ghost btn-icon btn-sm" aria-label={t('downloadTxt', lang)} title={t('downloadTxt', lang)}
              onClick={() => { downloadFile(recipe.id + '.txt', recipeToText(recipe, targetVol, lang)); toast.show(t('downloaded', lang)); }}>
              <IconDownload size={16} />
            </button>
            <button type="button" className="btn-ghost btn-icon btn-sm" aria-label={t('copyClipboard', lang)} title={t('copyClipboard', lang)}
              onClick={() => { navigator.clipboard.writeText(recipeToText(recipe, targetVol, lang)); toast.show(t('copied', lang)); }}>
              <IconCopy size={16} />
            </button>
            {recipe._isCustom && onEditCustom && (
              <>
                <span aria-hidden="true" style={{ width: 1, height: 18, background: 'var(--rule)', margin: '0 0.25rem' }} />
                <button type="button" className="btn-ghost btn-icon btn-sm" aria-label={t('editCustom', lang)} title={t('editCustom', lang)} onClick={() => onEditCustom(recipe)}>
                  <IconEdit size={16} />
                </button>
                <button type="button" className="btn-ghost btn-icon btn-sm" aria-label={t('deleteCustom', lang)} title={t('deleteCustom', lang)}
                  onClick={() => { if (window.confirm(t('deleteConfirm', lang))) onDeleteCustom(recipe); }}
                  style={{ color: 'var(--danger-text)' }}>
                  <IconTrash size={16} />
                </button>
              </>
            )}
          </div>
        </div>
        <h2 id="recipe-detail-title" style={{ fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.375rem, 1.1rem + 1vw, 1.875rem)', fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.15 }}>
          {recipe.name}
        </h2>
        {lang === 'zh' && recipe.nameCn && <p className="mt-1" style={{ color: 'var(--text-muted)', fontSize: '0.9375rem' }}>{recipe.nameCn}</p>}
        {recipe.usage && (
          <p className="mt-2.5 detail-text" style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text)' }}>
            {recipe.usage[lang] || recipe.usage.zh}
          </p>
        )}
        {relatedProtos.length > 0 && (
          <div className="mt-3.5 flex items-center gap-1.5 flex-wrap">
            <span className="eyebrow mr-1">{t('usedInLabel', lang)}</span>
            {(showAllRelated ? relatedProtos : relatedProtos.slice(0, RELATED_PREVIEW)).map(p => (
              <button key={p.id} type="button" onClick={() => onCrossNavigate ? onCrossNavigate(p) : null}
                className="chip" style={{ color: 'var(--accent)', borderColor: 'var(--border)' }}>
                {p.name}<IconArrowRight size={12} />
              </button>
            ))}
            {relatedProtos.length > RELATED_PREVIEW && (
              <button type="button" className="chip" aria-expanded={showAllRelated} onClick={() => setShowAllRelated(v => !v)}
                style={{ borderStyle: 'dashed' }}>
                {showAllRelated ? (lang === 'zh' ? '收起' : 'Show less') : `+${relatedProtos.length - RELATED_PREVIEW} ${lang === 'zh' ? '更多' : 'more'}`}
              </button>
            )}
          </div>
        )}
      </header>

      {facts.length > 0 && (
        <dl className="meta-grid" style={{ borderLeft: 0, marginRight: -1 }}>
          {facts.map(f => (
            <div key={f.k} style={f.wide ? { gridColumn: 'span 2' } : undefined}>
              <dt>{f.k}</dt>
              <dd>{f.v}</dd>
            </div>
          ))}
        </dl>
      )}

      <div className="px-4 pb-6 sm:px-6 lg:px-7">
        {/* Inline SDS-PAGE Gel Calculator for sds_page_gel recipe */}
        {isGel && <div className="doc-section"><GelTab /></div>}

        {/* Materials (protocols with linked recipes) */}
        {recipe.materials && recipe.materials.length > 0 && (
          <section className="doc-section" aria-labelledby="doc-materials">
            <SectionHead id="doc-materials" title={t('materialsLabel', lang)} />
            <ul className="grid gap-x-6" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(16rem, 1fr))' }}>
              {recipe.materials.map((mat, i) => {
                // Custom protocols store materials as plain strings.
                const m = typeof mat === 'string' ? { name: mat } : mat;
                const linked = m.linkedRecipe ? RECIPE_BY_ID[m.linkedRecipe] : null;
                return (
                  <li key={i} className="flex items-baseline gap-2 py-1.5" style={{ borderBottom: '1px solid var(--rule)', fontSize: '0.875rem' }}>
                    <span className="flex-shrink-0" aria-hidden="true" style={{ width: 5, height: 5, background: 'var(--text-muted)', transform: 'translateY(-2px)' }} />
                    <span className="flex-1 min-w-0">
                      {linked ? (
                        <button type="button" onClick={() => openLinked(linked)} className="link inline-flex items-center gap-1" style={{ textAlign: 'left' }}>
                          {m.name}<IconArrowUpRight size={12} />
                        </button>
                      ) : m.name}
                      {m.note && <span className="block" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{safeText(m.note, lang)}</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Brief / Detailed steps (protocols) */}
        {hasStepToggle && (
          <section className="doc-section" aria-labelledby="doc-steps">
            <SectionHead id="doc-steps" title={t('stepsLabel', lang)}>
              <div className="seg" role="group" aria-label={t('stepsLabel', lang)}>
                <button type="button" aria-pressed={!showDetailed} onClick={() => setShowDetailed(false)}>{t('briefLabel', lang)}</button>
                <button type="button" aria-pressed={showDetailed} onClick={() => setShowDetailed(true)}>{t('detailedLabel', lang)}</button>
              </div>
            </SectionHead>

            {!showDetailed ? (
              <div className="notice notice-info detail-text" style={{ display: 'block', fontSize: '0.9375rem', lineHeight: 1.65 }}>
                {recipe.briefSteps.map((s, i) => (
                  <p key={i}>{s[lang] || s.zh}</p>
                ))}
              </div>
            ) : (
              <div>
                {actionSteps.length > 0 && (
                  <div className="mb-3 flex items-center gap-3 px-3 py-2" style={{ background: 'var(--bg-2)' }}>
                    <span className="mono whitespace-nowrap" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {t('stepProgress', lang)} <strong style={{ color: 'var(--text)' }}>{doneCount}/{actionSteps.length}</strong>
                    </span>
                    <div className="flex-1" style={{ height: 4, background: 'var(--card)', border: '1px solid var(--rule)' }}
                      role="progressbar" aria-valuemin={0} aria-valuemax={actionSteps.length} aria-valuenow={doneCount}
                      aria-label={t('stepProgress', lang)}>
                      <div style={{ height: '100%', width: `${(doneCount / actionSteps.length) * 100}%`, background: 'var(--primary)', transition: 'width var(--duration-base) var(--ease-out)' }} />
                    </div>
                    {doneCount > 0 && (
                      <button type="button" onClick={resetSteps} className="btn-ghost btn-sm">{t('stepReset', lang)}</button>
                    )}
                  </div>
                )}
                <ol className="protocol-timeline has-checks">
                  {recipe.detailedSteps.map((step, i) => {
                    const text = step[lang] || step.zh || step.en || '';
                    const isH = step.isHeader;
                    const isDone = completedSteps.has(i);
                    const timeMatches = stepTimeMatches[i] || [];
                    // Check for safe stop after this step
                    const safeStop = (recipe.safeStops || []).find(ss => ss.afterStep === i);
                    return (
                      <React.Fragment key={i}>
                        <li className={`protocol-step${isH ? ' is-header' : ''}`}
                          style={{
                            display: 'flex', alignItems: 'flex-start', gap: '0.625rem',
                            ...(isH ? { marginTop: i > 0 ? '0.75rem' : 0, fontWeight: 700, fontSize: '0.875rem', letterSpacing: '-0.005em' } : {}),
                            ...(isDone && !isH ? { opacity: 0.55 } : {}),
                          }}>
                          {!isH && (
                            <button type="button" onClick={() => toggleStep(i)} className="flex-shrink-0 flex items-center justify-center"
                              aria-pressed={isDone}
                              aria-label={isDone ? (lang === 'zh' ? '标记为未完成' : 'Mark step incomplete') : (lang === 'zh' ? '标记为已完成' : 'Mark step complete')}
                              style={{ width: 28, height: 28, margin: '-2px -6px 0 -6px', border: 0, background: 'transparent' }}>
                              <span style={{
                                width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                border: `1px solid ${isDone ? 'var(--border-strong)' : 'var(--border)'}`,
                                background: isDone ? 'var(--primary)' : 'var(--card)', color: 'var(--on-primary)',
                              }}>
                                {isDone && <IconCheck size={12} strokeWidth={3} />}
                              </span>
                            </button>
                          )}
                          <span className="flex flex-wrap items-start gap-x-3 gap-y-1.5 flex-1 min-w-0">
                          <BoldText text={text} style={{ color: 'var(--text)', flex: '1 1 16rem', minWidth: 0, ...(isDone && !isH ? { textDecoration: 'line-through', textDecorationColor: 'var(--text-muted)' } : {}) }} />
                          {timeMatches.length > 0 && (
                            <span className="flex gap-1 flex-shrink-0 flex-wrap no-print">
                              {timeMatches.slice(0, 2).map((tm, ti) => (
                                <button key={ti} type="button" onClick={() => { addTimer(recipe.name + ' - ' + tm.label, tm.seconds); toast.show((lang === 'zh' ? '计时开始：' : 'Timer started: ') + tm.label, '⏱'); }}
                                  className="btn btn-sm mono" title={lang === 'zh' ? '开始计时' : 'Start timer'}
                                  style={{ minHeight: '1.625rem', padding: '0 0.45rem', fontSize: '0.6875rem', color: 'var(--accent)', borderColor: 'var(--border)', fontWeight: 700 }}>
                                  <IconTimer size={12} />{tm.label}
                                </button>
                              ))}
                            </span>
                          )}
                          </span>
                        </li>
                        {safeStop && (
                          <li className="notice notice-warn my-1.5" style={{ listStyle: 'none', fontSize: '0.8125rem', padding: '0.5rem 0.75rem' }}>
                            <IconPause size={14} style={{ color: 'var(--warning-text)', flexShrink: 0, marginTop: 3 }} />
                            <span>
                              <span className="notice-title">{t('safeStop', lang)}</span>
                              <span style={{ color: 'var(--text-muted)', marginLeft: '0.5rem' }}>{safeStop.note[lang] || safeStop.note.en}</span>
                            </span>
                          </li>
                        )}
                      </React.Fragment>
                    );
                  })}
                </ol>
              </div>
            )}
          </section>
        )}

        {/* Components: legacy timeline for old protocols, table for buffers. Hidden for protocols with
            detailed steps, and for the SDS gel (its calculator replaces it). */}
        {isGel ? null : isProtocol && hasStepToggle ? null : isProtocol ? (
          <section className="doc-section" aria-labelledby="doc-steps-legacy">
            <SectionHead id="doc-steps-legacy" title={t('stepsLabel', lang)} />
            <ol className="protocol-timeline">
              {/* Custom protocols keep their steps as strings in briefSteps (no components). */}
              {!(recipe.components || []).length && (recipe.briefSteps || []).map((st, i) => (
                <li key={'b' + i} className="protocol-step">
                  <span style={{ color: 'var(--text)' }}>{typeof st === 'string' ? st : (st[lang] || st.zh || st.en)}</span>
                </li>
              ))}
              {(recipe.components || []).map((c, i) => {
                const isSubStep = c.name.startsWith('  ');
                return (
                  <li key={i} className={`protocol-step ${isSubStep ? 'sub-step' : ''}`}>
                    <span style={{ color: 'var(--text)' }}>{c.name.trim()}</span>
                    {c.unit !== 'step' && <span className="step-amount ml-2">{fmtAmount(c.amount * scale)} {c.unit}</span>}
                    {c.note && <span className="step-note">{safeText(c.note, lang)}</span>}
                  </li>
                );
              })}
            </ol>
          </section>
        ) : (
          <section className="doc-section" aria-labelledby="doc-components">
            <SectionHead id="doc-components" title={t('componentsLabel', lang)}>
              <label htmlFor="target-volume" className="whitespace-nowrap" style={{ margin: 0 }}>{t('targetVolume', lang)}</label>
              <div className="flex items-stretch">
                <input id="target-volume" type="number" value={targetVol} min={1}
                  onChange={e => setTargetVol(Math.max(1, +e.target.value))}
                  className="tabular" style={{ width: '6.5rem', minHeight: '2rem', paddingTop: '0.25rem', paddingBottom: '0.25rem' }} />
                <span className="mono flex items-center px-2" style={{ fontSize: '0.8125rem', background: 'var(--bg-2)', border: '1px solid var(--border-strong)', borderLeft: 0 }}>{recipe.unit}</span>
              </div>
              <div className="seg no-print" role="group" aria-label={t('scaleFactor', lang)}>
                {SCALE_PRESETS.map(m => (
                  <button key={m} type="button" aria-pressed={Math.abs(scale - m) < 1e-9}
                    onClick={() => setTargetVol(recipe.defaultVolume * m)}>
                    ×{m === 0.5 ? '½' : m}
                  </button>
                ))}
              </div>
            </SectionHead>
            {scale !== 1 && (
              <p className="mono mb-2" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {t('scaleFactor', lang)} ×{scale.toFixed(2)} · {t('defaultVolLabel', lang).toLowerCase()} {recipe.defaultVolume} {recipe.unit}
              </p>
            )}
            <div className="overflow-x-auto -mx-1">
              <table className="w-full">
                <thead>
                  <tr>
                    <th>{t('reagent', lang)}</th>
                    <th style={{ textAlign: 'right' }}>{t('amount', lang)}</th>
                    <th>{t('unit', lang)}</th>
                    {showComponentsNotes && <th>{t('notes', lang)}</th>}
                  </tr>
                </thead>
                <tbody>
                  {recipe.components.map((c, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>
                        {c.linkedRecipe && RECIPE_BY_ID[c.linkedRecipe] && onNavigateRecipe ? (
                          <button type="button" onClick={() => onNavigateRecipe(RECIPE_BY_ID[c.linkedRecipe])} className="link" style={{ textAlign: 'left' }}>
                            {c.name}
                          </button>
                        ) : c.name}
                      </td>
                      <td className="tabular" style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.875rem' }}>{fmtAmount(c.amount * scale)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{c.unit}</td>
                      {showComponentsNotes && <td style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{safeText(c.note, lang)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Preparation steps */}
        {recipe.prepSteps && recipe.prepSteps.length > 0 && (
          <section className="doc-section" aria-labelledby="doc-prep">
            <SectionHead id="doc-prep" title={t('prepStepsLabel', lang)} />
            <ol className="protocol-timeline">
              {recipe.prepSteps.map((step, i) => (
                <li key={i} className="protocol-step">
                  <span style={{ color: 'var(--text)' }}>{renderDynamicStep(step[lang] || step.zh || step.en || '', scale)}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {noteText && (
          <div className="notice mt-6 detail-text">
            <IconInfo size={15} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 2 }} />
            <p><span className="notice-title">{t('tip', lang)}:</span> {noteText}</p>
          </div>
        )}
        {recipe.ref && (
          <p className="mt-4 mono" style={{ fontSize: '0.6875rem', lineHeight: 1.5, color: 'var(--text-muted)' }}>
            <span className="eyebrow" style={{ fontSize: '0.625rem' }}>{t('referenceLabel', lang)}</span> {recipe.ref}
          </p>
        )}
      </div>
    </article>
  );
}

export default RecipeDetail;
