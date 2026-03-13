import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import db, { type Protocol, type Component, type Material, type StepItem } from '@/lib/db'

type Category = Protocol['category']

interface RecipeFormProps {
  defaultCategory: Category
  existing?: Protocol
  onSave: () => void
  onCancel: () => void
}

const CATEGORIES: Category[] = ['buffer', 'staining', 'media', 'protocol']

const inputStyle = {
  background: 'var(--color-bg)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-sm)',
  color: 'var(--color-text)',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  width: '100%',
  fontFamily: 'var(--font-body)',
  boxSizing: 'border-box' as const,
}

const labelStyle = {
  color: 'var(--color-text-secondary)',
  fontSize: '0.75rem',
  fontWeight: 600 as const,
  marginBottom: '0.25rem',
  display: 'block' as const,
}

const btnSmall = {
  fontSize: '0.75rem',
  padding: '4px 10px',
  borderRadius: 'var(--radius-sm)',
  border: '1px solid var(--color-border)',
  background: 'var(--color-bg-card)',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
}

export default function RecipeForm({ defaultCategory, existing, onSave, onCancel }: RecipeFormProps) {
  const { t } = useTranslation()
  const isEdit = !!existing

  const [name, setName] = useState(existing?.name ?? '')
  const [nameZh, setNameZh] = useState(existing?.nameZh ?? '')
  const [category, setCategory] = useState<Category>(existing?.category ?? defaultCategory)
  const [tagsStr, setTagsStr] = useState(existing?.tags?.join(', ') ?? '')
  const [defaultVolume, setDefaultVolume] = useState(String(existing?.defaultVolume ?? ''))
  const [unit, setUnit] = useState(existing?.unit ?? 'mL')
  const [ph, setPh] = useState(existing?.ph ?? '')
  const [instructionsEn, setInstructionsEn] = useState(existing?.instructions?.en ?? '')
  const [instructionsZh, setInstructionsZh] = useState(existing?.instructions?.zh ?? '')
  const [reference, setReference] = useState(existing?.reference ?? '')
  const [usageEn, setUsageEn] = useState(existing?.usage?.en ?? '')
  const [usageZh, setUsageZh] = useState(existing?.usage?.zh ?? '')

  // Components (for buffer/staining/media)
  const [components, setComponents] = useState<Component[]>(
    existing?.components?.length ? existing.components : [{ name: '', amount: null, unit: '' }],
  )

  // Materials (for protocol)
  const [materials, setMaterials] = useState<Material[]>(
    existing?.materials?.length ? existing.materials : [{ name: '' }],
  )

  // Steps (for protocol)
  const [briefSteps, setBriefSteps] = useState<StepItem[]>(
    existing?.briefSteps?.length ? existing.briefSteps : [{ en: '', zh: '' }],
  )
  const [detailedSteps, setDetailedSteps] = useState<StepItem[]>(
    existing?.detailedSteps?.length ? existing.detailedSteps : [{ en: '', zh: '' }],
  )

  useEffect(() => {
    document.getElementById('recipe-name-input')?.focus()
  }, [])

  const isProtocol = category === 'protocol'

  function updateComponent(i: number, field: keyof Component, value: string) {
    setComponents(prev => {
      const next = [...prev]
      if (field === 'amount') {
        const num = parseFloat(value)
        next[i] = { ...next[i], amount: value === '' ? null : isNaN(num) ? value : num }
      } else {
        next[i] = { ...next[i], [field]: value }
      }
      return next
    })
  }

  function updateMaterial(i: number, field: string, value: string) {
    setMaterials(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: value }
      return next
    })
  }

  function updateStep(list: StepItem[], setList: (s: StepItem[]) => void, i: number, lang: 'en' | 'zh', value: string) {
    const next = [...list]
    next[i] = { ...next[i], [lang]: value }
    setList(next)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return

    const now = Date.now()
    const tags = tagsStr.split(',').map(s => s.trim()).filter(Boolean)
    const volNum = parseFloat(defaultVolume)

    const data: Omit<Protocol, 'id'> = {
      externalId: existing?.externalId ?? `custom_${now}_${name.trim().toLowerCase().replace(/\s+/g, '_')}`,
      name: name.trim(),
      nameZh: nameZh.trim() || name.trim(),
      category,
      tags,
      components: components.filter(c => c.name.trim()),
      instructions: { en: instructionsEn.trim(), zh: instructionsZh.trim() },
      reference: reference.trim() || undefined,
      source: 'custom',
      isFavorite: existing?.isFavorite ?? false,
      lastUsed: existing?.lastUsed,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      defaultVolume: isNaN(volNum) ? undefined : volNum,
      unit: unit.trim() || undefined,
      ph: ph.trim() || undefined,
      version: (existing?.version ?? 0) + 1,
    }

    if (isProtocol) {
      data.usage = (usageEn.trim() || usageZh.trim())
        ? { en: usageEn.trim(), zh: usageZh.trim() }
        : undefined
      data.materials = materials.filter(m => m.name.trim())
      data.briefSteps = briefSteps.filter(s => s.en.trim() || s.zh.trim())
      data.detailedSteps = detailedSteps.filter(s => s.en.trim() || s.zh.trim())
    }

    if (isEdit && existing?.id) {
      await db.protocols.update(existing.id, data)
    } else {
      await db.protocols.add(data as Protocol)
    }

    onSave()
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: '1.1rem', fontWeight: 700,
        color: 'var(--color-text)', margin: 0 }}>
        {isEdit ? t('db.editCustom') : t('db.addCustom')}
      </h3>

      {/* Name */}
      <div>
        <label style={labelStyle}>{t('inv.name')} *</label>
        <input id="recipe-name-input" type="text" value={name} onChange={e => setName(e.target.value)}
          required placeholder="e.g. My Custom Buffer" style={inputStyle} />
      </div>

      {/* Chinese name */}
      <div>
        <label style={labelStyle}>{t('inv.nameZh')}</label>
        <input type="text" value={nameZh} onChange={e => setNameZh(e.target.value)} style={inputStyle} />
      </div>

      {/* Category */}
      <div>
        <label style={labelStyle}>{t('db.category')}</label>
        <select value={category} onChange={e => setCategory(e.target.value as Category)} style={inputStyle}>
          {CATEGORIES.map(c => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label style={labelStyle}>{t('inv.tags')}</label>
        <input type="text" value={tagsStr} onChange={e => setTagsStr(e.target.value)}
          placeholder="WB, common, cell biology" style={inputStyle} />
      </div>

      {/* Volume / Unit / pH — for buffer types */}
      {!isProtocol && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{t('db.defaultVolume')}</label>
            <input type="number" value={defaultVolume} onChange={e => setDefaultVolume(e.target.value)}
              placeholder="1000" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>{t('calc.unit')}</label>
            <input type="text" value={unit} onChange={e => setUnit(e.target.value)}
              placeholder="mL" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>pH</label>
            <input type="text" value={ph} onChange={e => setPh(e.target.value)}
              placeholder="7.4" style={inputStyle} />
          </div>
        </div>
      )}

      {/* Components table — for buffer types */}
      {!isProtocol && (
        <div>
          <label style={labelStyle}>{t('db.components')}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {components.map((c, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
                <input type="text" value={c.name} onChange={e => updateComponent(i, 'name', e.target.value)}
                  placeholder="Reagent name" style={{ ...inputStyle, padding: '0.4rem 0.6rem' }} />
                <input type="text" value={c.amount ?? ''} onChange={e => updateComponent(i, 'amount', e.target.value)}
                  placeholder="Amount" style={{ ...inputStyle, padding: '0.4rem 0.6rem', fontFamily: 'var(--font-mono)' }} />
                <input type="text" value={c.unit} onChange={e => updateComponent(i, 'unit', e.target.value)}
                  placeholder="Unit" style={{ ...inputStyle, padding: '0.4rem 0.6rem' }} />
                <button type="button" onClick={() => setComponents(prev => prev.filter((_, j) => j !== i))}
                  style={{ ...btnSmall, color: 'var(--color-error)', border: 'none', padding: '4px 6px' }}>
                  &times;
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setComponents(prev => [...prev, { name: '', amount: null, unit: '' }])}
              style={{ ...btnSmall, alignSelf: 'flex-start', color: 'var(--color-primary)' }}>
              + {t('db.addRow')}
            </button>
          </div>
        </div>
      )}

      {/* Usage — for protocol */}
      {isProtocol && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div>
            <label style={labelStyle}>{t('buffer.usage')} (EN)</label>
            <textarea value={usageEn} onChange={e => setUsageEn(e.target.value)}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div>
            <label style={labelStyle}>{t('buffer.usage')} (ZH)</label>
            <textarea value={usageZh} onChange={e => setUsageZh(e.target.value)}
              rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>
      )}

      {/* Materials — for protocol */}
      {isProtocol && (
        <div>
          <label style={labelStyle}>{t('protocol.materials')}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {materials.map((m, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="text" value={m.name} onChange={e => updateMaterial(i, 'name', e.target.value)}
                  placeholder="Material name" style={{ ...inputStyle, flex: 1, padding: '0.4rem 0.6rem' }} />
                <button type="button" onClick={() => setMaterials(prev => prev.filter((_, j) => j !== i))}
                  style={{ ...btnSmall, color: 'var(--color-error)', border: 'none', padding: '4px 6px' }}>
                  &times;
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setMaterials(prev => [...prev, { name: '' }])}
              style={{ ...btnSmall, alignSelf: 'flex-start', color: 'var(--color-primary)' }}>
              + {t('db.addRow')}
            </button>
          </div>
        </div>
      )}

      {/* Brief steps — for protocol */}
      {isProtocol && (
        <div>
          <label style={labelStyle}>{t('protocol.brief')}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {briefSteps.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'start' }}>
                <input type="text" value={s.en} onChange={e => updateStep(briefSteps, setBriefSteps, i, 'en', e.target.value)}
                  placeholder="Step (EN)" style={{ ...inputStyle, padding: '0.4rem 0.6rem' }} />
                <input type="text" value={s.zh} onChange={e => updateStep(briefSteps, setBriefSteps, i, 'zh', e.target.value)}
                  placeholder="Step (ZH)" style={{ ...inputStyle, padding: '0.4rem 0.6rem' }} />
                <button type="button" onClick={() => setBriefSteps(prev => prev.filter((_, j) => j !== i))}
                  style={{ ...btnSmall, color: 'var(--color-error)', border: 'none', padding: '4px 6px', marginTop: 4 }}>
                  &times;
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setBriefSteps(prev => [...prev, { en: '', zh: '' }])}
              style={{ ...btnSmall, alignSelf: 'flex-start', color: 'var(--color-primary)' }}>
              + {t('db.addRow')}
            </button>
          </div>
        </div>
      )}

      {/* Detailed steps — for protocol */}
      {isProtocol && (
        <div>
          <label style={labelStyle}>{t('protocol.detailed')}</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {detailedSteps.map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, alignItems: 'start' }}>
                <textarea value={s.en} onChange={e => updateStep(detailedSteps, setDetailedSteps, i, 'en', e.target.value)}
                  placeholder="Detailed step (EN)" rows={2} style={{ ...inputStyle, padding: '0.4rem 0.6rem', resize: 'vertical' }} />
                <textarea value={s.zh} onChange={e => updateStep(detailedSteps, setDetailedSteps, i, 'zh', e.target.value)}
                  placeholder="Detailed step (ZH)" rows={2} style={{ ...inputStyle, padding: '0.4rem 0.6rem', resize: 'vertical' }} />
                <button type="button" onClick={() => setDetailedSteps(prev => prev.filter((_, j) => j !== i))}
                  style={{ ...btnSmall, color: 'var(--color-error)', border: 'none', padding: '4px 6px', marginTop: 4 }}>
                  &times;
                </button>
              </div>
            ))}
            <button type="button" onClick={() => setDetailedSteps(prev => [...prev, { en: '', zh: '' }])}
              style={{ ...btnSmall, alignSelf: 'flex-start', color: 'var(--color-primary)' }}>
              + {t('db.addRow')}
            </button>
          </div>
        </div>
      )}

      {/* Instructions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={labelStyle}>{t('db.instructions')} (EN)</label>
          <textarea value={instructionsEn} onChange={e => setInstructionsEn(e.target.value)}
            rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <div>
          <label style={labelStyle}>{t('db.instructions')} (ZH)</label>
          <textarea value={instructionsZh} onChange={e => setInstructionsZh(e.target.value)}
            rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
      </div>

      {/* Reference */}
      <div>
        <label style={labelStyle}>{t('db.reference')}</label>
        <input type="text" value={reference} onChange={e => setReference(e.target.value)}
          placeholder="Author (Year) Journal" style={inputStyle} />
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12, paddingTop: 8 }}>
        <button type="submit" className="btn-primary" style={{ flex: 1, padding: '0.6rem' }}>
          {t('inv.save')}
        </button>
        <button type="button" onClick={onCancel}
          style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)', background: 'var(--color-bg-card)',
            color: 'var(--color-text-secondary)', cursor: 'pointer' }}>
          {t('inv.cancel')}
        </button>
      </div>
    </form>
  )
}
