// ToolsTab — External tools / useful links with a category filter
import { useState } from 'react';
import { t, useLang } from '../../i18n/index.js';
import PageHeader from '../../components/PageHeader.jsx';
import { IconArrowUpRight } from '../../components/icons.jsx';
import { EXTERNAL_TOOLS } from '../../data/externalTools.js';

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
