// "Beta" tag for sections that are new and may still change (nav rows, page titles).
import { t } from '../i18n/index.js';

export default function BetaBadge({ lang, style }) {
  return (
    <span className="badge" style={{ '--badge-fg': 'var(--cat-protocol)', '--badge-bg': 'var(--cat-protocol-bg)', flexShrink: 0, ...style }}>
      {t('betaLabel', lang)}
    </span>
  );
}
