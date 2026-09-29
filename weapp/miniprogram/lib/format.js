// Text helpers shared by the library pages (ported from src/lib/utils.js and
// src/components/RecipeDetail.jsx).
const { t, NOTES_EN } = require('../shared/i18n.js');

// string | {en, zh} | null → string in the active language
function safeText(val, lang) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return (lang === 'en' ? val.en : val.zh) || val.en || val.zh || '';
  return String(val);
}

function getRecipeNotes(recipe, lang) {
  if (lang === 'en' && NOTES_EN[recipe.id]) return NOTES_EN[recipe.id];
  return safeText(recipe.notes, lang);
}

// "**bold** text" → [{ text, bold }] for <text> runs (the web's BoldText).
function boldSegments(text) {
  if (!text) return [];
  return String(text).split(/\*\*(.*?)\*\*/g)
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((s) => s.text !== '');
}

// "{v:800:mL}" → value scaled to the target volume.
function renderDynamicStep(text, scale) {
  if (!text) return '';
  return String(text).replace(/\{v:([\d.]+):([^}]+)\}/g, (_, amt, unit) => {
    const scaled = parseFloat(amt) * scale;
    const display = scaled < 0.01 ? scaled.toExponential(2) : scaled < 1 ? scaled.toFixed(2) : scaled < 100 ? scaled.toFixed(1) : Math.round(scaled);
    return display + ' ' + unit;
  });
}

function fmtAmount(v) {
  if (!Number.isFinite(v)) return '';
  return v < 0.01 ? v.toExponential(2) : v < 1 ? v.toFixed(3) : v < 100 ? v.toFixed(2) : v.toFixed(1);
}

// ── Step timers (RecipeDetail.parseTimePatternsFromText) ───────────────────
const PCR_DEG_RE = /°C/;
const PCR_CYCLE_RE = /[×x]\s*\d+|cycles?|\d+\s*轮/i;
const CENTRIFUGE_RE = /\d+\s*[×x]\s*g\b/i;
const HAS_TIME_UNIT_RE = /\d+\s*(min|h|s|分|秒|小时)/i;
const RATIO_S_RE = /\d+S\/\d+S/g;
const RATIO_A_RE = /A\d+\/\d+/g;
const EN_TIME_RE = /(?:(\d+(?:\.\d+)?)\s*[-–]\s*)?(\d+(?:\.\d+)?)\s*(min(?:utes?)?|h(?:ours?|rs?)?|s(?:ec(?:onds?)?)?)\b/gi;
const ZH_TIME_RE = /(?:(\d+(?:\.\d+)?)\s*[-–]\s*)?(\d+(?:\.\d+)?)\s*(分钟|分|小时|秒)/g;
const APPROX_RE = /[~≈约大约]/;
const APPROX_EN_RE = /about|approx/i;
const ON_OFF_RE = /^\s*(on|off)\b/i;

function parseTimePatternsFromText(text) {
  if (!text) return [];
  const matches = [];
  if (PCR_DEG_RE.test(text) && PCR_CYCLE_RE.test(text)) return matches;
  if (CENTRIFUGE_RE.test(text) && !HAS_TIME_UNIT_RE.test(text)) return matches;
  const cleaned = text.replace(RATIO_S_RE, '').replace(RATIO_A_RE, '');
  EN_TIME_RE.lastIndex = 0;
  ZH_TIME_RE.lastIndex = 0;
  let m;
  while ((m = EN_TIME_RE.exec(cleaned)) !== null) {
    const before = cleaned.slice(Math.max(0, m.index - 10), m.index);
    if (APPROX_RE.test(before) || APPROX_EN_RE.test(before)) continue;
    const after = cleaned.slice(m.index + m[0].length, m.index + m[0].length + 10);
    if (ON_OFF_RE.test(after)) continue;
    const val = parseFloat(m[2]);
    const unit = m[3].toLowerCase();
    let seconds;
    if (unit.startsWith('h')) seconds = val * 3600;
    else if (unit.startsWith('s')) seconds = val;
    else seconds = val * 60;
    if (seconds >= 5 && seconds <= 86400) matches.push({ seconds, label: m[0].trim() });
  }
  while ((m = ZH_TIME_RE.exec(cleaned)) !== null) {
    const before = cleaned.slice(Math.max(0, m.index - 10), m.index);
    if (APPROX_RE.test(before)) continue;
    const val = parseFloat(m[2]);
    const unit = m[3];
    let seconds;
    if (unit === '小时') seconds = val * 3600;
    else if (unit === '秒') seconds = val;
    else seconds = val * 60;
    if (seconds >= 5 && seconds <= 86400 && !matches.some((x) => x.seconds === seconds)) {
      matches.push({ seconds, label: m[0].trim() });
    }
  }
  return matches;
}

function stepText(step, lang) {
  if (step == null) return '';
  if (typeof step === 'string') return step;
  return step[lang] || step.zh || step.en || '';
}

// Plain-text copy of a recipe or protocol, for the clipboard / chat.
function recipeToText(recipe, targetVol, lang) {
  const zh = lang === 'zh';
  const line = (ch) => ch.repeat(28) + '\n';
  const isProt = recipe.category === 'protocol';
  let txt = line('═') + recipe.name + '\n';
  if (zh && recipe.nameCn && recipe.nameCn !== recipe.name) txt += recipe.nameCn + '\n';
  if (recipe.ph) txt += 'pH ' + recipe.ph + '\n';
  txt += line('─');
  if (isProt) {
    const steps = (recipe.detailedSteps && recipe.detailedSteps.length ? recipe.detailedSteps : (recipe.briefSteps || []));
    if ((recipe.materials || []).length) {
      txt += t('materialsLabel', lang) + ':\n';
      recipe.materials.forEach((mat) => { txt += '• ' + (typeof mat === 'string' ? mat : mat.name) + '\n'; });
      txt += '\n';
    }
    txt += t('stepsLabel', lang) + ':\n';
    let n = 0;
    if (steps.length) {
      steps.forEach((s) => {
        const text = stepText(s, lang);
        if (!text) return;
        if (s && s.isHeader) txt += '\n[' + text + ']\n';
        else txt += (++n) + '. ' + text.replace(/\*\*/g, '') + '\n';
      });
    } else {
      (recipe.components || []).forEach((c) => { txt += (++n) + '. ' + String(c.name).trim() + '\n'; });
    }
  } else {
    const scale = recipe.defaultVolume ? targetVol / recipe.defaultVolume : 1;
    txt += t('targetVolume', lang) + ': ' + targetVol + ' ' + (recipe.unit || '');
    if (scale !== 1) txt += '  (×' + scale.toFixed(2) + ')';
    txt += '\n\n';
    (recipe.components || []).forEach((c) => {
      txt += '• ' + c.name + '  ' + fmtAmount(c.amount * scale) + ' ' + c.unit;
      if (c.note) txt += '  (' + safeText(c.note, lang) + ')';
      txt += '\n';
    });
    if ((recipe.prepSteps || []).length) {
      txt += '\n' + t('prepStepsLabel', lang) + ':\n';
      recipe.prepSteps.forEach((s, i) => { txt += (i + 1) + '. ' + renderDynamicStep(stepText(s, lang), scale) + '\n'; });
    }
  }
  const noteTxt = getRecipeNotes(recipe, lang);
  if (noteTxt) txt += '\n' + t('tip', lang) + ': ' + noteTxt + '\n';
  if (recipe.ref) txt += '\n' + t('referenceLabel', lang) + ': ' + recipe.ref + '\n';
  txt += '\n— LabMate · bioinfospace';
  return txt;
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

// 90 → "1:30", 3700 → "1:01:40"
function formatTimer(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? pad2(m) : String(m);
  return (h > 0 ? h + ':' : '') + mm + ':' + pad2(sec);
}

function formatClock(ms) {
  const d = new Date(ms);
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

// Local YYYY-MM-DD (toISOString would give the UTC date).
function isoDate(d) {
  const x = d || new Date();
  return x.getFullYear() + '-' + pad2(x.getMonth() + 1) + '-' + pad2(x.getDate());
}

module.exports = {
  safeText, getRecipeNotes, boldSegments, renderDynamicStep, fmtAmount,
  parseTimePatternsFromText, stepText, recipeToText, formatTimer, formatClock, isoDate, pad2,
};
