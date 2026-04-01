// PlateTab — Full plate designer: well selection, coloring, templates, export
import React, { useState, useEffect } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { PLATE_CONFIGS, WELL_COLORS, ROW_LABELS } from '../../data/plateConfigs.js';
import { S_MUTED, S_PRIMARY } from '../../lib/styleConstants.js';
import { downloadFile } from '../../lib/utils.js';
import { plateToCSV, plateToSVG } from './plateExport.js';
import PlateTableView from './PlateTableView.jsx';

import DownloadBtn from '../../components/DownloadBtn.jsx';
import { useToast } from '../../components/Toast.jsx';

function PlateTab() {
  const lang = useLang();
  const toast = useToast();
  const [plateType, setPlateType] = useState(96);
  const [wellData, setWellData] = useState({});
  const [selectedWells, setSelectedWells] = useState(new Set());
  const [currentColor, setCurrentColor] = useState(0);
  const [customColor, setCustomColor] = useState('#ff0000');
  const [useCustomColor, setUseCustomColor] = useState(false);
  const [currentLabel, setCurrentLabel] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [groups, setGroups] = useState([]);
  const [enlarged, setEnlarged] = useState(false);

  const config = PLATE_CONFIGS[plateType];

  // ═══════════════════════════════════════════════
  // RESET ON PLATE TYPE CHANGE
  // ═══════════════════════════════════════════════

  useEffect(() => {
    setWellData({});
    setSelectedWells(new Set());
    setGroups([]);
  }, [plateType]);

  // ═══════════════════════════════════════════════
  // WELL SELECTION HELPERS
  // ═══════════════════════════════════════════════

  function wellKey(r, c) { return `${ROW_LABELS[r]}${c + 1}`; }

  function toggleWell(r, c) {
    const key = wellKey(r, c);
    setSelectedWells(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function handleMouseDown(r, c, e) {
    e.preventDefault();
    setIsDragging(true);
    toggleWell(r, c);
  }

  function handleMouseEnter(r, c) {
    if (isDragging) {
      const key = wellKey(r, c);
      setSelectedWells(prev => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
  }

  useEffect(() => {
    function handleUp() { setIsDragging(false); }
    window.addEventListener('mouseup', handleUp);
    return () => window.removeEventListener('mouseup', handleUp);
  }, []);

  function getActiveColor() {
    return useCustomColor ? customColor : WELL_COLORS[currentColor % WELL_COLORS.length];
  }

  // ═══════════════════════════════════════════════
  // ASSIGN / CLEAR
  // ═══════════════════════════════════════════════

  function assignSelected() {
    if (selectedWells.size === 0 || !currentLabel) return;
    const color = getActiveColor();
    setWellData(prev => {
      const next = { ...prev };
      selectedWells.forEach(key => {
        next[key] = { color, label: currentLabel };
      });
      return next;
    });
    const existingIdx = groups.findIndex(g => g.label === currentLabel);
    if (existingIdx === -1) {
      setGroups(prev => [...prev, { label: currentLabel, color, wells: [...selectedWells] }]);
    } else {
      setGroups(prev => prev.map((g, i) => i === existingIdx
        ? { ...g, wells: [...new Set([...g.wells, ...selectedWells])] }
        : g
      ));
    }
    setSelectedWells(new Set());
    setCurrentLabel('');
    if (!useCustomColor) setCurrentColor(prev => prev + 1);
  }

  function clearAll() {
    setWellData({});
    setSelectedWells(new Set());
    setGroups([]);
    setCurrentColor(0);
  }

  function selectRow(r) {
    setSelectedWells(prev => {
      const next = new Set(prev);
      for (let c = 0; c < config.cols; c++) next.add(wellKey(r, c));
      return next;
    });
  }

  function selectCol(c) {
    setSelectedWells(prev => {
      const next = new Set(prev);
      for (let r = 0; r < config.rows; r++) next.add(wellKey(r, c));
      return next;
    });
  }

  // ═══════════════════════════════════════════════
  // TEMPLATE SYSTEM
  // ═══════════════════════════════════════════════

  const [templateDialog, setTemplateDialog] = useState(null);
  const [templateParams, setTemplateParams] = useState({});

  function openTemplate(type) {
    const defaults = {
      serial: { startConc: '100', factor: '2', direction: 'row', replicates: '1' },
      checkerboard: { label1: 'Treatment', label2: 'Control', replicates: '1' },
      dose: { drugs: '3', startConc: '100', dilFactor: '3', replicates: '1' },
      control: {},
      antibody: { antibodies: '3', startConc: '100', dilFactor: '2' },
    };
    setTemplateParams(defaults[type]);
    setTemplateDialog(type);
  }

  function updateParam(key, val) {
    setTemplateParams(prev => ({ ...prev, [key]: val }));
  }

  function confirmTemplate() {
    if (templateDialog === 'serial') applySerialDilution();
    else if (templateDialog === 'checkerboard') applyCheckerboard();
    else if (templateDialog === 'dose') applyDoseResponse();
    else if (templateDialog === 'control') applyControlLayout();
    else if (templateDialog === 'antibody') applyAntibodyTitration();
    setTemplateDialog(null);
  }

  // --- Serial dilution template with replicates ---
  function applySerialDilution() {
    const startConc = templateParams.startConc;
    const factor = templateParams.factor;
    const direction = templateParams.direction;
    const reps = Math.max(1, Math.min(4, +(templateParams.replicates || 1)));
    if (!startConc || !factor) return;

    const newData = {};
    const newGroups = [];
    let conc = +startConc;
    const f = +factor;

    if (direction === 'row') {
      const steps = config.cols;
      const rowsPerStep = reps;
      for (let c = 0; c < steps; c++) {
        const label = conc >= 1 ? conc.toFixed(1) : conc.toExponential(1);
        const color = WELL_COLORS[c % WELL_COLORS.length];
        const wells = [];
        for (let rep = 0; rep < rowsPerStep && rep < config.rows; rep++) {
          for (let r = rep; r < config.rows; r += Math.max(1, Math.floor(config.rows / rowsPerStep))) {
            if (wells.length >= config.rows) break;
          }
        }
        for (let r = 0; r < Math.min(reps, config.rows); r++) {
          const key = wellKey(r, c);
          newData[key] = { color, label };
          wells.push(key);
        }
        if (reps === 1) {
          for (let r = 0; r < config.rows; r++) {
            const key = wellKey(r, c);
            newData[key] = { color, label };
            if (!wells.includes(key)) wells.push(key);
          }
        }
        newGroups.push({ label, color, wells });
        conc /= f;
      }
    } else {
      const steps = config.rows;
      for (let r = 0; r < steps; r++) {
        const label = conc >= 1 ? conc.toFixed(1) : conc.toExponential(1);
        const color = WELL_COLORS[r % WELL_COLORS.length];
        const wells = [];
        const colCount = reps === 1 ? config.cols : Math.min(reps, config.cols);
        for (let c = 0; c < colCount; c++) {
          const key = wellKey(r, c);
          newData[key] = { color, label };
          wells.push(key);
        }
        newGroups.push({ label, color, wells });
        conc /= f;
      }
    }

    setWellData(newData);
    setGroups(newGroups);
    setSelectedWells(new Set());
  }

  // --- Checkerboard template with replicates ---
  function applyCheckerboard() {
    const label1 = templateParams.label1;
    const label2 = templateParams.label2;
    const reps = Math.max(1, Math.min(4, +(templateParams.replicates || 1)));
    if (!label1 || !label2) return;
    const newData = {};
    const wells1 = [], wells2 = [];
    for (let r = 0; r < config.rows; r++) {
      for (let c = 0; c < config.cols; c++) {
        const key = wellKey(r, c);
        const blockR = Math.floor(r / reps);
        const blockC = Math.floor(c / reps);
        if ((blockR + blockC) % 2 === 0) {
          newData[key] = { color: WELL_COLORS[0], label: label1 };
          wells1.push(key);
        } else {
          newData[key] = { color: WELL_COLORS[1], label: label2 };
          wells2.push(key);
        }
      }
    }
    setWellData(newData);
    setGroups([
      { label: label1, color: WELL_COLORS[0], wells: wells1 },
      { label: label2, color: WELL_COLORS[1], wells: wells2 },
    ]);
  }

  // --- Dose-response template with replicates ---
  function applyDoseResponse() {
    const drugs = templateParams.drugs;
    const startConc = templateParams.startConc;
    const dilFactor = templateParams.dilFactor;
    const reps = Math.max(1, Math.min(4, +(templateParams.replicates || 1)));
    if (!drugs || !startConc || !dilFactor) return;
    const nDrugs = Math.min(+drugs, Math.floor(config.rows / reps));
    const newData = {};
    const newGroups = [];

    for (let d = 0; d < nDrugs; d++) {
      let conc = +startConc;
      const color = WELL_COLORS[d % WELL_COLORS.length];
      const drugLabel = `Drug ${d + 1}`;
      const wells = [];

      for (let c = 0; c < config.cols; c++) {
        const label = conc >= 1 ? conc.toFixed(1) : conc.toExponential(1);
        for (let rep = 0; rep < reps; rep++) {
          const r = d * reps + rep;
          if (r >= config.rows) break;
          const key = wellKey(r, c);
          newData[key] = { color, label };
          wells.push(key);
        }
        conc /= +dilFactor;
      }
      newGroups.push({ label: drugLabel, color, wells });
    }

    setWellData(newData);
    setGroups(newGroups);
  }

  // --- Control Layout template ---
  function applyControlLayout() {
    const newData = {};
    const posWells = [], negWells = [], blankWells = [];
    const posColor = WELL_COLORS[2]; // green
    const negColor = WELL_COLORS[1]; // red
    const blankColor = WELL_COLORS[6]; // cyan

    // Last column: positive controls (top half), negative controls (bottom half)
    const lastCol = config.cols - 1;
    const midRow = Math.floor(config.rows / 2);
    for (let r = 0; r < config.rows; r++) {
      const key = wellKey(r, lastCol);
      if (r < midRow) {
        newData[key] = { color: posColor, label: t('platePosCtrl', lang) };
        posWells.push(key);
      } else {
        newData[key] = { color: negColor, label: t('plateNegCtrl', lang) };
        negWells.push(key);
      }
    }
    // First column: blanks
    for (let r = 0; r < config.rows; r++) {
      const key = wellKey(r, 0);
      newData[key] = { color: blankColor, label: t('plateBlank', lang) };
      blankWells.push(key);
    }

    setWellData(newData);
    setGroups([
      { label: t('platePosCtrl', lang), color: posColor, wells: posWells },
      { label: t('plateNegCtrl', lang), color: negColor, wells: negWells },
      { label: t('plateBlank', lang), color: blankColor, wells: blankWells },
    ]);
  }

  // --- Antibody Titration template ---
  function applyAntibodyTitration() {
    const nAb = Math.min(+(templateParams.antibodies || 3), config.rows);
    const startConc = +(templateParams.startConc || 100);
    const dilFactor = +(templateParams.dilFactor || 2);
    const newData = {};
    const newGroups = [];

    for (let ab = 0; ab < nAb; ab++) {
      let conc = startConc;
      const color = WELL_COLORS[ab % WELL_COLORS.length];
      const abLabel = `Ab ${ab + 1}`;
      const wells = [];

      for (let c = 0; c < config.cols; c++) {
        const key = wellKey(ab, c);
        const label = conc >= 1 ? conc.toFixed(1) : conc.toExponential(1);
        newData[key] = { color, label };
        wells.push(key);
        conc /= dilFactor;
      }
      newGroups.push({ label: abLabel, color, wells });
    }

    setWellData(newData);
    setGroups(newGroups);
  }

  // ═══════════════════════════════════════════════
  // PLATE GRID RENDERER (shared between normal and enlarged views)
  // ═══════════════════════════════════════════════

  function renderPlateGrid(wellSizeOverride) {
    const ws = wellSizeOverride || config.wellSize;
    const fs = wellSizeOverride ? (wellSizeOverride > 28 ? 10 : wellSizeOverride > 18 ? 8 : 6) : (plateType > 96 ? 6 : plateType > 48 ? 7 : 9);
    return (
      <div>
        <div className="flex items-center gap-0.5 mb-1 ml-6">
          {Array.from({length: config.cols}, (_, c) => (
            <div key={c} onClick={() => selectCol(c)}
              className="text-center text-[10px] mono text-gray-400 cursor-pointer hover:text-primary font-bold"
              style={{width: ws, minWidth: ws}}>
              {c + 1}
            </div>
          ))}
        </div>
        {Array.from({length: config.rows}, (_, r) => (
          <div key={r} className="flex items-center gap-0.5 mb-0.5">
            <div onClick={() => selectRow(r)}
              className="w-5 text-right text-[10px] mono text-gray-400 cursor-pointer hover:text-primary font-bold mr-1">
              {ROW_LABELS[r]}
            </div>
            {Array.from({length: config.cols}, (_, c) => {
              const key = wellKey(r, c);
              const data = wellData[key];
              const isSel = selectedWells.has(key);
              return (
                <div key={c}
                  className={`well ${isSel ? 'selected' : ''}`}
                  style={{
                    width: ws, height: ws, minWidth: ws,
                    background: data ? data.color + '30' : '#f9fafb',
                    borderColor: data ? data.color : '#d1d5db',
                    borderWidth: data ? 2 : 1,
                    fontSize: fs,
                  }}
                  onMouseDown={e => handleMouseDown(r, c, e)}
                  onMouseEnter={() => handleMouseEnter(r, c)}
                  title={key + (data ? ': ' + data.label : '')}>
                  {ws >= 22 && data && (
                    <span className="truncate px-0.5" style={{color: data.color, fontWeight: 700}}>
                      {data.label.length > 5 ? data.label.slice(0,4)+'…' : data.label}
                    </span>
                  )}
                  {ws >= 22 && !data && (
                    <span className="text-gray-300">{key}</span>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // LEGEND RENDERER
  // ═══════════════════════════════════════════════

  function renderLegend() {
    if (groups.length === 0) return null;
    return (
      <div>
        <h4 className="text-sm font-bold mb-2">{t('plateLegend', lang)}</h4>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {groups.map((g, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{background: g.color}} />
              <span className="font-medium">{g.label}</span>
              <span className="text-gray-400 mono">({g.wells.length})</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════

  return (
    <div className="fade-in">
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl font-bold mb-1">{t('plateTitle', lang)}</h2>
            <p className="text-sm" style={S_MUTED}>{t('plateSubtitle', lang)}</p>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold" style={S_MUTED}>{t('plateType', lang)}:</label>
            <select value={plateType} onChange={e => setPlateType(+e.target.value)} className="w-28">
              {Object.keys(PLATE_CONFIGS).map(k => (
                <option key={k} value={k}>{k}-well</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        <div className="xl:col-span-3">
          <div className="card p-5 overflow-x-auto">
            {renderPlateGrid()}
          </div>

          {/* Legend alongside plate */}
          {groups.length > 0 && (
            <div className="card p-4 mt-3">
              {renderLegend()}
            </div>
          )}

          {/* Plate View / Table View toggle */}
          {Object.keys(wellData).length > 0 && (
            <PlateTableView wellData={wellData} config={config} lang={lang} />
          )}
        </div>

        <div className="space-y-4">
          {/* Assign panel */}
          <div className="card p-4">
            <h4 className="text-sm font-bold mb-3">{t('plateMarkTitle', lang)}</h4>
            <p className="text-xs mb-3" style={S_MUTED}>
              {t('plateSelected', lang)}: <span className="mono font-bold" style={{color:'var(--accent)'}}>{selectedWells.size}</span> {t('wells', lang)}
              {selectedWells.size > 0 && <span className="ml-1">({[...selectedWells].slice(0,6).join(', ')}{selectedWells.size > 6 ? '...' : ''})</span>}
            </p>
            <div className="mb-3">
              <label className="text-xs font-semibold block mb-1" style={S_MUTED}>{t('plateLabelName', lang)}</label>
              <input type="text" value={currentLabel} onChange={e => setCurrentLabel(e.target.value)}
                placeholder="e.g. 10 µM Drug A" style={{ fontFamily: "'DM Sans', sans-serif" }} />
            </div>
            <div className="mb-3">
              <label className="text-xs font-semibold block mb-1.5" style={S_MUTED}>{t('color', lang)}</label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {WELL_COLORS.map((c, i) => (
                  <button key={i} onClick={() => { setCurrentColor(i); setUseCustomColor(false); }}
                    className={`w-5 h-5 rounded-full border-2 transition-transform ${!useCustomColor && currentColor === i ? 'scale-125 ring-2 ring-offset-1' : ''}`}
                    style={{background: c, borderColor: !useCustomColor && currentColor === i ? 'var(--text)' : 'transparent', ringColor: 'var(--primary)'}} />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-semibold" style={S_MUTED}>{t('plateCustomColor', lang)}:</label>
                <input type="color" value={customColor} onChange={e => { setCustomColor(e.target.value); setUseCustomColor(true); }}
                  className="w-7 h-7 rounded cursor-pointer border-0 p-0" style={{background:'transparent'}} />
                {useCustomColor && (
                  <div className="w-5 h-5 rounded-full border-2 scale-125" style={{background: customColor, borderColor: 'var(--text)'}} />
                )}
              </div>
            </div>
            <button onClick={assignSelected} className="btn-primary w-full" disabled={!selectedWells.size || !currentLabel}>
              {t('plateConfirm', lang)}
            </button>
          </div>

          {/* Templates */}
          <div className="card p-4">
            <h4 className="text-sm font-bold mb-3">{t('plateTemplates', lang)}</h4>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => openTemplate('serial')} className="btn-secondary text-xs py-2 px-2">
                {t('plateSerial', lang)}
              </button>
              <button onClick={() => openTemplate('dose')} className="btn-secondary text-xs py-2 px-2">
                {t('plateDose', lang)}
              </button>
              <button onClick={() => openTemplate('checkerboard')} className="btn-secondary text-xs py-2 px-2">
                {t('plateCheckerboard', lang)}
              </button>
              <button onClick={() => openTemplate('control')} className="btn-secondary text-xs py-2 px-2">
                {t('plateControlLayout', lang)}
              </button>
              <button onClick={() => openTemplate('antibody')} className="btn-secondary text-xs py-2 px-2 col-span-2">
                {t('plateAntibodyTitration', lang)}
              </button>
            </div>
            <button onClick={clearAll} className="w-full text-sm px-4 py-2 mt-2 rounded-lg border font-semibold transition-colors"
              style={{borderColor:'var(--border)', color:'var(--text-muted)'}}>
              {t('plateClear', lang)}
            </button>

            {/* Inline template config */}
            {templateDialog && (
              <div className="mt-3 p-3 rounded-lg border fade-in" style={{background:'var(--bg-2)', borderColor:'var(--primary)'}}>
                <h5 className="text-xs font-bold mb-2" style={S_PRIMARY}>
                  {templateDialog === 'serial' ? t('plateSerial', lang) :
                   templateDialog === 'dose' ? t('plateDose', lang) :
                   templateDialog === 'checkerboard' ? t('plateCheckerboard', lang) :
                   templateDialog === 'control' ? t('plateControlLayout', lang) :
                   t('plateAntibodyTitration', lang)}
                </h5>
                <div className="space-y-2">
                  {templateDialog === 'serial' && (<>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>{t('serialStartConc', lang)}</label>
                      <input type="text" value={templateParams.startConc} onChange={e => updateParam('startConc', e.target.value)} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>{t('serialFactor', lang)}</label>
                      <input type="text" value={templateParams.factor} onChange={e => updateParam('factor', e.target.value)} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>
                        {lang === 'en' ? 'Direction' : '方向'}
                      </label>
                      <div className="flex gap-2">
                        <button onClick={() => updateParam('direction', 'row')}
                          className="flex-1 px-2 py-1 rounded text-xs font-semibold"
                          style={{background: templateParams.direction === 'row' ? 'var(--primary)' : 'var(--card)', color: templateParams.direction === 'row' ? 'white' : 'var(--text-muted)', border:'1px solid var(--border)'}}>
                          → {lang === 'en' ? 'Row' : '沿行'}
                        </button>
                        <button onClick={() => updateParam('direction', 'col')}
                          className="flex-1 px-2 py-1 rounded text-xs font-semibold"
                          style={{background: templateParams.direction === 'col' ? 'var(--primary)' : 'var(--card)', color: templateParams.direction === 'col' ? 'white' : 'var(--text-muted)', border:'1px solid var(--border)'}}>
                          ↓ {lang === 'en' ? 'Column' : '沿列'}
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>{t('plateReplicates', lang)}</label>
                      <select value={templateParams.replicates} onChange={e => updateParam('replicates', e.target.value)} className="w-full text-sm">
                        <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                      </select>
                    </div>
                  </>)}
                  {templateDialog === 'checkerboard' && (<>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>
                        {lang === 'en' ? 'Label 1' : '标签 1'}
                      </label>
                      <input type="text" value={templateParams.label1} onChange={e => updateParam('label1', e.target.value)} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>
                        {lang === 'en' ? 'Label 2' : '标签 2'}
                      </label>
                      <input type="text" value={templateParams.label2} onChange={e => updateParam('label2', e.target.value)} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>{t('plateReplicates', lang)}</label>
                      <select value={templateParams.replicates} onChange={e => updateParam('replicates', e.target.value)} className="w-full text-sm">
                        <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                      </select>
                    </div>
                  </>)}
                  {templateDialog === 'dose' && (<>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>{t('doseNumDrugs', lang)}</label>
                      <input type="number" value={templateParams.drugs} onChange={e => updateParam('drugs', e.target.value)} min={1} max={config.rows} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>{t('serialStartConc', lang)}</label>
                      <input type="text" value={templateParams.startConc} onChange={e => updateParam('startConc', e.target.value)} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>{t('serialFactor', lang)}</label>
                      <input type="text" value={templateParams.dilFactor} onChange={e => updateParam('dilFactor', e.target.value)} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>{t('plateReplicates', lang)}</label>
                      <select value={templateParams.replicates} onChange={e => updateParam('replicates', e.target.value)} className="w-full text-sm">
                        <option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4</option>
                      </select>
                    </div>
                  </>)}
                  {templateDialog === 'control' && (
                    <p className="text-[11px]" style={S_MUTED}>
                      {lang === 'en'
                        ? 'Places positive controls (top half of last column), negative controls (bottom half of last column), and blanks (first column).'
                        : '在最后一列上半部分放置阳性对照，下半部分放置阴性对照，第一列放置空白。'}
                    </p>
                  )}
                  {templateDialog === 'antibody' && (<>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>{t('plateNumAntibodies', lang)}</label>
                      <input type="number" value={templateParams.antibodies} onChange={e => updateParam('antibodies', e.target.value)} min={1} max={config.rows} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>{t('serialStartConc', lang)}</label>
                      <input type="text" value={templateParams.startConc} onChange={e => updateParam('startConc', e.target.value)} className="w-full text-sm" />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold block mb-0.5" style={S_MUTED}>{t('serialFactor', lang)}</label>
                      <input type="text" value={templateParams.dilFactor} onChange={e => updateParam('dilFactor', e.target.value)} className="w-full text-sm" />
                    </div>
                  </>)}
                  <div className="flex gap-2 mt-2">
                    <button onClick={confirmTemplate} className="btn-primary flex-1 text-sm py-1.5">
                      {lang === 'en' ? 'Apply' : '应用'}
                    </button>
                    <button onClick={() => setTemplateDialog(null)} className="btn-secondary flex-1 text-sm py-1.5">
                      {lang === 'en' ? 'Cancel' : '取消'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Export */}
          <div className="card p-4">
            <h4 className="text-sm font-bold mb-3">{t('plateExport', lang)}</h4>
            <div className="space-y-2">
              
              <DownloadBtn small label={t('downloadCSV', lang)}
                onClick={() => downloadFile(`plate_${plateType}well.csv`, plateToCSV(wellData, config), 'text/csv')} />
              <DownloadBtn small label={t('downloadSVG', lang)} icon=""
                onClick={() => downloadFile(`plate_${plateType}well.svg`, plateToSVG(wellData, config, groups), 'image/svg+xml')} />
              <DownloadBtn small label={t('copyLayout', lang)}
                onClick={() => {
                  let txt = `${plateType}-well Plate Layout\n${'─'.repeat(40)}\n`;
                  groups.forEach(g => { txt += `■ ${g.label}: ${g.wells.join(', ')}\n`; });
                  if (groups.length === 0) txt += '(empty)\n';
                  navigator.clipboard.writeText(txt);
                  toast.show(t('copied', lang));
                }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlateTab;
