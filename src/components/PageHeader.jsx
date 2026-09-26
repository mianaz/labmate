// Page header shared by every section: group eyebrow, title, one-line
// description and right-aligned actions.
import { t, useLang } from '../i18n/index.js';
import { groupLabelKey } from '../lib/nav.jsx';

export default function PageHeader({ tab, eyebrow, title, description, actions, meta }) {
  const lang = useLang();
  const groupKey = tab ? groupLabelKey(tab) : null;
  const eyebrowText = eyebrow ?? (groupKey ? t(groupKey, lang) : null);
  return (
    <header className="page-header">
      <div className="min-w-0">
        {eyebrowText && <div className="page-eyebrow">{eyebrowText}{meta && <span style={{ fontWeight: 500, letterSpacing: 0 }}>· {meta}</span>}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}
