import { IconDownload } from './icons.jsx';

// Secondary action with a download glyph. `icon` is accepted for backward
// compatibility (callers used to pass an emoji); the stroke icon is always used.
function DownloadBtn({ onClick, label, small = false }) {
  return (
    <button type="button" onClick={onClick} className={small ? 'btn btn-sm' : 'btn'}>
      <IconDownload size={small ? 13 : 15} />
      {label}
    </button>
  );
}

export default DownloadBtn;
