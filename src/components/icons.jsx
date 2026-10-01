// Shared stroke icon set — 24×24, currentColor, square caps/miter joins to match
// the square-cornered design language. Decorative by default (aria-hidden); give
// the surrounding button an aria-label.
function Icon({ size = 18, strokeWidth = 1.75, children, style, className, fill = 'none', title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="square" strokeLinejoin="miter"
      aria-hidden={title ? undefined : true} role={title ? 'img' : undefined}
      className={className} style={style} focusable="false">
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

export const IconFlask = (p) => (
  <Icon {...p}>
    <path d="M9 3h6" /><path d="M10 3v6.2L4.6 18.4A1.7 1.7 0 0 0 6.1 21h11.8a1.7 1.7 0 0 0 1.5-2.6L14 9.2V3" />
    <path d="M7.2 14h9.6" />
  </Icon>
);
export const IconClipboard = (p) => (
  <Icon {...p}>
    <path d="M8 4H5v17h14V4h-3" /><path d="M8 2.5h8v3.5H8z" /><path d="M8.5 11h7M8.5 14.5h7M8.5 18h4" />
  </Icon>
);
export const IconCalculator = (p) => (
  <Icon {...p}>
    <path d="M5 2.5h14v19H5z" /><path d="M8 6.5h8v3H8z" />
    <path d="M8.5 13.5h.01M12 13.5h.01M15.5 13.5h.01M8.5 17.5h.01M12 17.5h.01M15.5 17.5h.01" strokeWidth={2.4} />
  </Icon>
);
export const IconPlate = (p) => (
  <Icon {...p}>
    <path d="M2.5 5h19v14h-19z" />
    <circle cx="7" cy="9.5" r="1.4" /><circle cx="12" cy="9.5" r="1.4" /><circle cx="17" cy="9.5" r="1.4" />
    <circle cx="7" cy="14.5" r="1.4" /><circle cx="12" cy="14.5" r="1.4" /><circle cx="17" cy="14.5" r="1.4" />
  </Icon>
);
export const IconLink = (p) => (
  <Icon {...p}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4L11.8 5.8" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1.4-1.4" />
  </Icon>
);
export const IconBox = (p) => (
  <Icon {...p}>
    <path d="M3 4h18v5H3z" /><path d="M4.5 9v11h15V9" /><path d="M10 13h4" />
  </Icon>
);
export const IconNotebook = (p) => (
  <Icon {...p}>
    <path d="M5 2.5h14v19H5z" /><path d="M9 2.5v19" /><path d="M12 7h4M12 10.5h4" />
  </Icon>
);
export const IconCalendar = (p) => (
  <Icon {...p}>
    <path d="M3.5 5h17v16h-17z" /><path d="M3.5 10h17" /><path d="M8 2.5v4M16 2.5v4" />
    <path d="M7.5 14h2M11 14h2M14.5 14h2M7.5 17.5h2M11 17.5h2" />
  </Icon>
);
export const IconGraph = (p) => (
  <Icon {...p}>
    <path d="M2.5 3.5h6v5h-6zM2.5 15.5h6v5h-6zM15.5 9.5h6v5h-6z" /><path d="M8.5 6H12v12H8.5M12 12h3.5" />
  </Icon>
);
export const IconBook = (p) => (
  <Icon {...p}>
    <path d="M2.5 4.5h6.5a3 3 0 0 1 3 3V21a2.5 2.5 0 0 0-2.5-2.5h-7z" />
    <path d="M21.5 4.5H15a3 3 0 0 0-3 3V21a2.5 2.5 0 0 1 2.5-2.5h7z" />
  </Icon>
);
export const IconSearch = (p) => (
  <Icon {...p}>
    <circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" />
  </Icon>
);
export const IconTimer = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="13.5" r="7.5" /><path d="M12 9.5v4h3" /><path d="M9.5 2.5h5" /><path d="M18.5 6.5l1.5-1.5" />
  </Icon>
);
export const IconSpark = (p) => (
  <Icon {...p}>
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    <path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z" strokeWidth={1.4} />
  </Icon>
);
export const IconSun = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" />
  </Icon>
);
export const IconMoon = (p) => (
  <Icon {...p}>
    <path d="M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z" />
  </Icon>
);
export const IconGlobe = (p) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" /><path d="M3 12h18" />
    <path d="M12 3a14 14 0 0 1 3.6 9A14 14 0 0 1 12 21a14 14 0 0 1-3.6-9A14 14 0 0 1 12 3z" />
  </Icon>
);
export const IconRefresh = (p) => (
  <Icon {...p}>
    <path d="M20.5 4v5.5H15" /><path d="M3.5 20v-5.5H9" />
    <path d="M19.2 9.5A7.8 7.8 0 0 0 5.4 7M4.8 14.5A7.8 7.8 0 0 0 18.6 17" />
  </Icon>
);
export const IconDownload = (p) => (
  <Icon {...p}>
    <path d="M12 3v12" /><path d="M7 10.5l5 5 5-5" /><path d="M4 20.5h16" />
  </Icon>
);
export const IconUpload = (p) => (
  <Icon {...p}>
    <path d="M12 16V4" /><path d="M7 8.5l5-5 5 5" /><path d="M4 20.5h16" />
  </Icon>
);
export const IconPlus = (p) => (
  <Icon {...p}><path d="M12 5v14M5 12h14" /></Icon>
);
export const IconClose = (p) => (
  <Icon {...p}><path d="M6 6l12 12M18 6L6 18" /></Icon>
);
export const IconChevronLeft = (p) => (
  <Icon {...p}><path d="M15 5l-7 7 7 7" /></Icon>
);
export const IconChevronRight = (p) => (
  <Icon {...p}><path d="M9 5l7 7-7 7" /></Icon>
);
export const IconChevronDown = (p) => (
  <Icon {...p}><path d="M5 9l7 7 7-7" /></Icon>
);
export const IconArrowRight = (p) => (
  <Icon {...p}><path d="M4 12h15" /><path d="M13 6l6 6-6 6" /></Icon>
);
export const IconArrowUpRight = (p) => (
  <Icon {...p}><path d="M7 17L17 7" /><path d="M8 7h9v9" /></Icon>
);
export const IconStar = ({ filled, ...p }) => (
  <Icon {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 3.2l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 17l-5.4 2.9 1.1-6.1-4.5-4.2 6.1-.8z" />
  </Icon>
);
export const IconCheck = (p) => (
  <Icon {...p}><path d="M4.5 12.5l5 5 10-11" /></Icon>
);
export const IconMore = (p) => (
  <Icon {...p} strokeWidth={2.6}><path d="M5 12h.01M12 12h.01M19 12h.01" /></Icon>
);
export const IconEdit = (p) => (
  <Icon {...p}><path d="M4 20h4.5L20 8.5 15.5 4 4 15.5z" /><path d="M13.5 6l4.5 4.5" /></Icon>
);
export const IconTrash = (p) => (
  <Icon {...p}><path d="M3.5 6h17" /><path d="M9 6V3.5h6V6" /><path d="M5.5 6l1 15h11l1-15" /><path d="M10 10.5v6M14 10.5v6" /></Icon>
);
export const IconCopy = (p) => (
  <Icon {...p}><path d="M8.5 8.5h12v12h-12z" /><path d="M15.5 8.5v-5h-12v12h5" /></Icon>
);
export const IconPanelLeft = ({ collapsed, ...p }) => (
  <Icon {...p}>
    <path d="M3 4h18v16H3z" /><path d="M9 4v16" />
    {collapsed ? <path d="M13 9.5l2.5 2.5-2.5 2.5" /> : <path d="M16 9.5L13.5 12l2.5 2.5" />}
  </Icon>
);
export const IconAlert = (p) => (
  <Icon {...p}><path d="M12 3L2.5 20.5h19z" /><path d="M12 10v5" /><path d="M12 17.8h.01" strokeWidth={2.4} /></Icon>
);
export const IconShield = (p) => (
  <Icon {...p}><path d="M12 2.5l8 3v6.5c0 5-3.6 8.3-8 9.5-4.4-1.2-8-4.5-8-9.5V5.5z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></Icon>
);
export const IconInfo = (p) => (
  <Icon {...p}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><path d="M12 7.8h.01" strokeWidth={2.4} /></Icon>
);
export const IconPause = (p) => (
  <Icon {...p}><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></Icon>
);
export const IconPlay = (p) => (
  <Icon {...p}><path d="M7 4.5v15l12-7.5z" /></Icon>
);
export const IconReset = (p) => (
  <Icon {...p}><path d="M3.5 4v5.5H9" /><path d="M4.4 9.5A8 8 0 1 1 4 14" /></Icon>
);
export const IconFile = (p) => (
  <Icon {...p}><path d="M5 2.5h9.5L19 7v14.5H5z" /><path d="M14 2.5V7.5h5" /><path d="M8.5 12h7M8.5 15.5h7M8.5 19h4" /></Icon>
);
export const IconLayers = (p) => (
  <Icon {...p}><path d="M12 3l9.5 5-9.5 5-9.5-5z" /><path d="M2.5 12.5l9.5 5 9.5-5" /><path d="M2.5 16.5l9.5 5 9.5-5" /></Icon>
);
export const IconGithub = ({ size = 14, style, className }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={style} className={className} focusable="false">
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

export default Icon;
