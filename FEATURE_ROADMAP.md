# LabMate Feature Roadmap — Action Plan
**Drafted:** 2026-04-13 · **Reviewed:** 2026-07-05  
**Status:** Partially shipped — **Phase 1.1 (Plate Reader CSV → long format) is DONE** (`src/features/plate/plateReaderParser.js` + the "Reader Import" tab + tests). Items 1.2/1.3 and Phase 2 remain open.  
**Related:** the LLM-agent workstream is specced separately in [`docs/AGENT-PLAN.md`](docs/AGENT-PLAN.md); this file covers the *data-processing* tools (plots, densitometry, methods/Obsidian export). Keep the two in sync.  
**Target:** Free-tier + student budget

---

## Vision

LabMate evolves from **protocol lookup tool** → **researcher's daily lab OS**: protocols, calculations, sample tracking, notebook, data processing, and publication-ready export — all in one workflow.

---

## Phase 1 — Immediate (Pure Frontend, No Server)

### 1.1 Plate Reader CSV → Long Format Converter

**What it does:** Drag-and-drop a plate reader CSV export → parsed, transformed, downloadable as tidy long-format CSV.

**UI Flow:**
1. New tab: "Data Import" (or sub-section under Tools)
2. Drag-drop zone for CSV files
3. Auto-detect format (common: Tecan Spark, BioTek, SpectraMax)
4. Preview table with detected columns
5. Map columns: well → row/col, sample_name, condition, value, date
6. Output: long-format CSV + mini heatmap preview
7. Option to save directly to notebook entry

**Spec details:**
- Accept .csv, .tsv, .xlsx (SheetJS for xlsx)
- Plate layout auto-detection: detect 96/384-well from row count
- Output columns: `experiment_id, date, well, row, col, sample_name, condition, replicate, value, unit`
- Replicate numbering auto-assigned
- Download as `.csv` or save to IndexedDB

**Complexity:** Low  
**Backend needed:** No  
**Time estimate:** 1–2 days

---

### 1.2 Quick Plot Generator

**What it does:** Paste tabular data → interactive chart → export PNG/SVG.

**UI Flow:**
1. New tab: "Plot" or "Charts"
2. Textarea: paste from Excel/Sheets
3. Auto-parse into table (tab/comma separated)
4. Chart type selector: bar, scatter, line, box-plot
5. Axis mapping: drag columns to X / Y / Group / Color
6. Customize: title, axis labels, legend position, colors
7. Export: PNG (2x resolution), SVG, or copy to clipboard
8. Optional: save plot config to notebook entry (reproducibility)

**Spec details:**
- Chart.js for rendering
- Support for: bar, grouped bar, line, scatter, dot-plot
- Grouped/bar colors from a consistent scientific palette (ColorBrewer or similar)
- Error bar support (paste mean ± SD as separate columns)
- One-sample, two-group, dose-response curve presets

**Complexity:** Low–Medium  
**Backend needed:** No  
**Time estimate:** 2–3 days

---

### 1.3 Obsidian / Notion Export

**What it does:** Export notebook entries as Markdown with YAML front-matter for Obsidian import.

**Spec details:**
- Front-matter fields:
  ```yaml
  ---
  date: 2026-04-13
  title: "Western Blot - Sample A vs B"
  protocol: Western Blot
  tags: [western-blot, experiment]
  samples: [Sample A, Sample B]
  conditions: [Control, Treated]
  linked_reagents: [Buffer A, Antibody X]
  ---
  ```
- Full entry as Markdown body
- Linked protocol referenced by name, opens in LabMate
- Export as single `.md` file or `.zip` of all entries
- Optional: Obsidian uri-link for direct navigation back to LabMate

**Complexity:** Low  
**Backend needed:** No  
**Time estimate:** 1 day

---

## Phase 2 — Server-Enabled (With Job Queue)

### 2.1 Western Blot Densitometry Tool

**What it does:** Upload gel image → server processes with OpenCV → band intensity quantification → downloadable table + figure.

**Job Queue Design:**
- Redis or simple DB-backed queue (labmate_jobs table)
- One active job per user at a time
- Job states: `queued` → `processing` → `done` / `failed`
- Client polls every 2–3s for job status
- Auto-cleanup after 1 hour

**Densitometry Pipeline (server-side):**
1. Upload image → save to temp storage
2. OpenCV: convert to grayscale, invert if needed
3. Lane detection: find vertical lanes automatically
4. Band detection per lane: peak detection on lane profile
5. Background subtraction (rolling ball or mean of lane edges)
6. Band intensity integration: area under peak
7. Relative quantification: band / loading control (select a housekeeping band)
8. Output: CSV table (band, MW_estimate, intensity, relative_intensity)

**UI Flow:**
1. Upload gel image
2. Preview with auto-detected lanes overlaid
3. User confirms/corrects lane boundaries
4. User labels lanes (Sample A, Sample B, Ladder)
5. User marks housekeeping band for normalization
6. Submit job → polling → results
7. Download: CSV, annotated PNG figure

**Complexity:** Medium–High  
**Backend needed:** Yes ($5–10/mo server, OpenCV)  
**Time estimate:** 5–7 days

---

### 2.2 WB Image Annotation Tool (Canvas Overlay)

**What it does:** Overlay editor on top of gel image for labeling, cropping, adding scale bars.

**Tools:**
| Tool | Behavior |
|---|---|
| Text | Click to place label, type text, style (bold/italic/size) |
| Arrow | Click-drag to draw arrow |
| Box/Rectangle | Highlight region of interest |
| Crop | Draw crop region, confirm |
| Ladder label | Click on ladder bands, auto-label by size (if ladder template provided) |
| Scale bar | Drag to place scale bar, input size |

**Spec details:**
- HTML5 Canvas layered over `<img>`
- Undo/redo stack
- Export: PNG with annotations burned in (for publication)
- Non-destructive: annotation data stored separately in JSON, can re-edit
- Dark mode aware (labels visible on both light and dark gels)

**Complexity:** Medium  
**Backend needed:** No (pure frontend)  
**Time estimate:** 3–4 days

---

### 2.3 Protocol-to-Methods Template Export

**What it does:** Browse protocol → Fill in specific values → Export as structured template for methods writing.

**Template Structure (per protocol type):**

```markdown
## Reagents & Materials
- Primary antibody: ___________ (Catalog: ___________)
  - Dilution: 1:___________ in ___________
  - Incubation: ___________ °C for ___________
- Secondary antibody: ___________ (Catalog: ___________)
  - Dilution: 1:___________ in ___________
- Blocking buffer: ___________
- Wash buffer: ___________
- Sample preparation: ___________

## Equipment
- Gel apparatus: ___________
- Transfer system: ___________
- Imaging system: ___________

## Procedure
1. [Step 1 — template fills in user values]
2. [Step 2]
...

## Critical Parameters
- Gel percentage: ___________%
- Running conditions: ___________ V, ___________ min
- Transfer conditions: ___________ V, ___________ min, ___________ °C
- Primary incubation: ___________ °C, ___________
- Secondary incubation: ___________ °C, ___________
- Wash steps: ___________ × ___________ min

## Notes
[Free text field for researcher to add tips/warnings]
```

**UI Flow:**
1. Open any protocol recipe → "Export Method Template" button
2. Modal opens with pre-filled template
3. Blank fields highlighted, researcher fills in
4. Preview rendered methods section
5. Export as: `.docx` (with proper formatting) or `.md`

**Spec details:**
- Template system: each protocol recipe has an associated `methodTemplate` field (JSON structure)
- Templates stored in the recipe DB
- Variable substitution: `[VARIABLE_NAME]` → user fills
- Output: docx using docx.js (frontend, no server needed)
- Citation line always included: "Protocol adapted from [Name], LabMate Recipe #[ID]"

**Complexity:** Medium  
**Backend needed:** No (docx.js frontend)  
**Time estimate:** 3–4 days

---

## Implementation Order

| # | Feature | Phase | Days | Reason |
|---|---|---|---|---|
| 1 | Plate reader CSV → long format | 1 | 1–2 | Lowest effort, immediate utility, builds workflow habit |
| 2 | Quick plot generator | 1 | 2–3 | High daily use, solidifies "data processing hub" identity |
| 3 | Obsidian export | 1 | 1 | Quick win, leverages existing notebook feature |
| 4 | WB annotation tool (canvas) | 2 | 3–4 | Pure frontend, no server dependency |
| 5 | WB densitometry (server) | 2 | 5–7 | Most complex, needs job queue + OpenCV |
| 6 | Protocol-to-methods export | 2 | 3–4 | High differentiation, uses existing recipe DB |

**Total estimated effort:** ~15–23 days

---

## Technical Notes

### Job Queue (for WB densitometry)
```sql
-- jobs table
id, user_id, status, input_path, output_path, error, created_at, updated_at
```

### Free Tier Options
- **Hugging Face Inference API** — free tier LLM calls (for future LLM features)
- **Google Cloud Vision** — 1,000 OCR calls/month free (for future notebook digitizer)
- **Modal.com** — free GPU credits for running VLMs
- **RunPod free tier** — GPU inference for image models

### Server Spec
- Current server at bioinfospace.com can handle Phase 2 features
- Add Redis for job queue (or use DB-backed queue to avoid extra infra)
- Estimated additional resource: ~1–2 GB RAM, 1 CPU core for OpenCV jobs

---

## Open Questions

- [ ] Should plot generator support statistical tests (t-test, ANOVA)? Adds significant complexity.
- [ ] Plate reader: which instrument formats to prioritize first? (Tecan, BioTek, SpectraMax?)
- [ ] WB annotation: allow saving annotation presets (e.g., "my standard crop + scale bar")?
- [ ] Protocol templates: who authors the templates? (You? Community contributions?)
- [ ] Methods export: which journal style guide to prioritize? (Nature, Cell, ACS?)

---

*Last updated: 2026-04-13*
