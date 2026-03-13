// ─────────────────────────────────────────────────────────────────────────────
// Protocol Enhancements Data
// Ported from the original monolithic index.html (const PROTOCOL_ENHANCEMENTS)
// ─────────────────────────────────────────────────────────────────────────────

export interface BilingualString {
  en: string;
  zh: string;
}

export interface StorageInfo {
  temp: string;
  duration: string;
  icon: string;
  label: BilingualString;
}

export interface MaterialItem {
  name: string;
  note?: BilingualString;
  linkedRecipe?: string;
}

export interface StepItem {
  en: string;
  zh: string;
  isHeader?: boolean;
}

export interface ProtocolEnhancement {
  usage: BilingualString;
  storage: StorageInfo;
  materials: MaterialItem[];
  briefSteps: StepItem[];
  detailedSteps: StepItem[];
}

export const PROTOCOL_ENHANCEMENTS: Record<string, ProtocolEnhancement> = {
  trizol_extraction: {
    usage: { en: 'Gold-standard total RNA extraction using phenol-guanidinium. High yield from cells, tissues, bacteria. Compatible with downstream RT-qPCR, RNA-seq, Northern blot.', zh: '苯酚-异硫氰酸胍法提取总 RNA 的金标准。适用于细胞、组织、细菌。兼容 RT-qPCR、RNA-seq、Northern blot 等下游实验。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — RNA stored at -80°C', zh: '实验方案 — RNA -80°C 保存' } },
    materials: [
      { name: 'TRIzol Reagent', note: { en: 'Commercial reagent', zh: '商品化试剂' } },
      { name: 'Chloroform', note: { en: 'ACS grade', zh: '分析纯' } },
      { name: 'Isopropanol', note: { en: 'Molecular biology grade', zh: '分子生物学级' } },
      { name: '75% Ethanol', note: { en: 'DEPC-H₂O diluted', zh: 'DEPC 水配制' } },
      { name: 'RNase-free H₂O', note: { en: 'DEPC-treated or commercial', zh: 'DEPC 处理或商品化' } },
    ],
    briefSteps: [
      { en: 'Lyse cells in TRIzol → add chloroform → centrifuge → collect aqueous phase → isopropanol precipitate → ethanol wash → dissolve RNA', zh: 'TRIzol 裂解 → 加氯仿 → 离心 → 取水相 → 异丙醇沉淀 → 乙醇洗涤 → 溶解 RNA' },
    ],
    detailedSteps: [
      { en: '**Cell lysis**: Remove media, add 1 mL TRIzol per 5–10×10⁶ cells (or 50–100 mg tissue). Pipet up/down 10× to lyse completely', zh: '**细胞裂解**: 去除培养基，每 5–10×10⁶ 细胞加 1 mL TRIzol（或 50–100 mg 组织）。反复吹打 10 次至完全裂解' },
      { en: 'Incubate 5 min at RT to dissociate nucleoprotein complexes', zh: '室温静置 5 min，使核蛋白复合物完全解离' },
      { en: '**Phase separation**: Add 0.2 mL chloroform per 1 mL TRIzol. Cap tightly, shake vigorously 15 s (do NOT vortex)', zh: '**相分离**: 每 1 mL TRIzol 加 0.2 mL 氯仿。盖紧管盖，剧烈摇晃 15 s（不要涡旋）' },
      { en: 'Incubate 2–3 min at RT. Solution should turn milky pink', zh: '室温静置 2–3 min。溶液应变为乳白粉红色' },
      { en: 'Centrifuge 12,000×g, 15 min, 4°C. Three layers form: red organic (bottom), white interphase, clear aqueous (top)', zh: '4°C 12,000×g 离心 15 min。形成三层：红色有机相（底）、白色中间相、透明水相（顶）' },
      { en: '**RNA precipitation**: Carefully transfer upper aqueous phase to new tube (~60% of TRIzol volume). ⚠️ Avoid interphase!', zh: '**RNA 沉淀**: 小心转移上层水相至新管（约为 TRIzol 体积的 60%）。⚠️ 避免触碰中间相！' },
      { en: 'Add 0.5 mL isopropanol per 1 mL TRIzol. Mix gently by inversion 6×', zh: '每 1 mL TRIzol 加 0.5 mL 异丙醇。轻柔颠倒混匀 6 次' },
      { en: 'Incubate 10 min RT (or -20°C 1 h for low-abundance samples)', zh: '室温静置 10 min（低丰度样品可 -20°C 放 1 h）' },
      { en: 'Centrifuge 12,000×g, 10 min, 4°C. RNA pellet should be visible (white/translucent)', zh: '4°C 12,000×g 离心 10 min。应可见 RNA 沉淀（白色/半透明）' },
      { en: '**Wash**: Discard supernatant. Add 1 mL 75% ethanol (in DEPC-H₂O). Vortex briefly', zh: '**洗涤**: 弃上清。加 1 mL 75% 乙醇（DEPC 水配制）。短暂涡旋' },
      { en: 'Centrifuge 7,500×g, 5 min, 4°C. Discard ethanol completely', zh: '4°C 7,500×g 离心 5 min。完全弃去乙醇' },
      { en: '**Dissolve**: Air-dry pellet 5–10 min (do NOT over-dry — pellet becomes hard to dissolve). Dissolve in 20–50 µL RNase-free H₂O', zh: '**溶解**: 室温风干沉淀 5–10 min（不要过度干燥——会难以溶解）。加 20–50 µL 无 RNase 水溶解' },
      { en: 'Incubate 55°C, 10 min to aid dissolution. Place on ice', zh: '55°C 孵育 10 min 促进溶解。然后置于冰上' },
      { en: '**QC**: Measure A260/280 (expect ~2.0) and A260/230 (expect >1.7). Run on gel or Bioanalyzer if needed', zh: '**质检**: 测 A260/280（期望 ~2.0）和 A260/230（期望 >1.7）。必要时跑胶或 Bioanalyzer 检测' },
    ],
  },
  wb_protocol: {
    usage: { en: 'Detect specific proteins in cell/tissue lysates by separating on SDS-PAGE, transferring to membrane, and probing with antibodies. Quantitative with proper controls.', zh: '通过 SDS-PAGE 分离蛋白，转膜后用抗体探测特定蛋白。适当对照下可实现定量分析。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — 2-day experiment', zh: '实验方案 — 2 天实验' } },
    materials: [
      { name: 'RIPA Buffer', linkedRecipe: 'ripa' },
      { name: 'Laemmli Buffer (2×)', linkedRecipe: 'laemmli_2x' },
      { name: 'Running Buffer (1×)', linkedRecipe: 'running_buffer' },
      { name: 'Transfer Buffer', linkedRecipe: 'transfer_buffer' },
      { name: 'TBST', linkedRecipe: 'tbst' },
      { name: '5% Milk Blocking', linkedRecipe: 'blocking_milk' },
      { name: '5% BSA Blocking', linkedRecipe: 'blocking_bsa' },
      { name: 'Stripping Buffer', linkedRecipe: 'strip_buffer' },
      { name: 'PVDF/NC membrane', note: { en: 'PVDF: activate in methanol', zh: 'PVDF: 甲醇活化' } },
      { name: 'ECL substrate', note: { en: 'Commercial kit', zh: '商品化试剂盒' } },
      { name: 'Protein ladder', note: { en: 'Pre-stained, 10–250 kDa', zh: '预染 Marker, 10–250 kDa' } },
    ],
    briefSteps: [
      { en: 'Lyse → quantify → SDS-PAGE → transfer → block → primary Ab O/N → wash → secondary Ab 1h → wash → ECL detect', zh: '裂解 → 定量 → SDS-PAGE → 转膜 → 封闭 → 一抗过夜 → 洗 → 二抗 1h → 洗 → ECL 检测' },
    ],
    detailedSteps: [
      { en: '**Day 1 — Sample prep**', zh: '**第一天 — 样品制备**', isHeader: true },
      { en: '**Lysis**: Aspirate media, wash 1× cold PBS. Add cold RIPA buffer (100–200 µL per well of 6-well plate). Rock on ice 15–30 min', zh: '**裂解**: 吸除培养基，冷 PBS 洗 1 次。加冷 RIPA 裂解液（6 孔板每孔 100–200 µL）。冰上晃动 15–30 min' },
      { en: 'Scrape cells, transfer to 1.5 mL tube. Centrifuge 14,000×g, 15 min, 4°C. Transfer supernatant (= total protein)', zh: '刮下细胞，转移至 1.5 mL 管。4°C 14,000×g 离心 15 min。取上清（= 总蛋白）' },
      { en: '**Quantification**: BCA or Bradford assay. Need 20–50 µg protein per lane', zh: '**定量**: BCA 或 Bradford 法。每泳道需 20–50 µg 蛋白' },
      { en: 'Mix protein sample with equal volume 2× Laemmli buffer (or 1:3 with 4× buffer)', zh: '蛋白样品与等体积 2× Laemmli buffer 混合（或与 4× buffer 1:3 混合）' },
      { en: 'Boil 95°C, 5 min (or 70°C, 10 min for membrane proteins). Quick-spin, place on ice or store -20°C', zh: '95°C 煮沸 5 min（膜蛋白用 70°C, 10 min）。快速离心，冰上或 -20°C 保存' },
      { en: '**SDS-PAGE**: Set up gel (choose % based on target MW — see Gel Calculator tab). Load samples + ladder', zh: '**SDS-PAGE**: 装好凝胶（根据目标蛋白分子量选择浓度——参见配胶计算 tab）。上样 + Marker' },
      { en: 'Run: 80V through stacking gel (~20 min), then 120V through resolving gel (~1–1.5 h). Run until dye front reaches bottom', zh: '电泳: 浓缩胶 80V（约 20 min），分离胶 120V（约 1–1.5 h）。跑至溴酚蓝到达底部' },
      { en: '**Transfer**: Prepare transfer sandwich — sponge / filter paper / gel / membrane / filter paper / sponge. Remove all air bubbles!', zh: '**转膜**: 组装转膜三明治——海绵 / 滤纸 / 凝胶 / 膜 / 滤纸 / 海绵。去除所有气泡！' },
      { en: 'Wet transfer: 100V, 60–90 min in cold Transfer Buffer with ice pack. OR semi-dry: 25V, 30 min', zh: '湿转: 冷 Transfer Buffer 中 100V, 60–90 min，加冰块。或半干转: 25V, 30 min' },
      { en: 'For proteins >150 kDa: transfer at 30V overnight at 4°C, reduce methanol to 10%, add 0.01% SDS', zh: '>150 kDa 蛋白: 4°C 30V 过夜转膜，甲醇降至 10%，加 0.01% SDS' },
      { en: '**Verify transfer**: Ponceau S stain membrane 2 min, wash with ddH₂O. Photograph. Destain with TBST', zh: '**验证转膜**: Ponceau S 染膜 2 min，ddH₂O 冲洗。拍照。用 TBST 脱色' },
      { en: '**Blocking**: 5% milk/TBST or 5% BSA/TBST, 1 h at RT with rocking. ⚠️ Use BSA for phospho-antibodies!', zh: '**封闭**: 5% 脱脂奶/TBST 或 5% BSA/TBST，室温摇 1 h。⚠️ 磷酸化抗体必须用 BSA！' },
      { en: '**Primary antibody**: Dilute in blocking buffer (typically 1:500–1:2000). Incubate 4°C overnight with rocking', zh: '**一抗**: 用封闭液稀释（通常 1:500–1:2000）。4°C 摇孵过夜' },
      { en: '**Day 2 — Detection**', zh: '**第二天 — 检测**', isHeader: true },
      { en: '**Wash**: TBST 3×10 min with rocking. Use generous volume (>10 mL per wash)', zh: '**洗膜**: TBST 3×10 min 摇洗。用量要足（每次 >10 mL）' },
      { en: '**Secondary antibody**: HRP-conjugated anti-mouse/rabbit IgG, dilute 1:5000–1:10,000 in blocking buffer. 1 h RT', zh: '**二抗**: HRP 标记的抗鼠/兔 IgG，封闭液 1:5000–1:10,000 稀释。室温 1 h' },
      { en: '**Wash**: TBST 3×10 min. Final wash with TBS (no Tween) 1×5 min', zh: '**洗膜**: TBST 3×10 min。最后用 TBS（不含 Tween）洗 1×5 min' },
      { en: '**Detection**: Mix ECL components 1:1, apply to membrane, incubate 1–5 min. Image on ChemiDoc or expose to film', zh: '**检测**: ECL 等比混合，涂于膜上，孵育 1–5 min。用化学发光成像仪或胶片曝光' },
      { en: '**Analysis**: Quantify band intensity with ImageJ/Image Lab. Normalize to loading control (β-actin, GAPDH, or total protein)', zh: '**分析**: 用 ImageJ/Image Lab 定量条带灰度。以 loading control（β-actin、GAPDH 或总蛋白）归一化' },
    ],
  },
  if_protocol: {
    usage: { en: 'Visualize protein localization and expression in fixed cells using fluorescent antibodies. Compatible with confocal, epifluorescence, and super-resolution microscopy.', zh: '用荧光抗体观察固定细胞中蛋白的定位和表达。兼容共聚焦、落射荧光和超分辨率显微镜。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — same day (~5h + overnight)', zh: '实验方案 — 当天完成（~5h + 过夜）' } },
    materials: [
      { name: 'PBS (1×)', linkedRecipe: 'pbs_1x' },
      { name: '4% PFA', linkedRecipe: 'pfa_4' },
      { name: 'Permeabilization buffer', linkedRecipe: 'if_permeabilization' },
      { name: 'Blocking buffer', linkedRecipe: 'if_blocking' },
      { name: 'DAPI', note: { en: '1 mg/mL stock → 1:1000 in PBS', zh: '1 mg/mL 母液 → PBS 中 1:1000' } },
      { name: 'Mounting medium', note: { en: 'ProLong Gold / Vectashield', zh: 'ProLong Gold / Vectashield' } },
      { name: 'Coverslips + slides', note: { en: '#1.5 thickness for confocal', zh: '#1.5 厚度，适合共聚焦' } },
    ],
    briefSteps: [
      { en: 'Culture on coverslips → fix (PFA) → permeabilize → block → primary Ab O/N → wash → fluorescent secondary 1h → DAPI → mount', zh: '盖玻片培养 → 固定 (PFA) → 透化 → 封闭 → 一抗过夜 → 洗 → 荧光二抗 1h → DAPI → 封片' },
    ],
    detailedSteps: [
      { en: '**Cell preparation**: Seed cells on sterile coverslips in 24-well plate (or chamber slides). Culture to 50–70% confluency', zh: '**细胞准备**: 将无菌盖玻片放入 24 孔板（或使用 chamber slides）。培养至 50–70% 汇合度' },
      { en: 'For suspension cells: use poly-L-lysine coated coverslips or cytospin onto slides', zh: '悬浮细胞：使用多聚赖氨酸包被的盖玻片或 cytospin 到载玻片上' },
      { en: '**Fixation**: Aspirate media, wash 2× with RT PBS (gentle!). Add 4% PFA, 15 min RT', zh: '**固定**: 吸除培养基，室温 PBS 轻柔洗 2 次。加 4% PFA，室温固定 15 min' },
      { en: '⚠️ Do NOT fix >20 min — over-fixation masks epitopes. For some antigens, try ice-cold methanol 10 min instead', zh: '⚠️ 不要固定 >20 min——过度固定会遮蔽表位。某些抗原可改用冰冷甲醇固定 10 min' },
      { en: 'Wash 3×5 min PBS', zh: 'PBS 洗 3×5 min' },
      { en: '**Permeabilization**: 0.1–0.5% Triton X-100 / PBS, 10 min RT. (Membrane proteins: skip this step or use 0.05%)', zh: '**透化**: 0.1–0.5% Triton X-100 / PBS，室温 10 min（膜蛋白：跳过此步或用 0.05%）' },
      { en: 'Wash 3×5 min PBS', zh: 'PBS 洗 3×5 min' },
      { en: '**Blocking**: 3% BSA + 5% normal serum (same species as secondary Ab) in PBS-T, 1 h RT', zh: '**封闭**: 3% BSA + 5% 正常血清（与二抗同种属）溶于 PBS-T，室温 1 h' },
      { en: '**Primary antibody**: Dilute in blocking buffer (typically 1:50–1:500). Apply 200 µL per coverslip. 4°C overnight in humidified chamber', zh: '**一抗**: 用封闭液稀释（通常 1:50–1:500）。每片加 200 µL。4°C 湿盒过夜' },
      { en: '💡 Lay parafilm in dish + wet paper towel to make humidity chamber. Place coverslips cell-side DOWN on antibody drops', zh: '💡 用保鲜膜铺在培养皿中 + 湿纸巾做湿盒。盖玻片细胞面朝下放在抗体液滴上' },
      { en: 'Wash 3×5 min PBS (from here on, protect from light!)', zh: 'PBS 洗 3×5 min（从此步起避光操作！）' },
      { en: '**Secondary antibody**: Fluorescent-conjugated (Alexa Fluor 488/555/647), 1:200–1:1000 in blocking buffer, 1 h RT dark', zh: '**荧光二抗**: Alexa Fluor 488/555/647 等，封闭液 1:200–1:1000 稀释，室温避光 1 h' },
      { en: 'Wash 3×5 min PBS', zh: 'PBS 洗 3×5 min' },
      { en: '**DAPI**: 1 µg/mL in PBS, 5 min RT. Wash 2× PBS', zh: '**DAPI 染核**: 1 µg/mL PBS 溶液，室温 5 min。PBS 洗 2 次' },
      { en: '**Mount**: Add small drop of mounting medium on slide. Place coverslip cell-side down. Avoid bubbles. Seal edges with nail polish', zh: '**封片**: 在载玻片上滴少量封片剂。盖玻片细胞面朝下放置。避免气泡。指甲油封边' },
      { en: 'Let cure 24 h at RT (or 4°C overnight). Image within 1 week for best signal', zh: '室温固化 24 h（或 4°C 过夜）。1 周内成像信号最佳' },
    ],
  },
  chip_protocol: {
    usage: { en: 'Map protein-DNA interactions genome-wide. Identifies transcription factor binding sites and histone modifications. Combine with qPCR or sequencing (ChIP-seq).', zh: '全基因组水平检测蛋白-DNA 相互作用。鉴定转录因子结合位点和组蛋白修饰。可结合 qPCR 或测序（ChIP-seq）。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — 3-day experiment', zh: '实验方案 — 3 天实验' } },
    materials: [
      { name: 'PBS (1×)', linkedRecipe: 'pbs_1x' },
      { name: 'ChIP Lysis Buffer', linkedRecipe: 'chip_lysis' },
      { name: 'ChIP Dilution Buffer', linkedRecipe: 'chip_dilution' },
      { name: 'Low-Salt Wash Buffer', linkedRecipe: 'chip_wash_low' },
      { name: 'High-Salt Wash Buffer', linkedRecipe: 'chip_wash_high' },
      { name: 'TE Buffer', linkedRecipe: 'te' },
      { name: '37% Formaldehyde', note: { en: 'Methanol-free preferred', zh: '优选无甲醇型' } },
      { name: '2.5 M Glycine', note: { en: 'Quench crosslinking', zh: '终止交联反应' } },
      { name: 'Protein A/G magnetic beads', note: { en: 'Dynabeads or equivalent', zh: 'Dynabeads 或同类产品' } },
      { name: 'Proteinase K', note: { en: '20 mg/mL stock', zh: '20 mg/mL 母液' } },
      { name: 'RNase A', note: { en: '10 mg/mL', zh: '10 mg/mL' } },
    ],
    briefSteps: [
      { en: 'Crosslink → lyse → sonicate → IP with antibody+beads → wash → elute → reverse crosslink → purify DNA → qPCR/seq', zh: '交联 → 裂解 → 超声 → 抗体+磁珠 IP → 洗涤 → 洗脱 → 解交联 → 纯化 DNA → qPCR/测序' },
    ],
    detailedSteps: [
      { en: '**Day 1 — Crosslinking & Sonication**', zh: '**第一天 — 交联与超声**', isHeader: true },
      { en: '**Crosslink**: Add 37% formaldehyde directly to culture media to 1% final (270 µL per 10 mL media). Rock 10 min RT', zh: '**交联**: 向培养基中直接加入 37% 甲醛至终浓度 1%（每 10 mL 培养基加 270 µL）。室温摇 10 min' },
      { en: '**Quench**: Add 2.5 M glycine to 125 mM final. Rock 5 min RT', zh: '**终止**: 加 2.5 M 甘氨酸至终浓度 125 mM。室温摇 5 min' },
      { en: 'Wash 2× cold PBS. Scrape cells in PBS + protease inhibitors. Pellet 800×g 5 min 4°C', zh: '冷 PBS 洗 2 次。PBS + 蛋白酶抑制剂中刮下细胞。4°C 800×g 离心 5 min' },
      { en: '**Lysis**: Resuspend pellet in SDS Lysis Buffer (200 µL per 1×10⁶ cells). Incubate ice 10 min', zh: '**裂解**: 用 SDS Lysis Buffer 重悬沉淀（每 1×10⁶ 细胞 200 µL）。冰上 10 min' },
      { en: '**Sonication**: Shear chromatin to 200–500 bp. ⚠️ Must optimize! (e.g., Bioruptor: 30s on/30s off, 15–25 cycles)', zh: '**超声**: 将染色质剪切至 200–500 bp。⚠️ 必须优化条件！（如 Bioruptor: 30s 开/30s 关，15–25 个循环）' },
      { en: '💡 Check shearing: take 10 µL aliquot, reverse crosslink (65°C + Proteinase K), run on 1.5% agarose gel', zh: '💡 检查剪切效果：取 10 µL，解交联（65°C + Proteinase K），跑 1.5% 琼脂糖凝胶' },
      { en: 'Centrifuge 14,000×g, 10 min, 4°C. Transfer supernatant (= sheared chromatin)', zh: '4°C 14,000×g 离心 10 min。取上清（= 剪切后染色质）' },
      { en: '**Dilute**: Add 9 volumes ChIP Dilution Buffer (reduces SDS from 1% to 0.1%)', zh: '**稀释**: 加 9 倍体积 ChIP Dilution Buffer（将 SDS 从 1% 降至 0.1%）' },
      { en: '**Save Input**: Remove 1–10% as "Input" control → store at -20°C', zh: '**留 Input**: 取 1–10% 作为 Input 对照 → -20°C 保存' },
      { en: '**Day 1–2 — Immunoprecipitation**', zh: '**第 1–2 天 — 免疫沉淀**', isHeader: true },
      { en: '**Pre-clear** (optional): Add 20 µL protein A/G beads, rotate 1 h at 4°C. Remove beads', zh: '**预清除**（可选）：加 20 µL protein A/G 磁珠，4°C 旋转 1 h。去除磁珠' },
      { en: 'Add antibody (2–5 µg) + 30 µL protein A/G beads. Rotate overnight at 4°C', zh: '加抗体（2–5 µg）+ 30 µL protein A/G 磁珠。4°C 旋转过夜' },
      { en: '**Day 2–3 — Washes & Elution**', zh: '**第 2–3 天 — 洗涤与洗脱**', isHeader: true },
      { en: 'Wash sequentially (each 3–5 min, 4°C, rotation): Low-salt → High-salt → LiCl wash → 2× TE buffer', zh: '依次洗涤（每次 3–5 min, 4°C 旋转）：低盐 → 高盐 → LiCl 洗 → 2× TE 缓冲液' },
      { en: '**Elute**: Add 250 µL elution buffer (1% SDS + 0.1 M NaHCO₃), vortex 15 min RT. Repeat. Pool eluates (500 µL total)', zh: '**洗脱**: 加 250 µL 洗脱液（1% SDS + 0.1 M NaHCO₃），室温涡旋 15 min。重复一次。合并洗脱液（共 500 µL）' },
      { en: '**Reverse crosslink**: Add NaCl to 200 mM final. Incubate 65°C overnight (or 65°C 4h). Also reverse-crosslink Input', zh: '**解交联**: 加 NaCl 至终浓度 200 mM。65°C 过夜（或 65°C 4h）。Input 同时解交联' },
      { en: 'Add Proteinase K (20 µg/mL), 45°C, 1 h. Add RNase A, 37°C, 30 min', zh: '加 Proteinase K（20 µg/mL），45°C 1 h。加 RNase A，37°C 30 min' },
      { en: '**Purify DNA**: Phenol-chloroform extraction or column purification (MinElute). Elute in 30 µL TE', zh: '**纯化 DNA**: 酚-氯仿抽提或柱纯化（MinElute）。30 µL TE 洗脱' },
      { en: '**Analysis**: qPCR (% Input method) or library prep for ChIP-seq', zh: '**分析**: qPCR（% Input 法）或建库做 ChIP-seq' },
    ],
  },
  coip_protocol: {
    usage: { en: 'Detect protein-protein interactions in native conditions. Pull down a "bait" protein with its antibody and detect co-precipitated "prey" proteins by WB.', zh: '在天然条件下检测蛋白-蛋白相互作用。用抗体沉淀"诱饵"蛋白，通过 WB 检测共沉淀的"猎物"蛋白。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — 2-day experiment', zh: '实验方案 — 2 天实验' } },
    materials: [
      { name: 'IP Lysis Buffer', linkedRecipe: 'ip_lysis' },
      { name: 'Laemmli Buffer (2×)', linkedRecipe: 'laemmli_2x' },
      { name: 'PBS (1×)', linkedRecipe: 'pbs_1x' },
      { name: 'Protein A/G beads', note: { en: 'Magnetic preferred', zh: '推荐磁珠' } },
      { name: 'Target antibody', note: { en: '1–5 µg per IP', zh: '每次 IP 1–5 µg' } },
      { name: 'Normal IgG', note: { en: 'Same species, negative control', zh: '同种属，阴性对照' } },
    ],
    briefSteps: [
      { en: 'Lyse (mild buffer) → quantify → pre-clear → add Ab overnight → beads → wash → elute → WB for bait+prey', zh: '温和裂解 → 定量 → 预清除 → 加抗体过夜 → 磁珠 → 洗涤 → 洗脱 → WB 检测 bait+prey' },
    ],
    detailedSteps: [
      { en: '**Lysis**: Wash cells 1× cold PBS. Add IP Lysis Buffer (500 µL per 10-cm dish). ⚠️ Do NOT use RIPA — SDS disrupts interactions!', zh: '**裂解**: 冷 PBS 洗 1 次。加 IP Lysis Buffer（10 cm 皿每皿 500 µL）。⚠️ 不要用 RIPA——SDS 会破坏蛋白互作！' },
      { en: 'Incubate on ice 30 min with occasional vortexing. Centrifuge 14,000×g, 15 min, 4°C', zh: '冰上裂解 30 min，偶尔涡旋。4°C 14,000×g 离心 15 min' },
      { en: '**Quantify**: BCA assay. Use 500 µg – 2 mg total protein per IP. Save 5–10% as Input', zh: '**定量**: BCA 法。每次 IP 用 500 µg – 2 mg 总蛋白。留 5–10% 做 Input' },
      { en: '**Pre-clear**: Add 20 µL protein A/G beads, rotate 1 h at 4°C. Remove beads (reduces non-specific binding)', zh: '**预清除**: 加 20 µL protein A/G 磁珠，4°C 旋转 1 h。去除磁珠（减少非特异结合）' },
      { en: '**IP**: Add 1–5 µg target antibody. In parallel, set up IgG control with same amount of normal IgG. Rotate overnight 4°C', zh: '**IP**: 加 1–5 µg 目标抗体。同时设 IgG 对照（同量正常 IgG）。4°C 旋转过夜' },
      { en: 'Add 30–50 µL protein A/G beads. Rotate 2–4 h at 4°C', zh: '加 30–50 µL protein A/G 磁珠。4°C 旋转 2–4 h' },
      { en: '**Wash**: 4–6× with cold IP Lysis Buffer. Each wash: add 500 µL, rotate 5 min 4°C, pellet beads', zh: '**洗涤**: 冷 IP Lysis Buffer 洗 4–6 次。每次：加 500 µL，4°C 旋转 5 min，收集磁珠' },
      { en: '💡 For weak interactions: reduce washes to 3× and use gentler buffer (0.1% NP-40)', zh: '💡 弱相互作用：减少洗涤至 3 次，使用更温和的缓冲液（0.1% NP-40）' },
      { en: '**Elute**: Add 40 µL 2× Laemmli buffer to beads. Boil 95°C 5 min. Collect supernatant', zh: '**洗脱**: 向磁珠加 40 µL 2× Laemmli buffer。95°C 煮沸 5 min。收集上清' },
      { en: '**WB**: Load IP eluate, IgG control, and Input. Probe for both bait and prey proteins', zh: '**WB 检测**: 上样 IP 洗脱液、IgG 对照和 Input。分别检测 bait 和 prey 蛋白' },
    ],
  },
  qpcr_protocol: {
    usage: { en: 'Quantify gene expression at mRNA level. Combines reverse transcription with real-time PCR. Gold standard for validating RNA-seq hits. Requires proper controls and MIQE compliance.', zh: '在 mRNA 水平定量基因表达。结合逆转录和实时 PCR。验证 RNA-seq 结果的金标准。需要适当对照并符合 MIQE 规范。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — 1-day experiment (after RNA extraction)', zh: '实验方案 — 1 天实验（RNA 提取后）' } },
    materials: [
      { name: 'Total RNA', note: { en: 'See TRIzol extraction protocol', zh: '参见 TRIzol 提取方案' }, linkedRecipe: 'trizol_extraction' },
      { name: 'Reverse Transcriptase Kit', note: { en: 'e.g., SuperScript IV, PrimeScript', zh: '如 SuperScript IV, PrimeScript' } },
      { name: 'SYBR Green Master Mix', note: { en: 'Or TaqMan probes', zh: '或 TaqMan 探针' } },
      { name: 'Gene-specific primers', note: { en: 'Tm 58–62°C, product 80–200 bp', zh: 'Tm 58–62°C, 产物 80–200 bp' } },
      { name: 'Reference gene primers', note: { en: 'GAPDH / ACTB / 18S rRNA', zh: 'GAPDH / ACTB / 18S rRNA' } },
    ],
    briefSteps: [
      { en: 'Extract RNA → DNase → RT → dilute cDNA → qPCR (SYBR) → melt curve → analyze by 2^(-ΔΔCt)', zh: 'RNA 提取 → DNase → 反转录 → 稀释 cDNA → qPCR (SYBR) → 溶解曲线 → 2^(-ΔΔCt) 分析' },
    ],
    detailedSteps: [
      { en: '**RNA quality check**: Measure A260/280 (should be ~2.0). A260/230 >1.7. Optionally check on agarose gel (28S:18S ~2:1)', zh: '**RNA 质检**: 测 A260/280（应为 ~2.0）。A260/230 >1.7。可选跑琼脂糖凝胶（28S:18S ~2:1）' },
      { en: '**DNase treatment** (recommended): Use TURBO DNase or on-column DNase. Heat-inactivate 75°C 5 min or use DNase removal reagent', zh: '**DNase 处理**（推荐）：用 TURBO DNase 或柱上 DNase。75°C 5 min 热灭活或用 DNase 去除试剂' },
      { en: '**Reverse transcription**: Use 500 ng–2 µg RNA per 20 µL reaction. Use oligo-dT + random hexamer mix for best coverage', zh: '**反转录**: 每 20 µL 反应体系用 500 ng–2 µg RNA。Oligo-dT + 随机六聚体混合引物效果最好' },
      { en: 'RT program: 25°C 5 min → 42–50°C 30–60 min → 85°C 5 min (inactivation). Store cDNA at -20°C', zh: 'RT 程序：25°C 5 min → 42–50°C 30–60 min → 85°C 5 min（灭活）。cDNA -20°C 保存' },
      { en: '**Dilute cDNA**: 1:5 to 1:20 with nuclease-free H₂O (typically 1:10). Include –RT control (no reverse transcriptase)', zh: '**稀释 cDNA**: 用无核酸酶水 1:5 至 1:20 稀释（通常 1:10）。设置 –RT 对照（不加逆转录酶）' },
      { en: '**qPCR setup (20 µL)**: 10 µL 2× SYBR Master Mix + 0.4 µL Fw primer (10 µM) + 0.4 µL Rv primer (10 µM) + 2 µL cDNA + 7.2 µL H₂O', zh: '**qPCR 体系 (20 µL)**: 10 µL 2× SYBR Master Mix + 0.4 µL Fw 引物 (10 µM) + 0.4 µL Rv 引物 (10 µM) + 2 µL cDNA + 7.2 µL H₂O' },
      { en: '⚠️ Set up on ice. Include NTC (no template control) for every primer pair. Technical replicates ≥3', zh: '⚠️ 冰上操作。每对引物设 NTC（无模板对照）。技术重复 ≥3' },
      { en: '**Cycling**: 95°C 10 min (polymerase activation) → [95°C 15 s → 60°C 60 s] × 40 cycles → Melt curve: 60°C→95°C', zh: '**程序**: 95°C 10 min（聚合酶激活）→ [95°C 15 s → 60°C 60 s] × 40 个循环 → 溶解曲线: 60°C→95°C' },
      { en: '**Melt curve analysis**: Single peak = specific product ✓. Multiple peaks = non-specific or primer dimers ✗', zh: '**溶解曲线分析**: 单峰 = 特异性产物 ✓。多峰 = 非特异或引物二聚体 ✗' },
      { en: '**Primer efficiency**: Make 5-point serial dilution of cDNA (1:4). Plot Ct vs log(dilution). Slope should be -3.2 to -3.5 (efficiency 90–110%)', zh: '**引物效率**: 做 5 点 cDNA 梯度稀释（1:4）。Ct vs log(稀释) 作图。斜率应为 -3.2 ~ -3.5（效率 90–110%）' },
      { en: '**Analysis**: ΔCt = Ct(target) – Ct(reference). ΔΔCt = ΔCt(treated) – ΔCt(control). Fold change = 2^(-ΔΔCt)', zh: '**分析**: ΔCt = Ct(目标) – Ct(内参)。ΔΔCt = ΔCt(处理组) – ΔCt(对照组)。倍数变化 = 2^(-ΔΔCt)' },
      { en: 'Bio reps ≥3. Stats: t-test on ΔCt values (NOT fold changes). Report as mean ± SEM', zh: '生物学重复 ≥3。统计：对 ΔCt 值做 t 检验（不是倍数变化）。报告 mean ± SEM' },
    ],
  },
  cell_transfection: {
    usage: { en: 'Deliver plasmid DNA or siRNA/miRNA into mammalian cells using cationic lipid reagents. Transient expression peaks 24–72h. For stable expression, add selection antibiotics.', zh: '利用阳离子脂质试剂将质粒 DNA 或 siRNA/miRNA 导入哺乳动物细胞。瞬时表达高峰 24–72h。稳定表达需加筛选抗生素。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — 1h setup + 24–72h expression', zh: '实验方案 — 1h 操作 + 24–72h 表达' } },
    materials: [
      { name: 'Opti-MEM', note: { en: 'Serum-free media for complex formation', zh: '无血清培养基，用于复合物形成' } },
      { name: 'Lipofectamine 2000/3000', note: { en: 'Or RNAiMAX for siRNA', zh: '或 RNAiMAX（用于 siRNA）' } },
      { name: 'Plasmid DNA / siRNA', note: { en: 'Endotoxin-free prep', zh: '无内毒素制备' } },
      { name: 'Complete growth media', note: { en: 'For recovery after transfection', zh: '转染后恢复培养用' } },
    ],
    briefSteps: [
      { en: 'Plate cells → mix DNA/Opti-MEM (tube A) → mix Lipo/Opti-MEM (tube B) → combine A+B → add to cells → replace media 6h → harvest 24–72h', zh: '铺板 → DNA/Opti-MEM 混合(管A) → Lipo/Opti-MEM 混合(管B) → A+B 混合 → 加入细胞 → 6h 换液 → 24–72h 收样' },
    ],
    detailedSteps: [
      { en: '**Day before**: Plate cells to reach 60–80% confluency at transfection. Do NOT use antibiotics in plating media', zh: '**前一天**: 铺板使转染时达到 60–80% 汇合度。铺板培养基不要加抗生素' },
      { en: '💡 Cell density matters: too sparse = toxicity; too confluent = low efficiency. Optimize for each cell line', zh: '💡 细胞密度很关键：太稀 = 毒性大；太密 = 效率低。每个细胞系需优化' },
      { en: '**Tube A — DNA mix**: For each well of 6-well plate: 2.5 µg DNA + 125 µL Opti-MEM. Mix gently', zh: '**管 A — DNA 混合**: 6 孔板每孔：2.5 µg DNA + 125 µL Opti-MEM。轻柔混匀' },
      { en: '**Tube B — Lipid mix**: 7.5 µL Lipofectamine 2000 (or 3.75 µL Lipo 3000 + 5 µL P3000) + 125 µL Opti-MEM', zh: '**管 B — 脂质混合**: 7.5 µL Lipofectamine 2000（或 3.75 µL Lipo 3000 + 5 µL P3000）+ 125 µL Opti-MEM' },
      { en: 'Incubate each tube 5 min RT', zh: '各管室温孵育 5 min' },
      { en: '**Combine**: Add tube A into tube B (NOT the reverse). Mix gently. Incubate 15–20 min RT. Solution may become slightly cloudy', zh: '**混合**: 将管 A 加入管 B（不要反过来）。轻柔混匀。室温 15–20 min。溶液可能会轻微浑浊' },
      { en: 'Add complex dropwise to cells. Rock plate gently to distribute', zh: '将复合物逐滴加入细胞。轻摇培养板使其均匀分布' },
      { en: '**Replace media**: After 6–8 h, replace with fresh complete media (with serum, optional antibiotics)', zh: '**换液**: 6–8 h 后换新鲜完全培养基（含血清，可选抗生素）' },
      { en: '**Harvest**: Check expression at 24 h (reporter), 48 h (protein), or 72 h (maximum protein accumulation)', zh: '**收样**: 24 h 检查表达（报告基因），48 h（蛋白），72 h（蛋白积累最大化）' },
      { en: '💡 **siRNA transfection**: Use Lipofectamine RNAiMAX instead. 25–50 pmol siRNA per 6-well. Knockdown peaks at 48–72 h', zh: '💡 **siRNA 转染**: 改用 Lipofectamine RNAiMAX。6 孔板每孔 25–50 pmol siRNA。敲低高峰在 48–72 h' },
    ],
  },
  flow_cytometry_protocol: {
    usage: { en: 'Analyze protein expression on individual cells by fluorescent antibody staining. Enables multi-parameter phenotyping, cell counting, and sorting (FACS).', zh: '通过荧光抗体染色分析单个细胞的蛋白表达。支持多参数表型分析、细胞计数和分选（FACS）。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — ~3h', zh: '实验方案 — 约 3 小时' } },
    materials: [
      { name: 'PBS (1×)', linkedRecipe: 'pbs_1x' },
      { name: 'FACS Buffer', linkedRecipe: 'facs_buffer' },
      { name: '4% PFA', linkedRecipe: 'pfa_4', note: { en: 'For intracellular staining fixation', zh: '用于胞内染色的固定' } },
      { name: 'Fc Block', note: { en: 'Human TruStain FcX / mouse anti-CD16/32', zh: 'Human TruStain FcX / 小鼠 anti-CD16/32' } },
      { name: 'Fluorescent antibodies', note: { en: 'Titrate each Ab individually first!', zh: '每个抗体需先单独做滴度实验！' } },
      { name: 'Viability dye', note: { en: 'DAPI, PI, or fixable Live/Dead', zh: 'DAPI、PI 或可固定 Live/Dead 染料' } },
    ],
    briefSteps: [
      { en: 'Harvest cells → Fc block → surface Ab stain 4°C 30min → wash → (fix → perm → intracellular stain) → viability dye → acquire ≥10K events', zh: '收集细胞 → Fc 封闭 → 表面抗体 4°C 30min → 洗 → (固定 → 透化 → 胞内染色) → 活死染料 → 采集 ≥1 万事件' },
    ],
    detailedSteps: [
      { en: '**Harvest**: Collect cells (trypsinize adherent cells gently, or collect suspension). Count. Use ≥1×10⁵ cells per tube', zh: '**收集**: 收集细胞（贴壁细胞轻柔消化，悬浮细胞直接收集）。计数。每管 ≥1×10⁵ 细胞' },
      { en: 'Wash 1× PBS (300×g, 5 min). Resuspend in 100 µL FACS buffer', zh: 'PBS 洗 1 次（300×g，5 min）。重悬于 100 µL FACS buffer' },
      { en: '**Fc Block**: Add Fc receptor blocking reagent. Incubate 4°C 10 min. Do NOT wash', zh: '**Fc 封闭**: 加 Fc 受体封闭试剂。4°C 10 min。不洗' },
      { en: '**Surface staining**: Add fluorescent antibodies at titrated amounts. Incubate 4°C 20–30 min in the dark', zh: '**表面染色**: 按滴定量加入荧光抗体。4°C 避光孵育 20–30 min' },
      { en: "⚠️ Antibody titration is ESSENTIAL: test 2-fold dilutions from manufacturer's recommendation to find the amount that gives best separation", zh: '⚠️ 抗体滴定是必须的：从厂商推荐量开始做 2 倍梯度稀释，找到分离度最佳的用量' },
      { en: 'Wash 2× with 1 mL FACS buffer (300×g, 5 min)', zh: '1 mL FACS buffer 洗 2 次（300×g, 5 min）' },
      { en: '**For surface staining only**: Resuspend in 200–500 µL FACS buffer + viability dye. Go to acquisition', zh: '**仅表面染色**: 重悬于 200–500 µL FACS buffer + 活死染料。直接上机' },
      { en: '**For intracellular staining** (optional):', zh: '**胞内染色**（可选）:', isHeader: true },
      { en: 'Fix: 4% PFA 20 min RT. Wash 2× PBS', zh: '固定：4% PFA 室温 20 min。PBS 洗 2 次' },
      { en: 'Permeabilize: 0.1% saponin or commercial Perm buffer, 15 min RT', zh: '透化：0.1% 皂苷或商品化 Perm buffer，室温 15 min' },
      { en: 'Stain intracellular targets in Perm buffer. 30 min RT dark. Wash 2×', zh: '在 Perm buffer 中染胞内靶标。室温避光 30 min。洗 2 次' },
      { en: '**Acquisition**: Resuspend in 200–500 µL FACS buffer. Acquire on flow cytometer', zh: '**上机**: 重悬于 200–500 µL FACS buffer。上流式细胞仪' },
      { en: 'Acquire ≥10,000 events in live cell gate. For rare populations, acquire ≥100,000', zh: '在活细胞门中采集 ≥10,000 个事件。稀有细胞群需采集 ≥100,000' },
      { en: '**Controls needed**: Unstained, single-stain (for compensation), FMO (for gating), isotype (optional)', zh: '**所需对照**: 未染色、单染（补偿用）、FMO（门控用）、同型对照（可选）' },
    ],
  },
  // ── v1.9 new protocol enhancements ──
  heat_shock_transformation: {
    usage: { en: 'Standard method for introducing plasmid DNA into chemically competent E. coli. Used for cloning, protein expression, and library construction. Quick (2 h from thaw to plating).', zh: '将质粒 DNA 导入化学感受态大肠杆菌的标准方法。用于克隆、蛋白表达和文库构建。快速（从解冻到涂板 2 h）。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — 2 hours + overnight incubation', zh: '实验方案 — 2 小时 + 过夜培养' } },
    materials: [
      { name: 'Competent Cells', linkedRecipe: 'competent_cells_cacl2' },
      { name: 'SOC Medium', linkedRecipe: 'soc' },
      { name: 'LB Agar + Antibiotic', linkedRecipe: 'lb_agar' },
      { name: 'Plasmid DNA', note: { en: 'High purity, 1–50 ng', zh: '高纯度, 1–50 ng' } },
    ],
    briefSteps: [
      { en: 'Thaw cells on ice → add DNA → ice 30 min → 42°C 45 s → ice 2 min → add SOC → 37°C 1 h → plate on selective agar → O/N 37°C', zh: '冰上解冻感受态 → 加 DNA → 冰浴 30 min → 42°C 45 s → 冰浴 2 min → 加 SOC → 37°C 1 h → 涂选择性平板 → 37°C 过夜' },
    ],
    detailedSteps: [
      { en: '**Preparation**: Pre-warm selective LB agar plates at 37°C (at least 30 min to dry surface moisture)', zh: '**准备**: 选择性 LB 琼脂平板 37°C 预热（至少 30 min 烘干表面水分）' },
      { en: 'Thaw one aliquot of competent cells on ice for 5 min. Do NOT warm with hands', zh: '冰上解冻一管感受态细胞 5 min。不要用手温暖' },
      { en: '**Add DNA**: Gently pipette 1–5 µL DNA (1–50 ng) directly into cells. Flick tube gently 4–5×. Do NOT vortex or pipet up/down', zh: '**加 DNA**: 轻柔移取 1–5 µL DNA (1–50 ng) 直接加入细胞。轻弹管壁 4–5 次。不要涡旋或反复吹打' },
      { en: '⚠️ DNA volume must be ≤10% of cell volume (e.g., ≤5 µL into 50 µL cells). Excess volume reduces efficiency dramatically', zh: '⚠️ DNA 体积必须 ≤ 感受态体积的 10%（如 50 µL 细胞中加 ≤5 µL）。过量会严重降低效率' },
      { en: 'Incubate on ice for 30 min. Do not shake or move the tube', zh: '冰浴 30 min。不要摇动或移动管子' },
      { en: '**Heat shock**: Transfer tube to 42°C water bath for exactly 45 seconds. Start timer before placing tube', zh: '**热激**: 将管子转移至 42°C 水浴，精确 45 秒。放入前开始计时' },
      { en: 'Immediately return to ice for 2 min. This step is critical for survival', zh: '立即放回冰上 2 min。此步对细胞存活至关重要' },
      { en: '**Recovery**: Add 950 µL room-temperature SOC medium (or LB). SOC gives 2–5× better efficiency', zh: '**恢复**: 加入 950 µL 室温 SOC 培养基（或 LB）。SOC 效率高 2–5 倍' },
      { en: 'Incubate at 37°C, 225 rpm for 1 hour (Amp) or 1.5 hours (Kan/Cm)', zh: '37°C 225 rpm 振荡 1 小时 (Amp) 或 1.5 小时 (Kan/Cm)' },
      { en: '**Plating**: For routine cloning: plate 100 µL directly + spin down remainder and plate. For ligation: plate everything', zh: '**涂板**: 常规克隆: 直接涂 100 µL + 剩余离心后涂板。连接产物: 全部涂板' },
      { en: 'Spread evenly with sterile glass beads or spreader. Allow plates to dry 5 min (lid slightly open)', zh: '用无菌玻璃珠或涂布棒均匀涂开。开盖干燥 5 min' },
      { en: 'Invert plates. Incubate at 37°C for 12–16 hours. Do not exceed 16 h (satellite colonies form)', zh: '倒置平板。37°C 培养 12–16 小时。不要超过 16 h（会出现卫星菌落）' },
      { en: '**Controls**: Always include: (1) no-DNA negative control, (2) uncut vector positive control, (3) cut-only vector control (background)', zh: '**对照**: 始终设置: (1) 无 DNA 阴性对照, (2) 未切割载体阳性对照, (3) 仅切割载体对照（背景）' },
    ],
  },
  // ── v1.8 protocol enhancements ──
  colony_pcr: {
    usage: { en: 'Screen bacterial colonies for correct insert after transformation. Faster than miniprep + restriction digest. Screen 8–16 colonies per construct.', zh: '转化后筛选含正确插入片段的菌落。比提质粒 + 酶切更快。每个构建体筛选 8–16 个菌落。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — ~2h', zh: '实验方案 — 约 2h' } },
    materials: [
      { name: '2× Taq Master Mix', note: { en: 'Commercial (e.g., NEB, Takara)', zh: '商品化（如 NEB、Takara）' } },
      { name: 'Forward primer (10 µM)', note: { en: 'M13 or gene-specific', zh: 'M13 通用引物或基因特异引物' } },
      { name: 'Reverse primer (10 µM)', note: { en: 'M13 or gene-specific', zh: 'M13 通用引物或基因特异引物' } },
      { name: 'Nuclease-free water', note: { en: '', zh: '' } },
      { name: 'Sterile toothpicks or pipette tips', note: { en: '', zh: '' } },
      { name: 'DNA Loading Dye (6×)', linkedRecipe: 'dna_loading_dye_6x' },
      { name: 'Agarose gel + DNA Ladder', note: { en: '1–1.5%', zh: '1–1.5%' } },
      { name: 'LB + antibiotic replica plate', note: { en: 'For backup streaks', zh: '用于备份划线' } },
    ],
    briefSteps: [
      { en: 'Set up PCR mix (25 µL): master mix + primers + water → pick colony with tip → dip in PCR tube → streak on replica plate → PCR: 95°C 10 min → 30 cycles → agarose gel → sequence positives', zh: '配 PCR 体系 (25 µL): master mix + 引物 + 水 → 枪头挑菌落 → 蘸入 PCR 管 → 划线到备份板 → PCR: 95°C 10 min → 30 个循环 → 琼脂糖凝胶 → 阳性送测序' },
    ],
    detailedSteps: [
      { en: 'Prepare PCR master mix in a 1.5 mL tube: 12.5 µL 2× Taq mix, 1 µL each primer (10 µM), 10.5 µL water per reaction. Make N+1 reactions', zh: '在 1.5 mL 管中配 PCR 体系：12.5 µL 2× Taq mix，各 1 µL 引物（10 µM），10.5 µL 水/反应。配 N+1 个反应' },
      { en: 'Aliquot 25 µL into each PCR tube. Label tubes to match colony numbers', zh: '每管分装 25 µL，标记与菌落编号对应' },
      { en: 'Using a sterile pipette tip or toothpick, touch a single colony lightly', zh: '用无菌枪头或牙签轻触单个菌落' },
      { en: 'Dip the tip into the PCR tube and swirl briefly to release cells', zh: '将枪头在 PCR 管中轻轻搅动释放细菌' },
      { en: '(Recommended) Streak the same tip onto a fresh replica plate. Label to match', zh: '（推荐）用同一枪头在备份平板上划线，标记编号' },
      { en: 'Incubate replica plate at 37°C while PCR runs', zh: 'PCR 运行时将备份板 37°C 培养' },
      { en: 'Include negative control (no colony) and positive control (known template) if available', zh: '设阴性对照（无菌落）和阳性对照（已知模板，如有）' },
      { en: 'Run PCR: 95°C 10 min (lyses cells) → (95°C 30s, 55°C 30s, 72°C 1 min/kb) × 30 → 72°C 5 min → hold 4°C', zh: 'PCR 程序: 95°C 10 min (裂解细菌) → (95°C 30s, 55°C 30s, 72°C 1 min/kb) × 30 → 72°C 5 min → 4°C 保持' },
      { en: 'Add 5 µL of 6× loading dye to each 25 µL reaction', zh: '每管加 5 µL 6× loading dye' },
      { en: 'Run on 1% agarose gel alongside DNA ladder. Image: positive clones show band at expected insert size', zh: '1% 琼脂糖凝胶电泳，加 DNA ladder。成像：阳性克隆在预期插入片段大小处有条带' },
      { en: 'Inoculate 2–3 positive clones from replica plate into LB + antibiotic overnight, miniprep, and sequence-verify', zh: '从备份板挑 2–3 个阳性克隆，接种到 LB + 抗生素过夜培养，提质粒，送测序验证' },
    ],
  },
  competent_cells_cacl2: {
    usage: { en: 'Prepare chemically competent E. coli cells for heat-shock transformation. Simple and cheap, yields 10⁶–10⁷ CFU/µg. Sufficient for routine cloning.', zh: '制备化学感受态大肠杆菌用于热激转化。简单便宜，效率 10⁶–10⁷ CFU/µg。足够常规克隆使用。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — ~4h + O/N culture', zh: '实验方案 — 约 4h + 过夜培养' } },
    materials: [
      { name: 'LB Medium', linkedRecipe: 'lb' },
      { name: '100 mM CaCl₂ (autoclaved, ice-cold)', note: { en: 'Pre-chill to 4°C', zh: '预冷至 4°C' } },
      { name: 'Glycerol (60%, sterile)', note: { en: 'For freezing stock', zh: '用于冻存' } },
      { name: 'Liquid nitrogen', note: { en: 'For snap-freezing', zh: '速冻用' } },
    ],
    briefSteps: [
      { en: 'Grow to OD 0.3–0.5 → ice 15 min → pellet → resuspend in cold CaCl₂ → ice 30 min → pellet → resuspend in CaCl₂ + glycerol → aliquot → snap-freeze', zh: '培养至 OD 0.3–0.5 → 冰浴 15 min → 离心 → 冷 CaCl₂ 重悬 → 冰浴 30 min → 离心 → CaCl₂ + 甘油重悬 → 分装 → 速冻' },
    ],
    detailedSteps: [
      { en: '**Day 0**: Inoculate single colony into 5 mL LB. Grow O/N at 37°C with shaking', zh: '**前一天**: 挑单克隆接种 5 mL LB。37°C 振荡过夜' },
      { en: '**Day 1**: Dilute O/N culture 1:100 into 50 mL fresh LB in 250 mL flask', zh: '**当天**: 过夜菌液 1:100 接种至 250 mL 锥形瓶中 50 mL 新鲜 LB' },
      { en: 'Grow at 37°C with vigorous shaking until OD₆₀₀ = 0.3–0.5 (~2–3 h). ⚠️ Do NOT overgrow!', zh: '37°C 剧烈振荡至 OD₆₀₀ = 0.3–0.5（约 2–3 h）。⚠️ 不要过度生长！' },
      { en: 'Transfer to pre-chilled 50 mL tube. Ice 15 min', zh: '转移至预冷的 50 mL 管。冰浴 15 min' },
      { en: 'Centrifuge 3000×g, 10 min, 4°C. Decant supernatant completely', zh: '4°C 3000×g 离心 10 min。完全倒掉上清' },
      { en: 'Gently resuspend pellet in 25 mL ice-cold 100 mM CaCl₂ (pipet gently — do NOT vortex!)', zh: '用 25 mL 冰冷 100 mM CaCl₂ 轻柔重悬沉淀（轻柔吹打——不要涡旋！）' },
      { en: 'Incubate on ice 30 min', zh: '冰浴 30 min' },
      { en: 'Centrifuge 3000×g, 10 min, 4°C. Decant carefully', zh: '4°C 3000×g 离心 10 min。小心倒掉上清' },
      { en: 'Resuspend in 2.5 mL ice-cold 100 mM CaCl₂ + 15% glycerol', zh: '用 2.5 mL 冰冷 100 mM CaCl₂ + 15% 甘油 轻柔重悬' },
      { en: 'Aliquot 100 µL per pre-chilled 1.5 mL tube. Snap-freeze in liquid N₂. Store -80°C', zh: '分装 100 µL/预冷管。液氮速冻。-80°C 保存' },
      { en: '**Test efficiency**: Transform 1 ng pUC19, plate on LB + Amp. Count colonies next day', zh: '**效率测试**: 转化 1 ng pUC19，涂 LB + Amp 平板。次日计数菌落' },
    ],
  },
  trypan_blue_counting: {
    usage: { en: 'Count cells and determine viability before seeding, passaging, or experiments. Dead cells take up trypan blue (blue), live cells exclude it (clear).', zh: '在接种、传代或实验前计数细胞并判断活力。死细胞摄取台盼蓝（蓝色），活细胞排斥（透明）。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — 5 min', zh: '实验方案 — 5 分钟' } },
    materials: [
      { name: 'Cell suspension (trypsinized, single-cell)', note: { en: '', zh: '' } },
      { name: '0.4% Trypan Blue', note: { en: 'Commercial solution (Gibco/Sigma)', zh: '商品化溶液（Gibco/Sigma）' } },
      { name: 'Hemocytometer (Neubauer improved)', note: { en: '+ coverslip', zh: '+ 盖玻片' } },
      { name: 'Micropipette (10–20 µL)', note: { en: '', zh: '' } },
      { name: 'Counter (hand tally or app)', note: { en: 'Optional', zh: '可选' } },
    ],
    briefSteps: [
      { en: 'Prepare single-cell suspension → mix 10 µL cells + 10 µL trypan blue → load 10 µL onto hemocytometer → count 4 corner squares (live = clear, dead = blue) → calculate: cells/mL = (count ÷ 4) × 2 × 10⁴', zh: '制备单细胞悬液 → 10 µL 细胞 + 10 µL 台盼蓝 → 取 10 µL 加入计数板 → 数 4 个角大格（活=透明, 死=蓝色）→ 计算: cells/mL = (计数 ÷ 4) × 2 × 10⁴' },
    ],
    detailedSteps: [
      { en: 'Trypsinize adherent cells or resuspend suspension cells. Ensure single-cell suspension (no clumps)', zh: '消化贴壁细胞或重悬悬浮细胞，确保单细胞悬液（无团块）' },
      { en: 'Transfer cell suspension to a 15 mL tube. Take a 20 µL aliquot for counting', zh: '转移到 15 mL 管，取 20 µL 用于计数' },
      { en: 'Mix 10 µL of cell suspension with 10 µL of 0.4% trypan blue in a microcentrifuge tube', zh: '在微量离心管中将 10 µL 细胞悬液与 10 µL 0.4% 台盼蓝混匀' },
      { en: 'Incubate for 1–2 min at RT. Do NOT exceed 5 min (trypan blue becomes toxic to live cells)', zh: '室温孵育 1–2 分钟。不超过 5 分钟（台盼蓝对活细胞有毒性）' },
      { en: 'Clean hemocytometer and coverslip with 70% ethanol. Dry completely', zh: '用 70% 乙醇清洁血球计数板和盖玻片，完全干燥' },
      { en: 'Place coverslip on hemocytometer. It should adhere by surface tension (Newton rings visible)', zh: '放置盖玻片，应通过表面张力贴合（可见牛顿环）' },
      { en: 'Load 10 µL of the trypan blue mixture into one chamber. Let it fill by capillary action', zh: '取 10 µL 台盼蓝混合物加入一侧计数室，利用毛细作用填充' },
      { en: 'Place on microscope at 10× magnification', zh: '放在显微镜下 10× 观察' },
      { en: 'Count all four corner squares (each 1 mm × 1 mm). Count live cells (clear/refractile) and dead cells (blue) separately', zh: '计数四个角大格（每个 1 mm × 1 mm）。分别计数活细胞（透明/折光）和死细胞（蓝色）' },
      { en: 'Follow convention: count cells touching top and left borders, skip bottom and right', zh: '规则：计数触碰上线和左线的细胞，不计下线和右线的' },
      { en: '**Calculate concentration**: Cells/mL = (total live count ÷ 4 squares) × dilution factor (2) × 10⁴', zh: '**计算浓度**: 细胞/mL = (4 格活细胞总数 ÷ 4) × 稀释倍数 (2) × 10⁴' },
      { en: '**Calculate viability**: % viable = (live count ÷ total count) × 100. Should be >90% for healthy cultures', zh: '**计算活率**: 活率% = (活细胞数 ÷ 总细胞数) × 100。健康培养 >90%' },
      { en: '**Calculate seeding volume**: Volume (mL) = desired cell count ÷ concentration (cells/mL)', zh: '**计算接种体积**: 体积 (mL) = 所需细胞数 ÷ 浓度 (cells/mL)' },
    ],
  },
  calcium_phosphate_transfection: {
    usage: { en: 'Classic, cost-effective transfection method. Transfect HEK293T, HeLa, and other easily transfectable cell lines. 80–90% efficiency for HEK293T. Widely used for lentivirus packaging.', zh: '经典、低成本的转染方法。适用于 HEK293T、HeLa 等易转染细胞系。HEK293T 效率可达 80–90%。广泛用于慢病毒包装。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — 2–3 day experiment', zh: '实验方案 — 2–3 天实验' } },
    materials: [
      { name: 'Plasmid DNA (high quality, endotoxin-free)', note: { en: 'A260/280 > 1.8', zh: 'A260/280 > 1.8' } },
      { name: '2.5 M CaCl₂ (sterile, 0.22 µm filtered)', note: { en: 'Prepare fresh or store -20°C', zh: '现配或 -20°C 保存' } },
      { name: '2× HBS (HEPES-buffered saline, pH 7.05 exactly)', note: { en: '⚠️ pH 7.05 ± 0.05 is critical', zh: '⚠️ pH 7.05 ± 0.05 是关键' } },
      { name: 'Sterile H₂O', note: { en: '', zh: '' } },
      { name: 'Cells seeded at 50–70% confluence (day before)', note: { en: '', zh: '' } },
      { name: 'Complete growth medium', note: { en: '', zh: '' } },
    ],
    briefSteps: [
      { en: 'Plate cells → mix DNA + CaCl₂ → drop into 2× HBS while bubbling → incubate 20 min → add to cells → O/N → change media → harvest 48–72h', zh: '铺板 → DNA + CaCl₂ 混合 → 逐滴加入 2× HBS 同时吹泡 → 20 min → 加至细胞 → 过夜 → 换液 → 48–72h 收获' },
    ],
    detailedSteps: [
      { en: '**Day 0**: Plate cells to 50–70% confluency by next morning (e.g., 4×10⁶ HEK293T per 10 cm dish)', zh: '**前一天**: 铺板至次日 50–70% 汇合度（如 HEK293T 4×10⁶/10 cm 皿）' },
      { en: '**Day 1 — Transfection**:', zh: '**第一天 — 转染**:', isHeader: true },
      { en: 'Change to fresh medium 1–2 h before transfection. Include 25 µM chloroquine (optional, boosts efficiency 2–3×)', zh: '转染前 1–2 h 换新鲜培养基。可选加 25 µM 氯喹（提高效率 2–3 倍）' },
      { en: 'Tube A: Mix 20 µg DNA + 50 µL 2.5M CaCl₂ + ddH₂O to 500 µL total', zh: '管 A: 20 µg DNA + 50 µL 2.5M CaCl₂ + ddH₂O 补至 500 µL' },
      { en: 'Tube B: Add 500 µL 2× HBS. Insert Pasteur pipet connected to pipet-aid, start bubbling air', zh: '管 B: 加 500 µL 2× HBS。插入连接移液器的巴斯德吸管，开始吹泡' },
      { en: 'Add Tube A dropwise to Tube B while continuously bubbling. This ensures fine precipitate formation', zh: '逐滴将管 A 加入管 B，同时持续吹泡。这确保形成细小沉淀' },
      { en: 'Incubate at RT 15–20 min. Solution should appear slightly turbid (fine precipitate)', zh: '室温静置 15–20 min。溶液应略显浑浊（细小沉淀）' },
      { en: "⚠️ If solution is clear → precipitate did not form (check 2× HBS pH!). If chunky/flocculent → precipitate too large (won't work)", zh: '⚠️ 如果溶液澄清 → 未形成沉淀（检查 2× HBS pH！）。如果絮状/块状 → 沉淀太大（不会起效）' },
      { en: 'Add dropwise to dish while swirling gently. Return to 37°C incubator', zh: '边轻柔晃动培养皿边逐滴加入。放回 37°C 培养箱' },
      { en: '**Day 2**: Replace medium after 12–16 h. Fine granular precipitate on cells is normal and good', zh: '**第二天**: 12–16 h 后换液。细胞上的细颗粒状沉淀是正常的好现象' },
      { en: '**Day 3**: Harvest protein expression at 48 h or collect virus supernatant at 48–72 h', zh: '**第三天**: 48 h 收获蛋白表达或 48–72 h 收集病毒上清' },
    ],
  },
  agarose_gel_electrophoresis: {
    usage: { en: 'Separate DNA fragments by size (100 bp – 25 kb). Use 0.8% for large fragments, 2% for small. Standard for PCR product analysis, restriction digests, quality checks, and gel extraction.', zh: '按大小分离 DNA 片段（100 bp – 25 kb）。大片段用 0.8%，小片段用 2%。用于 PCR 产物分析、酶切鉴定、质量检查和胶回收。' },
    storage: { temp: 'N/A', duration: '', icon: '📋', label: { en: 'Protocol — ~1.5h', zh: '实验方案 — 约 1.5h' } },
    materials: [
      { name: 'Agarose (molecular biology grade)', note: { en: 'Use low-melt for gel extraction', zh: '胶回收用低熔点琼脂糖' } },
      { name: 'TAE (1×) or TBE (1×)', linkedRecipe: 'tae_50x' },
      { name: 'DNA stain (EtBr or SYBR Safe)', note: { en: '0.5 µg/mL EtBr or 1× SYBR Safe', zh: '0.5 µg/mL EtBr 或 1× SYBR Safe' } },
      { name: 'DNA Loading Dye (6×)', linkedRecipe: 'dna_loading_dye_6x' },
      { name: 'DNA Ladder (100 bp or 1 kb)', note: { en: 'Match expected fragment sizes', zh: '与目标片段大小匹配' } },
      { name: 'Gel casting tray + comb', note: { en: '', zh: '' } },
      { name: 'Electrophoresis chamber + power supply', note: { en: '', zh: '' } },
      { name: 'UV transilluminator or blue light imager', note: { en: '', zh: '' } },
    ],
    briefSteps: [
      { en: 'Dissolve agarose in buffer → microwave → cool to 55°C → add stain → pour gel → insert comb → solidify 20–30 min → load samples + ladder → run 80–120V 30–60 min → image under UV/blue light', zh: '溶解琼脂糖 → 微波 → 冷至 55°C → 加染料 → 倒胶 → 插梳 → 凝固 20–30 min → 上样 + Ladder → 80–120V 电泳 30–60 min → UV/蓝光成像' },
    ],
    detailedSteps: [
      { en: '**Choose agarose %**: 0.8% for >1 kb, 1% for 0.5–7 kb, 1.5% for 0.2–3 kb, 2% for <500 bp', zh: '**选择琼脂糖浓度**: 0.8% 适合 >1 kb, 1% 适合 0.5–7 kb, 1.5% 适合 0.2–3 kb, 2% 适合 <500 bp' },
      { en: 'Weigh agarose powder (e.g. 1 g per 100 mL for 1% gel) into an Erlenmeyer flask. Add 1× TAE or TBE buffer. Swirl', zh: '称取琼脂糖粉末（如 1% 胶：1 g / 100 mL）放入锥形瓶。加 1× TAE 或 TBE 缓冲液，摇匀' },
      { en: 'Microwave 1–3 min until agarose is completely dissolved. Watch for boiling over. ⚠️ Loosen cap!', zh: '微波 1–3 min 至完全溶解，注意防止沸腾溢出。⚠️ 松开瓶盖！' },
      { en: 'Cool to ~55°C (comfortable to hold). Add DNA stain (0.5 µg/mL EtBr or 1× SYBR Safe). Swirl', zh: '冷至约 55°C（手可握住）。加 DNA 染料（0.5 µg/mL EtBr 或 1× SYBR Safe）。摇匀' },
      { en: 'Seal ends of gel tray with tape or gaskets. Place comb(s)', zh: '用胶带或密封垫密封胶模两端，放置梳子' },
      { en: 'Pour molten agarose into tray. Pop any bubbles with a pipette tip. Let solidify 20–30 min at RT', zh: '将熔化琼脂糖倒入模具，用枪头戳破气泡。室温凝固 20–30 min' },
      { en: 'Remove comb(s) gently. Place gel in electrophoresis chamber', zh: '轻轻拔出梳子，将凝胶放入电泳槽' },
      { en: 'Fill chamber with 1× TAE/TBE until gel is submerged (2–3 mm above gel surface). Use same buffer as gel', zh: '加 1× TAE/TBE 没过凝胶 2–3 mm。必须与制胶用同一缓冲液' },
      { en: 'Mix DNA samples with 6× loading dye (1:5 ratio). Load into wells using a micropipette', zh: '将 DNA 样品与 6× loading dye 1:5 混合。用微量移液器加样' },
      { en: 'Load DNA ladder in the first and/or last well', zh: '在第一和/或最后一个孔加入 DNA ladder' },
      { en: 'Connect power supply. Run at 5–8 V/cm (e.g., 100–120V for standard mini gel) for 30–60 min', zh: '连接电源。5–8 V/cm 电泳（标准小胶用 100–120V），30–60 min' },
      { en: 'Monitor: loading dye should travel ⅔–¾ of gel length. Dye migrates toward + (red) electrode', zh: '观察：loading dye 应跑到凝胶 ⅔–¾ 处。染料向阳极（红色）迁移' },
      { en: 'Turn off power. Remove gel from tray', zh: '关闭电源，取出凝胶' },
      { en: 'Image on UV transilluminator (254/302 nm for EtBr) or blue light (for SYBR Safe). Photograph and document', zh: '紫外透射仪（EtBr：254/302 nm）或蓝光（SYBR Safe）下成像。拍照记录' },
      { en: 'Compare band sizes to ladder. **For gel extraction**: use blue light (less DNA damage), cut band with clean scalpel, purify with gel extraction kit', zh: '对照 ladder 比较条带大小。**胶回收时**: 使用蓝光（减少 DNA 损伤），用干净手术刀切下条带，用胶回收试剂盒纯化' },
    ],
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Reference Notes (English) — keyed by numeric ID
// ─────────────────────────────────────────────────────────────────────────────

export const REF_NOTES_EN: Record<number, string> = {
  1: 'Foundational SDS-PAGE paper — Laemmli discontinuous electrophoresis system',
  2: 'Original Western blot transfer technique paper',
  3: 'Origin of the name "Western blot"',
  4: 'Molecular Cloning lab manual (classic reference), contains all buffer recipes',
  5: 'Molecular Cloning 4th edition, updated reference manual',
  6: 'Detailed SDS-PAGE protocol with gel recipes and staining',
  7: 'Original LB medium paper (Lysogeny Broth)',
  8: 'SOC medium and high-efficiency transformation protocol',
  9: 'Ponceau S staining as WB loading control',
  10: 'Gel recipe and operation standards (industry standard)',
  11: 'Fast ChIP protocol — Nature Protocols',
  12: 'Blue Native PAGE for native protein complexes — Nature Protocols',
  13: 'REAP: rapid nuclear/cytoplasmic fractionation',
  14: 'TRIzol RNA extraction original paper — >65,000 citations',
  15: 'CSH Protocols — standard TRIzol operation',
  16: 'MIQE guidelines: minimum information for qPCR publication',
  17: 'qPCR 2^(-ΔΔCt) analysis method — >100,000 citations',
  18: 'Immunofluorescence staining standard protocol',
  19: 'Flow cytometry gold standard guidelines — 500+ pages',
  20: 'CRISPR experiment design and analysis review',
  21: 'CRISPR RNP delivery protocol',
  22: 'His/GST affinity tag protein purification review',
  23: 'Complete WB tutorial and troubleshooting',
  24: 'MTT cell viability assay original paper',
  25: 'ChIP technology review and optimization strategies',
};
