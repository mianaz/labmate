function DownloadBtn({ onClick, label, icon = '', small = false }) {
  return (
    <button onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-all hover:shadow-md ${
        small ? 'px-2.5 py-1.5 text-[11px]' : 'px-3.5 py-2 text-xs'
      }`}
      style={{ background: 'linear-gradient(135deg, #0b6e63, #0a5c53)', color: 'white' }}>
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
        <path d="M6 1v7M3 6l3 3 3-3"/><line x1="1" y1="11" x2="11" y2="11"/>
      </svg>
      {label}
    </button>
  );
}

export default DownloadBtn;
