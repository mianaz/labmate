// iCalendar (.ics) export for notebook/calendar experiments (RFC 5545).
// Pure — shared with the WeChat mini program (weapp/scripts/sync.mjs).
//
// Times are "floating" local times (no TZID), as before: an experiment at 09:30
// imports at 09:30 wherever the calendar app is.

const pad2 = (n) => String(n).padStart(2, '0');
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

// Experiments whose date falls in [from, to] (to = '' → open-ended).
export function icsEntries(entries, from, to) {
  const end = to || '9999-12-31';
  return (entries || []).filter((e) => e && e.date && e.date >= (from || '') && e.date <= end);
}

// TEXT value escaping: backslash first, then ; , and line breaks.
export function icsEscape(value) {
  return String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');
}

// Content lines longer than 75 octets are folded: CRLF + one space, never
// splitting a multi-byte (e.g. Chinese) character.
export function icsFold(line) {
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const cp = ch.codePointAt(0);
    const len = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
    const limit = out.length ? 74 : 75; // continuation lines spend one octet on the space
    if (bytes + len > limit) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += len;
  }
  out.push(cur);
  return out.join('\r\n ');
}

function stampLocal(d) {
  return `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(d.getHours())}${pad2(d.getMinutes())}00`;
}

function stampUTC(d) {
  return `${d.getUTCFullYear()}${pad2(d.getUTCMonth() + 1)}${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}${pad2(d.getUTCMinutes())}${pad2(d.getUTCSeconds())}Z`;
}

// Start/end of an experiment as local Dates, or null without a valid date.
// Date arithmetic (not string maths) so an experiment running past midnight
// ends on the next day; a missing or non-numeric duration counts as 60 min.
export function experimentSpan(e) {
  const dm = DATE_RE.exec(e?.date || '');
  if (!dm) return null;
  const tm = TIME_RE.exec(e.startTime || '');
  const timeOk = !!tm && +tm[1] < 24 && +tm[2] < 60; // otherwise 09:00, as the web always did
  const start = new Date(+dm[1], +dm[2] - 1, +dm[3], timeOk ? +tm[1] : 9, timeOk ? +tm[2] : 0);
  const dur = Number(e.duration);
  const minutes = Number.isFinite(dur) && dur > 0 ? dur : 60;
  return { start, end: new Date(start.getTime() + minutes * 60000) };
}

/**
 * Build a VCALENDAR document for the given experiments.
 * @param {Array} entries experiment records (see lib/experiments.js)
 * @param {{ now?: Date }} [opts] now: DTSTAMP time (tests)
 * @returns {string} CRLF-separated .ics text
 */
export function buildICS(entries, { now = new Date() } = {}) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//bioinfospace labmate//EN', 'CALSCALE:GREGORIAN'];
  const dtstamp = stampUTC(now);
  for (const e of entries || []) {
    const span = experimentSpan(e);
    if (!span) continue;
    lines.push('BEGIN:VEVENT');
    lines.push(`UID:${e.id}@labmate.bioinfospace.com`);
    lines.push(`DTSTAMP:${dtstamp}`);
    lines.push(`DTSTART:${stampLocal(span.start)}`);
    lines.push(`DTEND:${stampLocal(span.end)}`);
    lines.push(`SUMMARY:${icsEscape(e.title || e.titleZh || 'Experiment')}`);
    if (e.plan?.objectives) lines.push(`DESCRIPTION:${icsEscape(e.plan.objectives)}`);
    lines.push(`STATUS:${e.status === 'completed' ? 'CONFIRMED' : e.status === 'cancelled' ? 'CANCELLED' : 'TENTATIVE'}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(icsFold).join('\r\n') + '\r\n';
}
