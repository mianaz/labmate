# Labmate App — Implementation Tasks

Source: Miana's audit, 2026-03-18

## Phase 1: Quick Fixes

### 1. ✅ Favicon Update
- Files extracted from `/home/ubuntu/files.zip` → `public/`
- Update `index.html` `<head>` to reference: favicon.ico, favicon.svg, favicon-16x16.png, favicon-32x32.png, apple-touch-icon.png, site.webmanifest
- Also update the standalone root `index.html` if needed

### 6. Calculator Titles
- **Current**: Sidebar shows task descriptions like "I need to dilute a stock solution"
- **Target**: Clean titles like "Dilution Calculator", "Mass Calculator", "Molarity Calculator"
- Files: `src/features/calculator/CalcTab.tsx` 
- Also make titles bigger in the sidebar

### 9. Rename External Tools
- Change "External Tools & BioinfoSpace Apps" → "Useful Links"
- Move data export/import section to Guide tab (refs tab) at the top
- Files: `src/features/tools/ToolsTab.tsx`, `src/features/refs/RefsTab.tsx`

### 12. Quick Timer Overflow
- The "Start" button overflows the outer box in the quick timer popup
- Fix: Check the fixed-position timer popup layout, ensure button stays within bounds
- Files: Root `index.html` (QuickTimerButton component) or equivalent in React version

## Phase 2: Medium Tasks

### 5. Sidebar Hide + Fullscreen Mode
- Add a toggle to hide the sidebar and view recipe/protocol in fullscreen
- Should work on both buffers and protocols tabs
- Files: `src/features/buffers/BuffersTab.tsx`, `src/features/protocols/ProtocolsTab.tsx`

### 10. Cloud Sync — Disable PAT
- Remove PAT (Personal Access Token) paste UI
- Write a plan/comment for future Google Drive OAuth or GitHub OAuth integration
- Files: `src/lib/syncService.ts`, any settings UI

### 11. Inventory Dashboard
- Show stats dashboard first (total samples, by type, by location, occupancy)
- Provide buttons to navigate into individual locations/boxes
- Files: `src/features/inventory/InventoryTab.tsx`

## Phase 3: Major Features

### 2. Recipe Syncing from GitHub
- Enable syncing with github.com/mianaz/labmate-recipe
- Current sync: reads from `/db/recipes-v1.json` (local)
- Target: fetch from GitHub raw URL, merge with local IndexedDB
- Files: `src/lib/syncService.ts`

### 3. Buffer Schema Standardization
Standard components for each buffer:
1. Name + full name
2. One-liner explanation of usage
3. "Used in" with protocol cross-links
4. Storage conditions (temp, time, autoclave/sterile filter)
5. Target volume (default based on general usage)
6. Components table (reagent, concentration/MW, amount, unit)
7. Preparation steps
8. References
9. Download into readable format (txt)
10. Category labels (molecular, cell, protein, RNA/DNA, other, general) with filtering

Current categories: all, favorites, my recipes, buffer, staining, media → REPLACE with science-based categories

**Remove protocols from buffers** (e.g., Silver Stain is a staining protocol, not a buffer)

Files: 
- Schema: `/home/ubuntu/.openclaw/workspace-webdev/labmate-recipes/schema.json`
- Recipe JSONs: `/home/ubuntu/.openclaw/workspace-webdev/labmate-recipes/recipes/`
- App rendering: `src/features/buffers/BuffersTab.tsx`, `src/data/buffer-enhancements.ts`

### 4. Protocol Schema Standardization
Standard components for each protocol:
1. One-line introduction
2. Duration of experiment (hours/days) — fix TRIzol showing RNA at -80 as duration
3. Materials with crosslink to buffer recipes
4. Remove brief steps, keep ONLY detailed step-by-step with progress tracker
5. Detailed steps include:
   a. Day-to-day titles ("Day 1: Sample Prep")
   b. Numbered steps with checkboxes + inline timers
   c. For variable time ranges (15-30 min), use slider (default: lower end)
   d. Cross-links with related protocols (e.g., BCA in WB)
   e. Clear mark optional steps
   f. Safe stopping points (e.g., "protein sample at -20°C")
   g. References
   h. Download to readable files
   i. Export to publication-ready methods template

Files:
- Schema: same recipes repo
- App rendering: `src/features/protocols/ProtocolsTab.tsx`, `src/data/protocol-enhancements.ts`

### 7. MW Calculator + Periodic Table
- Add molecular weight calculator
- Add interactive periodic table (element lookup, MW calculation from formula)
- Files: `src/features/calculator/CalcTab.tsx` (add new calc modes)

### 8. Plate Designer Overhaul
- Redesign buttons (current style issues)
- Add more color selectors (currently 15 colors)
- Quick templates: add replicates option, more templates
- "Enlarge Plate" for detailed well view
- Put legends alongside plate (not just in sidebar)
- Files: `src/features/plate/PlateTab.tsx`

## Repos
- **App**: `/home/ubuntu/.openclaw/workspace-pm/labmate-repo` (React/Vite/Tailwind v4)
- **Recipes**: `/home/ubuntu/.openclaw/workspace-webdev/labmate-recipes` (JSON)
- **Tech stack**: React 19, Vite, Tailwind CSS v4, Dexie (IndexedDB), react-router-dom, i18next
- **No external component library** — all custom components with CSS variables
