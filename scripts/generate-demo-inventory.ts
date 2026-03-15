/**
 * generate-demo-inventory.ts — Creates a demo Excel inventory file
 * for LabMate import testing and GitHub demonstration.
 *
 * Run: npx tsx scripts/generate-demo-inventory.ts
 * Output: public/demo/LabMate_Demo_Inventory.xlsx
 */

import XLSX from 'xlsx'
import { mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = resolve(__dirname, '../public/demo')
const OUTPUT_PATH = resolve(OUTPUT_DIR, 'LabMate_Demo_Inventory.xlsx')

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true })

const wb = XLSX.utils.book_new()

// ── Sheet 1: Antibodies ──
const antibodyHeaders = [
  'Name', 'Vendor', 'Catalog #', 'Lot #', 'Host Species', 'Reactivity',
  'Clone', 'Dilution (WB)', 'Dilution (IF)', 'MW (kDa)',
  'Application', 'Quantity', 'Owner', 'Notes',
]
const antibodyData = [
  ['Anti-GAPDH', 'CST', '5174S', '12', 'Rabbit', 'Human, Mouse, Rat',
   '14C10', '1:1000', '1:200', '37',
   'WB, IF, IHC', '100 µL', 'Lab Common', 'Loading control'],
  ['Anti-beta-Actin', 'Sigma', 'A5316', 'GR3456', 'Mouse', 'Human, Mouse',
   'AC-74', '1:5000', '', '42',
   'WB', '200 µL', 'Lab Common', 'Loading control, HRP-conjugated available'],
  ['Anti-AR (N-20)', 'Santa Cruz', 'sc-816', '', 'Rabbit', 'Human, Mouse',
   'N-20', '1:500', '1:100', '110',
   'WB, IF, IP', '100 µL', 'Alice', 'AR full length'],
  ['Anti-PSA', 'Dako', 'A0562', 'A8823', 'Rabbit', 'Human',
   'Polyclonal', '1:2000', '1:500', '33',
   'WB, IHC', '50 µL', 'Lab Common', ''],
  ['Anti-Synaptophysin', 'CST', '36406', '3', 'Rabbit', 'Human, Mouse',
   'D8F6H', '1:1000', '1:200', '38',
   'WB, IF, IHC', '100 µL', 'Alice', 'NEPC marker'],
  ['Anti-FOXA2', 'Abcam', 'ab108422', 'GR339', 'Rabbit', 'Human, Mouse',
   'EPR4466', '1:1000', '1:250', '50',
   'WB, IF, ChIP', '100 µL', 'Lab Common', ''],
  ['Anti-Ki67', 'CST', '9449S', '7', 'Mouse', 'Human',
   '8D5', '1:800', '1:200', '359',
   'WB, IF, IHC', '100 µL', 'Lab Common', 'Proliferation marker'],
  ['Anti-H3K27me3', 'CST', '9733S', '14', 'Rabbit', 'Human, Mouse, Rat',
   'C36B11', '1:1000', '1:100', '17',
   'WB, IF, ChIP', '100 µL', 'Alice', 'Histone modification'],
  ['Anti-ERG', 'Abcam', 'ab92513', 'GR198', 'Rabbit', 'Human',
   'EPR3864', '1:2000', '1:500', '55',
   'WB, IF, IHC', '100 µL', 'Lab Common', 'ETS family TF'],
  ['Anti-Vimentin', 'CST', '5741S', '9', 'Rabbit', 'Human, Mouse',
   'D21H3', '1:1000', '1:100', '57',
   'WB, IF', '100 µL', 'Lab Common', 'EMT marker'],
  ['Anti-EZH2', 'CST', '5246S', '10', 'Rabbit', 'Human, Mouse',
   'D2C9', '1:1000', '1:200', '98',
   'WB, IF, ChIP', '100 µL', 'Alice', 'Polycomb complex'],
  ['Anti-PTEN', 'CST', '9188S', '8', 'Rabbit', 'Human, Mouse',
   '138G6', '1:1000', '', '54',
   'WB, IHC', '100 µL', 'Lab Common', 'Tumor suppressor'],
]
const wsAb = XLSX.utils.aoa_to_sheet([antibodyHeaders, ...antibodyData])
wsAb['!cols'] = antibodyHeaders.map(() => ({ wch: 18 }))
XLSX.utils.book_append_sheet(wb, wsAb, 'Antibodies (4C)')

// ── Sheet 2: Primers / Oligos ──
const primerHeaders = [
  'Name', 'Sequence (5\'→3\')', 'Target Gene', 'Species',
  'Amplicon Size (bp)', 'Tm (°C)', 'Vendor', 'Catalog #', 'Notes',
]
const primerData = [
  ['hGAPDH-F', 'ACAACTTTGGTATCGTGGAAGG', 'GAPDH', 'Human',
   '101', '60', 'IDT', '', 'Housekeeping control'],
  ['hGAPDH-R', 'GCCATCACGCCACAGTTTC', 'GAPDH', 'Human',
   '101', '60', 'IDT', '', ''],
  ['hAR-F', 'CCAGGGACCATGTTTTGCC', 'AR', 'Human',
   '148', '60', 'IDT', '', 'Full-length AR'],
  ['hAR-R', 'GAAGACCTTGCAGCTTCCAC', 'AR', 'Human',
   '148', '60', 'IDT', '', ''],
  ['hARv7-F', 'CCATCTTGTCGTCTTCGGAAATGTTA', 'AR-V7', 'Human',
   '125', '62', 'IDT', '', 'Splice variant specific'],
  ['hARv7-R', 'TTTGAATGAGGCAAGTCAGCCTTTCT', 'AR-V7', 'Human',
   '125', '62', 'IDT', '', ''],
  ['hPSA-F', 'AGGCCTTCCCTGTACACCAA', 'KLK3 (PSA)', 'Human',
   '160', '60', 'IDT', '', 'AR target gene'],
  ['hPSA-R', 'GTCTTGGCCTGGTCATTTCC', 'KLK3 (PSA)', 'Human',
   '160', '60', 'IDT', '', ''],
  ['hSYP-F', 'CTGCTGCAAACCCTAAACCATG', 'SYP', 'Human',
   '132', '60', 'IDT', '', 'Neuroendocrine marker'],
  ['hSYP-R', 'CTCCCATCTTGACAGCCACG', 'SYP', 'Human',
   '132', '60', 'IDT', '', ''],
  ['hFOXA2-F', 'GGAGCAGCTACTATGCAGAGC', 'FOXA2', 'Human',
   '115', '60', 'IDT', '', 'Lineage plasticity TF'],
  ['hFOXA2-R', 'CGTGTTCATGCCGTTCATCC', 'FOXA2', 'Human',
   '115', '60', 'IDT', '', ''],
  ['mGapdh-F', 'AGGTCGGTGTGAACGGATTTG', 'Gapdh', 'Mouse',
   '95', '60', 'IDT', '', 'Mouse housekeeping'],
  ['mGapdh-R', 'TGTAGACCATGTAGTTGAGGTCA', 'Gapdh', 'Mouse',
   '95', '60', 'IDT', '', ''],
  ['hACTB-F', 'CATGTACGTTGCTATCCAGGC', 'ACTB', 'Human',
   '250', '60', 'IDT', '', 'Beta-actin'],
  ['hACTB-R', 'CTCCTTAATGTCACGCACGAT', 'ACTB', 'Human',
   '250', '60', 'IDT', '', ''],
]
const wsPr = XLSX.utils.aoa_to_sheet([primerHeaders, ...primerData])
wsPr['!cols'] = primerHeaders.map((_, i) => ({ wch: i === 1 ? 30 : 16 }))
XLSX.utils.book_append_sheet(wb, wsPr, 'Oligos')

// ── Sheet 3: Compounds ──
const compoundHeaders = [
  'Name', 'Type', 'Vendor', 'Catalog #', 'Concentration',
  'Quantity', 'Storage', 'Owner', 'Notes',
]
const compoundData = [
  ['Enzalutamide', 'AR inhibitor', 'MedChemExpress', 'HY-70002', '10 mM in DMSO',
   '500 µL', '-20°C', 'Alice', 'AR antagonist, 2nd gen'],
  ['DHT (5a-dihydrotestosterone)', 'AR inducer', 'Sigma', 'D-073', '10 mM in EtOH',
   '1 mL', '-20°C', 'Alice', 'AR ligand'],
  ['EZH2i (Tazemetostat)', 'EZH2 inhibitor', 'Selleck', 'S7128', '10 mM in DMSO',
   '200 µL', '-20°C', 'Alice', 'PRC2 inhibitor'],
  ['JQ1', 'BET inhibitor', 'Cayman', '11187', '10 mM in DMSO',
   '500 µL', '-20°C', 'Lab Common', 'BRD4 inhibitor'],
  ['Doxorubicin', 'Chemotherapy', 'Sigma', 'D1515', '1 mM in H2O',
   '100 µL', '-20°C', 'Lab Common', 'Topoisomerase II inhibitor'],
  ['Docetaxel', 'Chemotherapy', 'Selleck', 'S1148', '10 mM in DMSO',
   '200 µL', '-20°C', 'Lab Common', 'Microtubule stabilizer'],
  ['ATRA (all-trans retinoic acid)', 'Differentiation', 'Sigma', 'R2625', '10 mM in DMSO',
   '500 µL', '-20°C', 'Alice', 'Retinoic acid receptor agonist'],
  ['SAHA (Vorinostat)', 'HDAC inhibitor', 'Cayman', '10009929', '10 mM in DMSO',
   '200 µL', '-20°C', 'Lab Common', 'Pan-HDAC inhibitor'],
]
const wsCp = XLSX.utils.aoa_to_sheet([compoundHeaders, ...compoundData])
wsCp['!cols'] = compoundHeaders.map(() => ({ wch: 20 }))
XLSX.utils.book_append_sheet(wb, wsCp, 'Compounds')

// ── Sheet 4: Cell Lines (N2 Tank — Grid Layout) ──
// 9x9 cryo box grid
const gridHeaders = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const cellLineGrid = [
  gridHeaders,
  ['A', 'LNCaP P22', 'LNCaP P25', 'LNCaP P30', 'C4-2 P15', 'C4-2 P18', 'C4-2 P20', '22Rv1 P10', '22Rv1 P12', '22Rv1 P15'],
  ['B', 'PC3 P8', 'PC3 P10', 'PC3 P12', 'DU145 P6', 'DU145 P8', 'DU145 P10', 'VCaP P5', 'VCaP P8', ''],
  ['C', 'LAPC4 P12', 'LAPC4 P15', 'RWPE-1 P5', 'RWPE-1 P8', 'BPH-1 P10', 'BPH-1 P12', '', '', ''],
  ['D', 'NCI-H660 P6', 'NCI-H660 P8', 'LASCPC P4', 'LASCPC P6', '', '', '', '', ''],
  ['E', 'HEK293T P30', 'HEK293T P35', 'HEK293T P40', '', '', '', '', '', ''],
  ['F', '', '', '', '', '', '', '', '', ''],
  ['G', '', '', '', '', '', '', '', '', ''],
  ['H', '', '', '', '', '', '', '', '', ''],
  ['I', '', '', '', '', '', '', '', '', ''],
]
const wsCell = XLSX.utils.aoa_to_sheet(cellLineGrid)
wsCell['!cols'] = gridHeaders.map((_, i) => ({ wch: i === 0 ? 3 : 14 }))
XLSX.utils.book_append_sheet(wb, wsCell, 'N2 Tank - Box 1')

// ── Sheet 5: Common Reagents (Room Temp) ──
const reagentHeaders = [
  'Name', 'Vendor', 'Catalog #', 'Lot #', 'Size',
  'Location', 'Category', 'Notes',
]
const reagentData = [
  ['Tris Base', 'Fisher', 'BP152-1', 'R421', '1 kg',
   'Shelf A', 'Buffer component', 'For making Tris-HCl buffers'],
  ['NaCl', 'Fisher', 'S271-3', 'K982', '2.5 kg',
   'Shelf A', 'Buffer component', 'ACS grade'],
  ['SDS', 'Bio-Rad', '1610302', 'BR-887', '100 g',
   'Shelf A', 'Detergent', '20% stock solution available'],
  ['EDTA disodium', 'Sigma', 'E5134', 'SLCC8', '500 g',
   'Shelf A', 'Chelator', '0.5 M stock pH 8.0 in 4C fridge'],
  ['Glycine', 'Fisher', 'BP381-5', 'P341', '2.5 kg',
   'Shelf A', 'Buffer component', 'For transfer buffer and stripping'],
  ['Methanol', 'Fisher', 'A412-4', 'N871', '4 L',
   'Shelf B', 'Solvent', 'For WB transfer buffer, keep sealed'],
  ['Isopropanol', 'Fisher', 'A416-4', 'M563', '4 L',
   'Shelf B', 'Solvent', 'For gel overlay'],
  ['Ethanol 100%', 'Decon Labs', '2716', 'E203', '4 L',
   'Shelf B', 'Solvent', 'Molecular biology grade'],
  ['DMSO', 'Sigma', 'D2650', 'RNBK', '100 mL',
   'Shelf B', 'Solvent', 'Cell culture grade, sterile'],
  ['Tween-20', 'Sigma', 'P1379', 'SLCJ', '500 mL',
   'Shelf B', 'Detergent', 'For TBST wash buffer'],
  ['BSA Fraction V', 'Fisher', 'BP1600-100', 'Q912', '100 g',
   'Shelf C', 'Blocking', 'For WB blocking, 5% in TBST'],
  ['Non-fat dry milk', 'Bio-Rad', '1706404', 'BR-445', '300 g',
   'Shelf C', 'Blocking', 'For WB blocking, 5% in TBST'],
  ['Protease inhibitor cocktail', 'Roche', '11836170001', '45892', '20 tablets',
   'Shelf C', 'Inhibitor', 'cOmplete ULTRA, 1 tab / 10 mL lysis buffer'],
  ['PMSF', 'Sigma', 'P7626', 'SLCD', '5 g',
   'Shelf C', 'Inhibitor', '100 mM stock in isopropanol, add fresh'],
  ['DTT', 'Fisher', 'BP172-5', 'R663', '25 g',
   'Shelf C', 'Reducing agent', '1 M stock, aliquot and freeze'],
  ['Acrylamide 30%', 'Bio-Rad', '1610158', 'BR-223', '500 mL',
   'Shelf D', 'Gel component', 'NEUROTOXIN — gloves required!'],
  ['APS (ammonium persulfate)', 'Sigma', 'A3678', 'SLCM', '100 g',
   'Shelf D', 'Gel component', 'Make 10% fresh each time'],
  ['TEMED', 'Bio-Rad', '1610801', 'BR-119', '50 mL',
   'Shelf D', 'Gel component', 'Add last, polymerization is immediate'],
  ['Agarose', 'Invitrogen', '16500-500', 'A4523', '500 g',
   'Shelf D', 'Gel component', 'UltraPure, for DNA gels'],
  ['10x TBE', 'Fisher', 'BP1333-1', 'S108', '1 L',
   'Shelf D', 'Buffer', 'Dilute to 0.5x for DNA electrophoresis'],
]
const wsRt = XLSX.utils.aoa_to_sheet([reagentHeaders, ...reagentData])
wsRt['!cols'] = reagentHeaders.map(() => ({ wch: 22 }))
XLSX.utils.book_append_sheet(wb, wsRt, 'Room Temp Chemicals')

// ── Sheet 6: 4C Fridge Reagents ──
const fridge4cHeaders = [
  'Name', 'Vendor', 'Catalog #', 'Size', 'Bin',
  'Opened', 'Expiry', 'Owner', 'Notes',
]
const fridge4cData = [
  ['FBS (Fetal Bovine Serum)', 'Gibco', '10437028', '500 mL', 'Media shelf',
   '2026-01-10', '2027-01-10', 'Lab Common', 'Heat-inactivated, aliquots in -20'],
  ['RPMI 1640', 'Gibco', '11875093', '500 mL', 'Media shelf',
   '2026-02-01', '2026-08-01', 'Lab Common', 'With L-glutamine'],
  ['DMEM High Glucose', 'Gibco', '11965092', '500 mL', 'Media shelf',
   '2026-02-15', '2026-08-15', 'Lab Common', 'With pyruvate'],
  ['Pen-Strep (100x)', 'Gibco', '15140122', '100 mL', 'Media shelf',
   '2026-01-05', '2026-07-05', 'Lab Common', '10,000 U/mL Pen, 10 mg/mL Strep'],
  ['Trypsin 0.25% EDTA', 'Gibco', '25200056', '100 mL', 'Media shelf',
   '2026-02-20', '2026-06-20', 'Lab Common', 'Pre-warmed to 37°C before use'],
  ['PBS pH 7.4', 'Gibco', '10010023', '500 mL', 'Media shelf',
   '2026-01-15', '2026-12-15', 'Lab Common', 'Sterile, no Ca/Mg'],
  ['Charcoal-stripped FBS', 'Gibco', 'A3382101', '500 mL', 'Media shelf',
   '2026-03-01', '2027-03-01', 'Alice', 'For androgen-deprived conditions'],
  ['Matrigel', 'Corning', '356231', '10 mL', 'Bin A',
   '2026-01-20', '2026-07-20', 'Lab Common', 'Keep on ice, aliquots in -20'],
  ['Collagen I (rat tail)', 'Corning', '354236', '100 mg', 'Bin A',
   '', '2026-12-01', 'Lab Common', '3 mg/mL in 0.02 M acetic acid'],
  ['Bradford Reagent', 'Bio-Rad', '5000006', '450 mL', 'Bin B',
   '2026-02-10', '2026-08-10', 'Lab Common', 'For protein quantification'],
  ['Western ECL Substrate', 'Thermo', '34580', '500 mL', 'Bin B',
   '2026-01-25', '2026-07-25', 'Lab Common', 'SuperSignal West Pico PLUS'],
  ['RIPA Buffer', 'Thermo', '89901', '250 mL', 'Bin B',
   '2026-02-05', '2027-02-05', 'Lab Common', 'Add protease/phosphatase inhibitors fresh'],
]
const ws4c = XLSX.utils.aoa_to_sheet([fridge4cHeaders, ...fridge4cData])
ws4c['!cols'] = fridge4cHeaders.map(() => ({ wch: 22 }))
XLSX.utils.book_append_sheet(wb, ws4c, '4C Fridge')

// ── Sheet 7: -80 Freezer Grid (box layout) ──
const freezerGridHeaders = ['', '1', '2', '3', '4', '5', '6', '7', '8', '9']
const freezerGrid = [
  freezerGridHeaders,
  ['A', 'Total RNA - LNCaP ctrl', 'Total RNA - LNCaP ENZ', 'Total RNA - C4-2 ctrl', 'Total RNA - C4-2 ENZ', 'Total RNA - 22Rv1 ctrl', 'Total RNA - 22Rv1 ENZ', '', '', ''],
  ['B', 'Protein - LNCaP ctrl', 'Protein - LNCaP ENZ', 'Protein - LNCaP DHT', 'Protein - C4-2 ctrl', 'Protein - C4-2 ENZ', '', '', '', ''],
  ['C', 'gDNA - LNCaP', 'gDNA - C4-2', 'gDNA - 22Rv1', 'gDNA - PC3', 'gDNA - DU145', '', '', '', ''],
  ['D', '', '', '', '', '', '', '', '', ''],
  ['E', '', '', '', '', '', '', '', '', ''],
  ['F', '', '', '', '', '', '', '', '', ''],
  ['G', '', '', '', '', '', '', '', '', ''],
  ['H', '', '', '', '', '', '', '', '', ''],
  ['I', '', '', '', '', '', '', '', '', ''],
]
const wsFz = XLSX.utils.aoa_to_sheet(freezerGrid)
wsFz['!cols'] = freezerGridHeaders.map((_, i) => ({ wch: i === 0 ? 3 : 22 }))
XLSX.utils.book_append_sheet(wb, wsFz, '-80 Box A-1')

// ── Sheet 8: EMPTY (should be skipped) ──
const wsEmpty = XLSX.utils.aoa_to_sheet([['This sheet is empty — all items depleted']])
XLSX.utils.book_append_sheet(wb, wsEmpty, 'EMPTY - Old Stock')

// ── Write workbook ──
XLSX.writeFile(wb, OUTPUT_PATH)
console.log(`Demo inventory Excel created: ${OUTPUT_PATH}`)
console.log()
console.log('Sheets:')
console.log('  1. Antibodies (4C)      — 12 antibodies with full metadata')
console.log('  2. Oligos               — 16 primers with sequences')
console.log('  3. Compounds            — 8 drug compounds')
console.log('  4. N2 Tank - Box 1      — 9x9 cryo grid with cell lines')
console.log('  5. Room Temp Chemicals  — 20 common lab reagents')
console.log('  6. 4C Fridge            — 12 media & reagents')
console.log('  7. -80 Box A-1          — 9x9 grid with RNA/protein/gDNA')
console.log('  8. EMPTY - Old Stock    — skipped sheet demo')
