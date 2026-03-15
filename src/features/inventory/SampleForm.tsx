import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { Sample, SampleType } from '@/lib/db'

const SAMPLE_TYPES: SampleType[] = [
  'cell_line', 'plasmid', 'antibody', 'primer',
  'protein', 'reagent', 'tissue', 'virus', 'compound', 'other',
]

interface SampleFormProps {
  boxId: number
  position: string
  existing?: Sample
  onSave: (data: Omit<Sample, 'id' | 'createdAt' | 'updatedAt'>) => void
  onDelete?: () => void
  onCancel: () => void
}

export default function SampleForm({ boxId, position, existing, onSave, onDelete, onCancel }: SampleFormProps) {
  const { t } = useTranslation()

  const [name, setName] = useState(existing?.name ?? '')
  const [nameZh, setNameZh] = useState(existing?.nameZh ?? '')
  const [sampleType, setSampleType] = useState<SampleType>(existing?.sampleType ?? 'other')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [quantity, setQuantity] = useState(existing?.quantity ?? '')
  const [concentration, setConcentration] = useState(existing?.concentration ?? '')
  const [passage, setPassage] = useState(existing?.passage ?? '')
  const [dateStored, setDateStored] = useState(() => {
    const d = existing?.dateStored ? new Date(existing.dateStored) : new Date()
    return d.toISOString().slice(0, 10)
  })
  const [expiryDate, setExpiryDate] = useState(() => {
    if (!existing?.expiryDate) return ''
    return new Date(existing.expiryDate).toISOString().slice(0, 10)
  })
  const [vendor, setVendor] = useState(existing?.vendor ?? '')
  const [catalogNumber, setCatalogNumber] = useState(existing?.catalogNumber ?? '')
  const [lotNumber, setLotNumber] = useState(existing?.lotNumber ?? '')
  const [owner, setOwner] = useState(existing?.owner ?? '')
  const [tagsStr, setTagsStr] = useState(existing?.tags?.join(', ') ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Type-specific metadata
  const meta = existing?.metadata ?? {}
  const [dilution, setDilution] = useState(meta.dilution ?? '')
  const [clone, setClone] = useState(meta.clone ?? '')
  const [hostSpecies, setHostSpecies] = useState(meta.hostSpecies ?? '')
  const [reactivity, setReactivity] = useState(meta.reactivity ?? '')
  const [mw, setMw] = useState(meta.mw ?? '')
  const [application, setApplication] = useState(meta.application ?? '')
  const [sequence, setSequence] = useState(meta.sequence ?? '')
  const [targetGene, setTargetGene] = useState(meta.targetGene ?? '')
  const [ampliconSize, setAmpliconSize] = useState(meta.ampliconSize ?? '')
  const [primerSpecies, setPrimerSpecies] = useState(meta.species ?? '')
  const [compoundType, setCompoundType] = useState(meta.compoundType ?? '')
  const [aliquotLocation, setAliquotLocation] = useState(meta.aliquotLocation ?? '')
  const [stockLocation, setStockLocation] = useState(meta.stockLocation ?? '')

  useEffect(() => {
    // Focus name field on mount
    const el = document.getElementById('sample-name-input')
    el?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean)

    // Build metadata based on sample type
    const metadata: Record<string, string> = {}
    if (sampleType === 'antibody') {
      if (dilution.trim()) metadata.dilution = dilution.trim()
      if (clone.trim()) metadata.clone = clone.trim()
      if (hostSpecies.trim()) metadata.hostSpecies = hostSpecies.trim()
      if (reactivity.trim()) metadata.reactivity = reactivity.trim()
      if (mw.trim()) metadata.mw = mw.trim()
      if (application.trim()) metadata.application = application.trim()
    } else if (sampleType === 'primer') {
      if (sequence.trim()) metadata.sequence = sequence.trim()
      if (targetGene.trim()) metadata.targetGene = targetGene.trim()
      if (ampliconSize.trim()) metadata.ampliconSize = ampliconSize.trim()
      if (primerSpecies.trim()) metadata.species = primerSpecies.trim()
    } else if (sampleType === 'compound') {
      if (compoundType.trim()) metadata.compoundType = compoundType.trim()
      if (aliquotLocation.trim()) metadata.aliquotLocation = aliquotLocation.trim()
      if (stockLocation.trim()) metadata.stockLocation = stockLocation.trim()
    }

    onSave({
      name: name.trim(),
      nameZh: nameZh.trim() || undefined,
      boxId,
      position,
      sampleType,
      description: description.trim() || undefined,
      quantity: quantity.trim() || undefined,
      concentration: concentration.trim() || undefined,
      passage: passage.trim() || undefined,
      vendor: vendor.trim() || undefined,
      catalogNumber: catalogNumber.trim() || undefined,
      lotNumber: lotNumber.trim() || undefined,
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      dateStored: new Date(dateStored).getTime(),
      expiryDate: expiryDate ? new Date(expiryDate).getTime() : undefined,
      owner: owner.trim() || undefined,
      tags,
      notes: notes.trim() || undefined,
      isFavorite: existing?.isFavorite ?? false,
    })
  }

  const inputStyle = {
    background: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text)',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    width: '100%',
    fontFamily: 'var(--font-body)',
  }

  const labelStyle = {
    color: 'var(--color-text-secondary)',
    fontSize: '0.75rem',
    fontWeight: 600 as const,
    marginBottom: '0.25rem',
    display: 'block' as const,
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3
          className="text-lg font-bold"
          style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
        >
          {existing ? t('inv.editSample') : t('inv.addSample')}
        </h3>
        <span
          className="text-sm px-2 py-0.5 rounded"
          style={{
            background: 'var(--color-border-light)',
            color: 'var(--color-text-muted)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {position}
        </span>
      </div>

      {/* Name */}
      <div>
        <label style={labelStyle}>{t('inv.name')} *</label>
        <input
          id="sample-name-input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. HEK293T P15"
          required
          style={inputStyle}
        />
      </div>

      {/* Chinese name */}
      <div>
        <label style={labelStyle}>{t('inv.nameZh')}</label>
        <input
          type="text"
          value={nameZh}
          onChange={e => setNameZh(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Type */}
      <div>
        <label style={labelStyle}>{t('inv.sampleType')}</label>
        <select
          value={sampleType}
          onChange={e => setSampleType(e.target.value as SampleType)}
          style={inputStyle}
        >
          {SAMPLE_TYPES.map(st => (
            <option key={st} value={st}>{t(`inv.sample.${st}`)}</option>
          ))}
        </select>
      </div>

      {/* Row: Quantity + Concentration */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={labelStyle}>{t('inv.quantity')}</label>
          <input
            type="text"
            value={quantity}
            onChange={e => setQuantity(e.target.value)}
            placeholder="500 µL"
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('inv.concentration')}</label>
          <input
            type="text"
            value={concentration}
            onChange={e => setConcentration(e.target.value)}
            placeholder="1 µg/µL"
            style={inputStyle}
          />
        </div>
      </div>

      {/* Passage (conditional — only for cell lines) */}
      {sampleType === 'cell_line' && (
        <div>
          <label style={labelStyle}>{t('inv.passage')}</label>
          <input
            type="text"
            value={passage}
            onChange={e => setPassage(e.target.value)}
            placeholder="P15"
            style={inputStyle}
          />
        </div>
      )}

      {/* Vendor / Catalog # / Lot # */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label style={labelStyle}>{t('inv.vendor')}</label>
          <input
            type="text"
            value={vendor}
            onChange={e => setVendor(e.target.value)}
            placeholder="CST, Sigma..."
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('inv.catalogNumber')}</label>
          <input
            type="text"
            value={catalogNumber}
            onChange={e => setCatalogNumber(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('inv.lotNumber')}</label>
          <input
            type="text"
            value={lotNumber}
            onChange={e => setLotNumber(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Antibody-specific metadata */}
      {sampleType === 'antibody' && (
        <div className="space-y-3 p-3 rounded-md" style={{ background: 'var(--color-border-light)' }}>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>{t('inv.dilution')}</label>
              <input
                type="text"
                value={dilution}
                onChange={e => setDilution(e.target.value)}
                placeholder="1:1000"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('inv.clone')}</label>
              <input
                type="text"
                value={clone}
                onChange={e => setClone(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>{t('inv.hostSpecies')}</label>
              <input
                type="text"
                value={hostSpecies}
                onChange={e => setHostSpecies(e.target.value)}
                placeholder="Rabbit, Mouse..."
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('inv.reactivity')}</label>
              <input
                type="text"
                value={reactivity}
                onChange={e => setReactivity(e.target.value)}
                placeholder="Human, Mouse..."
                style={inputStyle}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>{t('inv.mw')}</label>
              <input
                type="text"
                value={mw}
                onChange={e => setMw(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('inv.application')}</label>
              <input
                type="text"
                value={application}
                onChange={e => setApplication(e.target.value)}
                placeholder="WB, IF, IHC..."
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      )}

      {/* Primer-specific metadata */}
      {sampleType === 'primer' && (
        <div className="space-y-3 p-3 rounded-md" style={{ background: 'var(--color-border-light)' }}>
          <div>
            <label style={labelStyle}>{t('inv.sequence')}</label>
            <textarea
              value={sequence}
              onChange={e => setSequence(e.target.value)}
              rows={2}
              placeholder="ATCGATCG..."
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)', fontSize: '0.8rem', resize: 'vertical' as const }}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label style={labelStyle}>{t('inv.targetGene')}</label>
              <input
                type="text"
                value={targetGene}
                onChange={e => setTargetGene(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('inv.ampliconSize')}</label>
              <input
                type="text"
                value={ampliconSize}
                onChange={e => setAmpliconSize(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('inv.species')}</label>
              <input
                type="text"
                value={primerSpecies}
                onChange={e => setPrimerSpecies(e.target.value)}
                placeholder="Human, Mouse..."
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      )}

      {/* Compound-specific metadata */}
      {sampleType === 'compound' && (
        <div className="space-y-3 p-3 rounded-md" style={{ background: 'var(--color-border-light)' }}>
          <div>
            <label style={labelStyle}>{t('inv.compoundType')}</label>
            <input
              type="text"
              value={compoundType}
              onChange={e => setCompoundType(e.target.value)}
              placeholder="Inhibitor, Inducer..."
              style={inputStyle}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={labelStyle}>{t('inv.aliquotLocation')}</label>
              <input
                type="text"
                value={aliquotLocation}
                onChange={e => setAliquotLocation(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>{t('inv.stockLocation')}</label>
              <input
                type="text"
                value={stockLocation}
                onChange={e => setStockLocation(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>
      )}

      {/* Row: Date stored + Expiry */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label style={labelStyle}>{t('inv.dateStored')}</label>
          <input
            type="date"
            value={dateStored}
            onChange={e => setDateStored(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle}>{t('inv.expiryDate')}</label>
          <input
            type="date"
            value={expiryDate}
            onChange={e => setExpiryDate(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Owner */}
      <div>
        <label style={labelStyle}>{t('inv.owner')}</label>
        <input
          type="text"
          value={owner}
          onChange={e => setOwner(e.target.value)}
          style={inputStyle}
        />
      </div>

      {/* Tags */}
      <div>
        <label style={labelStyle}>{t('inv.tags')}</label>
        <input
          type="text"
          value={tagsStr}
          onChange={e => setTagsStr(e.target.value)}
          placeholder="WB, IP, validated"
          style={inputStyle}
        />
      </div>

      {/* Description */}
      <div>
        <label style={labelStyle}>{t('inv.description')}</label>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' as const }}
        />
      </div>

      {/* Notes */}
      <div>
        <label style={labelStyle}>{t('inv.notes')}</label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={2}
          style={{ ...inputStyle, resize: 'vertical' as const }}
        />
      </div>

      {/* Buttons */}
      <div className="flex items-center gap-3 pt-2">
        <button type="submit" className="btn-primary text-sm px-4 py-2 flex-1">
          {t('inv.save')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm px-4 py-2 rounded-md flex-1"
          style={{
            background: 'var(--color-border-light)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          {t('inv.cancel')}
        </button>
      </div>

      {/* Delete (only for existing) */}
      {existing && onDelete && (
        <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {showDeleteConfirm ? (
            <div className="flex items-center gap-3">
              <p className="text-xs flex-1" style={{ color: 'var(--color-error)' }}>
                {t('inv.deleteConfirm')}
              </p>
              <button
                type="button"
                onClick={onDelete}
                className="text-xs px-3 py-1 rounded-md font-medium"
                style={{ background: 'var(--color-error)', color: 'white' }}
              >
                {t('inv.confirm')}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-xs px-3 py-1 rounded-md"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t('inv.cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-xs"
              style={{ color: 'var(--color-error)' }}
            >
              {t('inv.deleteSample')}
            </button>
          )}
        </div>
      )}
    </form>
  )
}
