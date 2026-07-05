// ──────────────────────────────────────────────────────────────────────────────
// Experiment record → Markdown  (pure) + a small browser download helper
// ──────────────────────────────────────────────────────────────────────────────
//
// `experimentToMarkdown(entry)` is side-effect-free so it can be unit-tested and
// reused by the agent's `exportProtocol` tool. `downloadText()` is the only
// browser-coupled part (Blob + <a> click), kept separate.
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Render an experiment record to a Markdown string. Mirrors the layout the
 * Notebook tab has always produced (headings, task-list checkboxes, deviations).
 * @param {object} entry experiment record (see createEmptyExperiment)
 * @returns {string}
 */
export function experimentToMarkdown(entry) {
  const e = entry || {};
  let md = `# ${e.title || 'Untitled Experiment'}\n`;
  if (e.titleZh) md += `**${e.titleZh}**\n`;
  md += `\n**Date:** ${e.date || 'N/A'}  \n`;
  md += `**Status:** ${e.status || ''}  \n**Priority:** ${e.priority || ''}\n`;
  if (e.protocolRef) md += `**Protocol:** ${e.protocolRef}\n`;

  md += `\n## Plan\n\n### Objectives\n${e.plan?.objectives || '_None_'}\n\n### Notes\n${e.plan?.notes || '_None_'}\n`;

  md += `\n## Materials\n\n### Reagents\n`;
  (e.materials?.reagents || []).forEach((r) => {
    md += `- ${r.name}${r.amount ? ': ' + r.amount + ' ' + (r.unit || '') : ''}${r.location ? ' (' + r.location + ')' : ''}\n`;
  });
  if ((e.materials?.equipment || []).length) {
    md += `\n### Equipment\n`;
    e.materials.equipment.forEach((eq) => { md += `- [${eq.status === 'ready' ? 'x' : ' '}] ${eq.name}\n`; });
  }
  if ((e.materials?.checklist || []).length) {
    md += `\n### Checklist\n`;
    e.materials.checklist.forEach((c) => { md += `- [${c.checked ? 'x' : ' '}] ${c.item}\n`; });
  }

  md += `\n## Procedure\n\n`;
  if (e.procedure?.mode === 'template' && e.procedure.protocolSteps?.length) {
    e.procedure.protocolSteps.forEach((s, i) => {
      md += `${i + 1}. [${s.completed ? 'x' : ' '}] ${s.stepText}\n`;
      if (s.deviation) md += `   - **Deviation:** ${s.deviation}\n`;
      if (s.actualParams) md += `   - **Actual:** ${s.actualParams}\n`;
    });
  } else {
    md += e.procedure?.freeText || '_None_';
  }

  md += `\n\n## Results\n\n### Summary\n${e.results?.summary || '_None_'}\n`;
  if (e.results?.dataProcessing) md += `\n### Data Processing\n${e.results.dataProcessing}\n`;
  if ((e.results?.figures || []).length) {
    md += `\n### Figures\n`;
    e.results.figures.forEach((f, i) => { md += `${i + 1}. ${f.description}${f.notes ? ' — ' + f.notes : ''}\n`; });
  }
  return md;
}

/** Suggested filename for an experiment export (no extension logic beyond .md). */
export function experimentFilename(entry) {
  const e = entry || {};
  const id = (e.id || 'entry').slice(-6);
  return `experiment_${e.date || 'entry'}_${id}.md`;
}

/** Trigger a browser download of `content` as a file. Browser-only. */
export function downloadText(content, filename, mime = 'text/markdown') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
