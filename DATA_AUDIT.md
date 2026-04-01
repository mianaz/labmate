# LabMate Recipe Data Audit Report

**Date:** 2026-03-31  
**Scope:** App repo `recipes.json` (159 entries) vs Recipes repo `dist/recipes.json` (215 entries)  
**Schema:** `labmate-recipes/schema.json` (v2 unified schema)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| App recipes.json entries | **159** |
| Dist recipes.json entries | **215** |
| Missing from app (in dist but not app) | **56** |
| Missing from dist (in app but not dist) | **0** |
| Duplicate IDs | **0** |
| Broken cross-references | **0** |
| Schema field-name mismatches | **7 fields** |
| Entries missing `discipline` | **159/159 (100%)** |
| Entries missing `duration` (protocols) | **68/68 (100%)** |
| Entries missing bilingual `usage` | **69/159 (43%)** |

### Top-Priority Issues

1. **56 recipes exist in dist but are missing from the app** — 25 buffers, 30 protocols, 1 media
2. **Zero entries have `discipline` tags** — the filtering feature cannot work
3. **Zero protocols have `duration` info** — schema field completely unused
4. **7 field names don't match the schema** — data uses non-schema field names
5. **Staining category severely under-populated** — only 2/9 have usage, storage, prepSteps

---

## 1. Entry Count Discrepancy

### App (159) vs Dist (215): 56 Missing Recipes

All 159 app entries exist in dist, but **56 dist entries are absent from the app**.

| Category | In App | In Dist | Missing |
|----------|--------|---------|---------|
| Buffer | 72 | 97 | **25** |
| Protocol | 68 | 99 | **30** |  
| Media | 10 | 11 | **1** |
| Staining | 9 | 8 | 0* |

\* Staining has 9 in app but only 8 in dist — 1 staining entry may have been added to app but not committed to the recipes repo, or there's a categorization difference.

#### Missing Buffer IDs (25)
`antibody_diluent_ihc`, `antibody_diluent_wb`, `buprenorphine_solution`, `coelenterazine_stock`, `cresol_red_10x`, `d_luciferin_stock`, `exosome_isolation_buffer`, `ficoll_400_stock`, `ficoll_paque_pbmc`, `ficoll_solution`, `g418_stock`, `laemmli_5x`, `lysosome_isolation_buffer`, `mops_10x`, `mounting_medium_antifade`, `pcr_buffer_10x`, `pei_stock`, `percoll_gradient_buffer`, `percoll_isotonic`, `q_solution_5x`, `rbc_lysis_10x`, `resazurin_stock`, `sucrose_gradient_buffer`, `sucrose_gradient_homog`, `tris_hcl_1_5m`

#### Missing Protocol IDs (30)
`cite_seq_10x`, `competent_cell_bulk`, `competent_cells_electrocompetent`, `ctc_detection_pcr`, `cytof_staining`, `er_golgi_isolation`, `exosome_isolation`, `fbs_heat_inactivation`, `flow_panel_staining`, `genotyping_pcr`, `gradient_centrifugation_general`, `hela_mycoplasma_testing`, `if_cryostat`, `inclusion_body_refolding`, `lentiviral_titer_functional`, `lentiviral_titer_p24`, `lysosome_isolation`, `multiplex_if`, `ngn2_neuron_induction`, `pbmc_isolation`, `pdx_implantation`, `protein_concentration_amicon`, `pulldown_assay`, `resazurin_assay`, `rna_agarose_gel`, `sanger_sequencing_prep`, `single_colony_picking`, `stable_cell_line_selection`, `therapeutic_antibody_dilution`, `tumor_dissociation`

#### Missing Media IDs (1)
`nci_h660_medium`

**Recommendation:** Import the 56 dist-only recipes into the app's recipes.json. The dist recipes are more complete (they already have `discipline` tags, for example).

---

## 2. Schema Field-Name Mismatches

The data uses **7 field names that don't exist in the schema**, and the schema defines **4 fields not found in any data entry**.

### Fields in Data but NOT in Schema

| Data Field | Schema Equivalent | Count | Notes |
|------------|-------------------|-------|-------|
| `defaultVolume` | `volume` | 159/159 | Every entry uses wrong name |
| `unit` | `volumeUnit` | 159/159 | Every entry uses wrong name |
| `ph` | _(none)_ | 30/159 | Not in schema at all |
| `briefSteps` | _(none — part of `components`?)_ | 68/159 | Protocol-only; schema has no equivalent |
| `detailedSteps` | _(none)_ | 68/159 | Protocol-only; schema has no equivalent |
| `relatedProtocols` | `crosslinks` | 49/159 | Overlaps with schema `crosslinks` |
| `safeStops` | `stoppingPoints` | 53/159 | Different name, same purpose |

### Fields in Schema but NOT in Data

| Schema Field | Description | Impact |
|-------------|-------------|--------|
| `volume` | Default prep volume | All entries use `defaultVolume` instead |
| `volumeUnit` | Unit for volume | All entries use `unit` instead |
| `stoppingPoints` | Safe pause points | All entries use `safeStops` instead |
| `source` | Journal/book source | Never used; `ref` is used instead |

### Ambiguity: `relatedProtocols` vs `crosslinks`

- **49 entries** have `relatedProtocols` (buffers → protocols)
- **29 entries** have `crosslinks` (protocols → buffers/protocols)
- **0 entries** have both
- The schema only defines `crosslinks`

These appear to serve the same purpose but are used by different categories. Need to decide: merge into `crosslinks`, or formalize `relatedProtocols` in the schema.

### Ambiguity: `briefSteps` / `detailedSteps` vs `components`

The schema defines `components` as dual-purpose ("Reagent list (buffers/media) OR step list (protocols)"). But in practice:
- Protocols use `briefSteps` (bilingual step summaries) and `detailedSteps` (bilingual detailed instructions)
- Protocols also have `components` (which contains step-like entries)

These fields need to be formalized in the schema or the data needs restructuring.

**Recommendation:** Either update the schema to match the data field names, or migrate the data. Since 100% of entries use the non-schema names, updating the schema is likely easier.

---

## 3. Per-Category Field Coverage

### Buffer (72 entries)

| Field | Present | % | Status |
|-------|---------|---|--------|
| `components` | 72 | 100% | ✅ |
| `nameCn` | 72 | 100% | ✅ |
| `tags` | 72 | 100% | ✅ |
| `ref` | 72 | 100% | ✅ |
| `notes` (bilingual) | 72 | 100% | ✅ |
| `defaultVolume` | 72 | 100% | ✅ |
| `usage` (bilingual) | 56 | 78% | ⚠️ |
| `storage` | 56 | 78% | ⚠️ |
| `prepSteps` | 56 | 78% | ⚠️ |
| `relatedProtocols` | 41 | 57% | ⚠️ |
| `ph` | 26 | 36% | ℹ️ |
| `crosslinks` | 10 | 14% | ⚠️ |
| `discipline` | 0 | 0% | ❌ |

**16 buffers missing usage/storage/prepSteps:**
`bsa_standard_curve`, `emsa_binding_buffer`, `kinase_buffer`, `luciferase_lysis_buffer`, `phosphatase_inhibitor_na3vo4`, `tail_lysis_buffer`, `ar_edta_ph9`, `bradford_reagent`, `dialysis_buffer_generic`, `gst_elution_reduced`, `imac_elution_500`, `imac_wash_highsalt`, `lysis_buffer_mild`, `mitochondria_buffer`, `nuclei_isolation_buffer`, `sec_running_buffer`

These 16 appear to be the most recently added entries with incomplete data.

### Protocol (68 entries)

| Field | Present | % | Status |
|-------|---------|---|--------|
| `components` | 68 | 100% | ✅ |
| `briefSteps` | 68 | 100% | ✅ |
| `detailedSteps` | 68 | 100% | ✅ |
| `materials` | 68 | 100% | ✅ |
| `nameCn` | 68 | 100% | ✅ |
| `tags` | 68 | 100% | ✅ |
| `notes` (bilingual) | 68 | 100% | ✅ |
| `safeStops` | 49 | 72% | ⚠️ |
| `usage` (bilingual) | 25 | 37% | ⚠️ |
| `crosslinks` | 19 | 28% | ⚠️ |
| `relatedProtocols` | 17 | 25% | ⚠️ |
| `discipline` | 0 | 0% | ❌ |
| `duration` | 0 | 0% | ❌ |

**19 protocols missing safeStops:**
`if_protocol`, `cell_transfection`, `colony_pcr`, `competent_cells_cacl2`, `trypan_blue_counting`, `calcium_phosphate_transfection`, `heat_shock_transformation`, `agarose_gel_electrophoresis`, `mtt_assay`, `scratch_assay`, `cell_thawing`, `gibson_assembly`, `site_directed_mutagenesis`, `transwell_migration`, `mycoplasma_pcr`, `annexin_v_apoptosis`, `bca_protein_assay`, `cell_counting_hemocytometer`, `cell_passage`

**43 protocols missing usage** (63%):
`annexin_v_apoptosis`, `bacterial_glycerol_stock`, `bca_protein_assay`, `cck8_proliferation`, `cell_counting_hemocytometer`, `cell_cycle_pi`, `cell_passage`, `chromatin_accessibility_atac`, `clonogenic_assay`, `comet_assay`, `coomassie_staining`, `crispr_sgrna_cloning`, `dna_ligation`, `dual_luciferase`, `elisa_sandwich`, `ethanol_precipitation`, `gel_extraction`, `genomic_dna_extraction`, `immunoprecipitation`, `northern_blot`, `pcr_standard`, `plasmid_maxiprep`, `proximity_ligation_assay`, `restriction_digest`, `rna_column_extraction`, `soft_agar_assay`, `southern_blot`, `tube_formation_assay`, `bacterial_protein_expression`, `bradford_assay_protocol`, `cut_and_run`, `emsa_gel_shift`, `enzyme_kinetics_michaelis`, `gst_tag_purification`, `his_tag_purification`, `ihc_paraffin_protocol`, `ion_exchange_chromatography`, `mitochondria_isolation`, `protein_dialysis`, `rnaseq_library_prep`, `sec_purification`, `sirna_knockdown`, `subcellular_fractionation`

### Staining (9 entries) — ⚠️ Severely Under-Populated

| Field | Present | % | Status |
|-------|---------|---|--------|
| `components` | 9 | 100% | ✅ |
| `nameCn` | 9 | 100% | ✅ |
| `tags` | 9 | 100% | ✅ |
| `ref` | 9 | 100% | ✅ |
| `notes` (bilingual) | 9 | 100% | ✅ |
| `usage` (bilingual) | 2 | 22% | ❌ |
| `storage` | 2 | 22% | ❌ |
| `prepSteps` | 2 | 22% | ❌ |
| `relatedProtocols` | 2 | 22% | ❌ |
| `discipline` | 0 | 0% | ❌ |

**7 staining entries missing usage/storage/prepSteps:**
`coomassie_stain`, `coomassie_destain`, `ponceau_s`, `alizarin_red`, `ecl_enhanced`, `oil_red_o`, `silver_stain`

### Media (10 entries)

| Field | Present | % | Status |
|-------|---------|---|--------|
| `components` | 10 | 100% | ✅ |
| `nameCn` | 10 | 100% | ✅ |
| `tags` | 10 | 100% | ✅ |
| `ref` | 10 | 100% | ✅ |
| `notes` (bilingual) | 10 | 100% | ✅ |
| `usage` (bilingual) | 7 | 70% | ⚠️ |
| `storage` | 7 | 70% | ⚠️ |
| `prepSteps` | 7 | 70% | ⚠️ |
| `relatedProtocols` | 5 | 50% | ⚠️ |
| `discipline` | 0 | 0% | ❌ |

**3 media entries missing usage/storage/prepSteps:**
`lb`, `esc_culture_media`, `tb_media`

---

## 4. Bilingual Coverage

| Aspect | Count | % | Notes |
|--------|-------|---|-------|
| `nameCn` present | 159/159 | 100% | ✅ All entries have Chinese names |
| `usage` bilingual (dict with en/zh) | 90/159 | 57% | ⚠️ 69 entries lack usage entirely |
| `usage` string-only | 0/159 | 0% | ✅ No entries have English-only usage |
| `notes` bilingual | 159/159 | 100% | ✅ All notes are {en, zh} objects |
| Component `note` bilingual | 141/488 | 29% | ⚠️ 347 component notes are string-only |

### Component Notes Detail
- **488 total** component entries have a `note` field
- **141** (29%) use bilingual `{en, zh}` objects
- **347** (71%) use plain English strings

**Recommendation:** Prioritize translating the 347 English-only component notes to bilingual format. These are typically short (e.g., "pH to 6.8 with HCl") and could be batch-translated.

---

## 5. Storage Structure

The schema defines storage with sub-fields: `temperature`, `duration`, `notes`, `sterile`.

**Actual data structure differs:** Storage objects use `temp`, `duration`, `icon`, and `label` (bilingual).

| Schema Field | Data Field | Notes |
|-------------|-----------|-------|
| `temperature` | `temp` | Name mismatch |
| `duration` | `duration` | ✅ Matches |
| `notes` | _(in `label`)_ | Embedded in label string |
| `sterile` | _(none)_ | Not used anywhere |
| _(none)_ | `icon` | Emoji indicator (🏠, ❄️, etc.) |
| _(none)_ | `label` | Bilingual human-readable summary |

**90 entries** have storage data. **69 entries** lack storage entirely.

Storage is present/absent in lockstep with `usage` and `prepSteps` — the same 16 buffers, 7 staining, and 3 media that lack usage also lack storage and prepSteps. These appear to be a batch of recently added, incomplete entries.

---

## 6. Cross-Reference Integrity

| Reference Type | Total Refs | Broken | Status |
|---------------|-----------|--------|--------|
| `relatedProtocols` → recipe ID | 68 | 0 | ✅ |
| `materials[].linkedRecipe` → recipe ID | 125 | 0 | ✅ |
| `crosslinks` → recipe ID | 108 | 0 | ✅ |
| `components[].linkedRecipe` → recipe ID | 0 | 0 | ✅ (unused) |

**All cross-references resolve successfully.** No broken links, no orphan references.

However, note that if the 56 dist-only recipes are imported, they may introduce new cross-references that need validation.

### Materials Cross-Link Coverage
- **125** material entries reference a buffer via `linkedRecipe`
- **381** material entries have no cross-link (plain text names)

---

## 7. Data Quality Issues Summary

### Critical (blocks features)

| # | Issue | Impact | Entries |
|---|-------|--------|---------|
| C1 | `discipline` missing from ALL 159 entries | Discipline-based filtering broken | 159 |
| C2 | `duration` missing from ALL 68 protocols | No time estimates shown | 68 |
| C3 | 56 recipes in dist not in app | 26% of content missing | 56 |

### High (significant data gaps)

| # | Issue | Impact | Entries |
|---|-------|--------|---------|
| H1 | 43 protocols missing `usage` | No description for 63% of protocols | 43 |
| H2 | 7 staining entries missing usage/storage/prepSteps | Category nearly empty in practice | 7 |
| H3 | Schema field-name mismatches (7 fields) | Schema doesn't describe actual data | 159 |
| H4 | 347 component notes not bilingual | Chinese users see English component notes | 347 |

### Medium (incomplete data)

| # | Issue | Impact | Entries |
|---|-------|--------|---------|
| M1 | 16 buffers missing usage/storage/prepSteps | Incomplete entries | 16 |
| M2 | 3 media entries missing usage/storage/prepSteps | Incomplete entries | 3 |
| M3 | 19 protocols missing `safeStops` | No pause point info | 19 |
| M4 | 31 buffers/staining/media missing `relatedProtocols` | No protocol cross-links | 31 |
| M5 | `storage.temperature` uses `temp` (schema mismatch) | Minor naming issue | 90 |
| M6 | `storage.sterile` never used | Schema feature unused | 0 |

### Low (nice-to-have)

| # | Issue | Impact | Entries |
|---|-------|--------|---------|
| L1 | `ph` field not in schema | 30 entries have pH; not formalized | 30 |
| L2 | `source` (schema) never used | `ref` is used instead | 0 |
| L3 | `doi` (schema) never used | Could enhance citations | 0 |

---

## 8. Recommendations

### Immediate (before next release)

1. **Import the 56 dist-only recipes** into the app's `recipes.json`. These are complete and include `discipline` tags.

2. **Add `discipline` tags to all 159 existing app entries.** The dist-only recipes already have them — use as reference. This unblocks the discipline filtering feature.

3. **Update schema.json** to match the actual data field names:
   - `defaultVolume` → keep (or rename to `volume` everywhere)
   - `unit` → keep (or rename to `volumeUnit`)
   - `briefSteps` / `detailedSteps` → add to schema
   - `relatedProtocols` → formalize or merge with `crosslinks`
   - `safeStops` → formalize or rename to `stoppingPoints`
   - `ph` → add to schema
   - `storage.temp` → rename to `storage.temperature` or update schema

### Short-term (next sprint)

4. **Add `usage` to the 69 missing entries.** Priority:
   - 43 protocols (highest impact — users need to know what protocols do)
   - 16 buffers, 7 staining, 3 media

5. **Add `duration` to all 68 protocols.** This is a structured field with `total` and `hands_on` — could be AI-assisted based on step content.

6. **Complete the 16 incomplete buffer entries** (add storage, prepSteps).

7. **Complete the 7 incomplete staining entries** (add usage, storage, prepSteps, relatedProtocols).

### Medium-term

8. **Translate 347 component notes** to bilingual `{en, zh}` format.

9. **Add `safeStops`** to 19 protocols that lack them.

10. **Add `relatedProtocols`** to 31 buffers/staining/media that lack protocol cross-links.

11. **Consider adding `doi`/`source`** fields to enhance citation quality.

---

## Appendix: Data File Locations

| File | Path | Entries |
|------|------|---------|
| App recipes | `/home/ubuntu/.openclaw/workspace-pm/labmate-repo/recipes.json` | 159 |
| Dist recipes | `/home/ubuntu/.openclaw/workspace-webdev/labmate-recipes/dist/recipes.json` | 215 |
| Individual files | `/home/ubuntu/.openclaw/workspace-webdev/labmate-recipes/recipes/{category}/` | 215 |
| Schema | `/home/ubuntu/.openclaw/workspace-webdev/labmate-recipes/schema.json` | — |
