// ToolsTab — External tools / useful links with category filter + data export/import
import React, { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import { S_MUTED } from '../../lib/styleConstants.js';
import { exportBackup, importBackup } from '../../lib/backup.js';

import { useToast } from '../../components/Toast.jsx';

// ═══════════════════════════════════════════════
// EXTERNAL TOOLS DATA
// ═══════════════════════════════════════════════

const EXTERNAL_TOOLS = [
  { cat: 'toolCatBIS', tools: [
    { name: 'ELISA Calculator', icon: '📈', url: 'https://apps.bioinfospace.com/ELISA_calculator/', desc: { en: 'Standard curve fitting & concentration calculation', zh: '标准曲线拟合 & 浓度计算' }},
    { name: 'qPCR Analyzer', icon: '🧬', url: 'https://apps.bioinfospace.com/qpcr-analysis/', desc: { en: 'ΔΔCt analysis & expression plots', zh: 'ΔΔCt 分析 & 表达量图' }},
    { name: 'freeCount', icon: '', url: 'https://apps.bioinfospace.com/freeCount/', desc: { en: 'Differential expression analysis (DESeq2/edgeR)', zh: '差异表达分析 (DESeq2/edgeR)' }},
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
    { name: 'DAVID', icon: '', url: 'https://david.ncifcrf.gov/', desc: { en: 'GO / KEGG pathway enrichment', zh: 'GO / KEGG 通路富集' }},
    { name: 'GEO', icon: '🗄️', url: 'https://www.ncbi.nlm.nih.gov/geo/', desc: { en: 'Public gene expression datasets', zh: '公共基因表达数据集' }},
  ]},
  { cat: 'toolCatData', tools: [
    { name: 'ImageJ.js', icon: '🖼️', url: 'https://ij.imjoy.io/', desc: { en: 'Browser-based ImageJ (WASM)', zh: '浏览器版 ImageJ (WASM)' }},
    { name: 'BioRender', icon: '🎨', url: 'https://www.biorender.com/', desc: { en: 'Scientific figure illustrations', zh: '科学插图绘制' }},
    { name: 'protocols.io', icon: '📋', url: 'https://www.protocols.io/', desc: { en: 'Protocol sharing & DOI minting', zh: '实验方案共享 & DOI 注册' }},
  ]},
  { cat: 'toolCatCancer', tools: [
    { name: 'UCSC Xena Browser', icon: '🧬', url: 'https://xenabrowser.net/', desc: { en: 'Multi-omic & clinical data visualization', zh: '多组学及临床数据可视化' }},
    { name: 'cBioPortal', icon: '🔬', url: 'https://www.cbioportal.org/', desc: { en: 'Cancer genomics datasets explorer', zh: '癌症基因组数据集浏览' }},
    { name: 'GDC Data Portal', icon: '🗄️', url: 'https://portal.gdc.cancer.gov/', desc: { en: 'NCI Genomic Data Commons', zh: 'NCI 基因组数据共享平台' }},
    { name: 'COSMIC', icon: '🧪', url: 'https://cancer.sanger.ac.uk/cosmic', desc: { en: 'Catalogue of somatic mutations in cancer', zh: '癌症体细胞突变目录' }},
  ]},
  { cat: 'toolCatStructure', tools: [
    { name: 'AlphaFold Protein Structure DB', icon: '🔮', url: 'https://alphafold.ebi.ac.uk/', desc: { en: 'AI-predicted 3D protein structures', zh: 'AI 预测蛋白质三维结构' }},
    { name: 'PDB (RCSB)', icon: '🧱', url: 'https://www.rcsb.org/', desc: { en: 'Protein Data Bank — 3D structures', zh: '蛋白质数据库 — 三维结构' }},
    { name: 'Phyre2', icon: '🔬', url: 'http://www.sbg.bio.ic.ac.uk/phyre2/', desc: { en: 'Protein structure prediction', zh: '蛋白质结构预测' }},
    { name: 'SWISS-MODEL', icon: '🧬', url: 'https://swissmodel.expasy.org/', desc: { en: 'Automated homology modelling', zh: '自动化同源建模' }},
  ]},
  { cat: 'toolCatPathway', tools: [
    { name: 'Reactome', icon: '🔄', url: 'https://reactome.org/', desc: { en: 'Curated biological pathway database', zh: '人工审编生物通路数据库' }},
    { name: 'KEGG', icon: '🗺️', url: 'https://www.genome.jp/kegg/', desc: { en: 'Pathway maps & molecular networks', zh: '通路图谱 & 分子网络' }},
    { name: 'Cytoscape Web', icon: '🕸️', url: 'https://cytoscape.org/', desc: { en: 'Network visualization & analysis', zh: '网络可视化 & 分析' }},
  ]},
  { cat: 'toolCatClinical', tools: [
    { name: 'ClinVar', icon: '🏥', url: 'https://www.ncbi.nlm.nih.gov/clinvar/', desc: { en: 'Clinical variant interpretations', zh: '临床变异解读' }},
    { name: 'DrugBank', icon: '💊', url: 'https://go.drugbank.com/', desc: { en: 'Drug-target interaction database', zh: '药物-靶标相互作用数据库' }},
    { name: 'PharmGKB', icon: '🧬', url: 'https://www.pharmgkb.org/', desc: { en: 'Pharmacogenomics knowledge base', zh: '药物基因组学知识库' }},
  ]},
  { cat: 'toolCatSingleCell', tools: [
    { name: 'CellxGene', icon: '🔬', url: 'https://cellxgene.cziscience.com/', desc: { en: 'Single-cell atlas browser', zh: '单细胞图谱浏览器' }},
    { name: 'Human Cell Atlas', icon: '🧬', url: 'https://www.humancellatlas.org/', desc: { en: 'Reference maps of all human cells', zh: '人类所有细胞的参考图谱' }},
  ]},
];

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════

function ToolsTab() {
  const lang = useLang();
  const toast = useToast();
  const [filter, setFilter] = useState('all');
  const cats = ['all', ...EXTERNAL_TOOLS.map(g => g.cat)];
  const fileInputRef = React.useRef(null);

  function handleExport() {
    exportBackup();
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const count = importBackup(ev.target.result);
        toast.show(t('importSuccess', lang).replace('{n}', count));
        setTimeout(() => window.location.reload(), 500);
      } catch {
        toast.show(t('importError', lang));
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  }

  return (
    <div className="fade-in">
      <div className="card p-5 mb-6">
        <h2 className="text-xl font-bold mb-1">{t('toolsTitle', lang)}</h2>
        <p className="text-sm mb-4" style={S_MUTED}>{t('toolsSubtitle', lang)}</p>
        <div className="flex flex-wrap gap-2">
          {cats.map(c => (
            <button key={c} onClick={() => setFilter(c)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={{
                background: filter === c ? 'var(--primary)' : 'var(--bg-2)',
                color: filter === c ? 'white' : 'var(--text-muted)',
              }}>
              {c === 'all' ? (lang === 'en' ? 'All' : '全部') : t(c, lang)}
            </button>
          ))}
        </div>
      </div>
      {EXTERNAL_TOOLS.filter(g => filter === 'all' || g.cat === filter).map(group => (
        <div key={group.cat} className="mb-6">
          <h3 className="text-sm font-bold mb-3 px-1" style={S_MUTED}>{t(group.cat, lang)}</h3>
          <div className="grid gap-3" style={{gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))'}}>
            {group.tools.map(tool => (
              <a key={tool.name} href={tool.url} target="_blank" rel="noopener"
                className="card p-4 flex items-start gap-3 transition-all hover:scale-[1.02]"
                style={{textDecoration:'none', color:'var(--text)'}}>
                <span className="text-2xl flex-shrink-0">{tool.icon}</span>
                <div className="min-w-0">
                  <p className="text-sm font-bold">{tool.name}</p>
                  <p className="text-xs mt-0.5" style={S_MUTED}>{tool.desc[lang] || tool.desc.en}</p>
                  <p className="text-xs mono mt-1 truncate" style={{color:'var(--primary)', opacity:0.7}}>{tool.url.replace('https://','').replace(/\/$/,'')}</p>
                </div>
                <span className="text-xs ml-auto flex-shrink-0" style={S_MUTED}>↗</span>
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ToolsTab;
