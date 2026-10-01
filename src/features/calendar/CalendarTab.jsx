import { Fragment, useState, useMemo, useEffect, useCallback, useId } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { useToast } from '../../components/Toast.jsx';
import PageHeader from '../../components/PageHeader.jsx';
import { useIsMobile } from '../../hooks/useMediaQuery.js';
import { useExperiments, createEmptyExperiment } from '../../lib/experiments.js';
import { useRecipes } from '../../lib/RecipeProvider.jsx';
import ProtocolSelector from '../notebook/ProtocolSelector.jsx';
import Dialog from '../../components/Dialog.jsx';
import { toProcedureSteps, toReagents, recipeTitle } from '../../lib/protocolImport.js';
import { icsEntries, buildICS } from '../../lib/ics.js';
import {
  IconPlus, IconDownload, IconClipboard, IconChevronLeft, IconChevronRight, IconNotebook, IconTrash, IconCheck, IconCalendar,
} from '../../components/icons.jsx';

// Status → label key + tone (same visual language as the Notebook tab).
const STATUSES = [
  { id: 'planned', key: 'nbStatusPlanned', fg: 'var(--base-c)', bg: 'var(--cat-media-bg)' },
  { id: 'in-progress', key: 'nbStatusInProgress', fg: 'var(--warning-text)', bg: 'var(--warning-bg)' },
  { id: 'completed', key: 'nbStatusCompleted', fg: 'var(--accent)', bg: 'var(--primary-light)' },
  { id: 'cancelled', key: 'nbStatusCancelled', fg: 'var(--text-muted)', bg: 'var(--bg-2)' },
];
const STATUS_BY_ID = Object.fromEntries(STATUSES.map(s => [s.id, s]));

// Optional label colour. createEmptyExperiment() stamps DEFAULT_COLOR on every new
// record, so that value means "none chosen": chips are coloured by status and a
// chosen label colour shows as a small swatch.
const DEFAULT_COLOR = '#1D9E75';
const LABEL_COLORS = [
  { value: '#16B364', en: 'Green', zh: '绿色' },
  { value: '#6366f1', en: 'Indigo', zh: '靛蓝' },
  { value: '#f59e0b', en: 'Amber', zh: '琥珀' },
  { value: '#ef4444', en: 'Red', zh: '红色' },
  { value: '#ec4899', en: 'Pink', zh: '粉色' },
  { value: '#8b5cf6', en: 'Violet', zh: '紫色' },
  { value: '#06b6d4', en: 'Cyan', zh: '青色' },
];
const hasLabelColor = (c) => !!c && String(c).toLowerCase() !== DEFAULT_COLOR.toLowerCase();

const MONTH_KEYS = ['calJan', 'calFeb', 'calMar', 'calApr', 'calMay', 'calJun', 'calJul', 'calAug', 'calSep', 'calOct', 'calNov', 'calDec'];
const DAY_KEYS = ['calSun', 'calMon', 'calTue', 'calWed', 'calThu', 'calFri', 'calSat'];
const MAX_CHIPS = 3; // per month cell; with more, show MAX_CHIPS - 1 and "+n more"

// Cross-tab hand-off (see NotebookTab): the Notebook's "View in calendar" leaves
// { id, date } here; our "Open in Notebook" leaves { id } for the Notebook.
const NOTEBOOK_FOCUS_KEY = 'labmate_notebook_focus';
const CALENDAR_FOCUS_KEY = 'labmate_calendar_focus';
function peekHandoff(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    const value = raw ? JSON.parse(raw) : null;
    return value && Date.now() - (value.at || 0) < 60000 ? value : null;
  } catch { return null; }
}
function clearHandoff(key) {
  try { window.sessionStorage.removeItem(key); } catch { /* storage off */ }
}
function giveHandoff(key, value) {
  try { window.sessionStorage.setItem(key, JSON.stringify({ ...value, at: Date.now() })); } catch { /* storage off */ }
}

const pad2 = (n) => String(n).padStart(2, '0');
// Local calendar date string. (toISOString() is UTC, which put events and
// "today" on the wrong day east/west of Greenwich.)
const ymd = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const isDateStr = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
// Parse a 'YYYY-MM-DD' string into a local Date (avoids UTC-parse day-shift bugs).
function dateStrToLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function addMinutes(time, minutes) {
  const [h, m] = (time || '').split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return '';
  const total = h * 60 + m + (Number(minutes) || 0);
  return `${pad2(Math.floor(total / 60) % 24)}:${pad2(total % 60)}`;
}
const timeRange = (e) => (e.startTime ? `${e.startTime}–${addMinutes(e.startTime, e.duration)}` : '--:--');
const hourOf = (e) => parseInt((e.startTime || '09:00').split(':')[0], 10) || 0;
const displayTitle = (e, lang) => (lang === 'zh' ? (e.titleZh || e.title) : (e.title || e.titleZh)) || '';

const isNarrow = () => typeof window !== 'undefined' && window.innerWidth < 768;

function StatusBadge({ status, lang }) {
  const s = STATUS_BY_ID[status] || STATUS_BY_ID.planned;
  return <span className="badge" style={{ '--badge-fg': s.fg, '--badge-bg': s.bg }}>{t(s.key, lang)}</span>;
}

// Day number: plain, today (green square) or selected (ink square).
function dayNumStyle({ today, selected, inMonth = true, size = '1.375rem' }) {
  const base = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: size, height: size,
    padding: '0 0.3rem', fontSize: '0.75rem', fontWeight: 600, lineHeight: 1, border: '1px solid transparent',
    fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  };
  if (selected) return { ...base, background: 'var(--text)', color: 'var(--bg)', borderColor: 'var(--text)', fontWeight: 700 };
  if (today) return { ...base, background: 'var(--primary)', color: 'var(--on-primary)', borderColor: 'var(--border-strong)', fontWeight: 700 };
  // Days outside the month: muted colour + lighter weight (no opacity — it drops below AA contrast).
  return { ...base, color: inMonth ? 'var(--text)' : 'var(--text-muted)', fontWeight: inMonth ? 600 : 400 };
}

function CalendarTab({ onNavigateNotebook }) {
  const lang = useLang();
  const zh = lang === 'zh';
  const toast = useToast();
  const uid = useId();
  const isMobile = useIsMobile();
  const { entries, save, remove, reload } = useExperiments();
  const { recipeById: RECIPE_BY_ID } = useRecipes();

  // Arriving from the Notebook's "View in calendar": open on that entry's date.
  const [focus] = useState(() => {
    const f = peekHandoff(CALENDAR_FOCUS_KEY);
    return f && isDateStr(f.date) ? f : null;
  });
  useEffect(() => { clearHandoff(CALENDAR_FOCUS_KEY); }, []);

  const [viewMode, setViewMode] = useState(() => (isNarrow() ? (focus ? 'month' : 'agenda') : 'month'));
  const [currentDate, setCurrentDate] = useState(() => (focus ? dateStrToLocalDate(focus.date) : new Date()));
  const [highlightId, setHighlightId] = useState(() => focus?.id || null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showProtocolImport, setShowProtocolImport] = useState(false);
  const [showIcsExport, setShowIcsExport] = useState(false);
  const [icsRange, setIcsRange] = useState(() => ({ from: ymd(new Date()), to: '' }));
  // Mobile-only: which day (if any) the compact month picker has selected, to filter the agenda list.
  const [mobileDayFilter, setMobileDayFilter] = useState(() => (isNarrow() && focus ? focus.date : null));

  // Refresh when the agent schedules timepoints (its writes go straight to Dexie via
  // a separate useExperiments instance; AgentContext emits this window event).
  useEffect(() => {
    const onChange = () => reload();
    window.addEventListener('labmate:experiments-changed', onChange);
    return () => window.removeEventListener('labmate:experiments-changed', onChange);
  }, [reload]);

  // Reconcile viewMode when crossing the mobile/desktop breakpoint at runtime (resize/rotate):
  // mobile has no 'week' view, desktop has no 'agenda' view.
  useEffect(() => {
    if (isMobile && viewMode === 'week') { setViewMode('agenda'); setMobileDayFilter(null); }
    if (!isMobile && viewMode === 'agenda') { setViewMode('month'); }
  }, [isMobile, viewMode]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const todayStr = ymd(new Date());

  const monthShort = (d) => (zh ? `${d.getMonth() + 1}月` : t(MONTH_KEYS[d.getMonth()], 'en').slice(0, 3));
  const longDate = (d) => (zh
    ? `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${t(DAY_KEYS[d.getDay()], 'zh')}`
    : `${t(DAY_KEYS[d.getDay()], 'en')}, ${t(MONTH_KEYS[d.getMonth()], 'en')} ${d.getDate()}, ${d.getFullYear()}`);
  const shortDate = (d) => (zh
    ? `${d.getMonth() + 1}月${d.getDate()}日 周${t(DAY_KEYS[d.getDay()], 'zh')}`
    : `${t(DAY_KEYS[d.getDay()], 'en')}, ${t(MONTH_KEYS[d.getMonth()], 'en')} ${d.getDate()}`);
  const untitled = zh ? '未命名实验' : 'Untitled experiment';
  const protocolName = (ref) => {
    if (!ref) return '';
    const r = RECIPE_BY_ID[ref];
    if (!r) return ref;
    return zh ? (r.nameCn || r.name) : r.name;
  };

  // ── Navigation ──
  const step = (dir) => {
    setHighlightId(null);
    if (viewMode === 'week') setCurrentDate(d => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7 * dir));
    else setCurrentDate(new Date(year, month + dir, 1));
    if (isMobile) setMobileDayFilter(null);
  };
  const goToday = () => {
    setHighlightId(null);
    setCurrentDate(new Date());
    if (isMobile) setMobileDayFilter(ymd(new Date()));
  };
  const showWeekOf = (d) => { setHighlightId(null); setCurrentDate(d); setViewMode('week'); };

  // Get entries by date map (each day in start-time order)
  const entriesByDate = useMemo(() => {
    const map = {};
    entries.forEach(e => {
      if (!e.date) return;
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    Object.values(map).forEach(list => list.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')));
    return map;
  }, [entries]);

  // Upcoming (>= today, non-cancelled) in chronological order.
  const upcomingAll = useMemo(() => entries
    .filter(e => e.date >= todayStr && e.status !== 'cancelled')
    .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.startTime || '').localeCompare(b.startTime || '')), [entries, todayStr]);

  // Mobile agenda: upcoming entries grouped by date.
  const groupedUpcoming = useMemo(() => {
    const groups = [];
    upcomingAll.forEach(e => {
      const g = groups[groups.length - 1];
      if (g && g.date === e.date) g.items.push(e);
      else groups.push({ date: e.date, items: [e] });
    });
    return groups;
  }, [upcomingAll]);

  // Mobile agenda: entries for the day selected in the compact month picker (any status, any date — not just upcoming).
  const dayFilteredEntries = useMemo(() => (mobileDayFilter ? entriesByDate[mobileDayFilter] || [] : []), [entriesByDate, mobileDayFilter]);

  // Month grid: whole weeks, padded with the neighbouring months' days.
  const monthDays = useMemo(() => {
    const first = new Date(year, month, 1);
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const weeks = Math.ceil((first.getDay() + daysInMonth) / 7);
    return Array.from({ length: weeks * 7 }, (_, i) => new Date(year, month, 1 - first.getDay() + i));
  }, [year, month]);

  const weekDays = useMemo(() => {
    const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - currentDate.getDay());
    return Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
  }, [currentDate]);

  // 07:00–19:00, stretched to include any experiment of this week outside that range.
  const weekHours = useMemo(() => {
    let min = 7, max = 19;
    weekDays.forEach(d => (entriesByDate[ymd(d)] || []).forEach(e => { const h = hourOf(e); min = Math.min(min, h); max = Math.max(max, h); }));
    min = Math.max(0, min); max = Math.min(23, max);
    return Array.from({ length: max - min + 1 }, (_, i) => min + i);
  }, [weekDays, entriesByDate]);

  // ── Event form ──
  const openNewEvent = (dateStr, time) => {
    setEditingEvent(createEmptyExperiment(dateStr || (isMobile && mobileDayFilter) || todayStr, time));
    setShowEventForm(true);
  };

  const handleEventClick = (entry) => {
    setEditingEvent(JSON.parse(JSON.stringify(entry)));
    setShowEventForm(true);
  };

  const closeForm = useCallback(() => { setShowEventForm(false); setEditingEvent(null); }, []);
  const isExisting = !!editingEvent && entries.some(e => e.id === editingEvent.id);

  const handleSaveEvent = async () => {
    if (!editingEvent) return;
    await save(editingEvent);
    setShowEventForm(false);
    setEditingEvent(null);
    toast.show(zh ? '实验已保存' : 'Experiment saved');
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent?.id) return;
    if (!window.confirm(t('nbDeleteConfirm', lang))) return;
    await remove(editingEvent.id);
    setShowEventForm(false);
    setEditingEvent(null);
    toast.show(zh ? '已删除' : 'Deleted');
  };

  // Save what's in the form (if anything changed), then show it in the Notebook.
  const openInNotebook = async () => {
    if (!editingEvent) return;
    const stored = entries.find(e => e.id === editingEvent.id);
    if (!stored || JSON.stringify(stored) !== JSON.stringify(editingEvent)) await save(editingEvent);
    giveHandoff(NOTEBOOK_FOCUS_KEY, { id: editingEvent.id });
    setShowEventForm(false);
    setEditingEvent(null);
    onNavigateNotebook?.();
  };

  const handleProtocolImport = (recipe) => {
    const entry = createEmptyExperiment((isMobile && mobileDayFilter) || todayStr);
    entry.protocolRef = recipe.id;
    entry.title = recipeTitle(recipe, lang);
    entry.titleZh = recipe.nameCn || '';
    entry.duration = Number.isFinite(recipe.duration) ? recipe.duration : 60; // minutes
    const steps = toProcedureSteps(recipe, lang);
    if (steps.length) {
      entry.procedure = { mode: 'template', protocolSteps: steps, freeText: '' };
    }
    if (recipe.materials) {
      entry.materials.reagents = toReagents(recipe);
    }
    setEditingEvent(entry);
    setShowProtocolImport(false);
    setShowEventForm(true);
  };

  // .ics export
  const icsCount = useMemo(() => icsEntries(entries, icsRange.from, icsRange.to).length, [entries, icsRange]);

  const generateICS = useCallback(() => {
    const from = icsRange.from;
    const filtered = icsEntries(entries, from, icsRange.to);
    if (filtered.length === 0) { toast.show(lang === 'zh' ? '无匹配实验' : 'No matching experiments'); return; }
    const ics = buildICS(filtered);

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `labmate_calendar_${from}.ics`; a.click();
    URL.revokeObjectURL(url);
    setShowIcsExport(false);
    toast.show(t('calIcsExported', lang));
  }, [entries, icsRange, lang, toast]);

  // ── Pieces ──
  // Event chip: tinted by status with a status bar; optional label-colour swatch.
  const renderChip = (e, twoLine = false) => {
    const s = STATUS_BY_ID[e.status] || STATUS_BY_ID.planned;
    const title = displayTitle(e, lang) || untitled;
    const cancelled = e.status === 'cancelled';
    const swatch = hasLabelColor(e.color) && (
      <span aria-hidden="true" style={{ width: 6, height: 6, flexShrink: 0, background: e.color, outline: '1px solid var(--card)' }} />
    );
    const titleEl = (
      <span className="truncate min-w-0" style={{ fontWeight: 600, color: cancelled ? 'var(--text-muted)' : 'var(--text)', textDecoration: cancelled ? 'line-through' : 'none' }}>
        {title}
      </span>
    );
    return (
      <button key={e.id} type="button" onClick={() => handleEventClick(e)}
        className="pointer-events-auto relative flex w-full min-w-0 text-left hover:ring-1 hover:ring-inset hover:ring-[var(--border-strong)]"
        title={`${e.startTime || ''} ${title} · ${t(s.key, lang)}`}
        style={{
          flexDirection: twoLine ? 'column' : 'row', alignItems: twoLine ? 'stretch' : 'center', gap: twoLine ? '0.1rem' : '0.3rem',
          minHeight: '1.25rem', padding: twoLine ? '0.2rem 0.35rem 0.25rem' : '0 0.35rem', fontSize: '0.6875rem', lineHeight: 1.25,
          background: s.bg, borderLeft: `3px solid ${s.fg}`, outlineOffset: -2,
          boxShadow: e.id === highlightId ? 'inset 0 0 0 2px var(--text)' : undefined,
        }}>
        {twoLine ? (
          <>
            <span className="flex items-center gap-1 min-w-0">{swatch}{titleEl}</span>
            <span className="mono truncate" style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>
              {e.startTime || '--:--'} · {e.duration || 0} min
            </span>
          </>
        ) : (
          <>
            {swatch}
            {e.startTime && <span className="mono flex-none" style={{ fontSize: '0.625rem', color: 'var(--text-muted)' }}>{e.startTime}</span>}
            {titleEl}
          </>
        )}
        <span className="sr-only">, {t(s.key, lang)}</span>
      </button>
    );
  };

  const periodLabel = (() => {
    if (viewMode !== 'week') return { main: t(MONTH_KEYS[month], lang), year };
    const a = weekDays[0], b = weekDays[6];
    const sameMonth = a.getMonth() === b.getMonth();
    const main = zh
      ? `${a.getMonth() + 1}月${a.getDate()}日 – ${sameMonth ? '' : `${b.getMonth() + 1}月`}${b.getDate()}日`
      : `${monthShort(a)} ${a.getDate()} – ${sameMonth ? '' : `${monthShort(b)} `}${b.getDate()}`;
    return { main, year: b.getFullYear() };
  })();

  const periodHeading = (size = '1.25rem') => (
    <h2 className="flex items-baseline gap-2 min-w-0" aria-live="polite" style={{ margin: 0 }}>
      <span style={{ fontFamily: 'var(--font-heading)', fontSize: size, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, whiteSpace: 'nowrap' }}>{periodLabel.main}</span>
      <span className="mono" style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text-muted)' }}>{periodLabel.year}</span>
    </h2>
  );

  const prevLabel = viewMode === 'week' ? (zh ? '上一周' : 'Previous week') : (zh ? '上个月' : 'Previous month');
  const nextLabel = viewMode === 'week' ? (zh ? '下一周' : 'Next week') : (zh ? '下个月' : 'Next month');

  // --- Month View (desktop/tablet) ---
  const renderMonthView = () => (
    <div className="panel overflow-hidden">
      <div className="grid grid-cols-7" style={{ gap: 1, background: 'var(--rule)', borderBottom: '1px solid var(--border-strong)' }}>
        {DAY_KEYS.map(d => (
          <div key={d} className="eyebrow" style={{ background: 'var(--card)', padding: '0.45rem 0.625rem' }}>{t(d, lang)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gap: 1, background: 'var(--rule)' }}>
        {monthDays.map(d => {
          const dateStr = ymd(d);
          const inMonth = d.getMonth() === month;
          const list = entriesByDate[dateStr] || [];
          const visible = list.length > MAX_CHIPS ? list.slice(0, MAX_CHIPS - 1) : list;
          const more = list.length - visible.length;
          return (
            <div key={dateStr} className="relative min-w-0" style={{ minHeight: '6.75rem', background: inMonth ? 'var(--card)' : 'var(--bg)' }}>
              <button type="button" onClick={() => openNewEvent(dateStr)}
                className="absolute inset-0 w-full h-full transition-colors hover:bg-[var(--bg-2)]"
                aria-label={`${t('calNewEvent', lang)} · ${longDate(d)}`} style={{ outlineOffset: -2 }} />
              <div className="relative pointer-events-none flex flex-col gap-[3px] p-1.5">
                <div className="flex items-center" style={{ height: '1.375rem', marginBottom: 2 }}>
                  <span className="mono" style={dayNumStyle({ today: dateStr === todayStr, inMonth })}>
                    {d.getDate() === 1 ? (zh ? `${d.getMonth() + 1}月1日` : `${monthShort(d)} 1`) : d.getDate()}
                  </span>
                </div>
                {visible.map(e => renderChip(e))}
                {more > 0 && (
                  <button type="button" onClick={() => showWeekOf(d)}
                    className="pointer-events-auto self-start mono hover:underline"
                    style={{ fontSize: '0.625rem', fontWeight: 700, color: 'var(--text-muted)', padding: '0.05rem 0.35rem', outlineOffset: -2 }}>
                    {zh ? `还有 ${more} 项` : `+${more} more`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // --- Week View (desktop/tablet): same hairline grid, one row per hour ---
  const renderWeekView = () => {
    const cols = { gridTemplateColumns: '3.5rem repeat(7, minmax(0, 1fr))', gap: 1, background: 'var(--rule)' };
    return (
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <div style={{ minWidth: 640 }}>
            <div className="grid" style={{ ...cols, borderBottom: '1px solid var(--border-strong)' }}>
              <div style={{ background: 'var(--card)' }} />
              {weekDays.map(d => (
                <div key={ymd(d)} className="flex items-center gap-1.5 min-w-0" style={{ background: 'var(--card)', padding: '0.4rem 0.5rem' }}>
                  <span className="eyebrow">{t(DAY_KEYS[d.getDay()], lang)}</span>
                  <span className="mono" style={dayNumStyle({ today: ymd(d) === todayStr })}>{d.getDate()}</span>
                </div>
              ))}
            </div>
            <div className="grid" style={cols}>
              {weekHours.map(h => (
                <Fragment key={h}>
                  <div className="mono" style={{ background: 'var(--card)', fontSize: '0.6875rem', color: 'var(--text-muted)', padding: '0.3rem 0.5rem 0 0', textAlign: 'right' }}>
                    {pad2(h)}:00
                  </div>
                  {weekDays.map(d => {
                    const dateStr = ymd(d);
                    const list = (entriesByDate[dateStr] || []).filter(e => hourOf(e) === h);
                    return (
                      <div key={dateStr + h} className="relative min-w-0" style={{ minHeight: '2.75rem', background: 'var(--card)' }}>
                        {/* Mouse shortcut only (tabIndex -1): keyboard users have "New Experiment". */}
                        <button type="button" tabIndex={-1} onClick={() => openNewEvent(dateStr, `${pad2(h)}:00`)}
                          className="absolute inset-0 w-full h-full transition-colors hover:bg-[var(--bg-2)]"
                          aria-label={`${t('calNewEvent', lang)} · ${longDate(d)} ${pad2(h)}:00`} />
                        <div className="relative pointer-events-none flex flex-col gap-[3px] p-1">
                          {list.map(e => renderChip(e, true))}
                        </div>
                      </div>
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const legend = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2.5">
      <span className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
        {viewMode === 'week'
          ? (zh ? '点击时间格即可在该时间新建实验' : 'Click an hour slot to schedule an experiment at that time')
          : (zh ? '点击任意一天即可新建实验' : 'Click a day to schedule an experiment')}
      </span>
      <span className="flex-1" />
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1" aria-hidden="true">
        {STATUSES.map(s => (
          <span key={s.id} className="inline-flex items-center gap-1.5 mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            <span style={{ width: 11, height: 11, background: s.bg, borderLeft: `3px solid ${s.fg}` }} />
            {t(s.key, lang)}
          </span>
        ))}
      </span>
    </div>
  );

  // Row with a date block (desktop "Upcoming" column).
  const renderDatedRow = (e) => {
    const s = STATUS_BY_ID[e.status] || STATUS_BY_ID.planned;
    const d = dateStrToLocalDate(e.date);
    const isToday = e.date === todayStr;
    const proto = protocolName(e.protocolRef);
    return (
      <button key={e.id} type="button" className="list-row" onClick={() => handleEventClick(e)}
        style={{ alignItems: 'flex-start', gap: '0.75rem', boxShadow: `inset 3px 0 0 ${s.fg}` }}>
        <span className="flex flex-col items-center flex-none" style={{ width: '2.25rem' }}>
          <span className="mono" style={{ fontSize: '0.5625rem', fontWeight: 700, letterSpacing: zh ? 0 : '0.08em', textTransform: 'uppercase', color: isToday ? 'var(--accent)' : 'var(--text-muted)' }}>
            {isToday ? t('calToday', lang) : (zh ? `周${t(DAY_KEYS[d.getDay()], 'zh')}` : t(DAY_KEYS[d.getDay()], 'en'))}
          </span>
          <span className="mono tabular" style={{ fontSize: '1.125rem', fontWeight: 700, lineHeight: 1.15 }}>{d.getDate()}</span>
        </span>
        <span className="flex-1 min-w-0">
          <span className="list-row-title block truncate">{displayTitle(e, lang) || untitled}</span>
          <span className="list-row-meta" style={{ flexWrap: 'nowrap', gap: '0.375rem' }}>
            <span className="flex-none">{timeRange(e)}</span>
            {proto && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate min-w-0">{proto}</span>
              </>
            )}
          </span>
        </span>
        <span className="sr-only">, {t(s.key, lang)}</span>
      </button>
    );
  };

  // Row with a time column (mobile agenda / selected day).
  const renderAgendaRow = (e) => {
    const s = STATUS_BY_ID[e.status] || STATUS_BY_ID.planned;
    const cancelled = e.status === 'cancelled';
    const proto = protocolName(e.protocolRef);
    return (
      <button key={e.id} type="button" className="list-row" onClick={() => handleEventClick(e)}
        style={{ gap: '0.75rem', boxShadow: `inset 3px 0 0 ${s.fg}`, ...(e.id === highlightId ? { background: 'var(--bg-2)' } : null) }}>
        <span className="mono tabular flex-none" style={{ width: '2.75rem', fontSize: '0.8125rem', fontWeight: 700 }}>{e.startTime || '--:--'}</span>
        <span className="flex-1 min-w-0">
          <span className="list-row-title block truncate" style={cancelled ? { color: 'var(--text-muted)', textDecoration: 'line-through' } : undefined}>
            {displayTitle(e, lang) || untitled}
          </span>
          <span className="list-row-meta" style={{ flexWrap: 'nowrap', gap: '0.375rem' }}>
            <span className="flex-none">{e.duration || 0} min</span>
            {proto && (
              <>
                <span aria-hidden="true">·</span>
                <span className="truncate min-w-0">{proto}</span>
              </>
            )}
          </span>
        </span>
        <StatusBadge status={e.status} lang={lang} />
      </button>
    );
  };

  const upcoming = upcomingAll.slice(0, 8);
  const upcomingPanel = (
    <section className="panel min-w-0" aria-labelledby={`${uid}-upcoming`}>
      <div className="panel-head">
        <h2 id={`${uid}-upcoming`} className="panel-title">{zh ? '即将进行' : 'Upcoming'}</h2>
        {upcomingAll.length > 0 && (
          <span className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
            {upcomingAll.length > upcoming.length ? `${upcoming.length} / ${upcomingAll.length}` : upcomingAll.length}
          </span>
        )}
      </div>
      {upcoming.length > 0 ? (
        <div className="list">
          {upcoming.map((e, i) => {
            const ym = e.date.slice(0, 7);
            const newMonth = ym !== (i ? upcoming[i - 1].date.slice(0, 7) : todayStr.slice(0, 7));
            const d = dateStrToLocalDate(e.date);
            return (
              <Fragment key={e.id}>
                {newMonth && (
                  <div className="eyebrow px-3.5 py-1" style={{ background: 'var(--bg-2)', borderBottom: '1px solid var(--rule)' }}>
                    {zh ? `${d.getFullYear()}年${d.getMonth() + 1}月` : `${t(MONTH_KEYS[d.getMonth()], 'en')} ${d.getFullYear()}`}
                  </div>
                )}
                {renderDatedRow(e)}
              </Fragment>
            );
          })}
        </div>
      ) : (
        <div className="empty" style={{ padding: '2rem 1.25rem' }}>
          <div className="empty-icon"><IconCalendar size={20} /></div>
          <div className="empty-title">{t('calNoEvents', lang)}</div>
          <div className="empty-desc">{zh ? '点击日历中的任意一天来安排实验。' : 'Click any day in the calendar to schedule an experiment.'}</div>
        </div>
      )}
    </section>
  );

  // --- Mobile compact month picker (day number + status dots) ---
  const renderMobileMonthView = () => (
    <div className="panel overflow-hidden">
      <div className="panel-head" style={{ padding: '0.375rem 0.375rem', minHeight: 0 }}>
        <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => step(-1)} aria-label={prevLabel}><IconChevronLeft size={18} /></button>
        {periodHeading('1.0625rem')}
        <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => step(1)} aria-label={nextLabel}><IconChevronRight size={18} /></button>
      </div>
      <div className="grid grid-cols-7" style={{ gap: 1, background: 'var(--rule)', borderTop: '1px solid var(--rule)', borderBottom: '1px solid var(--border-strong)' }}>
        {DAY_KEYS.map(d => (
          <div key={d} className="eyebrow text-center" style={{ background: 'var(--card)', padding: '0.3rem 0', fontSize: '0.625rem' }}>{t(d, lang)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7" style={{ gap: 1, background: 'var(--rule)' }}>
        {monthDays.map(d => {
          const dateStr = ymd(d);
          const inMonth = d.getMonth() === month;
          const list = entriesByDate[dateStr] || [];
          const isSelected = dateStr === mobileDayFilter;
          return (
            <button key={dateStr} type="button" onClick={() => setMobileDayFilter(prev => (prev === dateStr ? null : dateStr))}
              aria-pressed={isSelected}
              aria-label={`${longDate(d)}${list.length ? ` · ${zh ? `${list.length} 个实验` : `${list.length} experiment${list.length === 1 ? '' : 's'}`}` : ''}`}
              className="flex flex-col items-center gap-1 min-w-0"
              style={{ minHeight: '3rem', padding: '0.35rem 0 0.3rem', background: inMonth ? 'var(--card)' : 'var(--bg)', outlineOffset: -2 }}>
              <span className="mono" style={{ ...dayNumStyle({ today: dateStr === todayStr, selected: isSelected, inMonth, size: '1.625rem' }), fontSize: '0.8125rem' }}>
                {d.getDate()}
              </span>
              <span className="flex items-center gap-[2px]" style={{ height: 5 }} aria-hidden="true">
                {list.slice(0, 3).map(e => (
                  <span key={e.id} style={{ width: 5, height: 5, background: (STATUS_BY_ID[e.status] || STATUS_BY_ID.planned).fg }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  // Header label for the day-filtered mobile agenda (e.g. "Mon, Jul 7").
  const mobileFilterLabel = mobileDayFilter ? shortDate(dateStrToLocalDate(mobileDayFilter)) : '';

  // Mobile agenda body: either the day-filtered list (from the month picker) or the full chronological
  // upcoming list grouped by date header + weekday.
  const renderMobileAgendaBody = () => {
    if (mobileDayFilter) {
      if (dayFilteredEntries.length === 0) {
        return (
          <div className="empty" style={{ padding: '2rem 1.25rem' }}>
            <div className="empty-title">{zh ? '这一天没有实验' : 'No experiments this day'}</div>
            <button type="button" className="btn-primary" onClick={() => openNewEvent(mobileDayFilter)}>
              <IconPlus size={15} />{t('calNewEvent', lang)}
            </button>
          </div>
        );
      }
      return <div className="list">{dayFilteredEntries.map(renderAgendaRow)}</div>;
    }
    if (groupedUpcoming.length === 0) {
      return (
        <div className="empty">
          <div className="empty-icon"><IconCalendar size={20} /></div>
          <div className="empty-title">{t('calNoEvents', lang)}</div>
          <div className="empty-desc">{zh ? '安排一个实验，或从方案导入。' : 'Schedule an experiment, or start one from a protocol.'}</div>
          <button type="button" className="btn-primary" onClick={() => openNewEvent()}>
            <IconPlus size={15} />{t('calNewEvent', lang)}
          </button>
        </div>
      );
    }
    return groupedUpcoming.map((g, gi) => {
      const d = dateStrToLocalDate(g.date);
      return (
        <div key={g.date}>
          <div className="eyebrow px-3.5 py-1.5" style={{ background: 'var(--bg-2)', borderTop: gi ? '1px solid var(--rule)' : 0, borderBottom: '1px solid var(--rule)', color: g.date === todayStr ? 'var(--text)' : undefined }}>
            {g.date === todayStr ? `${t('calToday', lang)} · ${shortDate(d)}` : shortDate(d)}
          </div>
          <div className="list">{g.items.map(renderAgendaRow)}</div>
        </div>
      );
    });
  };

  // ── Dialogs ──
  const setField = (field, value) => setEditingEvent(prev => ({ ...prev, [field]: value }));
  const eventFormModal = showEventForm && editingEvent && (
    <Dialog title={isExisting ? t('calEditEvent', lang) : t('calNewEvent', lang)} onClose={closeForm} lang={lang} size="md"
      onSubmit={(ev) => { ev.preventDefault(); handleSaveEvent(); }}
      headActions={(
        <button type="button" className="btn-ghost btn-sm" onClick={openInNotebook}>
          <IconNotebook size={14} />{t('calOpenInNotebook', lang)}
        </button>
      )}
      footer={(
        <>
          {isExisting && (
            <button type="button" className="btn-danger" onClick={handleDeleteEvent}><IconTrash size={14} />{t('calDeleteEvent', lang)}</button>
          )}
          <span className="flex-1" />
          <button type="button" className="btn" onClick={closeForm}>{t('nbCancel', lang)}</button>
          <button type="submit" className="btn-primary"><IconCheck size={14} />{t('nbSave', lang)}</button>
        </>
      )}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-title`}>{t('nbEntryTitle', lang)}</label>
          <input id={`${uid}-title`} type="text" value={editingEvent.title || ''} onChange={e => setField('title', e.target.value)}
            className="w-full" placeholder={zh ? '实验标题' : 'Experiment title'} data-autofocus />
        </div>
        <div>
          <label htmlFor={`${uid}-titlezh`}>{t('nbEntryTitleZh', lang)}</label>
          <input id={`${uid}-titlezh`} type="text" value={editingEvent.titleZh || ''} onChange={e => setField('titleZh', e.target.value)}
            className="w-full" placeholder={zh ? '中文标题' : 'Chinese title'} />
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3">
        <div className="col-span-2 sm:col-span-1">
          <label htmlFor={`${uid}-date`}>{t('nbDate', lang)}</label>
          <input id={`${uid}-date`} type="date" value={editingEvent.date || ''} onChange={e => setField('date', e.target.value)} className="w-full" />
        </div>
        <div>
          <label htmlFor={`${uid}-start`}>{t('nbStartTime', lang)}</label>
          <input id={`${uid}-start`} type="time" value={editingEvent.startTime || ''} onChange={e => setField('startTime', e.target.value)} className="w-full" />
        </div>
        <div>
          <label htmlFor={`${uid}-duration`}>{t('nbDuration', lang)}</label>
          <input id={`${uid}-duration`} type="number" value={editingEvent.duration || ''} onChange={e => setField('duration', parseInt(e.target.value) || 0)} className="w-full" min="0" />
        </div>
      </div>
      <div className="grid gap-3 grid-cols-2">
        <div>
          <label htmlFor={`${uid}-status`}>{t('nbStatus', lang)}</label>
          <select id={`${uid}-status`} value={editingEvent.status || 'planned'} onChange={e => setField('status', e.target.value)} className="w-full">
            {STATUSES.map(s => <option key={s.id} value={s.id}>{t(s.key, lang)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor={`${uid}-priority`}>{t('nbPriority', lang)}</label>
          <select id={`${uid}-priority`} value={editingEvent.priority || 'medium'} onChange={e => setField('priority', e.target.value)} className="w-full">
            <option value="high">{t('nbPriorityHigh', lang)}</option>
            <option value="medium">{t('nbPriorityMedium', lang)}</option>
            <option value="low">{t('nbPriorityLow', lang)}</option>
          </select>
        </div>
      </div>
      <div>
        <span id={`${uid}-color`} className="eyebrow block" style={{ marginBottom: '0.35rem' }}>{t('calColor', lang)}</span>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-labelledby={`${uid}-color`}>
          <button type="button" className="chip" aria-pressed={!hasLabelColor(editingEvent.color)} onClick={() => setField('color', DEFAULT_COLOR)}>
            {zh ? '按状态' : 'By status'}
          </button>
          {LABEL_COLORS.map(c => {
            const on = editingEvent.color === c.value;
            return (
              <button key={c.value} type="button" aria-pressed={on} aria-label={zh ? c.zh : c.en} title={zh ? c.zh : c.en}
                onClick={() => setField('color', c.value)}
                style={{ width: 26, height: 26, background: c.value, border: '1px solid var(--border-strong)', boxShadow: on ? '0 0 0 2px var(--card), 0 0 0 3px var(--text)' : 'none' }} />
            );
          })}
        </div>
        <p style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {zh ? '日历按状态着色；标签颜色显示为一个小色块。' : 'Calendar chips are coloured by status; a label colour adds a small swatch.'}
        </p>
      </div>
      <div>
        <label htmlFor={`${uid}-objectives`}>{t('nbObjectives', lang)}</label>
        <textarea id={`${uid}-objectives`} value={editingEvent.plan?.objectives || ''} onChange={e => setEditingEvent(prev => ({ ...prev, plan: { ...prev.plan, objectives: e.target.value } }))}
          className="w-full" rows={2} placeholder={zh ? '简述实验目的...' : 'Brief objectives...'} />
      </div>
      {editingEvent.protocolRef && (
        <div className="notice notice-info" style={{ alignItems: 'center' }}>
          <IconClipboard size={15} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span><span className="notice-title">{t('nbLinkedProtocol', lang)}:</span> {protocolName(editingEvent.protocolRef)}</span>
        </div>
      )}
    </Dialog>
  );

  const icsExportModal = showIcsExport && (
    <Dialog title={t('calExportIcs', lang)} onClose={() => setShowIcsExport(false)} lang={lang} size="sm"
      footer={(
        <>
          <button type="button" className="btn" onClick={() => setShowIcsExport(false)}>{t('nbCancel', lang)}</button>
          <button type="button" className="btn-primary" onClick={generateICS}><IconDownload size={14} />{t('calExportIcs', lang)}</button>
        </>
      )}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`${uid}-ics-from`}>{t('calIcsFrom', lang)}</label>
          <input id={`${uid}-ics-from`} type="date" value={icsRange.from} onChange={e => setIcsRange(prev => ({ ...prev, from: e.target.value }))} className="w-full" />
        </div>
        <div>
          <label htmlFor={`${uid}-ics-to`}>{t('calIcsTo', lang)}</label>
          <input id={`${uid}-ics-to`} type="date" value={icsRange.to} onChange={e => setIcsRange(prev => ({ ...prev, to: e.target.value }))} className="w-full" />
        </div>
      </div>
      <p className="mono" style={{ fontSize: '0.75rem', color: icsCount ? 'var(--text-muted)' : 'var(--warning-text)' }} aria-live="polite">
        {zh
          ? `范围内共 ${icsCount} 个实验${icsRange.to ? '' : '（不设结束日期）'}`
          : `${icsCount} experiment${icsCount === 1 ? '' : 's'} in range${icsRange.to ? '' : ' (no end date)'}`}
      </p>
    </Dialog>
  );

  // ── Layout ──
  const headerActions = (
    <>
      <button type="button" className="btn" onClick={() => setShowProtocolImport(true)} aria-label={t('calImportProtocol', lang)}>
        <IconClipboard size={15} />
        <span className="sm:hidden">{zh ? '从方案' : 'From protocol'}</span>
        <span className="hidden sm:inline">{t('calImportProtocol', lang)}</span>
      </button>
      <button type="button" className="btn" onClick={() => setShowIcsExport(true)}>
        <IconDownload size={15} />{t('calExportIcs', lang)}
      </button>
      <button type="button" className="btn-primary" onClick={() => openNewEvent()} aria-label={t('calNewEvent', lang)}>
        <IconPlus size={15} />
        <span className="sm:hidden">{zh ? '新建' : 'New'}</span>
        <span className="hidden sm:inline">{t('calNewEvent', lang)}</span>
      </button>
    </>
  );

  const viewSeg = isMobile ? (
    <div className="seg" role="group" aria-label={zh ? '视图' : 'View'}>
      <button type="button" aria-pressed={viewMode === 'agenda'} onClick={() => { setViewMode('agenda'); setMobileDayFilter(null); }}>
        {lang === 'zh' ? '日程' : 'Agenda'}
      </button>
      <button type="button" aria-pressed={viewMode === 'month'} onClick={() => { setViewMode('month'); setMobileDayFilter(null); }}>
        {t('calMonthView', lang)}
      </button>
    </div>
  ) : (
    <div className="seg" role="group" aria-label={zh ? '视图' : 'View'}>
      <button type="button" aria-pressed={viewMode === 'month'} onClick={() => setViewMode('month')}>{t('calMonthView', lang)}</button>
      <button type="button" aria-pressed={viewMode === 'week'} onClick={() => setViewMode('week')}>{t('calWeekView', lang)}</button>
    </div>
  );

  return (
    <div>
      <PageHeader tab="calendar" title={t('calTitle', lang)} description={t('calSubtitle', lang)}
        meta={upcomingAll.length ? (zh ? `${upcomingAll.length} 个即将进行` : `${upcomingAll.length} upcoming`) : null}
        actions={headerActions} />

      {isMobile ? (
        <>
          <div className="toolbar mb-3">
            {viewSeg}
            <span className="toolbar-spacer" />
            {viewMode === 'month' && <button type="button" className="btn btn-sm" onClick={goToday}>{t('calToday', lang)}</button>}
          </div>
          {viewMode === 'month' && renderMobileMonthView()}
          <section className={`panel${viewMode === 'month' ? ' mt-3' : ''}`} aria-labelledby={`${uid}-agenda`}>
            <div className="panel-head">
              <h2 id={`${uid}-agenda`} className="panel-title">{mobileDayFilter ? mobileFilterLabel : (zh ? '即将进行' : 'Upcoming')}</h2>
              {mobileDayFilter ? (
                <span className="flex items-center gap-1">
                  {dayFilteredEntries.length > 0 && (
                    <button type="button" className="btn-ghost btn-icon btn-sm" onClick={() => openNewEvent(mobileDayFilter)} aria-label={t('calNewEvent', lang)}>
                      <IconPlus size={16} />
                    </button>
                  )}
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setMobileDayFilter(null)}>{zh ? '显示全部' : 'Show all'}</button>
                </span>
              ) : upcomingAll.length > 0 && (
                <span className="mono" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)' }}>{upcomingAll.length}</span>
              )}
            </div>
            {renderMobileAgendaBody()}
          </section>
        </>
      ) : (
        <>
          <div className="toolbar mb-3">
            <div className="flex items-center gap-1">
              <button type="button" className="btn btn-icon btn-sm" onClick={() => step(-1)} aria-label={prevLabel}><IconChevronLeft size={16} /></button>
              <button type="button" className="btn btn-icon btn-sm" onClick={() => step(1)} aria-label={nextLabel}><IconChevronRight size={16} /></button>
            </div>
            {periodHeading()}
            <button type="button" className="btn btn-sm" onClick={goToday}>{t('calToday', lang)}</button>
            <span className="toolbar-spacer" />
            {viewSeg}
          </div>
          <div className="grid gap-4 items-start min-[1360px]:grid-cols-[minmax(0,1fr)_300px]">
            <div className="min-w-0">
              {viewMode === 'week' ? renderWeekView() : renderMonthView()}
              {legend}
            </div>
            <div className={entries.length ? 'min-w-0' : 'hidden min-[1360px]:block'}>{upcomingPanel}</div>
          </div>
        </>
      )}

      {eventFormModal}
      {icsExportModal}
      {showProtocolImport && (
        <ProtocolSelector lang={lang} onSelect={handleProtocolImport} onClose={() => setShowProtocolImport(false)} title={t('calImportProtocol', lang)} />
      )}
    </div>
  );
}

export default CalendarTab;
