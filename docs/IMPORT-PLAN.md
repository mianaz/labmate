# Protocol Auto-Import Pipeline

## Sources & Access Methods

### 1. protocols.io API (Primary Source)
- **API**: `https://www.protocols.io/api/v3/protocols`
- **Auth**: Requires free developer token (Bearer token)
- **Registration**: https://www.protocols.io/developers
- **Content**: Structured JSON with steps, materials, reagents
- **License**: CC-BY (free to use with attribution)
- **Volume**: Tens of thousands of protocols
- **Action needed**: Register for developer account → get client_access_token

### 2. CSH Protocols Recipes (Buffer/Solution Focus)  
- **URL**: https://cshprotocols.cshlp.org/site/recipes/
- **Access**: Public, free, no auth needed
- **Content**: Classic buffer recipes with DOIs
- **Issue**: Content rendered by JS → use web_fetch or Puppeteer
- **Quality**: Gold standard — "Molecular Cloning" heritage

### 3. STAR Protocols (Cell Press, Open Access)
- **URL**: https://www.cell.com/star-protocols
- **Access**: Open Access, full text available
- **Content**: Peer-reviewed, structured step-by-step
- **Use**: Parse methods sections for detailed protocol steps
- **DOI pattern**: `10.1016/j.xpro.*`

### 4. Bio-protocol (Open Access)
- **URL**: https://bio-protocol.org
- **Access**: Open Access
- **Content**: Step-by-step lab protocols
- **Quality**: Peer-reviewed

### 5. OpenWetWare (Community Wiki)
- **URL**: https://openwetware.org
- **Access**: MediaWiki API
- **Content**: Community-contributed protocols
- **Quality**: Variable — needs curation

## Import Pipeline Architecture

```
┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│ protocols.io │────▶│   Normalizer  │────▶│  LabMate     │
│ API v3       │     │               │     │  Schema      │
├──────────────┤     │  - Parse steps│     │              │
│ CSH Recipes  │────▶│  - Extract    │────▶│  - id        │
│ (web scrape) │     │    components │     │  - name/Zh   │
├──────────────┤     │  - Map units  │     │  - category  │
│ STAR Proto-  │────▶│  - Add i18n   │     │  - components│
│ cols (OA)    │     │  - Validate   │     │  - steps     │
├──────────────┤     │  - Deduplicate│     │  - reference │
│ OpenWetWare  │────▶│               │     │  - DOI       │
│ (wiki API)   │     └───────┬───────┘     │  - source    │
└──────────────┘             │             └──────────────┘
                             ▼
                    ┌─────────────────┐
                    │  Quality Gate   │
                    │  - Has DOI?     │
                    │  - ≥10 citations│
                    │  - Complete?    │
                    │  - Duplicated?  │
                    └────────┬────────┘
                             ▼
                    ┌─────────────────┐
                    │  Review Queue   │
                    │  (human check)  │
                    │  → verified: ✓  │
                    └─────────────────┘
```

## Data Quality Rules

1. **Must have**: name, at least 1 component with amount+unit, preparation steps
2. **Should have**: DOI or published reference, storage conditions
3. **Auto-reject**: No components listed, unclear concentrations, non-standard units
4. **Dedup**: Match by name similarity (Levenshtein ≥0.85) + component overlap
5. **Translation**: Use LLM for EN→ZH translation of names and steps, human verify

## Priority Import Queue (Top 50 Missing Recipes)

### Buffers (highest demand)
- [ ] TAE Buffer (50× and 1×)
- [ ] TBE Buffer (10× and 1×)
- [ ] TE Buffer (10 mM Tris, 1 mM EDTA)
- [ ] MOPS Running Buffer (20×)
- [ ] MES Running Buffer (20×)
- [ ] SSC Buffer (20×)
- [ ] HEPES Buffer (1M)
- [ ] Sodium Citrate Buffer (various pH)
- [ ] Glycine Stripping Buffer
- [ ] Acetate Buffer
- [ ] RIPA variants (mild / harsh)
- [ ] NP-40 Lysis Buffer
- [ ] Protein Loading Buffer (non-reducing)
- [ ] DNA Loading Dye (6×)
- [ ] RNA Loading Dye
- [ ] Ethidium Bromide Solution
- [ ] SYBR Safe / SYBR Green Solution

### Fixation & Staining
- [ ] 4% PFA in PBS (fresh)
- [ ] 4% PFA + 0.1% Glutaraldehyde
- [ ] Methanol fixation
- [ ] Acetone fixation
- [ ] DAPI Staining Solution
- [ ] Crystal Violet Staining
- [ ] Hematoxylin & Eosin (H&E)
- [ ] Oil Red O Staining
- [ ] Trypan Blue (0.4%)
- [ ] Giemsa Staining

### Cell Culture
- [ ] Complete DMEM (10% FBS)
- [ ] Complete RPMI-1640
- [ ] Freezing Medium (10% DMSO)
- [ ] Bacterial Glycerol Stock (25%)
- [ ] Poly-L-Lysine Coating
- [ ] Gelatin Coating (0.1%)
- [ ] Collagen Coating

### Molecular Biology
- [ ] Colony PCR Mix
- [ ] Agarose Gel (1%, 1.5%, 2%)
- [ ] Ethanol Precipitation
- [ ] Phenol-Chloroform Extraction
- [ ] Alkaline Lysis (Miniprep)
- [ ] DEPC-Treated Water

### Protocols (step-by-step)
- [ ] Agarose Gel Electrophoresis
- [ ] Calcium Phosphate Transfection
- [ ] Bacterial Transformation (heat shock)
- [ ] Bacterial Transformation (electroporation)
- [ ] Plasmid Miniprep (alkaline lysis)
- [ ] Cell Counting (hemocytometer)
- [ ] MTT/MTS Viability Assay (detailed)
- [ ] Wound Healing / Scratch Assay
- [ ] Transwell Migration Assay
- [ ] Soft Agar Colony Formation

## Schedule

- **Week 1**: Register protocols.io token, build normalizer, import top 20 buffers
- **Week 2**: Import top 15 protocols, add CSH Recipes scraper
- **Week 3**: LLM translation pass (EN→ZH), human QA review
- **Week 4**: Deploy to app, add "source" badges, monthly auto-sync cron

## Token Registration Steps

1. Go to https://www.protocols.io/developers
2. Sign up (free academic account)
3. Create new application → get `client_id` + `client_secret`
4. Generate client access token (public read-only)
5. Store token in `.env` file (NOT committed to git)
6. Test: `curl -H "Authorization: Bearer TOKEN" "https://www.protocols.io/api/v3/protocols?key=western+blot&page_size=3" --compressed`
