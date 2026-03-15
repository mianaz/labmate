import Dexie, { type EntityTable } from 'dexie'

// ── Shared bilingual types ──
export interface BilingualString {
  en: string
  zh: string
}

export interface StepItem {
  en: string
  zh: string
  isHeader?: boolean
}

export interface StorageInfo {
  temp: string
  duration: string
  icon?: string
  label: BilingualString
}

// ── Protocol Schema ──
export interface Protocol {
  id?: number
  externalId: string          // e.g. 'proto_western_blot'
  name: string
  nameZh: string
  category: 'buffer' | 'protocol' | 'staining' | 'media'
  tags: string[]
  components: Component[]
  instructions: BilingualString
  briefSteps?: StepItem[]
  detailedSteps?: StepItem[]
  materials?: Material[]
  reference?: string
  doi?: string
  source: 'official' | 'custom'
  isFavorite?: boolean
  lastUsed?: number           // epoch ms
  createdAt: number
  updatedAt: number

  // Recipe-specific fields
  defaultVolume?: number
  unit?: string
  ph?: string
  usage?: BilingualString
  storage?: StorageInfo
  version: number             // monotonic data version
}

export interface Component {
  name: string
  amount: number | string | null
  unit: string
  note?: string
  mw?: number
}

export interface Material {
  name: string
  note?: BilingualString
  linkedRecipe?: string       // externalId of linked buffer/recipe
}

// ── Experiment Schema ──
export interface Experiment {
  id?: number
  title: string
  protocolId: string          // externalId
  date: number
  notes: string
  deviations: string[]
  outcome: 'success' | 'partial' | 'failed' | 'unclear'
  attachments: string[]       // base64 or blob URLs
  createdAt: number
  updatedAt: number
}

// ── Inventory Schema ──
export type StorageType = 'freezer' | 'fridge' | 'shelf' | 'tank' | 'rack'

export interface StorageLocation {
  id?: number
  name: string
  nameZh: string
  type: StorageType
  temperature?: string        // e.g. '-80°C', '-20°C', '4°C', 'RT', 'LN2'
  parentId?: number           // for rack inside freezer, etc.
  order: number               // sort order within parent
  createdAt: number
  updatedAt: number
}

export type BoxType = 'cryo_81' | 'cryo_100' | 'tip' | 'slide' | 'tube' | 'shelf' | 'box' | 'custom'

export interface SampleBox {
  id?: number
  name: string
  nameZh: string
  locationId: number          // FK → StorageLocation
  boxType: BoxType
  rows: number                // 9 for cryo_81, 10 for cryo_100, etc.
  cols: number
  color?: string              // optional label color for the box
  createdAt: number
  updatedAt: number
}

export type SampleType =
  | 'cell_line' | 'plasmid' | 'antibody' | 'primer'
  | 'protein' | 'reagent' | 'tissue' | 'virus' | 'compound' | 'other'

export interface Sample {
  id?: number
  name: string
  nameZh?: string
  boxId: number               // FK → SampleBox
  position: string            // e.g. 'A1', 'B3'
  sampleType: SampleType
  description?: string
  quantity?: string            // e.g. '500 µL', '2 vials'
  concentration?: string       // e.g. '1 µg/µL'
  passage?: string             // for cell lines
  vendor?: string
  catalogNumber?: string
  lotNumber?: string
  metadata?: Record<string, string>  // type-specific key-value pairs
  dateStored: number           // epoch ms
  expiryDate?: number
  owner?: string
  tags: string[]
  notes?: string
  isFavorite?: boolean
  createdAt: number
  updatedAt: number
}

// ── Settings ──
export interface UserSettings {
  id?: number
  key: string
  value: string
}

// ── Sample type color map ──
export const sampleTypeColors: Record<SampleType, { bg: string; text: string }> = {
  cell_line: { bg: '#e0f2ef', text: '#0b6e63' },
  plasmid:   { bg: '#f3e8ff', text: '#7c3aed' },
  antibody:  { bg: '#fef0ec', text: '#d4552a' },
  primer:    { bg: '#eff6ff', text: '#2563eb' },
  protein:   { bg: '#fef3c7', text: '#92400e' },
  reagent:   { bg: '#f0fdf4', text: '#166534' },
  tissue:    { bg: '#fce7f3', text: '#9d174d' },
  virus:     { bg: '#fef2f2', text: '#991b1b' },
  compound:  { bg: '#fef9c3', text: '#854d0e' },
  other:     { bg: '#f3f4f6', text: '#374151' },
}

// ── Database ──
const db = new Dexie('LabMateDB') as Dexie & {
  protocols: EntityTable<Protocol, 'id'>
  experiments: EntityTable<Experiment, 'id'>
  storageLocations: EntityTable<StorageLocation, 'id'>
  sampleBoxes: EntityTable<SampleBox, 'id'>
  samples: EntityTable<Sample, 'id'>
  settings: EntityTable<UserSettings, 'id'>
}

db.version(1).stores({
  protocols: '++id, externalId, category, *tags, isFavorite, lastUsed',
  experiments: '++id, protocolId, date, outcome',
  settings: '++id, &key',
})

db.version(2).stores({
  protocols: '++id, externalId, category, *tags, isFavorite, lastUsed',
  experiments: '++id, protocolId, date, outcome',
  storageLocations: '++id, name, type, parentId',
  sampleBoxes: '++id, name, locationId, boxType',
  samples: '++id, name, boxId, position, sampleType, *tags, dateStored, owner, isFavorite',
  settings: '++id, &key',
})

db.version(3).stores({
  protocols: '++id, externalId, category, *tags, source, isFavorite, lastUsed',
  experiments: '++id, protocolId, date, outcome',
  storageLocations: '++id, name, type, parentId',
  sampleBoxes: '++id, name, locationId, boxType',
  samples: '++id, name, boxId, position, sampleType, *tags, dateStored, owner, isFavorite',
  settings: '++id, &key',
})

db.version(4).stores({
  protocols: '++id, externalId, category, *tags, source, isFavorite, lastUsed',
  experiments: '++id, protocolId, date, outcome',
  storageLocations: '++id, name, type, parentId',
  sampleBoxes: '++id, name, locationId, boxType',
  samples: '++id, name, boxId, position, sampleType, *tags, dateStored, owner, vendor, isFavorite',
  settings: '++id, &key',
})

export { db }
export default db
