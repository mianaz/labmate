# Changelog

All notable changes to LabMate will be documented in this file.

## [2.1.0] - 2026-04-13

### Added
- Experiment Notebook tab — structured lab records with protocol import, materials, procedure, results
- Experiment Calendar tab — monthly/weekly views, .ics export, status tracking
- Link to main bioinfospace.com site in header and footer
- "What's New" section in Guide tab
- Dark mode support for backup reminder banner
- Shared backup module (`src/lib/backup.js`) — single source of truth for export/import

### Fixed
- Discipline filter now works (deployed 215 recipes with discipline tags)
- GitHub Actions deploy pipeline — pinned `ssh-deploy` to v4
- Hardcoded version `v0.1.0` in exports replaced with dynamic `__APP_VERSION__`
- Backup reminder renders correctly in dark mode (uses CSS variables)

### Changed
- Production now serves Vite build (was still old 8800-line monolith)
- Hashed assets get immutable 1-year cache via nginx
- OnboardingModal converted from React.createElement to JSX
- Removed labmate-dev staging environment (single canonical `/labmate/` URL)

### Removed
- Legacy `vendor/` CDN libs (babel, react, tailwind) — bundled by Vite
- 13 `index.html.bak.*` deployment artifacts from repo
- Empty icon spans in nav tabs and corresponding CSS hide rule
- `dist-preview/` build artifacts from repo

## [2.0.0] - 2026-04-01

### Changed
- Complete rewrite: monolith decomposed into 52 React modules
- Migrated from CDN React 18 + Babel to Vite 6 + React 19 + Tailwind CSS v4
- Data storage migrated from localStorage-only to IndexedDB (Dexie) with localStorage fallback
- Service worker updated for Vite hashed assets
- CI/CD via GitHub Actions (lint, build, test on push; deploy on merge to main)

### Added
- 215 recipes (up from 159): 97 buffers, 99 protocols, 11 media, 8 staining
- Discipline-based filtering (Protein, Cell Biology, Molecular, RNA/DNA, Immunology, Microbiology, Genomics)
- MW Calculator and Interactive Periodic Table
- Dead Volume Calculator and Percent Solution Calculator
- 77 calculator unit tests (Vitest)
- Recipe syncing from GitHub (mianaz/labmate-recipes)
- Cross-navigation between related recipes and protocols
- Sidebar hide/fullscreen mode for buffers and protocols
- Global search (Cmd+K / Ctrl+K)
- Bilingual onboarding tour (6 slides)
- Auto-backup reminder (7-day threshold)
- Code splitting with React.lazy for 5 tabs + 2 modals

## [0.1.0] - 2026-03-18

### Added
- Initial release — single HTML file (~8800 lines)
- React 18 via CDN with Babel runtime compilation
- Buffers & Recipes tab (50+ formulas)
- Protocols tab with step tracking
- Calculator (Dilution, Mass, Molarity)
- SDS-PAGE Gel Calculator
- Plate Designer (6, 12, 24, 48, 96-well)
- Sample Inventory with storage tree and box grids
- Tools tab with external bioinformatics links
- Guide tab with export/import
- Bilingual interface (EN/ZH)
- localStorage-based data persistence
