import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { S_MUTED, S_TEXT } from '../../lib/styleConstants.js';
import { useToast } from '../../components/Toast.jsx';
import { useExperiments, createEmptyExperiment } from '../../lib/experiments.js';
import { useRecipes } from '../../lib/RecipeProvider.jsx';
import ProtocolSelector from '../notebook/ProtocolSelector.jsx';

const S_PILL_PRIMARY = { background: 'var(--primary-light)', color: 'var(--accent)', border: '1px solid var(--border)', borderRadius: '0' };

// Parse a 'YYYY-MM-DD' string into a local Date (avoids UTC-parse day-shift bugs).
function dateStrToLocalDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function CalendarTab({ onNavigateNotebook }) {
  const lang = useLang();
  const toast = useToast();
  const { entries, loading, save, remove, reload } = useExperiments();
  const { recipeById: RECIPE_BY_ID } = useRecipes();
  const [viewMode, setViewMode] = useState(() => (typeof window !== 'undefined' && window.innerWidth < 768) ? 'agenda' : 'month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showEventForm, setShowEventForm] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);
  const [showProtocolImport, setShowProtocolImport] = useState(false);
  const [showIcsExport, setShowIcsExport] = useState(false);
  const [icsRange, setIcsRange] = useState({ from: new Date().toISOString().slice(0, 10), to: '' });

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Mobile-only: which day (if any) the compact month picker has selected, to filter the agenda list.
  const [mobileDayFilter, setMobileDayFilter] = useState(null);
  // Reconcile viewMode when crossing the mobile/desktop breakpoint at runtime (resize/rotate):
  // mobile has no 'week' view, desktop has no 'agenda' view.
  useEffect(() => {
    if (isMobile && viewMode === 'week') { setViewMode('agenda'); setMobileDayFilter(null); }
    if (!isMobile && viewMode === 'agenda') { setViewMode('month'); }
  }, [isMobile, viewMode]);

  const monthNames = ['calJan','calFeb','calMar','calApr','calMay','calJun','calJul','calAug','calSep','calOct','calNov','calDec'];
  const dayNames = ['calSun','calMon','calTue','calWed','calThu','calFri','calSat'];
  const statusColors = { planned: 'var(--base-c)', 'in-progress': 'var(--base-g)', completed: 'var(--base-a)', cancelled: 'var(--base-t)' };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => setCurrentDate(new Date());

  const prevWeek = () => setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() - 7); return n; });
  const nextWeek = () => setCurrentDate(d => { const n = new Date(d); n.setDate(n.getDate() + 7); return n; });

  // Get entries by date map
  const entriesByDate = useMemo(() => {
    const map = {};
    entries.forEach(e => {
      if (!e.date) return;
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [entries]);

  // Mobile agenda: upcoming (>= today, non-cancelled) entries grouped by date, chronological.
  const groupedUpcoming = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const list = entries
      .filter(e => e.date >= todayStr && e.status !== 'cancelled')
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.startTime || '').localeCompare(b.startTime || ''));
    const groups = [];
    list.forEach(e => {
      const g = groups[groups.length - 1];
      if (g && g.date === e.date) g.items.push(e);
      else groups.push({ date: e.date, items: [e] });
    });
    return groups;
  }, [entries]);

  // Mobile agenda: entries for the day selected in the compact month picker (any status, any date — not just upcoming).
  const dayFilteredEntries = useMemo(() => {
    if (!mobileDayFilter) return [];
    return entries.filter(e => e.date === mobileDayFilter).sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''));
  }, [entries, mobileDayFilter]);

  const handleDayClick = (dateStr) => {
    const entry = createEmptyExperiment(dateStr);
    setEditingEvent(entry);
    setShowEventForm(true);
  };

  const handleEventClick = (entry) => {
    setEditingEvent(JSON.parse(JSON.stringify(entry)));
    setShowEventForm(true);
  };

  const handleSaveEvent = async () => {
    if (!editingEvent) return;
    await save(editingEvent);
    setShowEventForm(false);
    setEditingEvent(null);
    toast.show(lang === 'zh' ? '实验已保存' : 'Experiment saved');
  };

  const handleDeleteEvent = async () => {
    if (!editingEvent?.id) return;
    await remove(editingEvent.id);
    setShowEventForm(false);
    setEditingEvent(null);
    toast.show(lang === 'zh' ? '已删除' : 'Deleted');
  };

  const handleProtocolImport = (recipe) => {
    const entry = createEmptyExperiment();
    entry.protocolRef = recipe.id;
    entry.title = lang === 'zh' ? (recipe.nameZh || recipe.name) : recipe.name;
    entry.titleZh = recipe.nameZh || '';
    entry.duration = recipe.duration || 60;
    if (recipe.briefSteps || recipe.detailedSteps) {
      entry.procedure = {
        mode: 'template',
        protocolSteps: (recipe.briefSteps || recipe.detailedSteps || []).map(s => ({
          stepText: typeof s === 'string' ? s : (s.text || s.step || ''),
          completed: false, deviation: '', actualParams: ''
        })),
        freeText: ''
      };
    }
    if (recipe.materials) {
      entry.materials.reagents = recipe.materials.map(m => ({
        name: typeof m === 'string' ? m : (m.name || m.reagent || ''),
        amount: m.amount || '', unit: m.unit || '', location: '', inventoryRef: null
      }));
    }
    setEditingEvent(entry);
    setShowProtocolImport(false);
    setShowEventForm(true);
  };

  // .ics export
  const generateICS = useCallback(() => {
    const from = icsRange.from;
    const to = icsRange.to || '9999-12-31';
    const filtered = entries.filter(e => e.date && e.date >= from && e.date <= to);
    if (filtered.length === 0) { toast.show(lang === 'zh' ? '无匹配实验' : 'No matching experiments', '⚠️'); return; }

    const pad = (n) => String(n).padStart(2, '0');
    const formatDT = (dateStr, timeStr) => {
      const [y, m, d] = dateStr.split('-');
      const [h, min] = (timeStr || '09:00').split(':');
      return `${y}${m}${d}T${pad(h)}${pad(min)}00`;
    };

    let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Bioinfospace LabMate//EN\r\nCALSCALE:GREGORIAN\r\n';
    filtered.forEach(e => {
      const dtStart = formatDT(e.date, e.startTime);
      const dur = e.duration || 60;
      const endH = Math.floor(((parseInt((e.startTime || '09:00').split(':')[0]) * 60) + parseInt((e.startTime || '09:00').split(':')[1]) + dur) / 60);
      const endM = ((parseInt((e.startTime || '09:00').split(':')[0]) * 60) + parseInt((e.startTime || '09:00').split(':')[1]) + dur) % 60;
      const dtEnd = formatDT(e.date, pad(endH) + ':' + pad(endM));
      ics += 'BEGIN:VEVENT\r\n';
      ics += `DTSTART:${dtStart}\r\n`;
      ics += `DTEND:${dtEnd}\r\n`;
      ics += `SUMMARY:${(e.title || 'Experiment').replace(/[,;\\]/g, ' ')}\r\n`;
      ics += `UID:${e.id}@labmate.bioinfospace.com\r\n`;
      if (e.plan?.objectives) ics += `DESCRIPTION:${e.plan.objectives.replace(/\n/g, '\\n').replace(/[,;\\]/g, ' ')}\r\n`;
      ics += `STATUS:${e.status === 'completed' ? 'CONFIRMED' : e.status === 'cancelled' ? 'CANCELLED' : 'TENTATIVE'}\r\n`;
      ics += 'END:VEVENT\r\n';
    });
    ics += 'END:VCALENDAR\r\n';

    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `labmate_calendar_${from}.ics`; a.click();
    URL.revokeObjectURL(url);
    setShowIcsExport(false);
    toast.show(t('calIcsExported', lang));
  }, [entries, icsRange, lang, toast]);

  // --- Month View ---
  const renderMonthView = () => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().toISOString().slice(0, 10);
    const cells = [];

    for (let i = 0; i < firstDay; i++) cells.push(<div key={'empty-' + i} className="p-1 min-h-[60px]" />);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dayEntries = entriesByDate[dateStr] || [];
      const isToday = dateStr === today;
      cells.push(
        <div key={d} onClick={() => handleDayClick(dateStr)}
          className="p-1 min-h-[60px] rounded-lg cursor-pointer transition-colors"
          style={{
            border: isToday ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: isToday ? 'var(--primary-light)' : 'var(--card)',
          }}>
          <div className="text-xs font-semibold mb-0.5" style={{ color: isToday ? 'var(--primary)' : 'var(--text-muted)' }}>{d}</div>
          {dayEntries.slice(0, 3).map(e => (
            <div key={e.id} onClick={ev => { ev.stopPropagation(); handleEventClick(e); }}
              className="text-xs px-1 py-0.5 rounded mb-0.5 truncate cursor-pointer transition-opacity hover:opacity-80"
              style={{ background: e.color || statusColors[e.status] || 'var(--base-c)', color: 'white', fontSize: '0.65rem' }}>
              {lang === 'zh' ? (e.titleZh || e.title || '—') : (e.title || '—')}
            </div>
          ))}
          {dayEntries.length > 3 && <div className="text-xs" style={S_MUTED}>+{dayEntries.length - 3}</div>}
        </div>
      );
    }

    return (
      <div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {dayNames.map(d => <div key={d} className="text-center text-xs font-semibold py-1.5" style={S_MUTED}>{t(d, lang)}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">{cells}</div>
      </div>
    );
  };

  // --- Week View ---
  const renderWeekView = () => {
    const start = new Date(currentDate);
    start.setDate(start.getDate() - start.getDay());
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    const today = new Date().toISOString().slice(0, 10);
    const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7am to 7pm

    return (
      <div className="overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: `50px repeat(7, 1fr)`, minWidth: isMobile ? '600px' : 'auto' }}>
          {/* Header row */}
          <div />
          {days.map(d => {
            const dateStr = d.toISOString().slice(0, 10);
            const isToday = dateStr === today;
            return (
              <div key={dateStr} className="text-center py-1.5 text-xs font-semibold"
                style={{ color: isToday ? 'var(--primary)' : 'var(--text-muted)', background: isToday ? 'var(--primary-light)' : 'transparent', borderRadius: 'var(--radius)' }}>
                {t(dayNames[d.getDay()], lang)} {d.getDate()}
              </div>
            );
          })}
          {/* Time slots */}
          {hours.map(h => (
            <React.Fragment key={h}>
              <div className="text-xs text-right pr-2 py-2" style={S_MUTED}>{h}:00</div>
              {days.map(d => {
                const dateStr = d.toISOString().slice(0, 10);
                const dayEntries = (entriesByDate[dateStr] || []).filter(e => {
                  const startH = parseInt((e.startTime || '09:00').split(':')[0]);
                  return startH === h;
                });
                return (
                  <div key={dateStr + h} onClick={() => { const entry = createEmptyExperiment(dateStr, `${String(h).padStart(2, '0')}:00`); setEditingEvent(entry); setShowEventForm(true); }}
                    className="py-1 px-0.5 cursor-pointer transition-colors min-h-[36px]"
                    style={{ borderTop: '1px solid var(--border)' }}>
                    {dayEntries.map(e => (
                      <div key={e.id} onClick={ev => { ev.stopPropagation(); handleEventClick(e); }}
                        className="text-xs px-1.5 py-1 rounded mb-0.5 cursor-pointer transition-opacity hover:opacity-80"
                        style={{ background: e.color || statusColors[e.status] || 'var(--base-c)', color: 'white', fontSize: '0.7rem' }}>
                        <div className="font-medium truncate">{lang === 'zh' ? (e.titleZh || e.title || '—') : (e.title || '—')}</div>
                        <div className="opacity-75">{e.startTime} · {e.duration}m</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
    );
  };

  // --- Mobile compact month picker (day number + dot, no event chips) ---
  const renderMobileMonthView = () => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = new Date().toISOString().slice(0, 10);
    const cells = [];

    for (let i = 0; i < firstDay; i++) cells.push(<div key={'empty-' + i} style={{ minHeight: '44px' }} />);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const hasEntries = !!(entriesByDate[dateStr] && entriesByDate[dateStr].length);
      const isToday = dateStr === today;
      const isSelected = dateStr === mobileDayFilter;
      cells.push(
        <button key={d} onClick={() => setMobileDayFilter(prev => prev === dateStr ? null : dateStr)}
          className="flex flex-col items-center justify-center transition-colors"
          style={{
            minHeight: '44px',
            border: isSelected ? '2px solid var(--border-strong)' : isToday ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: isSelected ? 'var(--bg-2)' : isToday ? 'var(--primary-light)' : 'var(--card)',
            cursor: 'pointer',
          }}>
          <span className="text-sm" style={{ color: isToday ? 'var(--primary)' : 'var(--text)' }}>{d}</span>
          <span style={{ width: 5, height: 5, marginTop: 2, background: hasEntries ? 'var(--primary)' : 'transparent' }} />
        </button>
      );
    }

    return (
      <div>
        <div className="grid grid-cols-7 gap-0.5 mb-1">
          {dayNames.map(dn => <div key={dn} className="text-center text-xs font-semibold py-1.5" style={S_MUTED}>{t(dn, lang)}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">{cells}</div>
      </div>
    );
  };

  // Single agenda row — full-width tappable, reused by both the grouped "upcoming" list and the day-filtered list.
  const renderAgendaRow = (e) => (
    <div key={e.id} onClick={() => handleEventClick(e)}
      className="w-full flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors hover:opacity-80"
      style={{ border: '1px solid var(--border)', background: 'var(--card)', minHeight: '44px' }}>
      <span className="flex-shrink-0" style={{ width: 10, height: 10, background: e.color || statusColors[e.status] || 'var(--base-c)' }} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{lang === 'zh' ? (e.titleZh || e.title || '—') : (e.title || '—')}</div>
        <div className="text-xs mono" style={S_MUTED}>{e.startTime || '--:--'} · {e.duration || 0}m</div>
      </div>
    </div>
  );

  // Mobile agenda body: either the day-filtered list (from the month picker) or the full chronological
  // upcoming list grouped by date header + weekday.
  const renderMobileAgendaBody = () => {
    if (mobileDayFilter) {
      if (dayFilteredEntries.length === 0) {
        return (
          <div className="text-center py-8">
            <p className="text-sm mb-3" style={S_MUTED}>{lang === 'zh' ? '这一天没有实验' : 'No experiments this day'}</p>
            <button onClick={() => { const entry = createEmptyExperiment(mobileDayFilter); setEditingEvent(entry); setShowEventForm(true); }}
              className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', minHeight: '40px' }}>
              + {t('calNewEvent', lang)}
            </button>
          </div>
        );
      }
      return <div className="space-y-1.5">{dayFilteredEntries.map(renderAgendaRow)}</div>;
    }

    if (groupedUpcoming.length === 0) {
      return (
        <div className="text-center py-8">
          <p className="text-sm mb-3" style={S_MUTED}>{t('calNoEvents', lang)}</p>
          <button onClick={() => { const entry = createEmptyExperiment(); setEditingEvent(entry); setShowEventForm(true); }}
            className="btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem', minHeight: '40px' }}>
            + {t('calNewEvent', lang)}
          </button>
        </div>
      );
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    return (
      <div className="space-y-3">
        {groupedUpcoming.map(g => {
          const dObj = dateStrToLocalDate(g.date);
          const label = `${t(dayNames[dObj.getDay()], lang)}, ${t(monthNames[dObj.getMonth()], lang)} ${dObj.getDate()}`;
          return (
            <div key={g.date}>
              <div className="text-xs font-semibold mb-1.5" style={S_MUTED}>
                {g.date === todayStr ? `${t('calToday', lang)} · ${label}` : label}
              </div>
              <div className="space-y-1.5">{g.items.map(renderAgendaRow)}</div>
            </div>
          );
        })}
      </div>
    );
  };

  // Event form modal
  const eventFormModal = showEventForm && editingEvent && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="card p-6 w-full max-w-md max-h-[85vh] overflow-y-auto" style={{ background: 'var(--card)' }}>
        <h3 className="text-lg font-semibold mb-4">{t('calEventForm', lang)}</h3>
        <div className="space-y-3">
          <div>
            <label>{t('nbEntryTitle', lang)}</label>
            <input type="text" value={editingEvent.title || ''} onChange={e => setEditingEvent(prev => ({ ...prev, title: e.target.value }))}
              className="w-full" placeholder={lang === 'zh' ? '实验标题' : 'Experiment title'} />
          </div>
          <div>
            <label>{t('nbEntryTitleZh', lang)}</label>
            <input type="text" value={editingEvent.titleZh || ''} onChange={e => setEditingEvent(prev => ({ ...prev, titleZh: e.target.value }))}
              className="w-full" placeholder={lang === 'zh' ? '中文标题' : 'Chinese title'} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label>{t('nbDate', lang)}</label>
              <input type="date" value={editingEvent.date || ''} onChange={e => setEditingEvent(prev => ({ ...prev, date: e.target.value }))} className="w-full" />
            </div>
            <div>
              <label>{t('nbStartTime', lang)}</label>
              <input type="time" value={editingEvent.startTime || ''} onChange={e => setEditingEvent(prev => ({ ...prev, startTime: e.target.value }))} className="w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label>{t('nbDuration', lang)}</label>
              <input type="number" value={editingEvent.duration || ''} onChange={e => setEditingEvent(prev => ({ ...prev, duration: parseInt(e.target.value) || 0 }))} className="w-full" min="0" />
            </div>
            <div>
              <label>{t('calColor', lang)}</label>
              <div className="flex gap-1.5 mt-1 flex-wrap">
                {['#16B364', '#6366f1', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6', '#06b6d4'].map(c => (
                  <button key={c} onClick={() => setEditingEvent(prev => ({ ...prev, color: c }))}
                    style={{ width: 24, height: 24, borderRadius: 0, background: c, border: editingEvent.color === c ? '3px solid var(--text)' : '2px solid var(--border)', cursor: 'pointer', transition: 'transform 0.15s' }} />
                ))}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label>{t('nbStatus', lang)}</label>
              <select value={editingEvent.status || 'planned'} onChange={e => setEditingEvent(prev => ({ ...prev, status: e.target.value }))} className="w-full">
                <option value="planned">{t('nbStatusPlanned', lang)}</option>
                <option value="in-progress">{t('nbStatusInProgress', lang)}</option>
                <option value="completed">{t('nbStatusCompleted', lang)}</option>
                <option value="cancelled">{t('nbStatusCancelled', lang)}</option>
              </select>
            </div>
            <div>
              <label>{t('nbPriority', lang)}</label>
              <select value={editingEvent.priority || 'medium'} onChange={e => setEditingEvent(prev => ({ ...prev, priority: e.target.value }))} className="w-full">
                <option value="high">{t('nbPriorityHigh', lang)}</option>
                <option value="medium">{t('nbPriorityMedium', lang)}</option>
                <option value="low">{t('nbPriorityLow', lang)}</option>
              </select>
            </div>
          </div>
          <div>
            <label>{t('nbObjectives', lang)}</label>
            <textarea value={editingEvent.plan?.objectives || ''} onChange={e => setEditingEvent(prev => ({ ...prev, plan: { ...prev.plan, objectives: e.target.value } }))}
              className="w-full" rows={2} placeholder={lang === 'zh' ? '简述实验目的...' : 'Brief objectives...'} />
          </div>
          {editingEvent.protocolRef && (
            <div className="px-3 py-1.5 rounded-lg text-xs flex items-center gap-2" style={S_PILL_PRIMARY}>
              <span>→</span>
              <span>{t('nbLinkedProtocol', lang)}: {RECIPE_BY_ID[editingEvent.protocolRef]?.name || editingEvent.protocolRef}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 mt-5 justify-between">
          <button onClick={handleDeleteEvent} className="btn-secondary" style={{ padding: '5px 12px', fontSize: '0.82rem', color: 'var(--danger-text)' }}>
            {t('calDeleteEvent', lang)}
          </button>
          <div className="flex gap-2">
            <button onClick={() => { setShowEventForm(false); setEditingEvent(null); }} className="btn-secondary" style={{ padding: '5px 14px', fontSize: '0.82rem' }}>{t('nbCancel', lang)}</button>
            <button onClick={handleSaveEvent} className="btn-primary" style={{ padding: '5px 14px', fontSize: '0.82rem' }}>{t('nbSave', lang)}</button>
          </div>
        </div>
      </div>
    </div>
  );

  // ICS export modal
  const icsExportModal = showIcsExport && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="card p-6 max-w-sm w-full" style={{ background: 'var(--card)' }}>
        <h3 className="text-lg font-semibold mb-3">{t('calExportIcs', lang)}</h3>
        <div className="space-y-3">
          <div>
            <label>{t('calIcsFrom', lang)}</label>
            <input type="date" value={icsRange.from} onChange={e => setIcsRange(prev => ({ ...prev, from: e.target.value }))} className="w-full" />
          </div>
          <div>
            <label>{t('calIcsTo', lang)}</label>
            <input type="date" value={icsRange.to} onChange={e => setIcsRange(prev => ({ ...prev, to: e.target.value }))} className="w-full" />
          </div>
        </div>
        <div className="flex gap-2 mt-4 justify-end">
          <button onClick={() => setShowIcsExport(false)} className="btn-secondary" style={{ padding: '5px 14px', fontSize: '0.82rem' }}>{t('nbCancel', lang)}</button>
          <button onClick={generateICS} className="btn-primary" style={{ padding: '5px 14px', fontSize: '0.82rem' }}>{t('calExportIcs', lang)}</button>
        </div>
      </div>
    </div>
  );

  const protocolImportModal = showProtocolImport && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.4)' }}>
      <div className="card p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" style={{ background: 'var(--card)' }}>
        <h3 className="text-lg font-semibold mb-3">{t('calImportProtocol', lang)}</h3>
        <ProtocolSelector lang={lang} onSelect={handleProtocolImport} onClose={() => setShowProtocolImport(false)} />
      </div>
    </div>
  );

  // Header label for the day-filtered mobile agenda (e.g. "Mon, Jul 7").
  let mobileFilterLabel = '';
  if (mobileDayFilter) {
    const filterDateObj = dateStrToLocalDate(mobileDayFilter);
    mobileFilterLabel = `${t(dayNames[filterDateObj.getDay()], lang)}, ${t(monthNames[filterDateObj.getMonth()], lang)} ${filterDateObj.getDate()}`;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-bold" style={S_TEXT}>{t('calTitle', lang)}</h2>
        <p className="text-sm mt-1" style={S_MUTED}>{t('calSubtitle', lang)}</p>
      </div>

      {/* Toolbar */}
      <div className="card p-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1">
            {isMobile ? (
              <>
                <button onClick={() => { setViewMode('agenda'); setMobileDayFilter(null); }}
                  className={viewMode === 'agenda' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '5px 14px', fontSize: '0.82rem' }}>
                  {lang === 'zh' ? '日程' : 'Agenda'}
                </button>
                <button onClick={() => { setViewMode('month'); setMobileDayFilter(null); }}
                  className={viewMode === 'month' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '5px 14px', fontSize: '0.82rem' }}>
                  {t('calMonthView', lang)}
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setViewMode('month')}
                  className={viewMode === 'month' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '5px 14px', fontSize: '0.82rem' }}>
                  {t('calMonthView', lang)}
                </button>
                <button onClick={() => setViewMode('week')}
                  className={viewMode === 'week' ? 'btn-primary' : 'btn-secondary'} style={{ padding: '5px 14px', fontSize: '0.82rem' }}>
                  {t('calWeekView', lang)}
                </button>
              </>
            )}
          </div>
          {!(isMobile && viewMode === 'agenda') && (
            <div className="flex items-center gap-1">
              <button onClick={() => { (viewMode === 'month' ? prevMonth : prevWeek)(); if (isMobile) setMobileDayFilter(null); }}
                className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.9rem' }}>&#8249;</button>
              <span className="text-sm font-semibold px-2 min-w-[140px] text-center" style={S_TEXT}>
                {t(monthNames[month], lang)} {year}
              </span>
              <button onClick={() => { (viewMode === 'month' ? nextMonth : nextWeek)(); if (isMobile) setMobileDayFilter(null); }}
                className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.9rem' }}>&#8250;</button>
            </div>
          )}
          {!(isMobile && viewMode === 'agenda') && (
            <button onClick={() => { goToday(); if (isMobile) setMobileDayFilter(null); }} className="btn-secondary" style={{ padding: '5px 12px', fontSize: '0.78rem' }}>
              {t('calToday', lang)}
            </button>
          )}
          <div className="flex-1" />
          <button onClick={() => setShowProtocolImport(true)} className="btn-secondary" style={{ padding: '5px 12px', fontSize: '0.78rem' }}>
            {t('calImportProtocol', lang)}
          </button>
          <button onClick={() => setShowIcsExport(true)} className="btn-secondary" style={{ padding: '5px 12px', fontSize: '0.78rem' }}>
            {t('calExportIcs', lang)}
          </button>
          <button onClick={() => { const entry = createEmptyExperiment(); setEditingEvent(entry); setShowEventForm(true); }}
            className="btn-primary" style={{ padding: '5px 12px', fontSize: '0.82rem' }}>
            + {t('calNewEvent', lang)}
          </button>
        </div>
      </div>

      {/* Calendar grid — on mobile, skipped entirely in Agenda mode (the Agenda card below is the whole body) */}
      {!(isMobile && viewMode === 'agenda') && (
        <div className="card p-4">
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block w-6 h-6 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--primary)' }} />
            </div>
          ) : isMobile ? renderMobileMonthView() : viewMode === 'month' ? renderMonthView() : renderWeekView()}
        </div>
      )}

      {/* Upcoming list (desktop) / Agenda (mobile) */}
      {(isMobile || entries.length > 0) && (
        <div className="card p-4 mt-4">
          {isMobile ? (
            <>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-lg font-semibold" style={S_TEXT}>
                  {mobileDayFilter ? mobileFilterLabel : (lang === 'zh' ? '即将进行' : 'Upcoming')}
                </h3>
                {mobileDayFilter ? (
                  <button onClick={() => setMobileDayFilter(null)} className="btn-secondary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                    {lang === 'zh' ? '显示全部' : 'Show all'}
                  </button>
                ) : groupedUpcoming.length > 0 ? (
                  <button onClick={() => { const entry = createEmptyExperiment(); setEditingEvent(entry); setShowEventForm(true); }}
                    className="btn-primary" style={{ padding: '4px 10px', fontSize: '0.75rem' }}>
                    + {t('calNewEvent', lang)}
                  </button>
                ) : null}
              </div>
              {renderMobileAgendaBody()}
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold mb-3" style={S_TEXT}>
                {lang === 'zh' ? '即将进行' : 'Upcoming'}
              </h3>
              <div className="space-y-1.5">
                {entries
                  .filter(e => e.date >= new Date().toISOString().slice(0, 10) && e.status !== 'cancelled')
                  .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
                  .slice(0, 8)
                  .map(e => (
                    <div key={e.id} onClick={() => handleEventClick(e)}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors hover:opacity-80"
                      style={{ background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.color || statusColors[e.status] || 'var(--base-c)' }} />
                      <span className="text-sm font-medium flex-1 truncate">{lang === 'zh' ? (e.titleZh || e.title || '—') : (e.title || '—')}</span>
                      <span className="text-xs mono" style={S_MUTED}>{e.date}</span>
                      <span className="text-xs" style={S_MUTED}>{e.startTime || ''}</span>
                    </div>
                  ))}
                {entries.filter(e => e.date >= new Date().toISOString().slice(0, 10) && e.status !== 'cancelled').length === 0 && (
                  <p className="text-sm text-center py-4" style={S_MUTED}>{t('calNoEvents', lang)}</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {eventFormModal}
      {icsExportModal}
      {protocolImportModal}
    </div>
  );
}

export default CalendarTab;
