# BioInfoSpace LabMate — Product Plan

> **Last updated**: 2026-03-13 | **Current version**: v1.9 | **Status**: Pre-Phase 1 (single-file prototype live)

## Identity
- **Name**: BioInfoSpace LabMate
- **Repo**: `bioinfospace/labmate`
- **Tagline**: Your local-first lab companion — open, private, publication-ready
- **License**: MIT (maximizes adoption, lowers contribution barrier)

## Current Status (Prototype)
The single-file prototype (`index.html`) is live at `https://apps.bioinfospace.com/lab_toolkit/`.

| Metric | Value |
|--------|-------|
| Recipes/Buffers | 67+ (35 original + 17 DevBot + 8 CSH + ongoing) |
| Protocols | 13+ (8 original + 5 new with detailed steps) |
| Tabs | 6: Buffers, Protocols, Calculator, Plate Designer, Tools, References |
| File size | ~5600 lines, single HTML with React CDN |
| i18n | EN/ZH bilingual |
| Data sources | protocols.io API (connected, 28 fetched), CSH Recipes (8 verified), community |
| Tests | 13 automated checks via Puppeteer (12/13 passing) |
| Design system | DESIGN_GUIDE.md enforced |
| Agent workflow | PMBot (specs) → DevBot (implementation), cross-agent messaging enabled |

## Four Pillars

Every feature decision must pass through these filters:

| Pillar | Meaning | Test |
|--------|---------|------|
| **Open-Source** | MIT license, public repo, community-driven | "Can anyone fork, audit, and contribute?" |
| **Local-First** | Data lives on user's device; no server required | "Does this work with airplane mode on?" |
| **Easy to Use** | Zero-config start, no Docker, no CLI | "Can a wet-lab biologist use this in 5 minutes?" |
| **Secure** | Encryption at rest, 二选一 permission model, BYOK LLM | "If someone steals the laptop, is data safe?" |

**If a feature conflicts with any pillar, redesign or defer it.**

---

## Competitive Position

| | eLabFTW | SciNote | Benchling | protocols.io | **LabMate** |
|---|:---:|:---:|:---:|:---:|:---:|
| Open-source | ✅ | ⚠️ partial | ❌ | ❌ | ✅ |
| No server needed | ❌ | ❌ | ❌ | ❌ | ✅ |
| Works offline | ❌ | ❌ | ❌ | ❌ | ✅ |
| <10 min setup | ❌ Docker | ❌ Rails | ✅ SaaS | ✅ SaaS | ✅ |
| E2E encrypted | ❌ | ❌ | ❌ | ❌ | ✅ |
| Methods generator | ❌ | ❌ | ❌ | ❌ | ✅ |
| Figure planner | ❌ | ❌ | ❌ | ❌ | ✅ |
| Sample box mapper | ❌ | ⚠️ | ✅ | ❌ | ✅ |
| Install size | ~500MB+ | ~400MB+ | 0 (cloud) | 0 (cloud) | <10 MB |

**Unique selling points (no competitor has these):**
1. Local-first + encrypted — your data never touches a server
2. Methods section auto-generation from protocols
3. Figure plan with panel tracking
4. Single-binary desktop app <10 MB (Tauri) or zero-install PWA

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| UI Framework | React 18 + TypeScript | Ecosystem, hiring pool, Tauri compat |
| Build | Vite | Fast, simple, tree-shaking |
| Styling | TailwindCSS | Matches BioInfoSpace design system |
| Local DB | Dexie.js (IndexedDB) | Mature, typed, 0 server dependency |
| Rich Text | TipTap (ProseMirror) | Extensible, MIT, collaborative-ready |
| Encryption | Web Crypto API | Native browser, no dependencies |
| i18n | react-i18next | Industry standard, lazy-load locales |
| Desktop | Tauri 2 | <10 MB, system WebView, Rust security |
| Mobile (future) | Capacitor | Same React code → iOS/Android |

**Not using:** Electron (too heavy), Firebase (vendor lock-in), MongoDB (needs server), Next.js (SSR unnecessary for local-first).

---

## Architecture

```
┌─────────────────────────────────────┐
│  LabMate App (Browser or Tauri)     │
│                                     │
│  ┌─────────────────────────────┐    │
│  │        React UI (SPA)       │    │
│  │  Modules: ELN | Protocols | │    │
│  │  Samples | Methods | Figs  │    │
│  └──────────┬──────────────────┘    │
│             │                       │
│  ┌──────────▼──────────────────┐    │
│  │     Core Services Layer     │    │
│  │  ┌──────┐ ┌──────┐ ┌─────┐ │    │
│  │  │Dexie │ │Crypto│ │Guard│ │    │
│  │  │(IDB) │ │AES256│ │A/B/C│ │    │
│  │  └──────┘ └──────┘ └─────┘ │    │
│  └──────────┬──────────────────┘    │
│             │ (optional)            │
│  ┌──────────▼──────────────────┐    │
│  │  Sync: encrypted blob I/O  │    │
│  │  → Google Drive / Dropbox  │    │
│  │  → File export / import    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │  LLM (BYOK, Web Worker)    │    │
│  │  Isolated | Read-only view │    │
│  │  Suggest only, no auto-write│   │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```

### Security: 二选一 Permission Model

Any operation may use at most 2 of 3 capabilities:
- **[A]** Process untrusted input (uploads, imports, pasted content)
- **[B]** Access sensitive data (experiments, notes, samples, keys)
- **[C]** Mutate state / outbound (write DB, export, sync, API calls)

A+B ✅ | A+C ✅ | B+C ✅ | **A+B+C → human confirmation required**

### LLM: BYOK + Minimal Privilege
- User supplies own API key → AES-256 encrypted in IndexedDB
- API calls: browser → provider directly (no middleman server)
- LLM runs in Web Worker (no DOM, no DB access)
- LLM sees only user-selected context (one protocol, not everything)
- LLM output = suggestion only, user must approve before write
- All AI content tagged `[AI-generated]`

---

## Phased Roadmap

### Phase 1: MVP — Weeks 1–8

**Goal**: Usable standalone tool that a biologist installs and starts using the same day.

| Week | Deliverable |
|------|------------|
| 1 | Repo scaffold: Vite + React + TS + Tailwind + Tauri. CI/CD (GitHub Actions). Dexie.js schema. AES-256 crypto utils. i18n setup (EN/ZH) |
| 2 | **Protocol Library**: migrate 40+ recipes from current app. User create/edit/fork. Tags + search. Volume scaling + dead volume calculator |
| 3 | **Protocol Timer**: inline per-step countdown, multi-timer, audio + notification alerts. Timer history log |
| 4 | **Sample Box Manager**: cryo box grid (9×9, 10×10), freezer → rack → box hierarchy, position assignment, search "where is X?" |
| 5–6 | **ELN**: TipTap rich text editor, image attachments, per-project folders, tag system, full-text search, Markdown/PDF export |
| 7 | **Auth + Sync foundation**: Google OAuth (optional). Encrypted JSON export/import. PWA manifest + offline caching |
| 8 | **Tauri build**: desktop packaging (.msi/.dmg/.AppImage). Polish, bug fixes, README, docs, first GitHub release |

**Phase 1 Definition of Done:**
- [ ] `npm run dev` → working app in browser
- [ ] `npm run tauri build` → installable desktop app <10 MB
- [ ] Works fully offline (airplane mode test)
- [ ] All data encrypted at rest
- [ ] 0 external API calls in default mode
- [ ] README with screenshots, quickstart, architecture diagram
- [ ] Current 40+ recipes accessible with volume scaling
- [ ] Demo video (<3 min)

### Phase 1.5: Resource Management — Weeks 9–12

**Goal**: Manage lab reagents and materials without a spreadsheet.

| Week | Deliverable |
|------|------------|
| 9 | **Antibody Database**: target, host, clone, vendor, lot#, applications + validated dilutions, expiry, location |
| 10 | **Primer Database**: Fw/Rv sequences, Tm calc, product size, target gene, location. CSV import |
| 11 | **Reagent Inventory**: quantities, reorder threshold alerts. Optional Google Sheets link (read-only) |
| 12 | **Unified Search**: cross-module search ("anti-CD3" finds antibody entry + protocols using it + experiments mentioning it) |

**Definition of Done:**
- [ ] Antibody/primer entries link bidirectionally to protocols
- [ ] CSV bulk import works for all resource types
- [ ] Google Sheets link works with just a sheet URL (no OAuth required for public sheets)

### Phase 2: Publication Power — Weeks 13–18

**Goal**: Go from experiment to paper faster.

| Week | Deliverable |
|------|------------|
| 13–14 | **Methods Generator**: select protocols used → fill experiment-specific params → generate journal-style methods paragraph. Template system. Export .docx / .md. `[FILL IN]` highlighting |
| 15 | **Protocol Deviation Log**: planned vs actual side-by-side, timestamped notes, outcome tagging (worked/failed/unclear) |
| 16 | **Troubleshooting Journal**: structured problem → hypothesis → attempt → result. Searchable knowledge base |
| 17 | **Figure Plan**: panel layout designer (Fig 1A/B/C), data type tags, image upload, missing panel checklist, basic auto-layout to journal specs |
| 18 | **LLM Integration (BYOK)**: methods text polishing, protocol summarization. Web Worker isolation. Permission guard |

**Definition of Done:**
- [ ] Methods generator produces text that a PI would accept as a first draft
- [ ] Figure plan exports composite image matching journal column width
- [ ] LLM features work with OpenAI, Anthropic, and local Ollama endpoints
- [ ] All LLM operations tagged and auditable

### Phase 3: Collaboration — Weeks 19–24

| Deliverable | Details |
|------------|---------|
| **Encrypted Sharing** | Export project/protocol as encrypted file → recipient imports with shared passphrase. View/edit permissions |
| **Cloud Backup** | Google Drive / Dropbox / Box sync. Encrypted blobs only — provider cannot read content |
| **Cell Line Tracker** | Passage#, freeze/thaw log, mycoplasma status, growth notes |
| **Onboarding Mode** | Guided walkthrough for new lab members through protocol collection |
| **Audit Trail UI** | Visual timeline of all changes per entry. Who/when/what. Export for compliance |
| **BioInfoSpace API** | Deep links + data exchange with ELISA Calculator, qPCR Analyzer, crispRdesignR, freeCount |

### Phase 4: Data Analysis — Future

| Module | Approach |
|--------|----------|
| qPCR analysis | Import .csv → ΔΔCt → bar chart (Plotly.js) |
| WB quantification | ImageJ.js (WASM in browser) → band detection → normalized chart |
| IF/IHC | Image measurements + channel overlay (ImageJ.js) |
| Flow cytometry | .fcs parsing (JS library) → dot plot / histogram |
| Auto-figure | Analysis output → auto-populate Figure Plan panels |
| Mobile | Capacitor build for iOS/Android |

---

## BioInfoSpace Ecosystem Integration

### Current App Inventory

| App | Stack | URL | Data Format | Integration Value |
|-----|-------|-----|-------------|-------------------|
| **ELISA Calculator** | R Shiny (drc, ggplot2, plotly) | `/ELISA_calculator/` | Upload plate reader CSV/Excel → standard curve + concentration | ★★★★ Auto-populate methods + import results to ELN |
| **qPCR Analyzer** | R Shiny | `/qpcr-analysis/` | Upload Ct CSV → ΔΔCt → expression plot | ★★★★★ Most-used analysis → methods + figures |
| **freeCount** | R Shiny (3 modules: DA/FA/SO) | `/freeCount/` | Upload count matrix → DEG list + volcano/MA plots | ★★★★ DEG results → notebook + figure plan |
| **crispRdesignR** | R Shiny | `/crispRdesignR/` | Input gene → sgRNA design + off-target scoring | ★★★ Guide design → CRISPR protocol entry |
| **JBrowse 2** | React (static) | `/jbrowse/` | Genome browser, custom tracks | ★★ Link genomic coordinates in notebook entries |
| **BioLab Toolkit** | Single HTML (React CDN) | `/lab_toolkit/` | Protocols, buffers, calculators | → Becomes LabMate lite/demo |
| ~~oPOSSUM-MEME~~ | ~~Flask~~ | ~~`/opossum-meme/`~~ | ~~Deprecated~~ | Removed |

### Integration Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  LabMate (Browser)                        │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │                 Integration Hub                    │   │
│  │                                                    │   │
│  │  ┌────────────┐  ┌──────────┐  ┌──────────────┐  │   │
│  │  │ Deep Links  │  │ Clipboard│  │ File Import  │  │   │
│  │  │ (URL params)│  │ Protocol │  │ (drag & drop)│  │   │
│  │  └──────┬─────┘  └────┬─────┘  └──────┬───────┘  │   │
│  │         │              │               │          │   │
│  │  ┌──────▼──────────────▼───────────────▼───────┐  │   │
│  │  │           Unified Import Parser             │  │   │
│  │  │  Recognizes: ELISA results, qPCR ΔΔCt,     │  │   │
│  │  │  DEG tables, sgRNA designs, JBrowse coords  │  │   │
│  │  └──────┬──────────────┬───────────────┬───────┘  │   │
│  │         │              │               │          │   │
│  │    ┌────▼────┐  ┌─────▼─────┐  ┌─────▼──────┐   │   │
│  │    │ ELN     │  │ Methods   │  │ Figure     │   │   │
│  │    │ Entry   │  │ Generator │  │ Plan Panel │   │   │
│  │    └─────────┘  └───────────┘  └────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
          │                │                │
   ┌──────▼─────┐  ┌──────▼──────┐  ┌─────▼───────┐
   │ ELISA App  │  │ qPCR App    │  │ freeCount   │
   │ (R Shiny)  │  │ (R Shiny)   │  │ (R Shiny)   │
   └────────────┘  └─────────────┘  └─────────────┘
```

### Three Integration Tiers

**Tier 1: Deep Links (Phase 1, zero work on Shiny side)**
LabMate generates links that open BioInfoSpace apps with pre-filled context:
```
# From LabMate "Run ELISA analysis" button:
https://apps.bioinfospace.com/ELISA_calculator/?from=labmate&project=exp-2024-03

# From LabMate notebook, link to JBrowse region:
https://apps.bioinfospace.com/jbrowse/?loc=chr17:7571720-7590863&assembly=hg38

# From LabMate CRISPR protocol:
https://apps.bioinfospace.com/crispRdesignR/?gene=TP53&organism=human
```

**Tier 2: Clipboard/File Protocol (Phase 2, minimal Shiny changes)**
BioInfoSpace apps add "Copy for LabMate" / "Export to LabMate" button:
```javascript
// In ELISA app: add a download button that outputs structured JSON
{
  "labmate_import": "elisa_result",
  "version": 1,
  "project": "...",          // optional
  "standard_curve": { "model": "4PL", "r2": 0.998, ... },
  "samples": [
    { "name": "Sample-1", "od": 0.45, "concentration": 125.3, "unit": "pg/mL" }
  ],
  "plot_png_base64": "...",  // for Figure Plan
  "methods_text": "ELISA was performed using ... kit (Vendor, Cat#). Standard curves were fitted using a four-parameter logistic model (R² = 0.998)."
}
```
LabMate recognizes `.labmate.json` files → auto-imports into ELN + pre-fills methods text + adds plot to Figure Plan.

**Tier 3: Shared API (Phase 3, needs BioInfoSpace backend work)**
```
POST https://bioinfospace.com/api/labmate/sync
Authorization: Bearer <user_token>

{
  "action": "import_results",
  "source_app": "qpcr_analyzer",
  "experiment_id": "exp-2024-03-12",
  "data": { ... }
}
```
Requires shared auth (Google OAuth already planned) + API endpoints on BioInfoSpace backend.

### Per-App Integration Spec

**ELISA Calculator → LabMate**
| What | How | Phase |
|------|-----|-------|
| "Analyze ELISA" button in LabMate | Deep link to ELISA app | 1 |
| Import standard curve + concentrations | `.labmate.json` export from ELISA app | 2 |
| Auto-generate methods text | Template: "ELISA performed using [KIT], 4PL fit (R²=[VALUE])..." | 2 |
| Plot → Figure Plan panel | PNG/SVG from ELISA export | 2 |

**qPCR Analyzer → LabMate**
| What | How | Phase |
|------|-----|-------|
| "Analyze qPCR" button | Deep link | 1 |
| Import ΔΔCt results table | `.labmate.json` with gene, fold-change, p-value | 2 |
| Auto-generate methods text | "RT-qPCR was performed using [MASTER_MIX]. Relative expression calculated by ΔΔCt method, normalized to [REF_GENE]..." | 2 |
| Bar chart → Figure Plan | SVG export | 2 |

**freeCount (DEG) → LabMate**
| What | How | Phase |
|------|-----|-------|
| "Run DEG analysis" button | Deep link to freeCount DA module | 1 |
| Import DEG table + volcano plot | `.labmate.json` with gene list, log2FC, padj | 2 |
| Auto-generate methods text | "Differential expression analysis was performed using DESeq2/edgeR. Genes with |log₂FC| > [X] and adjusted p-value < [Y] were considered significant." | 2 |

**crispRdesignR → LabMate**
| What | How | Phase |
|------|-----|-------|
| "Design sgRNAs" from CRISPR protocol | Deep link with gene name | 1 |
| Import top sgRNA sequences + scores | `.labmate.json` with sequence, PAM, off-target score | 2 |
| Auto-fill CRISPR protocol materials | Populate primer/oligo database entries | 2 |

**JBrowse 2 → LabMate**
| What | How | Phase |
|------|-----|-------|
| Link genomic locus in notebook | URL with coordinates | 1 |
| Embed JBrowse view in ELN | iframe with saved session | 3 |

### Implementation Cost

| Tier | LabMate work | Shiny app work | When |
|------|-------------|----------------|------|
| Tier 1 (Deep Links) | 2 days | 0 | Phase 1 |
| Tier 2 (File Protocol) | 1 week | 1-2 days per app (add export button) | Phase 2 |
| Tier 3 (Shared API) | 2 weeks | 1 week (API endpoints) | Phase 3 |

**Key insight: Tier 1 costs almost nothing but provides immediate UX value. Start there.**

### External Tools: Link Out, Don't Build

**Principle**: If a best-in-class free tool already exists, LabMate links to it instead of building a clone. We are a hub, not a monolith.

LabMate provides a curated "External Tools" sidebar with contextual deep links. When a user is working on a protocol that involves primers, the primer tools surface automatically.

| Category | Tool | URL | Use Case | Context in LabMate |
|----------|------|-----|----------|-------------------|
| **Primer Design** | PrimerBank | `https://pga.mgh.harvard.edu/primerbank/` | Pre-validated qPCR primers by gene | Primer DB: "Find primers for [GENE]" button |
| **Primer Design** | Primer-BLAST (NCBI) | `https://www.ncbi.nlm.nih.gov/tools/primer-blast/` | Custom primer design + specificity check | Primer DB: "Design new primers" button |
| **Sequence** | BLAST (NCBI) | `https://blast.ncbi.nlm.nih.gov/` | Sequence alignment / identity check | Primer DB: "BLAST this sequence" button |
| **Sequence** | SnapGene Viewer | `https://www.snapgene.com/snapgene-viewer` | Free plasmid map viewer | Protocol materials: view linked plasmid |
| **Sequence** | Benchling (free) | `https://www.benchling.com/` | Sequence editor, cloning design | Link when CRISPR/cloning protocols active |
| **Protein** | UniProt | `https://www.uniprot.org/` | Protein info, domains, function | Antibody DB: "View target protein" |
| **Protein** | ExPASy ProtParam | `https://web.expasy.org/protparam/` | MW, pI, extinction coefficient | SDS-PAGE: "Calculate protein properties" |
| **Oligo Calc** | OligoCalc | `http://biotools.nubic.northwestern.edu/OligoCalc.html` | Tm, MW, extinction for oligos | Primer DB: auto-link for Tm verification |
| **Oligo Calc** | NEB Tm Calculator | `https://tmcalculator.neb.com/` | Accurate Tm with salt/primer conc | Primer DB: "Check Tm (NEB)" |
| **Enzyme** | NEBcutter | `https://nc3.neb.com/NEBcutter/` | Restriction enzyme analysis | Cloning protocols: "Find RE sites" |
| **Genome** | Ensembl | `https://ensembl.org/` | Gene annotation, orthologs | Notebook entries: link gene locus |
| **Genome** | UCSC Genome Browser | `https://genome.ucsc.edu/` | Genome visualization | Alternative to JBrowse for specific views |
| **Pathway** | Enrichr | `https://maayanlab.cloud/Enrichr/` | Gene set enrichment | freeCount DEG results: "Run enrichment" |
| **Pathway** | STRING | `https://string-db.org/` | Protein interaction networks | DEG results: "View interactions" |
| **Pathway** | DAVID | `https://david.ncifcrf.gov/` | GO / KEGG enrichment | DEG results: "DAVID analysis" |
| **Reagent** | Addgene | `https://www.addgene.org/` | Plasmid repository | Protocol materials: "Find on Addgene" |
| **Antibody** | CiteAb | `https://www.citeab.com/` | Antibody citation/validation data | Antibody DB: "Check citations" |
| **Data** | GEO (NCBI) | `https://www.ncbi.nlm.nih.gov/geo/` | Public expression datasets | Notebook: link GEO accession |
| **Image** | ImageJ.js | `https://ij.imjoy.io/` | Browser-based ImageJ | WB/IF analysis: "Open in ImageJ" |
| **Figure** | BioRender | `https://www.biorender.com/` | Scientific figure illustrations | Figure Plan: "Create schematic" |

**How it works in LabMate UI:**
1. **Contextual**: Tools appear based on what module/protocol is active
2. **One-click**: Deep links pre-fill parameters where possible (gene name, sequence, coordinates)
3. **User-customizable**: Users can pin favorite tools, add custom links
4. **No dependency**: LabMate works fine if any external tool goes down — they're just links

---

## Scope Control: What We Say NO To

Staying lightweight means actively refusing features that violate the pillars:

| Temptation | Why We Say No | Alternative |
|-----------|---------------|------------|
| Built-in server/backend | Violates local-first, adds deploy complexity | IndexedDB + optional cloud sync |
| Real-time multiplayer editing | CRDTs add massive complexity in Phase 1 | Start with file-based sharing, add CRDTs in Phase 3+ |
| Sequence viewer/editor | SnapGene Viewer / Benchling free exist | Deep link out |
| Primer design tool | Primer-BLAST / PrimerBank are best-in-class | Deep link with gene name pre-filled |
| BLAST clone | NCBI BLAST is irreplaceable | Link out with sequence pre-filled |
| Pathway analysis | Enrichr / DAVID / STRING already excellent | Link out with gene list |
| Built-in reference manager | Zotero/Mendeley already solve this | DOI links + CrossRef metadata fetch |
| Custom workflow engine | Enterprise LIMS territory | Keep it simple: protocols + notes + projects |
| Server-rendered pages | Unnecessary for local-first SPA | Pure client-side React |
| Native mobile before desktop | Desktop is where researchers work | PWA covers mobile basics; Capacitor later |
| Any tool where a free best-in-class exists | Violates "easy/lightweight" pillar | **Link out, don't build** |

---

## Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Scope creep kills momentum | High | Fatal | Strict phase gates. Ship Phase 1 before starting Phase 2 |
| IndexedDB storage limits (~50MB–unlimited) | Low | Medium | Compress images, lazy-load attachments, offload large files to cloud sync |
| Tauri 2 has rough edges on Linux | Medium | Low | PWA is the fallback; Linux users are comfortable with browser apps |
| Nobody discovers the project | Medium | High | Launch on r/labrats, Hacker News, protocols.io forum. Demo video. BioInfoSpace blog post |
| LLM API costs scare users | Low | Low | LLM is 100% optional. Core app works without any API key |
| Security vulnerability in crypto code | Low | Critical | Use only Web Crypto API (browser-native), no custom crypto. Security audit before 1.0 |
| i18n maintenance burden | Low | Low | EN primary, ZH co-maintained. Community can add more locales |

---

## Success Metrics

### Phase 1 Launch (Week 8)
- [ ] GitHub repo public with MIT license
- [ ] README with demo GIF, quickstart, architecture
- [ ] Tauri release artifacts on GitHub Releases (Windows/Mac/Linux)
- [ ] ≥5 beta users from Notre Dame labs
- [ ] Post on r/labrats + r/bioinformatics

### 3-Month Mark (Week 12)
- [ ] ≥50 GitHub stars
- [ ] ≥3 external contributors (issues or PRs)
- [ ] Methods generator working (killer feature)
- [ ] At least 1 real lab using it for daily work

### 6-Month Mark (Week 24)
- [ ] ≥200 GitHub stars
- [ ] Featured on BioInfoSpace homepage
- [ ] Collaboration features live
- [ ] At least 1 blog post / talk about the project

---

## Progress Tracker (Pre-Phase 1 Prototype)

### Completed ✅
- [x] Core app with 6 tabs (Buffers, Protocols, Calculator, Plate Designer, Tools, References)
- [x] 67+ buffer/solution recipes with volume scaling
- [x] 13+ protocols with brief/detailed steps, materials, cross-links
- [x] SDS-PAGE Gel Calculator (merged into Buffers tab)
- [x] Solution Calculator: C₁V₁=C₂V₂, mass, molarity, percentage + dead volume
- [x] Calculator redesigned: task-oriented labels ("稀释母液" not "C₁V₁=C₂V₂")
- [x] Multi-well Plate Designer with CSV table view
- [x] Protocol Timer system (multi-timer, audio alerts, notifications)
- [x] External Tools tab (20+ curated links + BioInfoSpace app deep links)
- [x] Dark mode, i18n (EN/ZH), favorites, recent, global search
- [x] DESIGN_GUIDE.md written and enforced
- [x] protocols.io API connected (token active, 28 protocols fetched)
- [x] CSH Recipes data pipeline (8 verified buffer recipes with DOIs)
- [x] Automated acceptance test suite (13 checks)
- [x] Cross-agent workflow (PMBot specs → DevBot implements)
- [x] Featured on BioInfoSpace main site (PostgreSQL apps table)
- [x] biolab-protocol skill for standardized data entry
- [x] FEASIBILITY.md with full platform analysis

### Remaining Before Phase 1 Kickoff
- [ ] **Decision: Start Phase 1 repo** (Miana approval) → `bioinfospace/labmate`
- [ ] Continue expanding recipe library to 100+ (protocols.io batch import)
- [ ] STAR Protocols parsing (blocked by Cloudflare, need browser scraper)
- [ ] Fix last design guide violation (🌙 emoji → SVG moon icon)
- [ ] Protocol timer integration into protocol detail view (timer per step, not just global)

### Data Pipeline Status

| Source | Status | Recipes Fetched | Quality |
|--------|--------|----------------|---------|
| Manual/Expert | ✅ Active | 67+ | Gold (human-verified, bilingual) |
| protocols.io API | ✅ Connected | 28 (5 high quality) | Silver (needs ZH translation + review) |
| CSH Recipes | ✅ Working | 8 | Gold (DOI-backed, decades-verified) |
| STAR Protocols | ⚠️ Blocked (Cloudflare) | 0 | — (need Puppeteer scraper) |
| Bio-protocol | 🔲 Not started | 0 | — |
| OpenWetWare | 🔲 Not started | 0 | — |

## Action Plan: Week 1

**Concrete tasks to start building the real repo:**

```
Day 1:
  - [ ] Create GitHub repo: bioinfospace/labmate
  - [ ] Initialize: pnpm create vite@latest app --template react-ts
  - [ ] Add TailwindCSS + BioInfoSpace design tokens
  - [ ] Add Tauri 2 to the project
  - [ ] Set up GitHub Actions CI (lint + type-check + build)

Day 2:
  - [ ] Define Dexie.js schema (protocols, experiments, samples, settings)
  - [ ] Implement crypto utils (encrypt/decrypt with Web Crypto API)
  - [ ] Implement 二选一 permission guard

Day 3:
  - [ ] Port BioInfoSpace design system (CSS variables, fonts, dark mode)
  - [ ] Build app shell: sidebar nav, module routing, settings page
  - [ ] Set up react-i18next with EN/ZH

Day 4–5:
  - [ ] Migrate Protocol Library from current single-file app
  - [ ] Adapt to Dexie.js storage (user-created protocols)
  - [ ] Volume scaling + dead volume calculator
  - [ ] Protocol search + filter
```
