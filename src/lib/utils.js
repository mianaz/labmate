import React from 'react';

// Safe text extractor: handles string, {en,zh} object, or null
export function safeText(val, lang) {
  if (!val) return '';
  if (typeof val === 'string') return val;
  if (typeof val === 'object') return (lang === 'en' ? val.en : val.zh) || val.en || val.zh || '';
  return String(val);
}

// Safe bold text renderer — avoids dangerouslySetInnerHTML
// Renders **text** as <strong>text</strong>
export function BoldText({ text, style }) {
  if (!text) return null;
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return React.createElement('span', { style },
    parts.map((part, i) => i % 2 === 1
      ? React.createElement('strong', { key: i }, part)
      : part
    )
  );
}

// Unified notes accessor — handles string, {en, zh} object, false, null
export function getRecipeNotes(recipe, lang) {
  return safeText(recipe.notes, lang);
}

// Download helper
export function downloadFile(filename, content, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// Render dynamic step text with scaled values
export function renderDynamicStep(text, scale) {
  return text.replace(/\{v:([\d.]+):([^}]+)\}/g, (_, amt, unit) => {
    const scaled = parseFloat(amt) * scale;
    const display = scaled < 0.01 ? scaled.toExponential(2) : scaled < 1 ? scaled.toFixed(2) : scaled < 100 ? scaled.toFixed(1) : Math.round(scaled);
    return display + ' ' + unit;
  });
}
