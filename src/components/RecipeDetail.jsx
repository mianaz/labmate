import React, { useState, useMemo, useEffect } from 'react';
import { t, useLang, NOTES_EN } from '../i18n/index.js';
import { S_MUTED, S_TEXT, S_PRIMARY, S_BORDER, S_BG2, S_INLINE_ICON } from '../lib/styleConstants.js';
import { safeText, BoldText, getRecipeNotes, downloadFile, renderDynamicStep } from '../lib/utils.js';
import { useToast } from './Toast.jsx';
import { useTimers } from './Timer.jsx';
import DownloadBtn from './DownloadBtn.jsx';
import { useRecipes } from '../lib/RecipeProvider.jsx';
import GelTab from '../features/calc/GelTab.jsx';
import db from '../lib/db.js';

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

// Parse time patterns in step text and return array of {text, seconds, label} matches
export function parseTimePatternsFromText(text) {
  const matches = [];
  // Skip entire text if it's a PCR cycling line (contains °C + cycles/×)
  if (/°C/.test(text) && /[×x]\s*\d+|cycles?|\d+\s*轮/i.test(text)) return matches;
  // Skip centrifuge lines (×g or rpm with no actionable timer)
  if (/\d+\s*[×x]\s*g\b/i.test(text) && !/\d+\s*(min|h|s|分|秒|小时)/i.test(text)) return matches;
  // Skip ratio patterns like 28S/18S, A260/280
  const cleaned = text.replace(/\d+S\/\d+S/g, '').replace(/A\d+\/\d+/g, '');
  // English time regex — captures optional range (takes the LAST/max number before unit)
  const enRegex = /(?:(\d+(?:\.\d+)?)\s*[-–]\s*)?(\d+(?:\.\d+)?)\s*(min(?:utes?)?|h(?:ours?|rs?)?|s(?:ec(?:onds?)?)?)\b/gi;
  // Chinese time regex — same range-aware pattern
  const zhRegex = /(?:(\d+(?:\.\d+)?)\s*[-–]\s*)?(\d+(?:\.\d+)?)\s*(分钟|分|小时|秒)/g;
  let m;
  while ((m = enRegex.exec(cleaned)) !== null) {
    // Skip approximate/informational markers
    const before = cleaned.slice(Math.max(0, m.index - 10), m.index);
    if (/[~≈约大约]/.test(before) || /about|approx/i.test(before)) continue;
    // Skip sonication on/off patterns (e.g., "30s on/30s off")
    const after = cleaned.slice(m.index + m[0].length, m.index + m[0].length + 10);
    if (/^\s*(on|off)\b/i.test(after)) continue;
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
    if (/[~≈约大约]/.test(before)) continue;
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

function RecipeDetail({ recipe, onNavigateRecipe, onCrossNavigate, onEditCustom, onDeleteCustom }) {
  const lang = useLang();
  const toast = useToast();
  const { addTimer } = useTimers();
  const { recipeById: RECIPE_BY_ID } = useRecipes();
  const [targetVol, setTargetVol] = useState(recipe.defaultVolume);
  const [showDetailed, setShowDetailed] = useState(false);
  const scale = targetVol / recipe.defaultVolume;
  const isProtocol = recipe.category === 'protocol';
  const hasStepToggle = recipe.briefSteps && recipe.detailedSteps;

  // Step tracker state (persisted in localStorage + IndexedDB per recipe)
  const storageKey = 'stepTracker_' + recipe.id;
  const [completedSteps, setCompletedSteps] = useState(() => {
    try { const s = localStorage.getItem(storageKey); return s ? new Set(JSON.parse(s)) : new Set(); }
    catch { return new Set(); }
  });

  useEffect(() => {
    setTargetVol(recipe.defaultVolume);
    setShowDetailed(false);
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

  // Find related protocol names (memoized — RECIPES lookup is O(n) per id)
  const relatedProtos = useMemo(() =>
    (recipe.relatedProtocols || []).map(pid => RECIPE_BY_ID[pid]).filter(Boolean),
    [recipe.id]
  );

  return (
    <div className="card p-7 fade-in">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-xl font-bold">{recipe.name}</h2>
          {lang === 'zh' && <p className="text-sm" style={S_MUTED}>{recipe.nameCn}</p>}
          {!recipe._isCustom && <span className="inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{background:'var(--bg-2)', color:'var(--text-muted)', border:'1px solid var(--border)'}}>{t('systemBadge', lang)}</span>}
        </div>
        {recipe._isCustom && onEditCustom && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => onEditCustom(recipe)} className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{background:'var(--primary-light)', color:'var(--primary)', border:'1px solid var(--border)'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S_INLINE_ICON}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
              {t('editCustom', lang)}
            </button>
            <button onClick={() => { if (window.confirm(t('deleteConfirm', lang))) onDeleteCustom(recipe); }}
              className="px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{background:'var(--bg-2)', color:'var(--text-muted)', border:'1px solid var(--border)'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={S_INLINE_ICON}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/></svg>
              {t('deleteCustom', lang)}
            </button>
          </div>
        )}
      </div>

      {/* Usage description */}
      {recipe.usage && (
        <div className="mb-5 p-4 rounded-lg text-sm detail-text" style={{background:'var(--bg-2)', color:'var(--text)', borderLeft:'3px solid var(--primary)'}}>
          {recipe.usage[lang] || recipe.usage.zh}
        </div>
      )}

      {/* Related protocols */}
      {relatedProtos.length > 0 && (
        <div className="mb-5 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold" style={S_MUTED}>
            {lang === 'en' ? 'Used in:' : '相关实验:'}
          </span>
          {relatedProtos.map(p => (
            <button key={p.id} onClick={() => onCrossNavigate ? onCrossNavigate(p) : null}
              className="text-xs px-2 py-1 rounded-full font-medium transition-all hover:opacity-80"
              style={{background:'hsla(168,55%,26%,0.1)', color:'var(--primary)', border:'1px solid hsla(168,55%,26%,0.2)', cursor: onCrossNavigate ? 'pointer' : 'default'}}>
              {p.name} →
            </button>
          ))}
        </div>
      )}

      {/* pH and Storage/Duration as plain text */}
      {(recipe.ph || recipe.storage) && (
        <div className="mb-5 text-sm" style={S_MUTED}>
          {recipe.ph && <p>pH {recipe.ph}</p>}
          {recipe.storage && (() => {
            const { storage } = recipe;
            // Two recipe shapes exist: protocols carry `storage.label.{en,zh}`,
            // buffers carry `{temperature, duration, sterile, notes}`.
            let cleanLabel;
            if (storage.label) {
              const rawLabel = storage.label[lang] || storage.label.zh || storage.label.en;
              cleanLabel = (rawLabel || '').replace(/^(Protocol|实验方案)\s*[—–-]\s*/i, '');
            } else {
              cleanLabel = [storage.temperature || storage.temp, storage.duration]
                .filter(Boolean)
                .join(', ');
            }
            if (!cleanLabel) return null;
            const fieldLabel = isProtocol ? t('durationLabel', lang) : t('storageLabel', lang);
            return <p>{fieldLabel}: {cleanLabel}</p>;
          })()}
        </div>
      )}

      {!isProtocol && recipe.id !== 'sds_page_gel' && (
        <div className="flex items-center gap-3 mb-5 p-4 rounded-lg" style={{background:'var(--primary-light)'}}>
          <label className="text-sm font-medium whitespace-nowrap">{t('targetVolume', lang)}:</label>
          <input id="target-volume" type="number" value={targetVol} min={1}
            onChange={e => setTargetVol(Math.max(1, +e.target.value))}
            className="w-28" />
          <span className="text-sm mono">{recipe.unit}</span>
          {scale !== 1 && <span className="text-xs px-2 py-1 rounded-full font-semibold" style={{background:'var(--accent-light)', color:'var(--accent)'}}>×{scale.toFixed(2)}</span>}
        </div>
      )}

      {/* Inline SDS-PAGE Gel Calculator for sds_page_gel recipe */}
      {recipe.id === 'sds_page_gel' && <GelTab />}

      {/* Materials section (for protocols with linked recipes) */}
      {recipe.materials && recipe.materials.length > 0 && (
        <div className="mb-5">
          <h4 className="text-sm font-bold mb-2" style={S_TEXT}>
            {lang === 'en' ? 'Materials' : '所需材料'}
          </h4>
          <div className="space-y-1">
            {recipe.materials.map((m, i) => {
              const linked = m.linkedRecipe ? RECIPE_BY_ID[m.linkedRecipe] : null;
              return (
                <div key={i} className="flex items-center gap-2 text-sm py-1 px-2 rounded" style={{background: i % 2 === 0 ? 'transparent' : 'var(--bg-2)'}}>
                  <span className="flex-1 font-medium">
                    {linked ? (
                      <button onClick={() => {
                        const sameTab = (recipe.category === 'protocol' && linked.category === 'protocol') || (recipe.category !== 'protocol' && linked.category !== 'protocol');
                        if (sameTab && onNavigateRecipe) onNavigateRecipe(linked);
                        else if (onCrossNavigate) onCrossNavigate(linked);
                      }} className="font-medium hover:underline inline-flex items-center gap-1"
                        style={{color:'var(--primary)', background:'none', border:'none', cursor:'pointer', padding:0, font:'inherit'}}>
                        {m.name} ↗
                      </button>
                    ) : m.name}
                  </span>
                  {(m.note) && (
                    <span className="text-xs" style={S_MUTED}>
                      {safeText(m.note, lang)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Brief / Detailed step toggle for protocols */}
      {hasStepToggle && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm font-bold" style={S_TEXT}>
              {lang === 'en' ? 'Steps' : '实验步骤'}
            </h4>
            <div className="flex rounded-lg overflow-hidden border ml-auto" style={S_BORDER}>
              <button onClick={() => setShowDetailed(false)}
                className="px-3 py-1 text-xs font-semibold transition-colors"
                style={{background: !showDetailed ? 'var(--primary)' : 'var(--card)', color: !showDetailed ? 'white' : 'var(--text-muted)'}}>
                {lang === 'en' ? 'Brief' : '简要'}
              </button>
              <button onClick={() => setShowDetailed(true)}
                className="px-3 py-1 text-xs font-semibold transition-colors"
                style={{background: showDetailed ? 'var(--primary)' : 'var(--card)', color: showDetailed ? 'white' : 'var(--text-muted)'}}>
                {lang === 'en' ? 'Detailed' : '详细'}
              </button>
            </div>
          </div>

          {!showDetailed ? (
            <div className="p-4 rounded-lg text-sm detail-text" style={{background:'var(--bg-2)', borderLeft:'3px solid var(--primary)'}}>
              {recipe.briefSteps.map((s, i) => (
                <p key={i} className="leading-relaxed">{s[lang] || s.zh}</p>
              ))}
            </div>
          ) : (
            <div>
              {/* Step progress bar */}
              {(() => {
                const actionSteps = recipe.detailedSteps.filter(s => !s.isHeader);
                const totalSteps = actionSteps.length;
                const doneCount = [...completedSteps].filter(idx => !recipe.detailedSteps[idx]?.isHeader).length;
                return totalSteps > 0 ? (
                  <div className="mb-3 p-2 rounded-lg flex items-center gap-3" style={S_BG2}>
                    <span className="text-xs font-semibold whitespace-nowrap" style={S_MUTED}>
                      {t('stepProgress', lang)}: {doneCount} {lang === 'zh' ? '/' : t('stepOf', lang) + ' '}{totalSteps} {t('stepComplete', lang)}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{background:'var(--border)'}}>
                      <div className="h-full rounded-full transition-all" style={{width:`${(doneCount/totalSteps)*100}%`, background:'var(--primary)'}} />
                    </div>
                    {doneCount > 0 && (
                      <button onClick={resetSteps} className="text-xs px-2 py-0.5 rounded font-medium" style={{color:'var(--text-muted)', background:'var(--card)', border:'1px solid var(--border)'}}>
                        {t('stepReset', lang)}
                      </button>
                    )}
                  </div>
                ) : null;
              })()}
              <div className="protocol-timeline">
                {recipe.detailedSteps.map((step, i) => {
                  const text = step[lang] || step.zh;
                  const isH = step.isHeader;
                  const isDone = completedSteps.has(i);
                  const timeMatches = !isH ? parseTimePatternsFromText(text) : [];
                  // Check for safe stop after this step
                  const safeStop = (recipe.safeStops || []).find(ss => ss.afterStep === i);
                  return (
                    <React.Fragment key={i}>
                      <div className={`protocol-step ${isH ? 'font-bold' : ''}`}
                        style={{
                          ...(isH ? {borderLeft:'3px solid var(--accent)', marginTop: i > 0 ? '0.75rem' : '0', paddingLeft:'0.5rem', background:'var(--bg-2)', borderRadius:'4px', marginLeft:'-0.5rem', paddingTop:'0.25rem', paddingBottom:'0.25rem'} : {}),
                          display:'flex', alignItems:'flex-start', gap:'0.5rem',
                          ...(isDone && !isH ? {opacity: 0.6} : {})
                        }}>
                        {!isH && (
                          <button onClick={() => toggleStep(i)} className="flex-shrink-0 mt-0.5"
                            style={{width:'16px', height:'16px', borderRadius:'50%', border: isDone ? 'none' : '2px solid var(--border)', background: isDone ? 'var(--primary)' : 'transparent', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0}}>
                            {isDone && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                          </button>
                        )}
                        <BoldText text={text} style={{color:'var(--text)', flex:1, ...(isDone && !isH ? {textDecoration:'line-through', textDecorationColor:'var(--text-muted)'} : {})}} />
                        {timeMatches.length > 0 && (
                          <span className="flex gap-1 flex-shrink-0 flex-wrap" style={{marginTop:'1px'}}>
                            {timeMatches.slice(0, 2).map((tm, ti) => (
                              <button key={ti} onClick={() => addTimer(recipe.name + ' - ' + tm.label, tm.seconds)}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold transition-colors hover:opacity-80"
                                style={{background:'var(--primary-light)', color:'var(--primary)', border:'1px solid var(--border)', cursor:'pointer', lineHeight:1.2, whiteSpace:'nowrap'}}>
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="10" y1="2" x2="14" y2="2"/></svg>
                                {tm.label}
                              </button>
                            ))}
                          </span>
                        )}
                      </div>
                      {safeStop && (
                        <div className="my-1.5 p-2 rounded-lg text-xs flex items-start gap-2" style={{background:'hsla(45, 90%, 55%, 0.1)', borderLeft:'3px solid hsl(45, 90%, 45%)', marginLeft:'1.5rem'}}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="hsl(45, 90%, 45%)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>
                          <div>
                            <span className="font-bold" style={{color:'hsl(45, 75%, 35%)'}}>{t('safeStop', lang)}</span>
                            <span style={{color:'var(--text-muted)', marginLeft:'0.5rem'}}>{safeStop.note[lang] || safeStop.note.en}</span>
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Components: legacy timeline for old protocols, table for buffers. Hide for protocols with detailed steps. Hide for SDS gel (calculator replaces it). */}
      {recipe.id === 'sds_page_gel' ? null : isProtocol && hasStepToggle ? null : isProtocol ? (
        /* Legacy protocol timeline view */
        <div className="protocol-timeline">
          {recipe.components.map((c,i) => {
            const isSubStep = c.name.startsWith('  ');
            const scaled = c.amount * scale;
            return (
              <div key={i} className={`protocol-step ${isSubStep ? 'sub-step' : ''}`}>
                <span style={S_TEXT}>{c.name.trim()}</span>
                {c.unit !== 'step' && (
                  <span className="step-amount ml-2">
                    {scaled < 0.01 ? scaled.toExponential(2) : scaled < 1 ? scaled.toFixed(3) : scaled < 100 ? scaled.toFixed(2) : scaled.toFixed(1)} {c.unit}
                  </span>
                )}
                {c.note && <span className="step-note">{safeText(c.note, lang)}</span>}
              </div>
            );
          })}
        </div>
      ) : (
        /* Buffer/reagent table view */
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b-2" style={S_BORDER}>
              <th className="text-left py-2.5 pr-3 font-semibold">{t('reagent', lang)}</th>
              <th className="text-right py-2.5 px-2 font-semibold">{t('amount', lang)}</th>
              <th className="text-right py-2.5 px-2 font-semibold">{t('unit', lang)}</th>
              {recipe.components.some(c => c.note) && <th className="text-left py-2.5 pl-4 font-semibold">{t('notes', lang)}</th>}
            </tr>
          </thead>
          <tbody>
            {recipe.components.map((c,i) => {
              const scaled = c.amount * scale;
              return (
                <tr key={i} className="border-b" style={S_BORDER}>
                  <td className="py-2.5 pr-3 font-medium">
                    {c.linkedRecipe && RECIPE_BY_ID[c.linkedRecipe] && onNavigateRecipe ? (
                      <button onClick={() => onNavigateRecipe(RECIPE_BY_ID[c.linkedRecipe])} className="font-medium hover:underline inline-flex items-center gap-1"
                        style={{color:'var(--primary)', background:'none', border:'none', cursor:'pointer', padding:0, font:'inherit'}}>
                        {c.name}
                      </button>
                    ) : c.name}
                  </td>
                  <td className="py-2.5 px-2 text-right mono font-semibold" style={S_PRIMARY}>
                    {scaled < 0.01 ? scaled.toExponential(2) : scaled < 1 ? scaled.toFixed(3) : scaled < 100 ? scaled.toFixed(2) : scaled.toFixed(1)}
                  </td>
                  <td className="py-2.5 px-2 text-right mono" style={S_MUTED}>{c.unit}</td>
                  {recipe.components.some(comp => comp.note) && <td className="py-2.5 pl-4 text-xs" style={S_MUTED}>{safeText(c.note, lang)}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Preparation steps */}
      {recipe.prepSteps && recipe.prepSteps.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-bold mb-2" style={S_TEXT}>
            {lang === 'en' ? 'Preparation Steps' : '配制步骤'}
          </h4>
          <div className="protocol-timeline">
            {recipe.prepSteps.map((step, i) => (
              <div key={i} className="protocol-step">
                <span style={S_TEXT}>{renderDynamicStep(step[lang] || step.zh, scale)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(NOTES_EN[recipe.id] || recipe.notes) && (
        <div className="mt-6 p-4 rounded-lg bg-amber-50 border border-amber-200 detail-text">
          <p className="text-xs text-amber-800"><strong>{t('tip', lang)}:</strong> {lang === 'en' && NOTES_EN[recipe.id] ? NOTES_EN[recipe.id] : getRecipeNotes(recipe, lang)}</p>
        </div>
      )}
      {recipe.ref && <div className="mt-3 text-[11px] italic" style={S_MUTED}>
        Ref: {recipe.ref}
      </div>}
      <div className="mt-6 pt-4 border-t flex gap-2" style={S_BORDER}>
        <DownloadBtn small label={t('downloadTxt', lang)}
          onClick={() => { downloadFile(recipe.id + '.txt', recipeToText(recipe, targetVol, lang)); toast.show(t('downloaded', lang)); }} />
        <DownloadBtn small label={t('copyClipboard', lang)}
          onClick={() => { navigator.clipboard.writeText(recipeToText(recipe, targetVol, lang)); toast.show(t('copied', lang)); }} />
      </div>
    </div>
  );
}

export default RecipeDetail;
