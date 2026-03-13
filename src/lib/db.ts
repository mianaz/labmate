import Dexie, { type EntityTable } from 'dexie'

// ── Schema ──
export interface Protocol {
  id?: number
  externalId: string          // e.g. 'proto_western_blot'
  name: string
  nameZh: string
  category: 'buffer' | 'protocol' | 'staining' | 'media'
  tags: string[]
  components: Component[]
  instructions: { en: string; zh: string }
  briefSteps?: { en: string[]; zh: string[] }
  detailedSteps?: { en: string[]; zh: string[] }
  materials?: Material[]
  reference?: string
  doi?: string
  source?: string
  isFavorite?: boolean
  lastUsed?: number           // epoch ms
  createdAt: number
  updatedAt: number
}

export interface Component {
  name: string
  amount: string
  unit: string
}

export interface Material {
  name: string
  linkedRecipe?: string       // externalId of linked buffer/recipe
}

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

export interface UserSettings {
  id?: number
  key: string
  value: string
}

// ── Database ──
const db = new Dexie('LabMateDB') as Dexie & {
  protocols: EntityTable<Protocol, 'id'>
  experiments: EntityTable<Experiment, 'id'>
  settings: EntityTable<UserSettings, 'id'>
}

db.version(1).stores({
  protocols: '++id, externalId, category, *tags, isFavorite, lastUsed',
  experiments: '++id, protocolId, date, outcome',
  settings: '++id, &key',
})

export { db }
export default db
