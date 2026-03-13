# 🧪 BioInfoSpace LabMate

**Your local-first lab companion — open, private, publication-ready.**

LabMate is a free, open-source lab notebook and protocol management tool built for biologists. All data stays in your browser (IndexedDB) — no account required, no cloud dependency.

## Features

- **Protocol Library** — 80+ buffer recipes and protocols with bilingual UI (EN/ZH)
- **Volume Scaling** — Scale any recipe to your target volume
- **SDS-PAGE Gel Calculator** — Quick reference for gel preparation
- **Solution Calculator** — Dilution (C₁V₁=C₂V₂), mass, molarity, percentage
- **Multi-well Plate Designer** — Visual plate layout with CSV export
- **Protocol Timer** — Multi-timer system with audio alerts
- **External Tools** — Curated links to best-in-class free bioinformatics tools
- **Dark Mode** — Full light/dark theme support

## Tech Stack

- **React 19** + TypeScript
- **Vite** for fast development
- **Tailwind CSS 4** with BioInfoSpace design tokens
- **Dexie.js** (IndexedDB) for local-first storage
- **Web Crypto API** (AES-256-GCM) for optional encrypted sync
- **react-i18next** for bilingual UI

## Getting Started

```bash
git clone https://github.com/mianaz/labmate.git
cd labmate
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

## Architecture

```
src/
├── components/       # Reusable UI components
│   ├── layout/       # Header, sidebar, navigation
│   ├── protocol/     # Protocol card, detail, steps
│   ├── buffer/       # Buffer/recipe components
│   ├── calculator/   # Solution calculator modes
│   ├── plate/        # Plate designer
│   └── tools/        # External tools links
├── data/             # Static recipe/protocol data
├── hooks/            # Custom React hooks
├── i18n/             # EN/ZH translations
├── lib/              # Core utilities
│   ├── db.ts         # Dexie.js schema + database
│   └── crypto.ts     # Web Crypto encryption
├── pages/            # Tab/page components
└── styles/           # CSS with design tokens
```

## Privacy & Security

LabMate follows the **二选一原则 (Either-Or Principle)**:
- **Local mode**: Data stays in your browser's IndexedDB. Nothing leaves your machine.
- **Sync mode**: Data is encrypted (AES-256-GCM) before upload. Cloud providers see only ciphertext.

No analytics. No tracking. No accounts required.

## Part of BioInfoSpace

LabMate is part of the [BioInfoSpace](https://bioinfospace.com) ecosystem, alongside:
- [ELISA Calculator](https://apps.bioinfospace.com/ELISA_calculator/)
- [qPCR Analyzer](https://apps.bioinfospace.com/qpcr-analysis/)
- [freeCount](https://apps.bioinfospace.com/freeCount/)
- [crispRdesignR](https://apps.bioinfospace.com/crispRdesignR/)

## License

MIT — free to use, modify, and distribute.

## Data Sources

Recipes sourced from:
- Cold Spring Harbor Protocols (public recipes, with DOIs)
- protocols.io (CC-BY licensed protocols)
- Sambrook & Russell, *Molecular Cloning*
- Community contributions

---

*Built with care for the bench scientist.*
