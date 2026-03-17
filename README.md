# LabMate

Local-first lab companion for wet-lab biologists. Part of the [BioInfoSpace](https://bioinfospace.com) ecosystem.

Protocols, buffer recipes, calculators, plate design, sample inventory, and an electronic lab notebook — all running client-side with zero backend dependency.

## Platforms

| Platform | Tech | Status |
|----------|------|--------|
| Web | Vite + React 19 | `main` branch |
| Desktop | Tauri 2 (macOS/Windows/Linux) | `desktop` branch |
| Mobile | Capacitor (iOS/Android) | `desktop` branch — in progress |

## Protocol & Recipe Data

Precompiled protocol/recipe database is maintained in a separate repository:

**[github.com/mianaz/labmate-recipe](https://github.com/mianaz/labmate-recipe)**

- Recipes are versioned JSON files (`recipes-v1.json`)
- The app fetches updates from this repo when connected online
- Local bundled copy at `public/db/recipes-v1.json` serves as offline fallback
- Sync is version-aware: only new or updated official entries are pulled; user customizations are never overwritten

### Sync behavior

1. On manual sync (or auto-check), the app fetches the latest `recipes-v1.json` from the recipe repo
2. Compares remote `version` field against local `dbVersion` stored in IndexedDB
3. New protocols are inserted; updated official protocols are merged (preserving favorites and usage timestamps)
4. Custom/user-created protocols are never modified by sync

## Quick Start

```bash
npm install
npm run dev          # Web dev server
npm run build        # Production build (web)

# Desktop (Tauri)
npm run tauri dev    # Dev mode with hot reload
npm run tauri build  # Build .app + .dmg

# Generate/update recipe database
npm run generate-db
```

## Tech Stack

- **UI**: React 19 + TypeScript 5.9 (strict) + Tailwind CSS 4
- **Local DB**: Dexie.js 4 (IndexedDB)
- **Desktop**: Tauri 2
- **Mobile**: Capacitor
- **i18n**: react-i18next (English + Chinese)
- **Encryption**: Web Crypto API (AES-256-GCM)

## Privacy & Security

LabMate follows the **Either-Or Principle**: operations use at most 2 of 3 capabilities — untrusted input, sensitive data, state mutation. All three together requires explicit user confirmation.

- **Local mode**: Data stays in your browser's IndexedDB. Nothing leaves your machine.
- **Sync mode**: Data is encrypted (AES-256-GCM) before upload. Cloud providers see only ciphertext.

No analytics. No tracking. No accounts required.

## Part of BioInfoSpace

LabMate is part of the [BioInfoSpace](https://bioinfospace.com) ecosystem, alongside [ELISA Calculator](https://apps.bioinfospace.com/ELISA_calculator/), [qPCR Analyzer](https://apps.bioinfospace.com/qpcr-analysis/), [freeCount](https://apps.bioinfospace.com/freeCount/), and [crispRdesignR](https://apps.bioinfospace.com/crispRdesignR/).

## Data Sources

Recipes sourced from Cold Spring Harbor Protocols (public recipes, with DOIs), protocols.io (CC-BY licensed), Sambrook & Russell (*Molecular Cloning*), and community contributions.

## License

[AGPL-3.0](LICENSE)
