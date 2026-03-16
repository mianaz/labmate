/**
 * Data barrel export
 *
 * All static data from the BioLab Toolkit prototype,
 * ported into typed modules.
 */

export { RECIPES, catColors, NOTES_EN } from './recipes'
export type { RecipeEntry, RecipeComponent, RecipeStorage } from './recipes'

export { PROTOCOL_ENHANCEMENTS } from './protocolEnhancements'
export type { ProtocolEnhancement, StepItem, MaterialItem, StorageInfo, BilingualString } from './protocolEnhancements'

export { EXTERNAL_TOOLS } from './externalTools'

// Remote-origin data files (kebab-case) — kept for reference
export { BUFFER_ENHANCEMENTS } from './buffer-enhancements'
export type { BufferEnhancement } from './buffer-enhancements'

export { REFERENCES } from './references'
export type { Reference } from './references'
