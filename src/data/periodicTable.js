// DATA: Periodic Table Elements

export const ELEMENTS = [
  {z:1,sym:'H',name:'Hydrogen',mass:1.008,cat:'nonmetal',econf:'1s¹'},
  {z:2,sym:'He',name:'Helium',mass:4.003,cat:'noble-gas',econf:'1s²'},
  {z:3,sym:'Li',name:'Lithium',mass:6.941,cat:'alkali',econf:'[He] 2s¹'},
  {z:4,sym:'Be',name:'Beryllium',mass:9.012,cat:'alkaline-earth',econf:'[He] 2s²'},
  {z:5,sym:'B',name:'Boron',mass:10.81,cat:'metalloid',econf:'[He] 2s² 2p¹'},
  {z:6,sym:'C',name:'Carbon',mass:12.011,cat:'nonmetal',econf:'[He] 2s² 2p²'},
  {z:7,sym:'N',name:'Nitrogen',mass:14.007,cat:'nonmetal',econf:'[He] 2s² 2p³'},
  {z:8,sym:'O',name:'Oxygen',mass:15.999,cat:'nonmetal',econf:'[He] 2s² 2p⁴'},
  {z:9,sym:'F',name:'Fluorine',mass:18.998,cat:'halogen',econf:'[He] 2s² 2p⁵'},
  {z:10,sym:'Ne',name:'Neon',mass:20.180,cat:'noble-gas',econf:'[He] 2s² 2p⁶'},
  {z:11,sym:'Na',name:'Sodium',mass:22.990,cat:'alkali',econf:'[Ne] 3s¹'},
  {z:12,sym:'Mg',name:'Magnesium',mass:24.305,cat:'alkaline-earth',econf:'[Ne] 3s²'},
  {z:13,sym:'Al',name:'Aluminium',mass:26.982,cat:'post-transition',econf:'[Ne] 3s² 3p¹'},
  {z:14,sym:'Si',name:'Silicon',mass:28.086,cat:'metalloid',econf:'[Ne] 3s² 3p²'},
  {z:15,sym:'P',name:'Phosphorus',mass:30.974,cat:'nonmetal',econf:'[Ne] 3s² 3p³'},
  {z:16,sym:'S',name:'Sulfur',mass:32.065,cat:'nonmetal',econf:'[Ne] 3s² 3p⁴'},
  {z:17,sym:'Cl',name:'Chlorine',mass:35.453,cat:'halogen',econf:'[Ne] 3s² 3p⁵'},
  {z:18,sym:'Ar',name:'Argon',mass:39.948,cat:'noble-gas',econf:'[Ne] 3s² 3p⁶'},
  {z:19,sym:'K',name:'Potassium',mass:39.098,cat:'alkali',econf:'[Ar] 4s¹'},
  {z:20,sym:'Ca',name:'Calcium',mass:40.078,cat:'alkaline-earth',econf:'[Ar] 4s²'},
  {z:21,sym:'Sc',name:'Scandium',mass:44.956,cat:'transition',econf:'[Ar] 3d¹ 4s²'},
  {z:22,sym:'Ti',name:'Titanium',mass:47.867,cat:'transition',econf:'[Ar] 3d² 4s²'},
  {z:23,sym:'V',name:'Vanadium',mass:50.942,cat:'transition',econf:'[Ar] 3d³ 4s²'},
  {z:24,sym:'Cr',name:'Chromium',mass:51.996,cat:'transition',econf:'[Ar] 3d⁵ 4s¹'},
  {z:25,sym:'Mn',name:'Manganese',mass:54.938,cat:'transition',econf:'[Ar] 3d⁵ 4s²'},
  {z:26,sym:'Fe',name:'Iron',mass:55.845,cat:'transition',econf:'[Ar] 3d⁶ 4s²'},
  {z:27,sym:'Co',name:'Cobalt',mass:58.933,cat:'transition',econf:'[Ar] 3d⁷ 4s²'},
  {z:28,sym:'Ni',name:'Nickel',mass:58.693,cat:'transition',econf:'[Ar] 3d⁸ 4s²'},
  {z:29,sym:'Cu',name:'Copper',mass:63.546,cat:'transition',econf:'[Ar] 3d¹⁰ 4s¹'},
  {z:30,sym:'Zn',name:'Zinc',mass:65.38,cat:'transition',econf:'[Ar] 3d¹⁰ 4s²'},
  {z:31,sym:'Ga',name:'Gallium',mass:69.723,cat:'post-transition',econf:'[Ar] 3d¹⁰ 4s² 4p¹'},
  {z:32,sym:'Ge',name:'Germanium',mass:72.630,cat:'metalloid',econf:'[Ar] 3d¹⁰ 4s² 4p²'},
  {z:33,sym:'As',name:'Arsenic',mass:74.922,cat:'metalloid',econf:'[Ar] 3d¹⁰ 4s² 4p³'},
  {z:34,sym:'Se',name:'Selenium',mass:78.971,cat:'nonmetal',econf:'[Ar] 3d¹⁰ 4s² 4p⁴'},
  {z:35,sym:'Br',name:'Bromine',mass:79.904,cat:'halogen',econf:'[Ar] 3d¹⁰ 4s² 4p⁵'},
  {z:36,sym:'Kr',name:'Krypton',mass:83.798,cat:'noble-gas',econf:'[Ar] 3d¹⁰ 4s² 4p⁶'},
  {z:37,sym:'Rb',name:'Rubidium',mass:85.468,cat:'alkali',econf:'[Kr] 5s¹'},
  {z:38,sym:'Sr',name:'Strontium',mass:87.62,cat:'alkaline-earth',econf:'[Kr] 5s²'},
  {z:39,sym:'Y',name:'Yttrium',mass:88.906,cat:'transition',econf:'[Kr] 4d¹ 5s²'},
  {z:40,sym:'Zr',name:'Zirconium',mass:91.224,cat:'transition',econf:'[Kr] 4d² 5s²'},
  {z:41,sym:'Nb',name:'Niobium',mass:92.906,cat:'transition',econf:'[Kr] 4d⁴ 5s¹'},
  {z:42,sym:'Mo',name:'Molybdenum',mass:95.95,cat:'transition',econf:'[Kr] 4d⁵ 5s¹'},
  {z:43,sym:'Tc',name:'Technetium',mass:98,cat:'transition',econf:'[Kr] 4d⁵ 5s²'},
  {z:44,sym:'Ru',name:'Ruthenium',mass:101.07,cat:'transition',econf:'[Kr] 4d⁷ 5s¹'},
  {z:45,sym:'Rh',name:'Rhodium',mass:102.91,cat:'transition',econf:'[Kr] 4d⁸ 5s¹'},
  {z:46,sym:'Pd',name:'Palladium',mass:106.42,cat:'transition',econf:'[Kr] 4d¹⁰'},
  {z:47,sym:'Ag',name:'Silver',mass:107.87,cat:'transition',econf:'[Kr] 4d¹⁰ 5s¹'},
  {z:48,sym:'Cd',name:'Cadmium',mass:112.41,cat:'transition',econf:'[Kr] 4d¹⁰ 5s²'},
  {z:49,sym:'In',name:'Indium',mass:114.82,cat:'post-transition',econf:'[Kr] 4d¹⁰ 5s² 5p¹'},
  {z:50,sym:'Sn',name:'Tin',mass:118.71,cat:'post-transition',econf:'[Kr] 4d¹⁰ 5s² 5p²'},
  {z:51,sym:'Sb',name:'Antimony',mass:121.76,cat:'metalloid',econf:'[Kr] 4d¹⁰ 5s² 5p³'},
  {z:52,sym:'Te',name:'Tellurium',mass:127.60,cat:'metalloid',econf:'[Kr] 4d¹⁰ 5s² 5p⁴'},
  {z:53,sym:'I',name:'Iodine',mass:126.90,cat:'halogen',econf:'[Kr] 4d¹⁰ 5s² 5p⁵'},
  {z:54,sym:'Xe',name:'Xenon',mass:131.29,cat:'noble-gas',econf:'[Kr] 4d¹⁰ 5s² 5p⁶'},
  {z:55,sym:'Cs',name:'Caesium',mass:132.91,cat:'alkali',econf:'[Xe] 6s¹'},
  {z:56,sym:'Ba',name:'Barium',mass:137.33,cat:'alkaline-earth',econf:'[Xe] 6s²'},
  {z:57,sym:'La',name:'Lanthanum',mass:138.91,cat:'lanthanide',econf:'[Xe] 5d¹ 6s²'},
  {z:58,sym:'Ce',name:'Cerium',mass:140.12,cat:'lanthanide',econf:'[Xe] 4f¹ 5d¹ 6s²'},
  {z:59,sym:'Pr',name:'Praseodymium',mass:140.91,cat:'lanthanide',econf:'[Xe] 4f³ 6s²'},
  {z:60,sym:'Nd',name:'Neodymium',mass:144.24,cat:'lanthanide',econf:'[Xe] 4f⁴ 6s²'},
  {z:61,sym:'Pm',name:'Promethium',mass:145,cat:'lanthanide',econf:'[Xe] 4f⁵ 6s²'},
  {z:62,sym:'Sm',name:'Samarium',mass:150.36,cat:'lanthanide',econf:'[Xe] 4f⁶ 6s²'},
  {z:63,sym:'Eu',name:'Europium',mass:151.96,cat:'lanthanide',econf:'[Xe] 4f⁷ 6s²'},
  {z:64,sym:'Gd',name:'Gadolinium',mass:157.25,cat:'lanthanide',econf:'[Xe] 4f⁷ 5d¹ 6s²'},
  {z:65,sym:'Tb',name:'Terbium',mass:158.93,cat:'lanthanide',econf:'[Xe] 4f⁹ 6s²'},
  {z:66,sym:'Dy',name:'Dysprosium',mass:162.50,cat:'lanthanide',econf:'[Xe] 4f¹⁰ 6s²'},
  {z:67,sym:'Ho',name:'Holmium',mass:164.93,cat:'lanthanide',econf:'[Xe] 4f¹¹ 6s²'},
  {z:68,sym:'Er',name:'Erbium',mass:167.26,cat:'lanthanide',econf:'[Xe] 4f¹² 6s²'},
  {z:69,sym:'Tm',name:'Thulium',mass:168.93,cat:'lanthanide',econf:'[Xe] 4f¹³ 6s²'},
  {z:70,sym:'Yb',name:'Ytterbium',mass:173.05,cat:'lanthanide',econf:'[Xe] 4f¹⁴ 6s²'},
  {z:71,sym:'Lu',name:'Lutetium',mass:174.97,cat:'lanthanide',econf:'[Xe] 4f¹⁴ 5d¹ 6s²'},
  {z:72,sym:'Hf',name:'Hafnium',mass:178.49,cat:'transition',econf:'[Xe] 4f¹⁴ 5d² 6s²'},
  {z:73,sym:'Ta',name:'Tantalum',mass:180.95,cat:'transition',econf:'[Xe] 4f¹⁴ 5d³ 6s²'},
  {z:74,sym:'W',name:'Tungsten',mass:183.84,cat:'transition',econf:'[Xe] 4f¹⁴ 5d⁴ 6s²'},
  {z:75,sym:'Re',name:'Rhenium',mass:186.21,cat:'transition',econf:'[Xe] 4f¹⁴ 5d⁵ 6s²'},
  {z:76,sym:'Os',name:'Osmium',mass:190.23,cat:'transition',econf:'[Xe] 4f¹⁴ 5d⁶ 6s²'},
  {z:77,sym:'Ir',name:'Iridium',mass:192.22,cat:'transition',econf:'[Xe] 4f¹⁴ 5d⁷ 6s²'},
  {z:78,sym:'Pt',name:'Platinum',mass:195.08,cat:'transition',econf:'[Xe] 4f¹⁴ 5d⁹ 6s¹'},
  {z:79,sym:'Au',name:'Gold',mass:196.97,cat:'transition',econf:'[Xe] 4f¹⁴ 5d¹⁰ 6s¹'},
  {z:80,sym:'Hg',name:'Mercury',mass:200.59,cat:'transition',econf:'[Xe] 4f¹⁴ 5d¹⁰ 6s²'},
  {z:81,sym:'Tl',name:'Thallium',mass:204.38,cat:'post-transition',econf:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p¹'},
  {z:82,sym:'Pb',name:'Lead',mass:207.2,cat:'post-transition',econf:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p²'},
  {z:83,sym:'Bi',name:'Bismuth',mass:208.98,cat:'post-transition',econf:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p³'},
  {z:84,sym:'Po',name:'Polonium',mass:209,cat:'metalloid',econf:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁴'},
  {z:85,sym:'At',name:'Astatine',mass:210,cat:'halogen',econf:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁵'},
  {z:86,sym:'Rn',name:'Radon',mass:222,cat:'noble-gas',econf:'[Xe] 4f¹⁴ 5d¹⁰ 6s² 6p⁶'},
  {z:87,sym:'Fr',name:'Francium',mass:223,cat:'alkali',econf:'[Rn] 7s¹'},
  {z:88,sym:'Ra',name:'Radium',mass:226,cat:'alkaline-earth',econf:'[Rn] 7s²'},
  {z:89,sym:'Ac',name:'Actinium',mass:227,cat:'actinide',econf:'[Rn] 6d¹ 7s²'},
  {z:90,sym:'Th',name:'Thorium',mass:232.04,cat:'actinide',econf:'[Rn] 6d² 7s²'},
  {z:91,sym:'Pa',name:'Protactinium',mass:231.04,cat:'actinide',econf:'[Rn] 5f² 6d¹ 7s²'},
  {z:92,sym:'U',name:'Uranium',mass:238.03,cat:'actinide',econf:'[Rn] 5f³ 6d¹ 7s²'},
  {z:93,sym:'Np',name:'Neptunium',mass:237,cat:'actinide',econf:'[Rn] 5f⁴ 6d¹ 7s²'},
  {z:94,sym:'Pu',name:'Plutonium',mass:244,cat:'actinide',econf:'[Rn] 5f⁶ 7s²'},
  {z:95,sym:'Am',name:'Americium',mass:243,cat:'actinide',econf:'[Rn] 5f⁷ 7s²'},
  {z:96,sym:'Cm',name:'Curium',mass:247,cat:'actinide',econf:'[Rn] 5f⁷ 6d¹ 7s²'},
  {z:97,sym:'Bk',name:'Berkelium',mass:247,cat:'actinide',econf:'[Rn] 5f⁹ 7s²'},
  {z:98,sym:'Cf',name:'Californium',mass:251,cat:'actinide',econf:'[Rn] 5f¹⁰ 7s²'},
  {z:99,sym:'Es',name:'Einsteinium',mass:252,cat:'actinide',econf:'[Rn] 5f¹¹ 7s²'},
  {z:100,sym:'Fm',name:'Fermium',mass:257,cat:'actinide',econf:'[Rn] 5f¹² 7s²'},
  {z:101,sym:'Md',name:'Mendelevium',mass:258,cat:'actinide',econf:'[Rn] 5f¹³ 7s²'},
  {z:102,sym:'No',name:'Nobelium',mass:259,cat:'actinide',econf:'[Rn] 5f¹⁴ 7s²'},
  {z:103,sym:'Lr',name:'Lawrencium',mass:266,cat:'actinide',econf:'[Rn] 5f¹⁴ 7s² 7p¹'},
  {z:104,sym:'Rf',name:'Rutherfordium',mass:267,cat:'transition',econf:'[Rn] 5f¹⁴ 6d² 7s²'},
  {z:105,sym:'Db',name:'Dubnium',mass:268,cat:'transition',econf:'[Rn] 5f¹⁴ 6d³ 7s²'},
  {z:106,sym:'Sg',name:'Seaborgium',mass:269,cat:'transition',econf:'[Rn] 5f¹⁴ 6d⁴ 7s²'},
  {z:107,sym:'Bh',name:'Bohrium',mass:270,cat:'transition',econf:'[Rn] 5f¹⁴ 6d⁵ 7s²'},
  {z:108,sym:'Hs',name:'Hassium',mass:277,cat:'transition',econf:'[Rn] 5f¹⁴ 6d⁶ 7s²'},
  {z:109,sym:'Mt',name:'Meitnerium',mass:278,cat:'transition',econf:'[Rn] 5f¹⁴ 6d⁷ 7s²'},
  {z:110,sym:'Ds',name:'Darmstadtium',mass:281,cat:'transition',econf:'[Rn] 5f¹⁴ 6d⁸ 7s²'},
  {z:111,sym:'Rg',name:'Roentgenium',mass:282,cat:'transition',econf:'[Rn] 5f¹⁴ 6d⁹ 7s²'},
  {z:112,sym:'Cn',name:'Copernicium',mass:285,cat:'transition',econf:'[Rn] 5f¹⁴ 6d¹⁰ 7s²'},
  {z:113,sym:'Nh',name:'Nihonium',mass:286,cat:'post-transition',econf:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p¹'},
  {z:114,sym:'Fl',name:'Flerovium',mass:289,cat:'post-transition',econf:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p²'},
  {z:115,sym:'Mc',name:'Moscovium',mass:290,cat:'post-transition',econf:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p³'},
  {z:116,sym:'Lv',name:'Livermorium',mass:293,cat:'post-transition',econf:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁴'},
  {z:117,sym:'Ts',name:'Tennessine',mass:294,cat:'halogen',econf:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁵'},
  {z:118,sym:'Og',name:'Oganesson',mass:294,cat:'noble-gas',econf:'[Rn] 5f¹⁴ 6d¹⁰ 7s² 7p⁶'},
];

export const ELEMENT_BY_SYM = {};
ELEMENTS.forEach(el => { ELEMENT_BY_SYM[el.sym] = el; });

export const ELEMENT_CAT_COLORS = {
  'alkali': '#ff6b6b', 'alkaline-earth': '#ffa94d', 'transition': '#4dabf7',
  'post-transition': '#69db7c', 'metalloid': '#da77f2', 'nonmetal': '#ffd43b',
  'halogen': '#38d9a9', 'noble-gas': '#748ffc', 'lanthanide': '#f783ac',
  'actinide': '#e599f7',
};

// Standard periodic table layout: [row, col] for each atomic number
export const PT_LAYOUT = {
  1:[0,0],2:[0,17],3:[1,0],4:[1,1],5:[1,12],6:[1,13],7:[1,14],8:[1,15],9:[1,16],10:[1,17],
  11:[2,0],12:[2,1],13:[2,12],14:[2,13],15:[2,14],16:[2,15],17:[2,16],18:[2,17],
  19:[3,0],20:[3,1],21:[3,2],22:[3,3],23:[3,4],24:[3,5],25:[3,6],26:[3,7],27:[3,8],28:[3,9],29:[3,10],30:[3,11],31:[3,12],32:[3,13],33:[3,14],34:[3,15],35:[3,16],36:[3,17],
  37:[4,0],38:[4,1],39:[4,2],40:[4,3],41:[4,4],42:[4,5],43:[4,6],44:[4,7],45:[4,8],46:[4,9],47:[4,10],48:[4,11],49:[4,12],50:[4,13],51:[4,14],52:[4,15],53:[4,16],54:[4,17],
  55:[5,0],56:[5,1],71:[5,2],72:[5,3],73:[5,4],74:[5,5],75:[5,6],76:[5,7],77:[5,8],78:[5,9],79:[5,10],80:[5,11],81:[5,12],82:[5,13],83:[5,14],84:[5,15],85:[5,16],86:[5,17],
  87:[6,0],88:[6,1],103:[6,2],104:[6,3],105:[6,4],106:[6,5],107:[6,6],108:[6,7],109:[6,8],110:[6,9],111:[6,10],112:[6,11],113:[6,12],114:[6,13],115:[6,14],116:[6,15],117:[6,16],118:[6,17],
  57:[8,2],58:[8,3],59:[8,4],60:[8,5],61:[8,6],62:[8,7],63:[8,8],64:[8,9],65:[8,10],66:[8,11],67:[8,12],68:[8,13],69:[8,14],70:[8,15],
  89:[9,2],90:[9,3],91:[9,4],92:[9,5],93:[9,6],94:[9,7],95:[9,8],96:[9,9],97:[9,10],98:[9,11],99:[9,12],100:[9,13],101:[9,14],102:[9,15],
};

// Parse chemical formula into element counts
export function parseFormula(formula) {
  // Normalize subscript characters
  const sub = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
  let f = formula.replace(/[₀-₉]/g, c => sub[c] || c);
  function parse(s, i) {
    const counts = {};
    while (i < s.length) {
      if (s[i] === '(') {
        const [inner, ni] = parse(s, i + 1);
        i = ni;
        let numStr = '';
        while (i < s.length && /\d/.test(s[i])) { numStr += s[i]; i++; }
        const mult = numStr ? parseInt(numStr) : 1;
        for (const el in inner) counts[el] = (counts[el] || 0) + inner[el] * mult;
      } else if (s[i] === ')') {
        return [counts, i + 1];
      } else if (/[A-Z]/.test(s[i])) {
        let sym = s[i]; i++;
        while (i < s.length && /[a-z]/.test(s[i])) { sym += s[i]; i++; }
        let numStr = '';
        while (i < s.length && /\d/.test(s[i])) { numStr += s[i]; i++; }
        const n = numStr ? parseInt(numStr) : 1;
        counts[sym] = (counts[sym] || 0) + n;
      } else {
        i++;
      }
    }
    return [counts, i];
  }
  const [counts] = parse(f, 0);
  return counts;
}

export function calcMW(formula) {
  const counts = parseFormula(formula);
  let total = 0;
  const breakdown = [];
  for (const sym in counts) {
    const el = ELEMENT_BY_SYM[sym];
    if (!el) return { error: true, sym };
    const sub = el.mass * counts[sym];
    breakdown.push({ sym, name: el.name, count: counts[sym], mass: el.mass, subtotal: sub });
    total += sub;
  }
  return { total, breakdown, error: false };
}

export const COMMON_MOLECULES = [
  { name: 'NaCl', formula: 'NaCl' },
  { name: 'KCl', formula: 'KCl' },
  { name: 'Tris', formula: 'C4H11NO3' },
  { name: 'EDTA', formula: 'C10H16N2O8' },
  { name: 'HEPES', formula: 'C8H18N2O4S' },
  { name: 'SDS', formula: 'C12H25NaO4S' },
  { name: 'Glycine', formula: 'C2H5NO2' },
  { name: 'Glucose', formula: 'C6H12O6' },
  { name: 'Sucrose', formula: 'C12H22O11' },
  { name: 'CaCl₂', formula: 'CaCl2' },
  { name: 'MgCl₂', formula: 'MgCl2' },
  { name: 'Na₂HPO₄', formula: 'Na2HPO4' },
];
