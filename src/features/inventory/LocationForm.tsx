import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import type { StorageLocation, StorageType } from '@/lib/db'

const LOCATION_TYPES: StorageType[] = ['freezer', 'fridge', 'shelf', 'tank', 'rack']
const TEMP_PRESETS = ['-80\u00B0C', '-20\u00B0C', '4\u00B0C', 'RT', 'LN2']

interface LocationFormProps {
  existing?: StorageLocation
  parentId?: number
  onSave: (data: Omit<StorageLocation, 'id' | 'createdAt' | 'updatedAt'>) => void
  onDelete?: () => void
  onCancel: () => void
}

export default function LocationForm({ existing, parentId, onSave, onDelete, onCancel }: LocationFormProps) {
  const { t } = useTranslation()

  const [name, setName] = useState(existing?.name ?? '')
  const [nameZh, setNameZh] = useState(existing?.nameZh ?? '')
  const [type, setType] = useState<StorageType>(existing?.type ?? 'freezer')
  const [temperature, setTemperature] = useState(existing?.temperature ?? '-80\u00B0C')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    document.getElementById('loc-name-input')?.focus()
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    onSave({
      name: name.trim(),
      nameZh: nameZh.trim(),
      type,
      temperature: temperature.trim() || undefined,
      parentId: existing?.parentId ?? parentId,
      order: existing?.order ?? 0,
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
        {existing ? t('inv.editLocation') : t('inv.addLocation')}
      </h3>

      <div>
        <label style={labelStyle}>{t('inv.name')} *</label>
        <input
          id="loc-name-input"
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. -80 Freezer #1"
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
          placeholder="e.g. -80°C冰箱 #1"
          style={inputStyle}
        />
      </div>

      <div>
        <label style={labelStyle}>{t('inv.locationType')}</label>
        <select
          value={type}
          onChange={e => setType(e.target.value as StorageType)}
          style={inputStyle}
        >
          {LOCATION_TYPES.map(lt => (
            <option key={lt} value={lt}>{t(`inv.type.${lt}`)}</option>
          ))}
        </select>
      </div>

      <div>
        <label style={labelStyle}>{t('inv.temperature')}</label>
        <div className="flex gap-2 mb-2 flex-wrap">
          {TEMP_PRESETS.map(tp => (
            <button
              key={tp}
              type="button"
              onClick={() => setTemperature(tp)}
              className="text-xs px-2 py-1 rounded-md transition-colors"
              style={{
                background: temperature === tp ? 'var(--color-primary)' : 'var(--color-border-light)',
                color: temperature === tp ? 'var(--color-text-inverse)' : 'var(--color-text-secondary)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {tp}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={temperature}
          onChange={e => setTemperature(e.target.value)}
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
                {t('inv.locationDeleteConfirm')}
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
              {t('inv.deleteLocation')}
            </button>
          )}
        </div>
      )}
    </form>
  )
}
