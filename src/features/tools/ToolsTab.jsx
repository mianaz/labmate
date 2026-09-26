// ToolsTab — External tools / useful links with a category filter
import { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import PageHeader from '../../components/PageHeader.jsx';
import { IconArrowUpRight } from '../../components/icons.jsx';

// ═══════════════════════════════════════════════
// EXTERNAL TOOLS DATA
// abbr: optional monogram override (otherwise derived from the name)
// ═══════════════════════════════════════════════

const EXTERNAL_TOOLS = [
  { cat: 'toolCatBIS', tools: [
    { name: 'ELISA Calculator', url: 'https://apps.bioinfospace.com/ELISA_calculator/', desc: { en: 'Standard curve fitting & concentration calculation', zh: '标准曲线拟合 & 浓度计算' }},
    { name: 'qPCR Analyzer', url: 'https://apps.bioinfospace.com/qpcr-analysis/', desc: { en: 'ΔΔCt analysis & expression plots', zh: 'ΔΔCt 分析 & 表达量图' }},
    { name: 'freeCount', url: 'https://apps.bioinfospace.com/freeCount/', desc: { en: 'Differential expression analysis (DESeq2/edgeR)', zh: '差异表达分析 (DESeq2/edgeR)' }},
    { name: 'crispRdesignR', url: 'https://apps.bioinfospace.com/crispRdesignR/', desc: { en: 'CRISPR sgRNA design & off-target scoring', zh: 'CRISPR sgRNA 设计 & 脱靶评分' }},
    { name: 'JBrowse 2', url: 'https://apps.bioinfospace.com/jbrowse/', desc: { en: 'Genome browser with custom tracks', zh: '基因组浏览器（自定义 track）' }},
  ]},
  { cat: 'toolCatPrimer', tools: [
    { name: 'PrimerBank', abbr: 'PR', url: 'https://pga.mgh.harvard.edu/primerbank/', desc: { en: 'Pre-validated qPCR primers by gene', zh: '按基因查找已验证 qPCR 引物' }},
    { name: 'Primer-BLAST', url: 'https://www.ncbi.nlm.nih.gov/tools/primer-blast/', desc: { en: 'Design primers with specificity check', zh: '设计引物 + 特异性检查' }},
    { name: 'BLAST', url: 'https://blast.ncbi.nlm.nih.gov/', desc: { en: 'Sequence alignment & identity search', zh: '序列比对 & 同源搜索' }},
    { name: 'NEB Tm Calculator', url: 'https://tmcalculator.neb.com/', desc: { en: 'Accurate Tm with salt/primer concentration', zh: '精确 Tm（考虑盐浓度和引物浓度）' }},
    { name: 'SnapGene Viewer', url: 'https://www.snapgene.com/snapgene-viewer', desc: { en: 'Free plasmid map viewer', zh: '免费质粒图谱查看器' }},
    { name: 'NEBcutter', abbr: 'NC', url: 'https://nc3.neb.com/NEBcutter/', desc: { en: 'Restriction enzyme site analysis', zh: '限制性内切酶位点分析' }},
  ]},
  { cat: 'toolCatProtein', tools: [
    { name: 'UniProt', url: 'https://www.uniprot.org/', desc: { en: 'Protein function, domains & sequences', zh: '蛋白功能、结构域 & 序列' }},
    { name: 'ExPASy ProtParam', url: 'https://web.expasy.org/protparam/', desc: { en: 'MW, pI, extinction coefficient', zh: '分子量、等电点、消光系数' }},
    { name: 'CiteAb', url: 'https://www.citeab.com/', desc: { en: 'Antibody citation data & validation', zh: '抗体引用数据 & 验证信息' }},
    { name: 'Addgene', url: 'https://www.addgene.org/', desc: { en: 'Plasmid repository & viral vectors', zh: '质粒库 & 病毒载体' }},
  ]},
  { cat: 'toolCatGenome', tools: [
    { name: 'Ensembl', url: 'https://ensembl.org/', desc: { en: 'Gene annotation & orthologs', zh: '基因注释 & 直系同源' }},
    { name: 'UCSC Genome Browser', url: 'https://genome.ucsc.edu/', desc: { en: 'Genome visualization & track hubs', zh: '基因组可视化 & track hub' }},
    { name: 'Enrichr', abbr: 'ER', url: 'https://maayanlab.cloud/Enrichr/', desc: { en: 'Gene set enrichment analysis', zh: '基因集富集分析' }},
    { name: 'STRING', url: 'https://string-db.org/', desc: { en: 'Protein interaction networks', zh: '蛋白相互作用网络' }},
    { name: 'DAVID', url: 'https://david.ncifcrf.gov/', desc: { en: 'GO / KEGG pathway enrichment', zh: 'GO / KEGG 通路富集' }},
    { name: 'GEO', url: 'https://www.ncbi.nlm.nih.gov/geo/', desc: { en: 'Public gene expression datasets', zh: '公共基因表达数据集' }},
  ]},
  { cat: 'toolCatData', tools: [
    { name: 'ImageJ.js', url: 'https://ij.imjoy.io/', desc: { en: 'Browser-based ImageJ (WASM)', zh: '浏览器版 ImageJ (WASM)' }},
    { name: 'BioRender', url: 'https://www.biorender.com/', desc: { en: 'Scientific figure illustrations', zh: '科学插图绘制' }},
    { name: 'protocols.io', url: 'https://www.protocols.io/', desc: { en: 'Protocol sharing & DOI minting', zh: '实验方案共享 & DOI 注册' }},
  ]},
  { cat: 'toolCatCancer', tools: [
    { name: 'UCSC Xena Browser', url: 'https://xenabrowser.net/', desc: { en: 'Multi-omic & clinical data visualization', zh: '多组学及临床数据可视化' }},
    { name: 'cBioPortal', url: 'https://www.cbioportal.org/', desc: { en: 'Cancer genomics datasets explorer', zh: '癌症基因组数据集浏览' }},
    { name: 'GDC Data Portal', url: 'https://portal.gdc.cancer.gov/', desc: { en: 'NCI Genomic Data Commons', zh: 'NCI 基因组数据共享平台' }},
    { name: 'COSMIC', url: 'https://cancer.sanger.ac.uk/cosmic', desc: { en: 'Catalogue of somatic mutations in cancer', zh: '癌症体细胞突变目录' }},
  ]},
  { cat: 'toolCatStructure', tools: [
    { name: 'AlphaFold Protein Structure DB', abbr: 'AF', url: 'https://alphafold.ebi.ac.uk/', desc: { en: 'AI-predicted 3D protein structures', zh: 'AI 预测蛋白质三维结构' }},
    { name: 'PDB (RCSB)', abbr: 'PD', url: 'https://www.rcsb.org/', desc: { en: 'Protein Data Bank — 3D structures', zh: '蛋白质数据库 — 三维结构' }},
    { name: 'Phyre2', url: 'http://www.sbg.bio.ic.ac.uk/phyre2/', desc: { en: 'Protein structure prediction', zh: '蛋白质结构预测' }},
    { name: 'SWISS-MODEL', url: 'https://swissmodel.expasy.org/', desc: { en: 'Automated homology modelling', zh: '自动化同源建模' }},
  ]},
  { cat: 'toolCatPathway', tools: [
    { name: 'Reactome', url: 'https://reactome.org/', desc: { en: 'Curated biological pathway database', zh: '人工审编生物通路数据库' }},
    { name: 'KEGG', url: 'https://www.genome.jp/kegg/', desc: { en: 'Pathway maps & molecular networks', zh: '通路图谱 & 分子网络' }},
    { name: 'Cytoscape Web', url: 'https://cytoscape.org/', desc: { en: 'Network visualization & analysis', zh: '网络可视化 & 分析' }},
  ]},
  { cat: 'toolCatClinical', tools: [
    { name: 'ClinVar', url: 'https://www.ncbi.nlm.nih.gov/clinvar/', desc: { en: 'Clinical variant interpretations', zh: '临床变异解读' }},
    { name: 'DrugBank', url: 'https://go.drugbank.com/', desc: { en: 'Drug-target interaction database', zh: '药物-靶标相互作用数据库' }},
    { name: 'PharmGKB', url: 'https://www.pharmgkb.org/', desc: { en: 'Pharmacogenomics knowledge base', zh: '药物基因组学知识库' }},
  ]},
  { cat: 'toolCatSingleCell', tools: [
    { name: 'CellxGene', url: 'https://cellxgene.cziscience.com/', desc: { en: 'Single-cell atlas browser', zh: '单细胞图谱浏览器' }},
    { name: 'Human Cell Atlas', url: 'https://www.humancellatlas.org/', desc: { en: 'Reference maps of all human cells', zh: '人类所有细胞的参考图谱' }},
  ]},
];

const TOTAL_TOOLS = EXTERNAL_TOOLS.reduce((n, g) => n + g.tools.length, 0);

// Two-letter monogram: initials of the first two words ("ELISA Calculator" → EC),
// else the camel-case humps ("freeCount" → FC), else the first two letters.
function monogram(tool) {
  if (tool.abbr) return tool.abbr;
  const words = tool.name.split(/[\s\-.()]+/).filter(w => w && !/^\d+$/.test(w));
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  const w = words[0] || tool.name;
  const hump = w.slice(1).search(/[A-Z]/);
  return (hump >= 0 ? w[0] + w[hump + 1] : w.slice(0, 2)).toUpperCase();
}

function hostname(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

// ═══════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════

function ToolsTab() {
  const lang = useLang();
  const [filter, setFilter] = useState('all');
  const cats = ['all', ...EXTERNAL_TOOLS.map(g => g.cat)];
  const countOf = (c) => (c === 'all' ? TOTAL_TOOLS : EXTERNAL_TOOLS.find(g => g.cat === c).tools.length);
  const newTab = lang === 'zh' ? '（在新标签页中打开）' : '(opens in a new tab)';

  return (
    <div className="fade-in">
      <PageHeader tab="tools" title={t('toolsTitle', lang)} description={t('toolsSubtitle', lang)}
        meta={lang === 'zh' ? `${TOTAL_TOOLS} 个链接` : `${TOTAL_TOOLS} links`} />

      <div className="chip-row is-scroll lg:flex-wrap lg:overflow-visible" style={{ marginBottom: '1.75rem' }}
        role="group" aria-label={lang === 'zh' ? '按类别筛选' : 'Filter by category'}>
        {cats.map(c => (
          <button key={c} type="button" className="chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>
            {c === 'all' ? t('all', lang) : t(c, lang)}
            <span className="chip-count">{countOf(c)}</span>
          </button>
        ))}
      </div>

      <div className="space-y-7">
        {EXTERNAL_TOOLS.filter(g => filter === 'all' || g.cat === filter).map(group => (
          <section key={group.cat} aria-labelledby={`links-${group.cat}`}>
            <h2 id={`links-${group.cat}`} className="eyebrow flex items-center gap-2.5" style={{ marginBottom: '0.75rem' }}>
              <span>{t(group.cat, lang)}</span>
              <span className="tabular" style={{ fontWeight: 500 }}>{String(group.tools.length).padStart(2, '0')}</span>
              <span aria-hidden="true" className="flex-1" style={{ height: 1, background: 'var(--rule)' }} />
            </h2>
            <ul className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(15rem, 1fr))' }}>
              {group.tools.map(tool => (
                <li key={tool.name} className="min-w-0">
                  <a href={tool.url} target="_blank" rel="noopener noreferrer"
                    className="panel card-link group flex items-start gap-3 h-full"
                    style={{ padding: '0.75rem 0.75rem 0.75rem 0.875rem' }}>
                    <span aria-hidden="true"
                      className="mono flex items-center justify-center flex-shrink-0 bg-[var(--bg-2)] text-[var(--text)] group-hover:bg-[var(--primary)] group-hover:text-[var(--on-primary)] group-focus-visible:bg-[var(--primary)] group-focus-visible:text-[var(--on-primary)]"
                      style={{
                        width: 32, height: 32, border: '1px solid var(--border)', fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
                        transition: 'background-color var(--duration-fast) ease, color var(--duration-fast) ease',
                      }}>
                      {monogram(tool)}
                    </span>
                    <span className="min-w-0 flex-1 flex flex-col self-stretch">
                      <span className="flex items-start gap-2">
                        <span className="flex-1 min-w-0 text-sm font-semibold" style={{ color: 'var(--text)', lineHeight: 1.3 }}>{tool.name}</span>
                        <IconArrowUpRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
                      </span>
                      <span className="block text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.45, marginTop: 3 }}>
                        {tool.desc[lang] || tool.desc.en}
                      </span>
                      <span className="block mono truncate mt-auto" style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', paddingTop: 6 }}>
                        {hostname(tool.url)}
                      </span>
                    </span>
                    <span className="sr-only">{newTab}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default ToolsTab;
