# Recipe Quality Standard Reference

## Required fields for ALL recipes:
- `id`, `name`, `nameCn`, `category`, `tags`, `defaultVolume`, `unit`, `components`
- `notes: {en, zh}` — bilingual
- `usage: {en, zh}` — bilingual 
- `storage: {temp, duration, icon, label: {en, zh}}`
- `discipline: [...]` — array of strings
- `relatedProtocols: [...]` — array of recipe IDs that exist in the database

## Required for PROTOCOLS (category: "protocol"):
- `safeStops: [{afterStep: <number>, note: {en, zh}}]` — safe stopping points. Every protocol MUST have at least one. Identify natural pause points (overnight incubations, -20/-80 storage steps).
- `detailedSteps: [{en, zh, isHeader?, time?, temp?}]` — step-by-step tracker. Include day headers (isHeader:true), each step bilingual. Be scientifically accurate.
- `briefSteps: [{en, zh}]` — one-line summary of the workflow (e.g. "Lyse → quantify → SDS-PAGE → transfer → block → Ab → detect")
- `materials: [{name, linkedRecipe?}]` — materials list. Use `linkedRecipe` to cross-reference buffer/reagent IDs.

## Required for BUFFERS (category: "buffer"/"media"/"staining"):
- `prepSteps: [{en, zh}]` — preparation steps

## Cross-linking:
- `relatedProtocols` should reference REAL recipe IDs
- `materials[].linkedRecipe` should reference REAL buffer/reagent IDs
- Validate all cross-references exist in the database

## NaN rules:
- `storage.temp: "N/A"` is VALID for protocols only
- No other field should contain "nan", "N/A", "none", "null", "undefined"
- All bilingual fields must have BOTH en and zh filled

## Example safeStops:
```json
[
  {"afterStep": 3, "note": {"en": "Lysate can be stored at -80°C for months", "zh": "裂解液可 -80°C 保存数月"}},
  {"afterStep": 8, "note": {"en": "Membrane can be stored dry at RT for weeks", "zh": "膜可室温干燥保存数周"}}
]
```

## Example detailedSteps:
```json
[
  {"en": "**Day 1 — Sample prep**", "zh": "**第一天 — 样品制备**", "isHeader": true},
  {"en": "Lyse cells in RIPA buffer on ice for 30 min", "zh": "用 RIPA 缓冲液在冰上裂解细胞 30 分钟", "time": "30 min", "temp": "4°C"},
  {"en": "Centrifuge at 14,000×g for 15 min at 4°C, collect supernatant", "zh": "4°C 14,000×g 离心 15 分钟，收集上清", "time": "15 min", "temp": "4°C"}
]
```

## Example briefSteps:
```json
[{"en": "Lyse → quantify → SDS-PAGE → transfer → block → primary Ab O/N → wash → secondary Ab 1h → wash → ECL detect", "zh": "裂解 → 定量 → SDS-PAGE → 转膜 → 封闭 → 一抗过夜 → 洗 → 二抗 1h → 洗 → ECL 检测"}]
```
