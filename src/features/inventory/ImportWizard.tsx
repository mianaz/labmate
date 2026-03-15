import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SampleType } from '@/lib/db'
import { sampleTypeColors } from '@/lib/db'
import type { ParsedWorkbook } from './parseExcel'
import { importSelectedSheets } from './importInventory'

const SAMPLE_TYPES: SampleType[] = [
  'cell_line', 'plasmid', 'antibody', 'primer',
  'protein', 'reagent', 'tissue', 'virus', 'compound', 'other',
]

interface ImportWizardProps {
  workbook: ParsedWorkbook
  onDone: (message: string, count: number) => void
  onCancel: () => void
}

interface SheetSelection {
  sheetName: string
  selected: boolean
  sampleType: SampleType
}

type WizardStep = 'select' | 'preview' | 'importing' | 'done'

export default function ImportWizard({ workbook, onDone, onCancel }: ImportWizardProps) {
  const { t } = useTranslation()

  const [step, setStep] = useState<WizardStep>('select')
  const [defaultOwner, setDefaultOwner] = useState('')
  const [selections, setSelections] = useState<SheetSelection[]>(() =>
    workbook.sheets
      .filter(s => s.kind !== 'skip')
      .map(s => ({
        sheetName: s.name,
        selected: true,
        sampleType: s.detectedType,
      })),
  )
  const [previewSheet, setPreviewSheet] = useState<string | null>(null)
  const [result, setResult] = useState<{ message: string; count: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggleSheet(name: string) {
    setSelections(prev =>
      prev.map(s => s.sheetName === name ? { ...s, selected: !s.selected } : s),
    )
  }

  function setSheetType(name: string, sampleType: SampleType) {
    setSelections(prev =>
      prev.map(s => s.sheetName === name ? { ...s, sampleType } : s),
    )
  }

  async function handleImport() {
    setStep('importing')
    setError(null)
    try {
      const selected = selections
        .filter(s => s.selected)
        .map(s => ({
          sheetName: s.sheetName,
          sampleType: s.sampleType,
          defaultOwner: defaultOwner.trim() || undefined,
        }))

      const res = await importSelectedSheets(workbook, selected)
      setResult(res)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      setStep('select')
    }
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

  const previewSheetData = previewSheet
    ? workbook.sheets.find(s => s.name === previewSheet)
    : null

  return (
    <div className="space-y-4">
      <h3
        className="text-lg font-bold"
        style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
      >
        {t('inv.importWizardTitle')}
      </h3>

      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
        {workbook.fileName}
      </p>

      {error && (
        <div
          className="text-xs p-2 rounded-md"
          style={{ background: 'var(--color-error)', color: 'white' }}
        >
          {error}
        </div>
      )}

      {/* Step: Select sheets */}
      {step === 'select' && (
        <>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {t('inv.importWizardSelectSheets')}
          </p>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {workbook.sheets.map(sheet => {
              const sel = selections.find(s => s.sheetName === sheet.name)
              const isSkipped = sheet.kind === 'skip'
              const colors = sel ? sampleTypeColors[sel.sampleType] : null

              return (
                <div
                  key={sheet.name}
                  className="flex items-center gap-3 p-2 rounded-md"
                  style={{
                    background: isSkipped ? 'transparent' : 'var(--color-bg)',
                    border: `1px solid ${isSkipped ? 'var(--color-border-light)' : 'var(--color-border)'}`,
                    opacity: isSkipped ? 0.5 : 1,
                  }}
                >
                  {!isSkipped && sel && (
                    <input
                      type="checkbox"
                      checked={sel.selected}
                      onChange={() => toggleSheet(sheet.name)}
                    />
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                      {sheet.name}
                    </p>
                    <p className="text-[10px]" style={{ color: 'var(--color-text-muted)' }}>
                      {isSkipped ? 'Skipped' : `${sheet.rowCount} ${t('inv.importWizardRows')} · ${sheet.kind}`}
                    </p>
                  </div>

                  {!isSkipped && sel && (
                    <>
                      <select
                        value={sel.sampleType}
                        onChange={e => setSheetType(sheet.name, e.target.value as SampleType)}
                        className="text-xs px-1.5 py-0.5 rounded"
                        style={{
                          background: colors?.bg ?? 'var(--color-bg)',
                          color: colors?.text ?? 'var(--color-text)',
                          border: '1px solid var(--color-border)',
                        }}
                      >
                        {SAMPLE_TYPES.map(st => (
                          <option key={st} value={st}>{t(`inv.sample.${st}`)}</option>
                        ))}
                      </select>

                      <button
                        onClick={() => setPreviewSheet(
                          previewSheet === sheet.name ? null : sheet.name,
                        )}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ color: 'var(--color-primary)' }}
                      >
                        {t('inv.importWizardPreview')}
                      </button>
                    </>
                  )}
                </div>
              )
            })}
          </div>

          {/* Preview */}
          {previewSheetData && previewSheetData.kind === 'tabular' && (
            <div className="overflow-x-auto max-h-40 border rounded-md" style={{ borderColor: 'var(--color-border)' }}>
              <table className="text-xs w-full">
                <thead>
                  <tr>
                    {previewSheetData.headers.slice(0, 8).map((h, i) => (
                      <th
                        key={i}
                        className="px-2 py-1 text-left font-medium"
                        style={{ background: 'var(--color-border-light)', color: 'var(--color-text-secondary)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewSheetData.rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri}>
                      {previewSheetData.headers.slice(0, 8).map((h, ci) => (
                        <td
                          key={ci}
                          className="px-2 py-1 truncate max-w-[10rem]"
                          style={{ color: 'var(--color-text)', borderTop: '1px solid var(--color-border-light)' }}
                        >
                          {row[h] ?? ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {previewSheetData && previewSheetData.kind === 'grid' && (
            <div className="text-xs p-2 rounded-md" style={{ background: 'var(--color-border-light)', color: 'var(--color-text-secondary)' }}>
              Grid layout: {previewSheetData.gridData?.length ?? 0} rows detected
            </div>
          )}

          {/* Default owner */}
          <div>
            <label
              className="text-xs font-semibold block mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('inv.importWizardDefaultOwner')}
            </label>
            <input
              type="text"
              value={defaultOwner}
              onChange={e => setDefaultOwner(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleImport}
              disabled={selections.every(s => !s.selected)}
              className="btn-primary text-sm px-4 py-2 flex-1"
              style={selections.every(s => !s.selected) ? { opacity: 0.5 } : undefined}
            >
              {t('inv.importWizardStart')}
            </button>
            <button
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
        </>
      )}

      {/* Step: Importing */}
      {step === 'importing' && (
        <div className="text-center py-8">
          <div
            className="inline-block w-8 h-8 border-2 rounded-full animate-spin mb-3"
            style={{ borderColor: 'var(--color-border)', borderTopColor: 'var(--color-primary)' }}
          />
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {t('inv.importWizardImporting')}
          </p>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && result && (
        <div className="text-center py-6 space-y-3">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-full mb-2"
            style={{ background: 'var(--color-success)', color: 'white' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
            {t('inv.importWizardDone')}
          </p>
          <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
            {result.message}
          </p>
          <button
            onClick={() => onDone(result.message, result.count)}
            className="btn-primary text-sm px-6 py-2"
          >
            OK
          </button>
        </div>
      )}
    </div>
  )
}
