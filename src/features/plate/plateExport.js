// Pure utility functions for plate data export (CSV, SVG)

import { ROW_LABELS } from '../../data/plateConfigs.js';

/**
 * Convert well plate data to CSV string
 * @param {Object} wellData - Map of well keys to {label, color}
 * @param {Object} config - Plate config with rows, cols
 * @returns {string} CSV content
 */
export function plateToCSV(wellData, config) {
  let csv = ',';
  for (let c = 0; c < config.cols; c++) csv += (c+1) + (c < config.cols-1 ? ',' : '');
  csv += '\n';
  for (let r = 0; r < config.rows; r++) {
    csv += ROW_LABELS[r];
    for (let c = 0; c < config.cols; c++) {
      const key = ROW_LABELS[r] + (c+1);
      const d = wellData[key];
      csv += ',' + (d ? '"' + d.label.replace(/"/g,'""') + '"' : '');
    }
    csv += '\n';
  }
  return csv;
}

/**
 * Convert well plate data to SVG string
 * @param {Object} wellData - Map of well keys to {label, color}
 * @param {Object} config - Plate config with rows, cols
 * @param {Array} groups - Array of {label, color, wells}
 * @returns {string} SVG markup
 */
export function plateToSVG(wellData, config, groups) {
  const pad = 40, ws = 32, gap = 4;
  const w = pad + config.cols * (ws + gap) + 20;
  const h = pad + config.rows * (ws + gap) + 60 + groups.length * 20;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" style="font-family:monospace;font-size:10px">`;
  svg += `<rect width="${w}" height="${h}" fill="#f5f2ec"/>`;
  // col headers
  for (let c = 0; c < config.cols; c++) {
    const x = pad + c * (ws + gap) + ws/2;
    svg += `<text x="${x}" y="${pad-8}" text-anchor="middle" fill="#888">${c+1}</text>`;
  }
  // rows
  for (let r = 0; r < config.rows; r++) {
    const y = pad + r * (ws + gap);
    svg += `<text x="${pad-12}" y="${y + ws/2 + 4}" text-anchor="middle" fill="#888">${ROW_LABELS[r]}</text>`;
    for (let c = 0; c < config.cols; c++) {
      const x = pad + c * (ws + gap);
      const key = ROW_LABELS[r] + (c+1);
      const d = wellData[key];
      const fill = d ? d.color + '40' : '#f0f0f0';
      const stroke = d ? d.color : '#ccc';
      svg += `<circle cx="${x+ws/2}" cy="${y+ws/2}" r="${ws/2-2}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
      if (d && config.cols <= 12) {
        const label = d.label.length > 5 ? d.label.slice(0,4)+'…' : d.label;
        svg += `<text x="${x+ws/2}" y="${y+ws/2+3}" text-anchor="middle" fill="${d.color}" font-size="7" font-weight="bold">${label}</text>`;
      }
    }
  }
  // legend
  const ly = pad + config.rows * (ws + gap) + 16;
  svg += `<text x="${pad}" y="${ly}" font-weight="bold" fill="#333">Legend:</text>`;
  groups.forEach((g, i) => {
    const gy = ly + 18 + i * 18;
    svg += `<circle cx="${pad+6}" cy="${gy-4}" r="5" fill="${g.color}"/>`;
    svg += `<text x="${pad+16}" y="${gy}" fill="#555">${g.label} (${g.wells.length} wells)</text>`;
  });
  svg += '</svg>';
  return svg;
}
