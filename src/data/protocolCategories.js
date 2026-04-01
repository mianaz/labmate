// DATA: Protocol Categories & Subcategories

export const BUFFER_CATEGORIES = ['buffer', 'staining', 'media'];

export const PROTOCOL_SUBCATEGORIES = {
  protein: ['wb_protocol', 'coip_protocol', 'if_protocol', 'chip_protocol'],
  nucleic_acid: ['trizol_extraction', 'qpcr_protocol', 'agarose_gel_electrophoresis', 'miniprep_protocol', 'colony_pcr', 'mycoplasma_pcr'],
  cell_culture: ['trypan_blue_counting', 'cell_freezing', 'cell_thawing', 'cell_transfection', 'calcium_phosphate_transfection', 'electroporation', 'lentivirus_production'],
  cloning: ['heat_shock_transformation', 'competent_cells_cacl2', 'gibson_assembly', 'site_directed_mutagenesis', 'colony_pcr', 'electroporation'],
  cell_assay: ['mtt_assay', 'scratch_assay', 'transwell_migration', 'flow_cytometry_protocol'],
};

// Reverse lookup: protocol id → subcategory id (first match)
export const PROTOCOL_SUBCAT_BY_ID = {};
Object.entries(PROTOCOL_SUBCATEGORIES).forEach(([cat, ids]) => {
  ids.forEach(id => { if (!PROTOCOL_SUBCAT_BY_ID[id]) PROTOCOL_SUBCAT_BY_ID[id] = cat; });
});

// Display labels for categories/subcategories on cards
export const CATEGORY_DISPLAY = {
  buffer: { en: 'Buffer', zh: '缓冲液' },
  staining: { en: 'Staining', zh: '染色' },
  media: { en: 'Media', zh: '培养基' },
  protein: { en: 'Protein', zh: '蛋白' },
  nucleic_acid: { en: 'Nucleic Acid', zh: '核酸' },
  cell_culture: { en: 'Cell Culture', zh: '细胞培养' },
  cloning: { en: 'Cloning', zh: '克隆' },
  cell_assay: { en: 'Cell Assay', zh: '细胞实验' },
  protocol: { en: 'Protocol', zh: '实验方案' },
};
