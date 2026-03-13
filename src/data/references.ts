// Literature references
export type Reference = {
  id: number
  text: string
  journal: string
  vol: string
  pages: string
  doi: string
  note: string
}

export const REFERENCES = [
  { id: 1, text: 'Laemmli, U. K. (1970). Cleavage of structural proteins during the assembly of the head of bacteriophage T4.', journal: 'Nature', vol: '227(5259)', pages: '680–685', doi: '10.1038/227680a0', note: 'SDS-PAGE 奠基文献，Laemmli 不连续电泳系统' },
  { id: 2, text: 'Towbin, H., Staehelin, T., & Gordon, J. (1979). Electrophoretic transfer of proteins from polyacrylamide gels to nitrocellulose sheets: procedure and some applications.', journal: 'PNAS', vol: '76(9)', pages: '4350–4354', doi: '10.1073/pnas.76.9.4350', note: 'Western blot 转膜技术原始论文' },
  { id: 3, text: 'Burnette, W. N. (1981). "Western blotting": electrophoretic transfer of proteins from sodium dodecyl sulfate—polyacrylamide gels to unmodified nitrocellulose and radiographic detection with antibody and radioiodinated protein A.', journal: 'Analytical Biochemistry', vol: '112(2)', pages: '195–203', doi: '10.1016/0003-2697(81)90281-5', note: '"Western blot" 命名起源' },
  { id: 4, text: 'Sambrook, J. & Russell, D. W. (2001). Molecular Cloning: A Laboratory Manual, 3rd edition.', journal: 'Cold Spring Harbor Laboratory Press', vol: '', pages: '', doi: '', note: '分子克隆实验手册（经典参考书），含各类 buffer 配方' },
  { id: 5, text: 'Green, M. R. & Sambrook, J. (2012). Molecular Cloning: A Laboratory Manual, 4th edition.', journal: 'Cold Spring Harbor Laboratory Press', vol: '', pages: '', doi: '', note: '分子克隆第四版，更新版参考手册' },
  { id: 6, text: 'Gallagher, S. R. (2012). One-dimensional SDS gel electrophoresis of proteins.', journal: 'Current Protocols in Molecular Biology', vol: 'Ch.10', pages: 'Unit 10.2A', doi: '10.1002/0471142727.mb1002as97', note: 'SDS-PAGE 详细实验方案，含胶配方和染色' },
  { id: 7, text: 'Bertani, G. (1951). Studies on lysogenesis I: The mode of phage liberation by lysogenic Escherichia coli.', journal: 'Journal of Bacteriology', vol: '62(3)', pages: '293–300', doi: '10.1128/jb.62.3.293-300.1951', note: 'LB 培养基原始文献 (Lysogeny Broth)' },
  { id: 8, text: 'Hanahan, D. (1983). Studies on transformation of Escherichia coli with plasmids.', journal: 'Journal of Molecular Biology', vol: '166(4)', pages: '557–580', doi: '10.1016/S0022-2836(83)80284-8', note: 'SOC 培养基和高效转化方案' },
  { id: 9, text: 'Romero-Calvo, I. et al. (2010). Reversible Ponceau staining as a loading control alternative to actin in Western blots.', journal: 'Analytical Biochemistry', vol: '401(2)', pages: '318–320', doi: '10.1016/j.ab.2010.02.036', note: 'Ponceau S 染色作为 loading control' },
  { id: 10, text: 'Bio-Rad Laboratories. Mini-PROTEAN® Tetra Handcast Systems Instruction Manual.', journal: 'Bio-Rad Tech Note', vol: '', pages: '', doi: '', note: '胶配方和操作规范参考 (工业标准)' },
  { id: 11, text: 'Nelson, J. D., Denisenko, O. & Bhatt, K. (2006). Protocol for the fast chromatin immunoprecipitation (ChIP) method.', journal: 'Nature Protocols', vol: '1(1)', pages: '179–185', doi: '10.1038/nprot.2006.27', note: 'ChIP 经典流程 — Nature Protocols' },
  { id: 12, text: 'Wittig, I., Braun, H.-P. & Schägger, H. (2006). Blue native PAGE.', journal: 'Nature Protocols', vol: '1(1)', pages: '418–428', doi: '10.1038/nprot.2006.62', note: 'BN-PAGE 天然蛋白复合物电泳 — Nature Protocols' },
  { id: 13, text: 'Suzuki, K., Bose, P., Leong-Quong, R. Y., Fujita, D. J. & Riabowol, K. (2010). REAP: a two minute cell fractionation method.', journal: 'BMC Research Notes / Nature Protocols', vol: '5', pages: '532–539', doi: '10.1038/nprot.2009.2', note: '快速核质分离方案' },
  { id: 14, text: 'Chomczynski, P. & Sacchi, N. (1987). Single-step method of RNA isolation by acid guanidinium thiocyanate–phenol–chloroform extraction.', journal: 'Analytical Biochemistry', vol: '162(1)', pages: '156–159', doi: '10.1016/0003-2697(87)90021-2', note: 'TRIzol RNA 提取法原始文献 — 引用量 >65,000' },
  { id: 15, text: 'Rio, D. C., Ares, M., Hannon, G. J. & Nilsen, T. W. (2010). Purification of RNA using TRIzol (TRI Reagent).', journal: 'Cold Spring Harbor Protocols', vol: '2010(6)', pages: 'pdb.prot5439', doi: '10.1101/pdb.prot5439', note: 'CSH Protocols — TRIzol 标准操作' },
  { id: 16, text: 'Bustin, S. A. et al. (2009). The MIQE guidelines: minimum information for publication of quantitative real-time PCR experiments.', journal: 'Clinical Chemistry', vol: '55(4)', pages: '611–622', doi: '10.1373/clinchem.2008.112797', note: 'qPCR 实验报告最低信息标准 (MIQE)' },
  { id: 17, text: 'Livak, K. J. & Schmittgen, T. D. (2001). Analysis of relative gene expression data using real-time quantitative PCR and the 2^(-ΔΔCt) method.', journal: 'Methods', vol: '25(4)', pages: '402–408', doi: '10.1006/meth.2001.1262', note: 'qPCR 2^(-ΔΔCt) 分析法 — 引用量 >100,000' },
  { id: 18, text: 'Donaldson, J. G. (2015). Immunofluorescence staining.', journal: 'Current Protocols in Cell Biology', vol: '69', pages: '4.3.1–4.3.7', doi: '10.1002/0471143030.cb0403s69', note: '免疫荧光标准流程' },
  { id: 19, text: 'Cossarizza, A. et al. (2019). Guidelines for the use of flow cytometry and cell sorting in immunological studies (2nd ed.).', journal: 'European Journal of Immunology', vol: '49(10)', pages: '1457–1973', doi: '10.1002/eji.201970107', note: '流式细胞术金标准指南 — 500+ 页' },
  { id: 20, text: 'Hanna, R. E. & Doench, J. G. (2020). Design and analysis of CRISPR–Cas experiments.', journal: 'Nature Biotechnology', vol: '38(7)', pages: '824–844', doi: '10.1038/s41587-020-0490-7', note: 'CRISPR 实验设计与分析综述' },
  { id: 21, text: 'Kim, S., Kim, D., Cho, S. W., Kim, J. & Kim, J.-S. (2014). Highly efficient RNA-guided genome editing in human cells via delivery of purified Cas9 ribonucleoproteins.', journal: 'Genome Research', vol: '24(6)', pages: '1012–1019', doi: '10.1101/gr.171322.113', note: 'CRISPR RNP 递送方案' },
  { id: 22, text: 'Kimple, M. E., Brill, A. L. & Pasker, R. L. (2013). Overview of affinity tags for protein purification.', journal: 'Current Protocols in Protein Science', vol: '73', pages: '9.9.1–9.9.23', doi: '10.1002/0471140864.ps0909s73', note: 'His/GST 等亲和标签蛋白纯化综述' },
  { id: 23, text: 'Mahmood, T. & Yang, P.-C. (2012). Western blot: technique, theory, and trouble shooting.', journal: 'North American Journal of Medical Sciences', vol: '4(9)', pages: '429–434', doi: '10.4103/1947-2714.100998', note: 'WB 完整教程与 troubleshooting' },
  { id: 24, text: 'Mosmann, T. (1983). Rapid colorimetric assay for cellular growth and survival.', journal: 'Journal of Immunological Methods', vol: '65(1-2)', pages: '55–63', doi: '10.1016/0022-1759(83)90303-4', note: 'MTT 细胞活力检测原始文献' },
  { id: 25, text: 'Collas, P. (2010). The current state of chromatin immunoprecipitation.', journal: 'Molecular Biotechnology', vol: '45(1)', pages: '87–100', doi: '10.1007/s12033-009-9239-8', note: 'ChIP 技术综述与优化策略' },
];

