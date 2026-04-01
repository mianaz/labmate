# LabMate Refactor — Master Plan

Created: 2026-03-31  
Status: Phase 1-2 Complete

## Status: Phase 1-2 Complete ✅

**Completed 2026-03-31 to 2026-04-01:**
- Vite + React 19 scaffold with Tailwind v4 build-time
- CI/CD (GitHub Actions), ESLint, Prettier
- 77 calculator unit tests (Vitest)
- Data audit (159 → 215 recipes synced, discipline 100%)
- Full monolith decomposition (52 modules)
- Inventory createElement → JSX rewrite
- RecipeProvider context (no more globals)
- IndexedDB migration (Dexie) with localStorage fallback
- Backend API (PostgreSQL + Express, 215 recipes imported)
- Service worker updated for Vite hashed assets
- Code splitting (React.lazy for 5 tabs + 2 modals)
- Dev deployment at apps.bioinfospace.com/labmate-dev/

## Overview

Transform LabMate from a 7500-line monolith HTML file into a proper Vite + React production project.

---

## Phase 1: Foundation (Parallel — Now)

### Track A: Vite Project Scaffold
**Goal**: Create proper build infrastructure
- [x] Initialize Vite + React project (TypeScript optional, discuss with Miana)
- [x] Create package.json with all dependencies
- [x] Configure Tailwind CSS v4 with build-time purge (not CDN runtime)
- [x] Set up path aliases, dev server config
- [x] Move vendor libs (React, ReactDOM) to npm dependencies
- [x] Create initial folder structure:
  ```
  src/
    components/     # Shared UI components
    features/       # Feature modules (buffers, protocols, calc, plate, inventory, tools, refs)
    data/           # Static data (periodic table, gel formulas, plate configs)
    i18n/           # Translation strings
    hooks/          # Custom hooks (useLocalStorage, useFavorites, useToast)
    lib/            # Utilities (download, export, search)
    styles/         # CSS variables, global styles
    App.tsx
    main.tsx
  ```
- [x] Verify `npm run dev` and `npm run build` work with empty shell

### Track B: CI/CD + Testing
**Goal**: Automated quality gates
- [x] Create `.github/workflows/ci.yml` (lint, build, test on push/PR)
- [x] Create `.github/workflows/deploy.yml` (build + deploy to server on main push)
- [x] Set up Vitest + React Testing Library
- [x] Write initial test suite for calculators (pure logic, easy to test):
  - Dilution calculator (C1V1 = C2V2)
  - Mass calculator
  - Molarity calculator
  - Unit conversion
- [x] Add ESLint + Prettier config
- [x] Create `.env.example` with any needed env vars

### Track C: Data Audit & Normalization
**Goal**: Single source of truth for recipes
- [x] Audit recipes.json (159 entries) vs dist data discrepancy
- [x] Validate all recipes against schema.json
- [x] Check for missing fields per category:
  - Buffers: storage, prepSteps, discipline, usage
  - Protocols: materials, detailedSteps, safeStops, duration
- [x] Generate a data quality report
- [x] Fix any schema violations
- [x] Ensure recipes repo (mianaz/labmate-recipes) is the canonical source

---

## Phase 2: Monolith Decomposition (Sequential — After Phase 1)

### Step 1: Extract i18n
- [x] Move all `I = { ... }` translations to `src/i18n/translations.ts`
- [x] Create `useTranslation()` hook
- [x] ~200 translation entries

### Step 2: Extract Data Constants
- [x] Periodic table → `src/data/periodicTable.ts`
- [x] Gel formulas → `src/data/gelFormulas.ts`
- [x] Plate configs → `src/data/plateConfigs.ts`
- [x] Protocol subcategories → `src/data/protocolCategories.ts`

### Step 3: Extract Hooks
- [x] `useLocalStorage` → `src/hooks/useLocalStorage.ts`
- [x] `useFavorites` (FavProvider/FavContext) → `src/hooks/useFavorites.tsx`
- [x] `useToast` → `src/hooks/useToast.tsx`
- [x] `useTimer` (TimerProvider) → `src/hooks/useTimer.tsx`

### Step 4: Extract Components (feature by feature)
- [x] BuffersTab → `src/features/buffers/BuffersTab.tsx`
- [x] ProtocolsTab → `src/features/protocols/ProtocolsTab.tsx`
- [x] CalcTab (all calculators) → `src/features/calc/`
- [x] PlateTab → `src/features/plate/PlateTab.tsx`
- [x] InventoryTab → `src/features/inventory/InventoryTab.tsx` (rewrite from createElement to JSX)
- [x] ToolsTab → `src/features/tools/ToolsTab.tsx`
- [x] RefsTab → `src/features/refs/RefsTab.tsx`
- [x] Shared: Header, GlobalSearch, ErrorBoundary, OnboardingModal

### Step 5: PWA Update
- [x] Update service worker for Vite build (hashed assets)
- [x] Update manifest.json paths

---

## Phase 3: Quality & Monitoring (After Phase 2)

- [ ] Add Umami or Plausible analytics (privacy-friendly, self-hostable)
- [ ] Add Sentry error monitoring (free tier)
- [ ] Accessibility audit (axe-core) + fix critical issues
- [ ] Add user feedback button (GitHub Issues or simple form)
- [x] IndexedDB migration (Dexie) for custom recipes + inventory
- [ ] Cloud sync OAuth implementation (GitHub or Google)
- [ ] Version bumping + changelog generation

---

## Architecture Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Language | TypeScript (optional, can start with JS) | Type safety for 7500 lines |
| Build | Vite | Already in TASKS.md, fast HMR |
| CSS | Tailwind v4 (build-time) | Remove runtime CDN overhead |
| Testing | Vitest + RTL | Native Vite integration |
| State | React Context (keep current) | Working fine, no need to add Redux |
| Data | recipes.json (fetched) + IndexedDB (user data) | Separate concerns |
| Deploy | GitHub Actions → SSH/rsync to server | Reproducible, auditable |
