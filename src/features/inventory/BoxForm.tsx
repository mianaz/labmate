import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { SampleBox, BoxType } from '@/lib/db'

const BOX_CONFIGS: { type: BoxType; rows: number; cols: number }[] = [
  { type: 'cryo_81', rows: 9, cols: 9 },
  { type: 'cryo_100', rows: 10, cols: 10 },
  { type: 'tip', rows: 8, cols: 12 },
  { type: 'slide', rows: 1, cols: 25 },
  { type: 'tube', rows: 4, cols: 6 },
  { type: 'shelf', rows: 10, cols: 1 },
  { type: 'box', rows: 10, cols: 1 },
  { type: 'custom', rows: 8, cols: 8 },
]

interface BoxFormProps {
  locationId: number
  existing?: SampleBox
  onSave: (data: Omit<SampleBox, 'id' | 'createdAt' | 'updatedAt'>) => void
  onDelete?: () => void
  onCancel: () => void
}

export default function BoxForm({ locationId, existing, onSave, onDelete, onCancel }: BoxFormProps) {
  const { t } = useTranslation()

  const [name, setName] = useState(existing?.name ?? '')
  const [nameZh, setNameZh] = useState(existing?.nameZh ?? '')
  const [boxType, setBoxType] = useState<BoxType>(existing?.boxType ?? 'cryo_81')
  const [rows, setRows] = useState(existing?.rows ?? 9)
  const [cols, setCols] = useState(existing?.cols ?? 9)
  const [color, setColor] = useState(existing?.color ?? '')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    document.getElementById('box-name-input')?.focus()
  }, [])

  function handleTypeChange(bt: BoxType) {
    setBoxType(bt)
    const config = BOX_CONFIGS.find(c => c.type === bt)
    if (config) {
      setRows(config.rows)
      setCols(config.cols)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    onSave({
      name: name.trim(),
      nameZh: nameZh.trim(),
      locationId: existing?.locationId ?? locationId,
      boxType,
      rows,
      cols,
      color: color.trim() || undefined,
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
      <h3
        className="text-lg font-bold mb-2"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
      >
        {existing ? t('inv.editBox') : t('inv.addBox')}
      </h3>

      <div>
        <label style={labelStyle}>{t('inv.name')} *</label>
        <input
          id="box-name-input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Box A-1"
          required
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('inv.nameZh')}</label>
        <input
          type="text"
          value={nameZh}
          onChange={e => setNameZh(e.target.value)}
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('inv.boxType')}</label>
        <div className="grid grid-cols-3 gap-2 mb-2">
          {BOX_CONFIGS.map(({ type }) => (
            <button
              key={type}
              type="button"
              onClick={() => handleTypeChange(type)}
              className="text-xs px-2 py-1.5 rounded-md transition-colors text-center"
              style={{
                background: boxType === type ? 'var(--color-primary)' : 'var(--color-border-light)',
                color: boxType === type ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
              }}
            >
              {t(`inv.box.${type}`)}
            </button>
          ))}
        </div>
      </div>

      {boxType === 'custom' && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label style={labelStyle}>Rows</label>
            <input
              type="number"
              min={1}
              max={26}
              value={rows}
              onChange={e => setRows(Number(e.target.value))}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
            />
          </div>
          <div>
            <label style={labelStyle}>Cols</label>
            <input
              type="number"
              min={1}
              max={26}
              value={cols}
              onChange={e => setCols(Number(e.target.value))}
              style={{ ...inputStyle, fontFamily: 'var(--font-mono)' }}
            />
          </div>
        </div>
      )}

      <div>
        <label style={labelStyle}>
          {rows}×{cols} = {rows * cols} positions
        </label>
      </div>

      <div>
        <label style={labelStyle}>Color Label</label>
        <input
          type="text"
          value={color}
          onChange={e => setColor(e.target.value)}
          placeholder="e.g. Red, Blue"
          style={inputStyle}
        />
      </div>

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

      {existing && onDelete && (
        <div className="pt-2 border-t" style={{ borderColor: 'var(--color-border)' }}>
          {showDeleteConfirm ? (
            <div className="flex items-center gap-3">
              <p className="text-xs flex-1" style={{ color: 'var(--color-error)' }}>
                {t('inv.boxDeleteConfirm')}
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
              {t('inv.deleteBox')}
            </button>
          )}
        </div>
      )}
    </form>
  )
}
