import { useState, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/lib/db'
import type { StorageLocation, SampleBox, Sample } from '@/lib/db'
import { sampleTypeColors } from '@/lib/db'
import StorageTree from './StorageTree'
import BoxGrid from './BoxGrid'
import SampleForm from './SampleForm'
import LocationForm from './LocationForm'
import BoxForm from './BoxForm'
import { exportBoxCsv, exportAllCsv, exportAllXlsx, exportInventoryJson, printBoxGrid } from './exportInventory'
import { importInventoryFile, generateCsvTemplate } from './importInventory'
import type { ParsedWorkbook } from './parseExcel'
import ImportWizard from './ImportWizard'

type ModalState =
  | { kind: 'none' }
  | { kind: 'addLocation'; parentId?: number }
  | { kind: 'editLocation'; location: StorageLocation }
  | { kind: 'addBox'; locationId: number }
  | { kind: 'editBox'; box: SampleBox }
  | { kind: 'addSample'; boxId: number; position: string }
  | { kind: 'editSample'; sample: Sample }
  | { kind: 'importWizard'; workbook: ParsedWorkbook }

// Mobile drill-down levels
type MobileView = 'tree' | 'grid' | 'sample'

export default function InventoryTab() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language

  // DB queries
  const locationsQuery = useLiveQuery(() => db.storageLocations.toArray())
  const boxesQuery = useLiveQuery(() => db.sampleBoxes.toArray())
  const samplesQuery = useLiveQuery(() => db.samples.toArray())
  const locations: StorageLocation[] = useMemo(() => locationsQuery ?? [], [locationsQuery])
  const boxes: SampleBox[] = useMemo(() => boxesQuery ?? [], [boxesQuery])
  const allSamples: Sample[] = useMemo(() => samplesQuery ?? [], [samplesQuery])

  // UI state
  const [selectedBoxId, setSelectedBoxId] = useState<number | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'mine' | 'lab'>('all')
  const [modal, setModal] = useState<ModalState>({ kind: 'none' })
  const [mobileView, setMobileView] = useState<MobileView>('tree')

  // Derived
  const selectedBox = boxes.find(b => b.id === selectedBoxId)
  const boxSamples = useMemo(
    () => selectedBoxId ? allSamples.filter(s => s.boxId === selectedBoxId) : [],
    [allSamples, selectedBoxId],
  )

  // Search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return null
    const q = searchQuery.toLowerCase()
    return allSamples.filter(s =>
      s.name.toLowerCase().includes(q)
      || (s.nameZh && s.nameZh.includes(q))
      || s.tags.some(tag => tag.toLowerCase().includes(q))
      || s.sampleType.includes(q)
      || (s.owner && s.owner.toLowerCase().includes(q))
      || (s.description && s.description.toLowerCase().includes(q))
      || (s.vendor && s.vendor.toLowerCase().includes(q))
      || (s.catalogNumber && s.catalogNumber.toLowerCase().includes(q))
    )
  }, [allSamples, searchQuery])

  // Location path helper
  function getLocationPath(locationId: number): string {
    const parts: string[] = []
    let current = locations.find(l => l.id === locationId)
    while (current) {
      parts.unshift(lang === 'zh' && current.nameZh ? current.nameZh : current.name)
      current = current.parentId ? locations.find(l => l.id === current!.parentId) : undefined
    }
    return parts.join(' > ')
  }

  function getBoxName(boxId: number): string {
    const box = boxes.find(b => b.id === boxId)
    if (!box) return ''
    return lang === 'zh' && box.nameZh ? box.nameZh : box.name
  }

  // CRUD handlers
  async function handleSaveLocation(data: Omit<StorageLocation, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now()
    if (modal.kind === 'editLocation') {
      await db.storageLocations.update(modal.location.id!, { ...data, updatedAt: now })
    } else {
      await db.storageLocations.add({ ...data, createdAt: now, updatedAt: now })
    }
    setModal({ kind: 'none' })
  }

  async function handleDeleteLocation(id: number) {
    // Delete all boxes and samples in this location
    const locBoxes = boxes.filter(b => b.locationId === id)
    for (const box of locBoxes) {
      await db.samples.where('boxId').equals(box.id!).delete()
    }
    await db.sampleBoxes.where('locationId').equals(id).delete()
    // Also delete child locations recursively
    const children = locations.filter(l => l.parentId === id)
    for (const child of children) {
      await handleDeleteLocation(child.id!)
    }
    await db.storageLocations.delete(id)
    setModal({ kind: 'none' })
  }

  async function handleSaveBox(data: Omit<SampleBox, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now()
    if (modal.kind === 'editBox') {
      await db.sampleBoxes.update(modal.box.id!, { ...data, updatedAt: now })
    } else {
      const id = await db.sampleBoxes.add({ ...data, createdAt: now, updatedAt: now })
      setSelectedBoxId(id as number)
    }
    setModal({ kind: 'none' })
  }

  async function handleDeleteBox(id: number) {
    await db.samples.where('boxId').equals(id).delete()
    await db.sampleBoxes.delete(id)
    if (selectedBoxId === id) setSelectedBoxId(null)
    setModal({ kind: 'none' })
  }

  async function handleSaveSample(data: Omit<Sample, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = Date.now()
    if (modal.kind === 'editSample') {
      await db.samples.update(modal.sample.id!, { ...data, updatedAt: now })
    } else {
      await db.samples.add({ ...data, createdAt: now, updatedAt: now })
    }
    setModal({ kind: 'none' })
  }

  async function handleDeleteSample(id: number) {
    await db.samples.delete(id)
    setModal({ kind: 'none' })
  }

  // Export/Import
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [showExportMenu, setShowExportMenu] = useState(false)
  const [importStatus, setImportStatus] = useState<{ message: string; isError: boolean } | null>(null)

  function handleExportBoxCsv() {
    if (!selectedBox) return
    exportBoxCsv(selectedBox, boxSamples, getLocationPath(selectedBox.locationId))
    setShowExportMenu(false)
  }

  function handleExportAllCsv() {
    exportAllCsv(locations, boxes, allSamples, getLocationPath)
    setShowExportMenu(false)
  }

  function handleExportJson() {
    exportInventoryJson(locations, boxes, allSamples)
    setShowExportMenu(false)
  }

  function handleExportXlsx() {
    exportAllXlsx(locations, boxes, allSamples, getLocationPath)
    setShowExportMenu(false)
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const result = await importInventoryFile(file)
      if ('needsWizard' in result) {
        setModal({ kind: 'importWizard', workbook: result.workbook })
      } else {
        setImportStatus({ message: result.message, isError: false })
        setTimeout(() => setImportStatus(null), 5000)
      }
    } catch (err) {
      setImportStatus({ message: err instanceof Error ? err.message : 'Import failed', isError: true })
      setTimeout(() => setImportStatus(null), 5000)
    }
    // Reset file input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function handleCellClick(position: string, sample?: Sample) {
    if (sample) {
      setModal({ kind: 'editSample', sample })
    } else if (selectedBoxId) {
      setModal({ kind: 'addSample', boxId: selectedBoxId, position })
    }
  }

  function handleSelectBox(boxId: number) {
    setSelectedBoxId(boxId)
    setMobileView('grid')
  }

  function handleSearchResultClick(sample: Sample) {
    setSelectedBoxId(sample.boxId)
    setSearchQuery('')
    setModal({ kind: 'editSample', sample })
    setMobileView('grid')
  }

  // ── Render ──

  const searchBar = (
    <div className="relative mb-4">
      <svg
        width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        className="absolute left-3 top-1/2 -translate-y-1/2"
        style={{ color: 'var(--color-text-muted)' }}
      >
        <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
      </svg>
      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder={t('inv.search')}
        className="w-full pl-10 pr-3 py-2 text-sm rounded-md"
        style={{
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text)',
          fontFamily: 'var(--font-body)',
        }}
      />
      {searchQuery && (
        <button
          onClick={() => setSearchQuery('')}
          className="absolute right-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  )

  const searchResultsList = searchResults && (
    <div className="space-y-2">
      {searchResults.length === 0 ? (
        <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
          {t('inv.noResults')}
        </p>
      ) : (
        searchResults.map(sample => {
          const box = boxes.find(b => b.id === sample.boxId)
          const colors = sampleTypeColors[sample.sampleType]
          return (
            <button
              key={sample.id}
              onClick={() => handleSearchResultClick(sample)}
              className="card p-3 w-full text-left flex items-start gap-3 hover:shadow-md transition-shadow"
            >
              <span
                className="inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold shrink-0"
                style={{ background: colors.bg, color: colors.text, fontFamily: 'var(--font-mono)' }}
              >
                {sample.position}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                  {sample.name}
                </p>
                <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                  {box ? `${getLocationPath(box.locationId)} > ${getBoxName(box.id!)}` : ''}
                </p>
                {(sample.vendor || sample.catalogNumber) && (
                  <p className="text-[10px] truncate" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {[sample.vendor, sample.catalogNumber].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className="text-[10px] px-1.5 py-0.5 rounded-full"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {t(`inv.sample.${sample.sampleType}`)}
                  </span>
                  {sample.quantity && (
                    <span className="text-[10px]" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {sample.quantity}
                    </span>
                  )}
                </div>
              </div>
            </button>
          )
        })
      )}
    </div>
  )

  const rightPanel = () => {
    if (searchResults) {
      return searchResultsList
    }

    if (!selectedBox) {
      return (
        <div className="card p-8 text-center" style={{ color: 'var(--color-text-muted)' }}>
          <svg
            width="48" height="48" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"
            className="mx-auto mb-3" style={{ opacity: 0.4 }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M9 3v18" />
          </svg>
          <p className="text-sm">{t('inv.selectBox')}</p>
        </div>
      )
    }

    return (
      <div>
        {/* Box header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3
              className="text-lg font-bold"
              style={{ fontFamily: 'var(--font-heading)', color: 'var(--color-text)' }}
            >
              {lang === 'zh' && selectedBox.nameZh ? selectedBox.nameZh : selectedBox.name}
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {getLocationPath(selectedBox.locationId)}
              {selectedBox.color && ` · ${selectedBox.color}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className="text-xs px-2 py-1 rounded"
              style={{
                background: 'var(--color-border-light)',
                color: 'var(--color-text-muted)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {t(`inv.box.${selectedBox.boxType}`)}
            </span>
            {/* Box-level actions */}
            <button
              onClick={handleExportBoxCsv}
              className="p-1.5 rounded-md hover:opacity-70 no-print"
              style={{ color: 'var(--color-text-muted)' }}
              title={t('inv.exportBoxCsv')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </button>
            <button
              onClick={printBoxGrid}
              className="p-1.5 rounded-md hover:opacity-70 no-print"
              style={{ color: 'var(--color-text-muted)' }}
              title={t('inv.print')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 6 2 18 2 18 9" />
                <path d="M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2" />
                <rect x="6" y="14" width="12" height="8" />
              </svg>
            </button>
          </div>
        </div>

        <p className="text-xs mb-3 no-print" style={{ color: 'var(--color-text-muted)' }}>
          {t('inv.clickToAdd')}
        </p>

        <BoxGrid
          box={selectedBox}
          samples={boxSamples}
          onCellClick={handleCellClick}
        />

        {/* Sample list below grid */}
        {boxSamples.length > 0 && (
          <div className="mt-6">
            <h4
              className="text-sm font-semibold mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('inv.listView')} ({boxSamples.length})
            </h4>
            <div className="space-y-1">
              {boxSamples
                .sort((a, b) => a.position.localeCompare(b.position))
                .map(sample => {
                  const colors = sampleTypeColors[sample.sampleType]
                  return (
                    <button
                      key={sample.id}
                      onClick={() => setModal({ kind: 'editSample', sample })}
                      className="w-full flex items-center gap-3 py-2 px-3 rounded-md text-left hover:opacity-80 transition-colors"
                      style={{ background: 'var(--color-bg)' }}
                    >
                      <span
                        className="text-xs font-bold w-7 text-center"
                        style={{ color: colors.text, fontFamily: 'var(--font-mono)' }}
                      >
                        {sample.position}
                      </span>
                      <span className="text-sm flex-1 truncate" style={{ color: 'var(--color-text)' }}>
                        {sample.name}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: colors.bg, color: colors.text }}
                      >
                        {t(`inv.sample.${sample.sampleType}`)}
                      </span>
                      {sample.quantity && (
                        <span className="text-[10px]" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {sample.quantity}
                        </span>
                      )}
                    </button>
                  )
                })}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Modal overlay
  const modalOverlay = modal.kind !== 'none' && (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.4)' }}
      onClick={e => { if (e.target === e.currentTarget) setModal({ kind: 'none' }) }}
    >
      <div
        className="card p-6 w-full max-w-md max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {(modal.kind === 'addLocation' || modal.kind === 'editLocation') && (
          <LocationForm
            existing={modal.kind === 'editLocation' ? modal.location : undefined}
            parentId={modal.kind === 'addLocation' ? modal.parentId : undefined}
            onSave={handleSaveLocation}
            onDelete={
              modal.kind === 'editLocation'
                ? () => handleDeleteLocation(modal.location.id!)
                : undefined
            }
            onCancel={() => setModal({ kind: 'none' })}
          />
        )}
        {(modal.kind === 'addBox' || modal.kind === 'editBox') && (
          <BoxForm
            locationId={modal.kind === 'addBox' ? modal.locationId : modal.box.locationId}
            existing={modal.kind === 'editBox' ? modal.box : undefined}
            onSave={handleSaveBox}
            onDelete={
              modal.kind === 'editBox'
                ? () => handleDeleteBox(modal.box.id!)
                : undefined
            }
            onCancel={() => setModal({ kind: 'none' })}
          />
        )}
        {(modal.kind === 'addSample' || modal.kind === 'editSample') && (
          <SampleForm
            boxId={modal.kind === 'addSample' ? modal.boxId : modal.sample.boxId}
            position={modal.kind === 'addSample' ? modal.position : modal.sample.position}
            existing={modal.kind === 'editSample' ? modal.sample : undefined}
            onSave={handleSaveSample}
            onDelete={
              modal.kind === 'editSample'
                ? () => handleDeleteSample(modal.sample.id!)
                : undefined
            }
            onCancel={() => setModal({ kind: 'none' })}
          />
        )}
        {modal.kind === 'importWizard' && (
          <ImportWizard
            workbook={modal.workbook}
            onDone={(message, _count) => {
              setModal({ kind: 'none' })
              setImportStatus({ message, isError: false })
              setTimeout(() => setImportStatus(null), 5000)
            }}
            onCancel={() => setModal({ kind: 'none' })}
          />
        )}
      </div>
    </div>
  )

  // Export/import toolbar (shared between desktop & mobile)
  const exportImportBar = (
    <div className="flex items-center gap-2 mb-3 no-print">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.json,.xlsx,.xls"
        onChange={handleImportFile}
        className="hidden"
      />

      {/* Export dropdown */}
      <div className="relative">
        <button
          onClick={() => setShowExportMenu(!showExportMenu)}
          className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors"
          style={{
            background: 'var(--color-border-light)',
            color: 'var(--color-text-secondary)',
            border: '1px solid var(--color-border)',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {t('inv.export')}
        </button>
        {showExportMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowExportMenu(false)} />
            <div
              className="absolute left-0 top-full mt-1 z-50 rounded-md py-1 min-w-[10rem]"
              style={{
                background: 'var(--color-bg-card)',
                border: '1px solid var(--color-border)',
                boxShadow: 'var(--shadow-lg)',
              }}
            >
              <button
                onClick={handleExportAllCsv}
                className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80"
                style={{ color: 'var(--color-text)' }}
              >
                {t('inv.exportAllCsv')}
              </button>
              {selectedBox && (
                <button
                  onClick={handleExportBoxCsv}
                  className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80"
                  style={{ color: 'var(--color-text)' }}
                >
                  {t('inv.exportBoxCsv')}
                </button>
              )}
              <button
                onClick={handleExportXlsx}
                className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80"
                style={{ color: 'var(--color-text)' }}
              >
                {t('inv.exportXlsx')}
              </button>
              <button
                onClick={handleExportJson}
                className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80"
                style={{ color: 'var(--color-text)' }}
              >
                {t('inv.exportJson')}
              </button>
              <div className="my-1" style={{ borderTop: '1px solid var(--color-border)' }} />
              <button
                onClick={() => { generateCsvTemplate(); setShowExportMenu(false) }}
                className="w-full text-left px-3 py-1.5 text-xs hover:opacity-80"
                style={{ color: 'var(--color-text-muted)' }}
              >
                {t('inv.downloadTemplate')}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Import button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md transition-colors"
        style={{
          background: 'var(--color-border-light)',
          color: 'var(--color-text-secondary)',
          border: '1px solid var(--color-border)',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        {t('inv.import')}
      </button>

      {/* Owner filter pills */}
      <div className="flex items-center gap-1 ml-auto">
        {(['all', 'mine', 'lab'] as const).map(f => (
          <button
            key={f}
            onClick={() => setOwnerFilter(f)}
            className="text-[10px] px-2 py-0.5 rounded-full transition-colors"
            style={{
              background: ownerFilter === f ? 'var(--color-primary)' : 'var(--color-border-light)',
              color: ownerFilter === f ? 'white' : 'var(--color-text-muted)',
            }}
          >
            {t(`inv.filter${f.charAt(0).toUpperCase() + f.slice(1)}`)}
          </button>
        ))}
      </div>

      {/* Import status toast */}
      {importStatus && (
        <span
          className="text-xs px-2 py-1 rounded-md"
          style={{
            background: importStatus.isError ? 'var(--color-error)' : 'var(--color-success)',
            color: 'white',
          }}
        >
          {importStatus.message}
        </span>
      )}
    </div>
  )

  return (
    <div>
      {/* ── Desktop: two-panel ── */}
      <div className="hidden lg:grid lg:grid-cols-12 gap-6">
        {/* Left panel: search + tree */}
        <div className="lg:col-span-4">
          <div className="card p-4 sticky" style={{ top: '7rem' }}>
            {searchBar}
            {exportImportBar}
            {searchResults ? searchResultsList : (
              <StorageTree
                locations={locations}
                boxes={boxes}
                samples={allSamples}
                selectedBoxId={selectedBoxId}
                onSelectBox={setSelectedBoxId}
                onAddLocation={() => setModal({ kind: 'addLocation' })}
                onAddBox={locationId => setModal({ kind: 'addBox', locationId })}
                onEditLocation={location => setModal({ kind: 'editLocation', location })}
                onEditBox={box => setModal({ kind: 'editBox', box })}
              />
            )}
          </div>
        </div>

        {/* Right panel: grid or detail */}
        <div className="lg:col-span-8">
          <div className="card p-5">
            {rightPanel()}
          </div>
        </div>
      </div>

      {/* ── Mobile: drill-down ── */}
      <div className="lg:hidden">
        {mobileView === 'tree' && (
          <div className="card p-4">
            {searchBar}
            {exportImportBar}
            {searchResults ? searchResultsList : (
              <StorageTree
                locations={locations}
                boxes={boxes}
                samples={allSamples}
                selectedBoxId={selectedBoxId}
                onSelectBox={handleSelectBox}
                onAddLocation={() => setModal({ kind: 'addLocation' })}
                onAddBox={locationId => setModal({ kind: 'addBox', locationId })}
                onEditLocation={location => setModal({ kind: 'editLocation', location })}
                onEditBox={box => setModal({ kind: 'editBox', box })}
              />
            )}
          </div>
        )}

        {mobileView === 'grid' && selectedBox && (
          <div className="card p-4">
            <button
              onClick={() => { setMobileView('tree'); setSelectedBoxId(null) }}
              className="flex items-center gap-1 text-sm mb-4"
              style={{ color: 'var(--color-primary)' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            {rightPanel()}
          </div>
        )}
      </div>

      {modalOverlay}
    </div>
  )
}
