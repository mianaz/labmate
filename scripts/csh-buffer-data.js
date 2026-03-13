/**
 * CSH Recipes — Verified Buffer Data
 * Source: Cold Spring Harbor Protocols (public recipes)
 * 
 * These are gold-standard buffer recipes used for decades.
 * Ready to merge into index.html RECIPES array.
 */

const CSH_BUFFERS = [
  {
    id: 'tae_buffer',
    name: 'TAE Buffer (50×)',
    nameZh: 'TAE 缓冲液（50×）',
    category: 'buffer',
    tags: ['electrophoresis', 'DNA', 'agarose gel', 'TAE'],
    components: [
      { name: 'Tris base', amount: '242', unit: 'g' },
      { name: 'Glacial acetic acid', amount: '57.1', unit: 'mL' },
      { name: '0.5 M EDTA (pH 8.0)', amount: '100', unit: 'mL' },
      { name: 'dH₂O', amount: 'to 1', unit: 'L' },
    ],
    instructions: {
      en: '50× stock. Working concentration: 1× = 40 mM Tris-acetate, 1 mM EDTA. Preferred over TBE for DNA recovery from gels.',
      zh: '50× 母液。工作浓度：1× = 40 mM Tris-acetate, 1 mM EDTA。从凝胶回收 DNA 时优于 TBE。',
    },
    reference: 'CSH Protocols doi:10.1101/pdb.rec8644; Sambrook & Russell, Molecular Cloning',
    doi: '10.1101/pdb.rec8644',
    source: 'CSH Protocols',
  },
  {
    id: 'tbe_buffer',
    name: 'TBE Buffer (5×)',
    nameZh: 'TBE 缓冲液（5×）',
    category: 'buffer',
    tags: ['electrophoresis', 'DNA', 'PAGE', 'TBE'],
    components: [
      { name: 'Tris base', amount: '54', unit: 'g' },
      { name: 'Boric acid', amount: '27.5', unit: 'g' },
      { name: '0.5 M EDTA (pH 8.0)', amount: '20', unit: 'mL' },
      { name: 'dH₂O', amount: 'to 1', unit: 'L' },
    ],
    instructions: {
      en: '5× stock. Working: 0.5× = 45 mM Tris-borate, 1 mM EDTA, pH ~8.3. Better resolution than TAE for small DNA fragments. Store at RT; filter through 0.22 µm to prevent precipitate.',
      zh: '5× 母液。工作浓度：0.5× = 45 mM Tris-borate, 1 mM EDTA, pH ~8.3。小 DNA 片段分辨率优于 TAE。室温保存，过 0.22 µm 滤膜防沉淀。',
    },
    reference: 'CSH Protocols doi:10.1101/pdb.rec8458',
    doi: '10.1101/pdb.rec8458',
    source: 'CSH Protocols',
  },
  {
    id: 'te_buffer',
    name: 'TE Buffer',
    nameZh: 'TE 缓冲液',
    category: 'buffer',
    tags: ['DNA', 'storage', 'TE', 'Tris-EDTA'],
    components: [
      { name: '1 M Tris-HCl (pH 8.0)', amount: '10', unit: 'mL' },
      { name: '0.5 M EDTA (pH 8.0)', amount: '2', unit: 'mL' },
      { name: 'dH₂O', amount: 'to 1', unit: 'L' },
    ],
    instructions: {
      en: '10 mM Tris-HCl, 1 mM EDTA, pH 8.0. Standard buffer for DNA storage. EDTA chelates divalent cations to inhibit nucleases. Autoclave and store at RT.',
      zh: '10 mM Tris-HCl, 1 mM EDTA, pH 8.0。DNA 保存标准缓冲液。EDTA 螯合二价阳离子抑制核酸酶。高压灭菌，室温保存。',
    },
    reference: 'Sambrook & Russell, Molecular Cloning, 4th ed.',
    source: 'CSH Protocols',
  },
  {
    id: 'ssc_buffer',
    name: 'SSC Buffer (20×)',
    nameZh: 'SSC 缓冲液（20×）',
    category: 'buffer',
    tags: ['hybridization', 'SSC', 'blotting', 'wash'],
    components: [
      { name: 'NaCl', amount: '175.3', unit: 'g' },
      { name: 'Sodium citrate dihydrate', amount: '88.2', unit: 'g' },
      { name: 'dH₂O', amount: 'to 1', unit: 'L' },
    ],
    instructions: {
      en: '20× stock = 3 M NaCl, 0.3 M sodium citrate. Adjust pH to 7.0 with HCl. Used for hybridization, Northern/Southern blot washes. Working: 2× for prehyb, 0.1× for stringent wash.',
      zh: '20× 母液 = 3 M NaCl, 0.3 M 柠檬酸钠。HCl 调 pH 至 7.0。用于杂交、Northern/Southern blot 洗涤。工作浓度：2× 预杂交，0.1× 严格洗涤。',
    },
    reference: 'CSH Protocols doi:10.1101/pdb.rec8765',
    doi: '10.1101/pdb.rec8765',
    source: 'CSH Protocols',
  },
  {
    id: 'depc_water',
    name: 'DEPC-Treated Water',
    nameZh: 'DEPC 处理水',
    category: 'buffer',
    tags: ['RNA', 'RNase-free', 'DEPC'],
    components: [
      { name: 'DEPC (diethyl pyrocarbonate)', amount: '1', unit: 'mL' },
      { name: 'dH₂O', amount: '1', unit: 'L' },
    ],
    instructions: {
      en: 'Add 0.1% DEPC to water, shake vigorously, incubate 12h at 37°C (or 2h at RT), then autoclave 15 min to decompose DEPC. Use for RNA work. Do NOT add DEPC to Tris buffers (reacts with amine groups).',
      zh: '加 0.1% DEPC 到水中，剧烈摇匀，37°C 孵育 12h（或室温 2h），然后高压灭菌 15 min 分解 DEPC。用于 RNA 实验。不要加 DEPC 到 Tris 缓冲液（与氨基反应）。',
    },
    reference: 'CSH Protocols doi:10.1101/pdb.rec8135; Sambrook & Russell',
    doi: '10.1101/pdb.rec8135',
    source: 'CSH Protocols',
  },
  {
    id: 'pfa_4_percent',
    name: '4% Paraformaldehyde in PBS',
    nameZh: '4% 多聚甲醛 PBS 溶液',
    category: 'buffer',
    tags: ['fixation', 'immunofluorescence', 'histology', 'PFA'],
    components: [
      { name: 'Paraformaldehyde powder', amount: '4', unit: 'g' },
      { name: '1× PBS', amount: 'to 100', unit: 'mL' },
      { name: '1 N NaOH', amount: '~2', unit: 'drops' },
    ],
    instructions: {
      en: 'Heat PBS to 60°C (NOT boiling) on hotplate with stirring. Add PFA powder. Solution will be cloudy. Add 1-2 drops of 1N NaOH to clear. Cool to RT, adjust pH to 7.4, filter through 0.45 µm. Use fresh or aliquot and store at -20°C. CAUTION: work in fume hood, PFA is toxic.',
      zh: '加热 PBS 至 60°C（不要煮沸），搅拌下加入 PFA 粉末。溶液会浑浊。加 1-2 滴 1N NaOH 至澄清。冷却至室温，调 pH 至 7.4，过 0.45 µm 滤膜。现配现用或分装 -20°C。注意：通风橱操作，PFA 有毒。',
    },
    reference: 'CSH Protocols doi:10.1101/pdb.rec11863',
    doi: '10.1101/pdb.rec11863',
    source: 'CSH Protocols',
  },
  {
    id: 'hepes_buffer',
    name: 'HEPES Buffer (1 M)',
    nameZh: 'HEPES 缓冲液（1 M）',
    category: 'buffer',
    tags: ['buffer', 'cell culture', 'HEPES', 'pH'],
    components: [
      { name: 'HEPES', amount: '238.3', unit: 'g' },
      { name: 'dH₂O', amount: 'to 1', unit: 'L' },
    ],
    instructions: {
      en: '1 M stock. Dissolve HEPES in ~800 mL water. Adjust pH to 7.2-7.5 with NaOH. Bring to 1 L. Filter sterilize (0.22 µm). Store at 4°C. Good buffering range: pH 6.8-8.2. Does not require CO₂ atmosphere. pKa = 7.5 at 25°C.',
      zh: '1 M 母液。溶解 HEPES 于约 800 mL 水中，NaOH 调 pH 至 7.2-7.5，定容至 1 L。0.22 µm 过滤除菌。4°C 保存。有效缓冲 pH 范围：6.8-8.2。不需要 CO₂ 环境。pKa = 7.5 (25°C)。',
    },
    reference: 'Good et al. (1966) Biochemistry 5:467-477',
    source: 'CSH Protocols',
  },
  {
    id: 'mops_buffer',
    name: 'MOPS Running Buffer (20×)',
    nameZh: 'MOPS 电泳缓冲液（20×）',
    category: 'buffer',
    tags: ['electrophoresis', 'protein', 'NuPAGE', 'MOPS', 'SDS-PAGE'],
    components: [
      { name: 'MOPS', amount: '104.6', unit: 'g' },
      { name: 'Tris base', amount: '60.6', unit: 'g' },
      { name: 'SDS', amount: '10', unit: 'g' },
      { name: 'EDTA', amount: '3', unit: 'g' },
      { name: 'dH₂O', amount: 'to 500', unit: 'mL' },
    ],
    instructions: {
      en: '20× stock for NuPAGE/Bis-Tris gels. 1× working: 50 mM MOPS, 50 mM Tris, 0.1% SDS, 1 mM EDTA, pH ~7.7. Best for resolving mid-to-high MW proteins (30-200 kDa). Do NOT adjust pH. Store at RT.',
      zh: '20× 母液，用于 NuPAGE/Bis-Tris 凝胶。1× 工作浓度：50 mM MOPS, 50 mM Tris, 0.1% SDS, 1 mM EDTA, pH ~7.7。最适合分离中高分子量蛋白（30-200 kDa）。不需调 pH。室温保存。',
    },
    reference: 'Invitrogen NuPAGE system; Schägger (2006) Nat Protoc 1:16-22',
    source: 'CSH Protocols',
  },
];

if (typeof module !== 'undefined') {
  module.exports = { CSH_BUFFERS };
}
