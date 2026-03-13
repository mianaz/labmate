/**
 * New Protocol Data — ready to merge into index.html
 * 
 * These are validated, bilingual protocol entries with full
 * briefSteps + detailedSteps + materials.
 * 
 * Sources: protocols.io (CC-BY), CSH Protocols, lab experience
 */

const NEW_PROTOCOLS = [
  // ===============================================
  // 1. Agarose Gel Electrophoresis
  // ===============================================
  {
    id: 'proto_agarose_gel',
    name: 'Agarose Gel Electrophoresis',
    nameZh: '琼脂糖凝胶电泳',
    category: 'protocol',
    tags: ['electrophoresis', 'DNA', 'agarose', 'gel', 'molecular biology'],
    components: [
      { name: 'Agarose', amount: '1-2', unit: '% (w/v)' },
      { name: '1× TAE or TBE buffer', amount: '50-100', unit: 'mL' },
      { name: 'DNA stain (EtBr/SYBR Safe)', amount: '0.5', unit: 'µg/mL' },
      { name: '6× DNA loading dye', amount: '1/5 vol', unit: '' },
      { name: 'DNA ladder', amount: '5', unit: 'µL' },
    ],
    instructions: {
      en: 'Standard agarose gel electrophoresis for DNA fragment separation and analysis.',
      zh: '标准琼脂糖凝胶电泳，用于 DNA 片段分离和分析。',
    },
    reference: 'Sambrook & Russell, Molecular Cloning, 4th ed. Ch. 5',
  },

  // ===============================================
  // 2. Bacterial Transformation (Heat Shock)
  // ===============================================
  {
    id: 'proto_heat_shock',
    name: 'Bacterial Transformation (Heat Shock)',
    nameZh: '细菌转化（热激法）',
    category: 'protocol',
    tags: ['transformation', 'bacteria', 'heat shock', 'competent cells', 'cloning'],
    components: [
      { name: 'Chemically competent cells', amount: '50', unit: 'µL' },
      { name: 'Plasmid DNA', amount: '1-5', unit: 'ng' },
      { name: 'SOC medium', amount: '950', unit: 'µL' },
      { name: 'LB agar plates + antibiotic', amount: '1-2', unit: 'plates' },
    ],
    instructions: {
      en: 'Transform chemically competent E. coli with plasmid DNA via heat shock.',
      zh: '通过热激法将质粒 DNA 转化到化学感受态大肠杆菌中。',
    },
    reference: 'Hanahan, D. (1983) J Mol Biol 166:557-580',
  },

  // ===============================================
  // 3. Calcium Phosphate Transfection
  // ===============================================
  {
    id: 'proto_capo4_transfection',
    name: 'Calcium Phosphate Transfection',
    nameZh: '磷酸钙转染',
    category: 'protocol',
    tags: ['transfection', 'calcium phosphate', 'mammalian cells', 'DNA delivery'],
    components: [
      { name: 'Plasmid DNA', amount: '10-20', unit: 'µg' },
      { name: '2.5 M CaCl₂', amount: '50', unit: 'µL' },
      { name: '2× HBS (HEPES-buffered saline)', amount: '500', unit: 'µL' },
      { name: 'Sterile H₂O', amount: 'to 500', unit: 'µL' },
    ],
    instructions: {
      en: 'Transfect mammalian cells using calcium phosphate co-precipitation.',
      zh: '使用磷酸钙共沉淀法转染哺乳动物细胞。',
    },
    reference: 'Graham & van der Eb (1973) Virology 52:456-467',
  },

  // ===============================================
  // 4. Colony PCR
  // ===============================================
  {
    id: 'proto_colony_pcr',
    name: 'Colony PCR',
    nameZh: 'Colony PCR（菌落 PCR）',
    category: 'protocol',
    tags: ['PCR', 'colony', 'screening', 'cloning', 'verification'],
    components: [
      { name: 'Taq polymerase (2× master mix)', amount: '12.5', unit: 'µL' },
      { name: 'Forward primer (10 µM)', amount: '1', unit: 'µL' },
      { name: 'Reverse primer (10 µM)', amount: '1', unit: 'µL' },
      { name: 'Nuclease-free water', amount: '10.5', unit: 'µL' },
      { name: 'Bacterial colony', amount: '1', unit: 'pick' },
    ],
    instructions: {
      en: 'Screen bacterial colonies for correct insert by direct PCR from colony.',
      zh: '通过菌落直接 PCR 筛选含有正确插入片段的克隆。',
    },
    reference: 'Gussow & Clackson (1989) Nucleic Acids Res 17:4000',
  },

  // ===============================================
  // 5. Cell Counting (Hemocytometer)
  // ===============================================
  {
    id: 'proto_cell_counting',
    name: 'Cell Counting (Hemocytometer)',
    nameZh: '细胞计数（血球计数板）',
    category: 'protocol',
    tags: ['cell counting', 'hemocytometer', 'cell culture', 'viability'],
    components: [
      { name: 'Cell suspension', amount: '—', unit: '' },
      { name: 'Trypan blue (0.4%)', amount: '10', unit: 'µL' },
      { name: 'Hemocytometer + coverslip', amount: '1', unit: 'set' },
    ],
    instructions: {
      en: 'Count cells and assess viability using trypan blue exclusion on a hemocytometer.',
      zh: '使用台盼蓝排斥法在血球计数板上计数细胞并评估活力。',
    },
    reference: 'Strober, W. (2015) Curr Protoc Immunol 111:A3.B.1-A3.B.3',
  },
];

// ===============================================
// PROTOCOL_ENHANCEMENTS for each
// ===============================================
const NEW_PROTOCOL_ENHANCEMENTS = {
  'proto_agarose_gel': {
    usage: {
      en: 'Separate DNA fragments by size (100 bp – 25 kb). Use 0.8% for large fragments, 2% for small.',
      zh: '按大小分离 DNA 片段（100 bp – 25 kb）。大片段用 0.8%，小片段用 2%。',
    },
    storage: {
      en: 'Prepare fresh. Solidified gel can be stored wrapped in buffer-soaked paper at 4°C for 1-2 days.',
      zh: '现配现用。凝固的胶可用浸泡缓冲液的纸包裹后 4°C 保存 1-2 天。',
    },
    materials: [
      { name: 'TAE or TBE buffer', linkedRecipe: 'tae_buffer' },
      { name: 'Agarose (molecular biology grade)' },
      { name: 'DNA stain (EtBr or SYBR Safe)' },
      { name: '6× DNA loading dye', linkedRecipe: 'dna_loading_dye' },
      { name: 'DNA ladder (100 bp or 1 kb)' },
      { name: 'Gel casting tray + comb' },
      { name: 'Electrophoresis chamber + power supply' },
      { name: 'UV transilluminator or blue light' },
    ],
    briefSteps: {
      en: [
        'Dissolve agarose in buffer → microwave → cool to 55°C → add stain → pour gel → insert comb → solidify (20-30 min)',
        'Load samples (DNA + loading dye) → load ladder → run at 80-120V (30-60 min)',
        'Image gel under UV/blue light → document',
      ],
      zh: [
        '溶解琼脂糖 → 微波 → 冷却至 55°C → 加染料 → 倒胶 → 插梳子 → 凝固（20-30 min）',
        '加样（DNA + loading dye）→ 加 marker → 80-120V 电泳（30-60 min）',
        '紫外/蓝光成像 → 记录结果',
      ],
    },
    detailedSteps: {
      en: [
        'Weigh agarose powder (1 g per 100 mL for 1% gel) into an Erlenmeyer flask.',
        'Add 1× TAE or TBE buffer. Swirl to mix.',
        'Microwave 1-3 min until agarose is completely dissolved. Watch for boiling over.',
        'Cool to ~55°C (comfortable to hold). Add DNA stain (0.5 µg/mL EtBr or 1× SYBR Safe).',
        'Seal ends of gel tray with tape or gaskets. Place comb(s).',
        'Pour molten agarose into tray. Pop any bubbles with a pipette tip.',
        'Allow to solidify at room temperature (20-30 min).',
        'Remove comb(s) gently. Place gel in electrophoresis chamber.',
        'Fill chamber with 1× TAE/TBE until gel is submerged (~2-3 mm above gel surface).',
        'Mix DNA samples with 6× loading dye (1:5 ratio). Load into wells using a micropipette.',
        'Load DNA ladder in the first and/or last well.',
        'Connect power supply. Run at 5-8 V/cm (e.g., 100V for ~20 cm gel) for 30-60 min.',
        'Monitor migration: loading dye should travel 2/3 to 3/4 of the gel length.',
        'Turn off power. Remove gel from tray.',
        'Image on UV transilluminator (254/302 nm for EtBr) or blue light (for SYBR Safe).',
        'Photograph and document results. Compare band sizes to ladder.',
      ],
      zh: [
        '称取琼脂糖粉末（1% 胶：1 g / 100 mL）放入锥形瓶。',
        '加入 1× TAE 或 TBE 缓冲液，摇匀。',
        '微波加热 1-3 分钟直到琼脂糖完全溶解，注意防止沸腾溢出。',
        '冷却至约 55°C（手可以握住），加入 DNA 染料（0.5 µg/mL EtBr 或 1× SYBR Safe）。',
        '用胶带或密封垫密封胶模两端，放置梳子。',
        '将熔化的琼脂糖倒入模具，用枪头戳破气泡。',
        '室温静置凝固（20-30 分钟）。',
        '轻轻拔出梳子，将胶放入电泳槽。',
        '加入 1× TAE/TBE 缓冲液没过胶面 2-3 mm。',
        '将 DNA 样品与 6× loading dye 混合（1:5），用微量移液器加入孔中。',
        '在第一和/或最后一个孔加入 DNA ladder。',
        '连接电源，5-8 V/cm 电泳（如 20 cm 胶用 100V），30-60 分钟。',
        '观察迁移：loading dye 应跑到 2/3 至 3/4 处。',
        '关闭电源，取出凝胶。',
        '紫外透射仪（EtBr：254/302 nm）或蓝光（SYBR Safe）下成像。',
        '拍照记录，对照 ladder 比较条带大小。',
      ],
    },
  },

  'proto_heat_shock': {
    usage: {
      en: 'Transform plasmid DNA into chemically competent E. coli. Efficiency: 10⁶-10⁹ CFU/µg.',
      zh: '将质粒 DNA 转化到化学感受态大肠杆菌中。效率：10⁶-10⁹ CFU/µg。',
    },
    storage: {
      en: 'Competent cells at -80°C. Plates at 4°C up to 2 weeks.',
      zh: '感受态细胞 -80°C 保存。平板 4°C 保存最多 2 周。',
    },
    materials: [
      { name: 'Chemically competent cells (DH5α, TOP10, etc.)' },
      { name: 'Plasmid DNA (1-5 ng)' },
      { name: 'SOC medium', linkedRecipe: 'soc_medium' },
      { name: 'LB agar plates with appropriate antibiotic', linkedRecipe: 'lb_medium' },
      { name: 'Ice bucket + ice' },
      { name: 'Water bath or heat block at 42°C' },
      { name: 'Shaking incubator at 37°C' },
    ],
    briefSteps: {
      en: [
        'Thaw competent cells on ice (20 min) → add 1-5 ng DNA → mix gently → ice 30 min',
        'Heat shock 42°C for 30-45 sec → ice 2 min',
        'Add 950 µL SOC → shake 37°C for 1 h',
        'Plate 50-200 µL on selective plates → invert → incubate 37°C overnight',
      ],
      zh: [
        '冰上融化感受态细胞（20 min）→ 加 1-5 ng DNA → 轻柔混匀 → 冰上 30 min',
        '42°C 热激 30-45 秒 → 冰上 2 min',
        '加 950 µL SOC → 37°C 摇菌 1 h',
        '涂板 50-200 µL → 倒扣 → 37°C 过夜',
      ],
    },
    detailedSteps: {
      en: [
        'Remove competent cells from -80°C freezer. Thaw on ice for 20-30 min. Do NOT use hands to warm.',
        'Add 1-5 ng of plasmid DNA (1-2 µL) to the cells. Flick tube gently to mix. Do NOT pipette up and down.',
        'Incubate on ice for 30 min.',
        'Heat shock at exactly 42°C for 30-45 seconds. Timing is critical.',
        'Immediately return to ice for 2 min.',
        'Add 950 µL of room temperature SOC medium (or LB, but SOC gives higher efficiency).',
        'Incubate at 37°C with shaking (225 rpm) for 1 hour. This allows antibiotic resistance expression.',
        'Centrifuge briefly (3000g, 2 min) if plating a concentrated sample. Resuspend in ~100 µL.',
        'Plate 50-200 µL on pre-warmed selective LB agar plates using sterile spreader or beads.',
        'Invert plates and incubate at 37°C for 12-16 hours.',
        'Count colonies. Expect 50-500 colonies from 1 ng of supercoiled plasmid with good competent cells.',
      ],
      zh: [
        '从 -80°C 取出感受态细胞，冰上融化 20-30 分钟。不要用手捂热。',
        '加入 1-5 ng 质粒 DNA（1-2 µL），轻弹管壁混匀。不要反复吹打。',
        '冰上孵育 30 分钟。',
        '42°C 精确热激 30-45 秒。计时要准确。',
        '立即放回冰上 2 分钟。',
        '加入 950 µL 室温 SOC 培养基（或 LB，但 SOC 效率更高）。',
        '37°C 摇菌（225 rpm）1 小时，使抗性基因表达。',
        '如需浓缩涂板，短暂离心（3000g, 2 min），重悬于约 100 µL。',
        '用无菌涂布器或玻璃珠将 50-200 µL 涂布到预温的选择性 LB 琼脂平板上。',
        '倒扣平板，37°C 培养 12-16 小时。',
        '计数菌落。好的感受态细胞 + 1 ng 超螺旋质粒应得到 50-500 个菌落。',
      ],
    },
  },

  'proto_colony_pcr': {
    usage: {
      en: 'Screen bacterial colonies for correct insert after transformation. Faster than miniprep + restriction digest.',
      zh: '转化后筛选含正确插入片段的菌落。比提质粒 + 酶切更快。',
    },
    storage: { en: 'Prepare fresh.', zh: '现配现用。' },
    materials: [
      { name: '2× Taq PCR master mix' },
      { name: 'Forward primer (10 µM)' },
      { name: 'Reverse primer (10 µM)' },
      { name: 'Nuclease-free water' },
      { name: 'Sterile toothpicks or pipette tips' },
      { name: 'PCR tubes (0.2 mL)' },
      { name: 'LB plates with colonies' },
      { name: 'LB + antibiotic for replica plate (optional)' },
    ],
    briefSteps: {
      en: [
        'Set up PCR mix (25 µL): master mix + primers + water',
        'Pick colony with sterile tip → dip in PCR tube → streak on replica plate',
        'PCR: 95°C 10 min → (95°C 30s, 55°C 30s, 72°C 1 min/kb) × 30 → 72°C 5 min',
        'Run on agarose gel → check for correct band size',
      ],
      zh: [
        '配 PCR 体系（25 µL）：master mix + 引物 + 水',
        '用无菌枪头挑菌落 → 蘸入 PCR 管 → 划线到备份板',
        'PCR：95°C 10 min →（95°C 30s, 55°C 30s, 72°C 1 min/kb）× 30 → 72°C 5 min',
        '琼脂糖凝胶电泳 → 检查是否有正确大小的条带',
      ],
    },
    detailedSteps: {
      en: [
        'Prepare PCR master mix in a 1.5 mL tube: 12.5 µL 2× Taq mix, 1 µL each primer (10 µM), 10.5 µL water per reaction.',
        'Aliquot 25 µL into each PCR tube. Label tubes to match colony numbers.',
        'Using a sterile pipette tip or toothpick, touch a single colony lightly.',
        'Dip the tip into the PCR tube and swirl briefly to release cells.',
        '(Optional but recommended) Streak the same tip onto a fresh replica plate. Label to match.',
        'Incubate replica plate at 37°C while PCR runs.',
        'Run PCR program: initial denaturation 95°C for 10 min (lyses cells), then 30 cycles of: 95°C 30s / 55°C 30s / 72°C 1 min per kb of expected product.',
        'Final extension: 72°C for 5 min. Hold at 4°C.',
        'Add 5 µL of 6× loading dye to each 25 µL reaction.',
        'Run on 1% agarose gel alongside DNA ladder.',
        'Image gel: positive clones show a band at the expected insert size.',
        'Inoculate positive clones from replica plate into liquid LB + antibiotic for overnight culture and miniprep.',
      ],
      zh: [
        '在 1.5 mL 管中配 PCR 体系：12.5 µL 2× Taq mix，各 1 µL 引物（10 µM），10.5 µL 水/反应。',
        '每管分装 25 µL，标记与菌落编号对应。',
        '用无菌枪头或牙签轻触单个菌落。',
        '将枪头在 PCR 管中轻轻搅动释放细菌。',
        '（推荐）用同一枪头在备份平板上划线，标记编号。',
        'PCR 运行时将备份板 37°C 培养。',
        'PCR 程序：95°C 10 min（裂解细菌），30 个循环：95°C 30s / 55°C 30s / 72°C 每 kb 1 min。',
        '终延伸：72°C 5 min，4°C 保持。',
        '每管加 5 µL 6× loading dye。',
        '1% 琼脂糖凝胶电泳，加 DNA ladder。',
        '成像：阳性克隆在预期插入片段大小处有条带。',
        '从备份板挑选阳性克隆，接种到 LB + 抗生素液体培养基过夜培养，提质粒验证。',
      ],
    },
  },

  'proto_cell_counting': {
    usage: {
      en: 'Count cells and determine viability before seeding, passaging, or experiments.',
      zh: '在接种、传代或实验前计数细胞并判断活力。',
    },
    storage: { en: 'N/A — perform immediately.', zh: '不适用——立即操作。' },
    materials: [
      { name: 'Cell suspension (trypsinized, single-cell)' },
      { name: 'Trypan blue 0.4%' },
      { name: 'Hemocytometer (Neubauer improved)' },
      { name: 'Coverslip' },
      { name: 'Micropipette (10-20 µL)' },
      { name: 'Counter (hand tally or app)' },
    ],
    briefSteps: {
      en: [
        'Prepare single-cell suspension → mix 10 µL cells + 10 µL trypan blue',
        'Load 10 µL onto hemocytometer → count 4 corner squares (live = clear, dead = blue)',
        'Calculate: cells/mL = (count ÷ 4) × 2 (dilution factor) × 10⁴',
      ],
      zh: [
        '制备单细胞悬液 → 10 µL 细胞 + 10 µL 台盼蓝混匀',
        '取 10 µL 加到计数板 → 数 4 个角大格（活细胞透明，死细胞蓝色）',
        '计算：cells/mL =（计数 ÷ 4）× 2（稀释倍数）× 10⁴',
      ],
    },
    detailedSteps: {
      en: [
        'Trypsinize adherent cells or resuspend suspension cells. Ensure single-cell suspension (no clumps).',
        'Transfer cell suspension to a 15 mL tube. Take a 20 µL aliquot for counting.',
        'Mix 10 µL of cell suspension with 10 µL of 0.4% trypan blue in a microcentrifuge tube.',
        'Incubate for 1-2 min at room temperature. Do not exceed 5 min (trypan blue becomes toxic).',
        'Clean hemocytometer and coverslip with 70% ethanol. Dry completely.',
        'Place coverslip on hemocytometer. It should adhere by surface tension (Newton rings visible).',
        'Load 10 µL of the trypan blue mixture into one chamber. Let it fill by capillary action.',
        'Place on microscope at 10× magnification.',
        'Count all four corner squares (each 1 mm × 1 mm, containing 16 small squares).',
        'Count live cells (clear/refractile) and dead cells (blue) separately.',
        'Follow the convention: count cells touching top and left borders, skip bottom and right.',
        'Calculate concentration: cells/mL = (total live count ÷ 4 squares) × dilution factor (2) × 10⁴.',
        'Calculate viability: % viable = (live count ÷ total count) × 100. Should be >90% for healthy cultures.',
        'Calculate volume needed for seeding: Volume (mL) = desired cells ÷ concentration (cells/mL).',
      ],
      zh: [
        '消化贴壁细胞或重悬悬浮细胞，确保单细胞悬液（无团块）。',
        '转移到 15 mL 管，取 20 µL 用于计数。',
        '在微量离心管中将 10 µL 细胞悬液与 10 µL 0.4% 台盼蓝混匀。',
        '室温孵育 1-2 分钟。不超过 5 分钟（台盼蓝有毒性）。',
        '用 70% 乙醇清洁血球计数板和盖玻片，完全干燥。',
        '放置盖玻片，应通过表面张力贴合（可见牛顿环）。',
        '取 10 µL 台盼蓝混合物加入一侧计数室，利用毛细作用填充。',
        '放在显微镜下 10× 观察。',
        '计数四个角大格（每个 1 mm × 1 mm，含 16 个小格）。',
        '分别计数活细胞（透明/折光）和死细胞（蓝色）。',
        '规则：计数触碰上线和左线的细胞，不计下线和右线的。',
        '计算浓度：cells/mL =（4 格活细胞总数 ÷ 4）× 稀释倍数（2）× 10⁴。',
        '计算活力：活力 % =（活细胞数 ÷ 总细胞数）× 100。健康培养 >90%。',
        '计算接种体积：体积 (mL) = 所需细胞数 ÷ 浓度 (cells/mL)。',
      ],
    },
  },

  'proto_capo4_transfection': {
    usage: {
      en: 'Transfect HEK293T, HeLa, and other easily transfectable cell lines. Cost-effective alternative to lipofection.',
      zh: '转染 HEK293T、HeLa 等易转染细胞系。比脂质体转染更经济。',
    },
    storage: {
      en: '2× HBS at 4°C for months, 2.5 M CaCl₂ at -20°C.',
      zh: '2× HBS 4°C 保存数月，2.5 M CaCl₂ -20°C 保存。',
    },
    materials: [
      { name: 'Plasmid DNA (high quality, endotoxin-free)' },
      { name: '2.5 M CaCl₂ (sterile, filter through 0.22 µm)' },
      { name: '2× HBS (HEPES-buffered saline, pH 7.05 exactly)' },
      { name: 'Sterile H₂O' },
      { name: 'Cells seeded at 50-70% confluence (day before)' },
      { name: 'Complete growth medium' },
    ],
    briefSteps: {
      en: [
        'Seed cells at 50-70% confluence the day before',
        'Mix DNA + CaCl₂ + H₂O → add dropwise to 2× HBS while vortexing → incubate 20 min RT',
        'Add precipitate dropwise to cells → incubate 4-16 h → replace medium',
        'Analyze at 24-48 h post-transfection',
      ],
      zh: [
        '前一天接种细胞至 50-70% 汇合度',
        '混合 DNA + CaCl₂ + H₂O → 涡旋中逐滴加入 2× HBS → 室温 20 min',
        '逐滴加到细胞上 → 培养 4-16 h → 换液',
        '转染后 24-48 h 分析',
      ],
    },
    detailedSteps: {
      en: [
        '**Day before:** Seed cells in 6-well plates at density to reach 50-70% confluence next day.',
        'Prepare DNA-CaCl₂ solution in a sterile tube: 10-20 µg DNA + 50 µL of 2.5 M CaCl₂ + sterile H₂O to 500 µL total.',
        'In a separate tube, add 500 µL of 2× HBS (pH must be 7.05 ± 0.05, this is critical).',
        'Add DNA-CaCl₂ solution dropwise to 2× HBS while vortexing or bubbling air through the HBS.',
        'Incubate at room temperature for 15-20 min. Fine precipitate should form (solution turns slightly cloudy).',
        'Add precipitate dropwise to cells, distributing evenly. Swirl plate gently.',
        'Return to 37°C, 5% CO₂ incubator.',
        'After 4-16 hours (overnight is fine for most cell types), remove medium.',
        'Wash once with PBS to remove precipitate.',
        'Add fresh complete medium.',
        'Assess transfection efficiency at 24-48 hours (e.g., GFP fluorescence, Western blot, or functional assay).',
      ],
      zh: [
        '**前一天：** 6 孔板接种细胞，使第二天达到 50-70% 汇合度。',
        '在无菌管中配制 DNA-CaCl₂ 溶液：10-20 µg DNA + 50 µL 2.5 M CaCl₂ + 无菌水补至 500 µL。',
        '另取一管加 500 µL 2× HBS（pH 必须 7.05 ± 0.05，这是关键）。',
        '涡旋或鼓泡的同时将 DNA-CaCl₂ 逐滴加入 2× HBS。',
        '室温孵育 15-20 分钟。应形成细小沉淀（溶液略变浑浊）。',
        '将沉淀逐滴均匀加到细胞上，轻轻摇匀。',
        '放回 37°C, 5% CO₂ 培养箱。',
        '4-16 小时后（大多数细胞过夜即可），移除培养基。',
        '用 PBS 洗一次去除沉淀。',
        '加入新鲜完全培养基。',
        '24-48 小时后评估转染效率（如 GFP 荧光、Western blot 或功能性检测）。',
      ],
    },
  },
};

// Export for use in other scripts
if (typeof module !== 'undefined') {
  module.exports = { NEW_PROTOCOLS, NEW_PROTOCOL_ENHANCEMENTS };
}
