export interface ExternalToolDesc {
  en: string;
  zh: string;
}

export interface ExternalTool {
  name: string;
  icon: string;
  url: string;
  desc: ExternalToolDesc;
}

export interface ExternalToolGroup {
  cat: string;
  tools: ExternalTool[];
}

export const EXTERNAL_TOOLS: ExternalToolGroup[] = [
  { cat: 'toolCatBIS', tools: [
    { name: 'ELISA Calculator', icon: '📈', url: 'https://apps.bioinfospace.com/ELISA_calculator/', desc: { en: 'Standard curve fitting & concentration calculation', zh: '标准曲线拟合 & 浓度计算' }},
    { name: 'qPCR Analyzer', icon: '🧬', url: 'https://apps.bioinfospace.com/qpcr-analysis/', desc: { en: 'ΔΔCt analysis & expression plots', zh: 'ΔΔCt 分析 & 表达量图' }},
    { name: 'freeCount', icon: '📊', url: 'https://apps.bioinfospace.com/freeCount/', desc: { en: 'Differential expression analysis (DESeq2/edgeR)', zh: '差异表达分析 (DESeq2/edgeR)' }},
    { name: 'crispRdesignR', icon: '✂️', url: 'https://apps.bioinfospace.com/crispRdesignR/', desc: { en: 'CRISPR sgRNA design & off-target scoring', zh: 'CRISPR sgRNA 设计 & 脱靶评分' }},
    { name: 'JBrowse 2', icon: '🗺️', url: 'https://apps.bioinfospace.com/jbrowse/', desc: { en: 'Genome browser with custom tracks', zh: '基因组浏览器（自定义 track）' }},
  ]},
  { cat: 'toolCatPrimer', tools: [
    { name: 'PrimerBank', icon: '🔬', url: 'https://pga.mgh.harvard.edu/primerbank/', desc: { en: 'Pre-validated qPCR primers by gene', zh: '按基因查找已验证 qPCR 引物' }},
    { name: 'Primer-BLAST', icon: '🎯', url: 'https://www.ncbi.nlm.nih.gov/tools/primer-blast/', desc: { en: 'Design primers with specificity check', zh: '设计引物 + 特异性检查' }},
    { name: 'BLAST', icon: '💥', url: 'https://blast.ncbi.nlm.nih.gov/', desc: { en: 'Sequence alignment & identity search', zh: '序列比对 & 同源搜索' }},
    { name: 'NEB Tm Calculator', icon: '🌡️', url: 'https://tmcalculator.neb.com/', desc: { en: 'Accurate Tm with salt/primer concentration', zh: '精确 Tm（考虑盐浓度和引物浓度）' }},
    { name: 'SnapGene Viewer', icon: '🧫', url: 'https://www.snapgene.com/snapgene-viewer', desc: { en: 'Free plasmid map viewer', zh: '免费质粒图谱查看器' }},
    { name: 'NEBcutter', icon: '✂️', url: 'https://nc3.neb.com/NEBcutter/', desc: { en: 'Restriction enzyme site analysis', zh: '限制性内切酶位点分析' }},
  ]},
  { cat: 'toolCatProtein', tools: [
    { name: 'UniProt', icon: '🧪', url: 'https://www.uniprot.org/', desc: { en: 'Protein function, domains & sequences', zh: '蛋白功能、结构域 & 序列' }},
    { name: 'ExPASy ProtParam', icon: '⚖️', url: 'https://web.expasy.org/protparam/', desc: { en: 'MW, pI, extinction coefficient', zh: '分子量、等电点、消光系数' }},
    { name: 'CiteAb', icon: '🏷️', url: 'https://www.citeab.com/', desc: { en: 'Antibody citation data & validation', zh: '抗体引用数据 & 验证信息' }},
    { name: 'Addgene', icon: '📦', url: 'https://www.addgene.org/', desc: { en: 'Plasmid repository & viral vectors', zh: '质粒库 & 病毒载体' }},
  ]},
  { cat: 'toolCatGenome', tools: [
    { name: 'Ensembl', icon: '🧬', url: 'https://ensembl.org/', desc: { en: 'Gene annotation & orthologs', zh: '基因注释 & 直系同源' }},
    { name: 'UCSC Genome Browser', icon: '🌐', url: 'https://genome.ucsc.edu/', desc: { en: 'Genome visualization & track hubs', zh: '基因组可视化 & track hub' }},
    { name: 'Enrichr', icon: '📈', url: 'https://maayanlab.cloud/Enrichr/', desc: { en: 'Gene set enrichment analysis', zh: '基因集富集分析' }},
    { name: 'STRING', icon: '🕸️', url: 'https://string-db.org/', desc: { en: 'Protein interaction networks', zh: '蛋白相互作用网络' }},
    { name: 'DAVID', icon: '📊', url: 'https://david.ncifcrf.gov/', desc: { en: 'GO / KEGG pathway enrichment', zh: 'GO / KEGG 通路富集' }},
    { name: 'GEO', icon: '🗄️', url: 'https://www.ncbi.nlm.nih.gov/geo/', desc: { en: 'Public gene expression datasets', zh: '公共基因表达数据集' }},
  ]},
  { cat: 'toolCatData', tools: [
    { name: 'ImageJ.js', icon: '🖼️', url: 'https://ij.imjoy.io/', desc: { en: 'Browser-based ImageJ (WASM)', zh: '浏览器版 ImageJ (WASM)' }},
    { name: 'BioRender', icon: '🎨', url: 'https://www.biorender.com/', desc: { en: 'Scientific figure illustrations', zh: '科学插图绘制' }},
    { name: 'protocols.io', icon: '📋', url: 'https://www.protocols.io/', desc: { en: 'Protocol sharing & DOI minting', zh: '实验方案共享 & DOI 注册' }},
  ]},
];
