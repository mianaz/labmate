// AgentSettings — the BYOK (bring-your-own-key) provider modal, launched from
// the AgentPanel header gear. Edits a draft of the persisted config and saves
// it ONLY through AgentContext.updateByokConfig → select.js saveByokConfig →
// the Dexie `credentials` table (never localStorage; credentials are excluded
// from the backup file). Config shape mirrors providers/select.js:
//   { enabled, preset, provider, baseUrl, apiKey, model, local, disableRedaction }
// Portaled to <body> above the panel, PermissionDialog-style; Escape / backdrop
// close WITHOUT saving.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { t } from '../../i18n/index.js';
import { useAgent } from '../../lib/agent/AgentContext.jsx';
import { PRESETS, getPreset } from '../../lib/agent/providers/select.js';
import { fetchByokModels, testByokConnection } from '../../lib/agent/providers/byokProbe.js';
import { S_MUTED } from '../../lib/styleConstants.js';

// Local copy of the icons.jsx 24×24 stroke conventions — kept here (not in
// icons.jsx) so this feature's commits stay independent of that file.
export const SettingsGearIcon = ({ size = 16, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
  </svg>
);

const S_LABEL = {
  display: 'block', fontSize: '0.62rem', letterSpacing: '0.05em', textTransform: 'uppercase',
  color: 'var(--text-muted)', fontWeight: 700, marginBottom: '0.25rem',
};
const S_INPUT = {
  width: '100%', fontSize: '0.8rem', padding: '0.4rem 0.5rem',
  background: 'var(--bg-2)', border: '2px solid var(--border)', color: 'var(--text)',
};
const S_BTN_SM = {
  fontSize: '0.68rem', fontWeight: 700, padding: '0.35rem 0.6rem', whiteSpace: 'nowrap',
  background: 'var(--card)', border: '2px solid var(--border)', color: 'var(--text)',
};

function draftFrom(config) {
  const preset = getPreset(config?.preset) || getPreset('openrouter');
  return {
    enabled: config?.enabled ?? false,
    preset: preset.key,
    baseUrl: config?.baseUrl ?? preset.baseUrl,
    apiKey: config?.apiKey ?? '',
    model: config?.model ?? '',
    disableRedaction: config?.disableRedaction ?? false,
  };
}

export default function AgentSettings({ open, onClose, lang = 'en' }) {
  const { byokConfig, updateByokConfig } = useAgent();

  const [draft, setDraft] = useState(() => draftFrom(byokConfig));
  const [models, setModels] = useState([]);       // ids from "fetch models"
  const [probe, setProbe] = useState(null);       // { kind:'models'|'test', ok, message? } | 'busy'
  const [saving, setSaving] = useState(false);

  // Re-seed the draft each time the modal opens (config may have loaded late).
  useEffect(() => {
    if (open) { setDraft(draftFrom(byokConfig)); setModels([]); setProbe(null); }
  }, [open, byokConfig]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    }
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const preset = getPreset(draft.preset) || getPreset('custom');
  const isLocal = !!preset.local;
  const canFetchModels = !!preset.modelsPath && !!draft.baseUrl;

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));

  const onPresetChange = (key) => {
    const p = getPreset(key);
    setModels([]); setProbe(null);
    set({ preset: key, baseUrl: p?.baseUrl ?? '', model: '' });
  };

  const probeArgs = () => ({
    baseUrl: draft.baseUrl, apiKey: draft.apiKey, model: draft.model, provider: preset.provider,
  });

  const onFetchModels = async () => {
    setProbe('busy');
    try {
      const ids = await fetchByokModels(probeArgs());
      setModels(ids);
      setProbe({ kind: 'models', ok: true, message: t('agentByokModelsFetched', lang).replace('{n}', String(ids.length)) });
    } catch (err) {
      setProbe({ kind: 'models', ok: false, message: `${t('agentByokFetchFail', lang)}${err?.status ? ` (HTTP ${err.status})` : ''}` });
    }
  };

  const onTest = async () => {
    setProbe('busy');
    const r = await testByokConnection(probeArgs());
    setProbe({
      kind: 'test', ok: r.ok,
      message: r.ok ? t('agentByokTestOk', lang) : `${t('agentByokTestFail', lang)}${r.message ? ` — ${r.message}` : ''}`,
    });
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await updateByokConfig({
        enabled: draft.enabled,
        preset: preset.key,
        provider: preset.provider,
        baseUrl: draft.baseUrl.trim(),
        apiKey: isLocal ? '' : draft.apiKey.trim(),
        model: draft.model.trim(),
        local: isLocal,
        disableRedaction: isLocal ? false : draft.disableRedaction,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const probeMsg = probe && probe !== 'busy' && (
    <p className="mono" role="status" style={{
      fontSize: '0.66rem', marginTop: '0.35rem',
      color: probe.ok ? 'var(--accent)' : 'var(--danger-text)',
    }}>
      {probe.message}
    </p>
  );

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog" aria-modal="true" aria-label={t('agentByokTitle', lang)}
      onClick={onClose}
    >
      <div className="absolute inset-0" style={{ background: 'rgba(20,23,18,0.55)' }} />
      <div
        className="relative w-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '28rem', maxHeight: 'calc(100dvh - 2rem)', background: 'var(--card)',
          border: '2px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="px-4 pt-3.5 pb-3" style={{ borderBottom: '2px solid var(--border)' }}>
          <div className="mono" style={{
            fontSize: '0.62rem', letterSpacing: '0.05em', textTransform: 'uppercase',
            color: 'var(--accent)', fontWeight: 700,
          }}>
            {t('agentByokTitle', lang)}
          </div>
          <p className="text-sm" style={{ color: 'var(--text-muted)', marginTop: '0.3rem', lineHeight: 1.5 }}>
            {t('agentByokIntro', lang)}
          </p>
        </div>

        <div className="px-4 py-3 space-y-3">
          {/* Enable toggle */}
          <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text)', fontWeight: 600 }}>
            <input
              type="checkbox"
              checked={draft.enabled}
              onChange={(e) => set({ enabled: e.target.checked })}
            />
            {t('agentByokEnable', lang)}
          </label>

          {/* Provider preset */}
          <div>
            <label style={S_LABEL} htmlFor="byok-preset">{t('agentByokPreset', lang)}</label>
            <select id="byok-preset" className="mono" style={S_INPUT}
              value={draft.preset} onChange={(e) => onPresetChange(e.target.value)}>
              {PRESETS.map((p) => (
                <option key={p.key} value={p.key}>{p.label}</option>
              ))}
            </select>
          </div>

          {/* Base URL */}
          <div>
            <label style={S_LABEL} htmlFor="byok-base-url">{t('agentByokBaseUrl', lang)}</label>
            <input id="byok-base-url" className="mono" style={S_INPUT} type="url"
              value={draft.baseUrl} onChange={(e) => set({ baseUrl: e.target.value })}
              placeholder="https://…" autoComplete="off" spellCheck={false} />
          </div>

          {/* API key — local presets need none */}
          {isLocal ? (
            <p style={{ ...S_MUTED, fontSize: '0.7rem' }}>{t('agentByokApiKeyLocal', lang)}</p>
          ) : (
            <div>
              <label style={S_LABEL} htmlFor="byok-api-key">{t('agentByokApiKey', lang)}</label>
              <input id="byok-api-key" className="mono" style={S_INPUT} type="password"
                value={draft.apiKey} onChange={(e) => set({ apiKey: e.target.value })}
                placeholder="sk-…" autoComplete="off" spellCheck={false} />
            </div>
          )}

          {/* Model + fetch models */}
          <div>
            <label style={S_LABEL} htmlFor="byok-model">{t('agentByokModel', lang)}</label>
            <div className="flex gap-2">
              <input id="byok-model" className="mono" style={S_INPUT} type="text"
                list="byok-model-options"
                value={draft.model} onChange={(e) => set({ model: e.target.value })}
                autoComplete="off" spellCheck={false} />
              {canFetchModels && (
                <button type="button" style={S_BTN_SM} onClick={onFetchModels} disabled={probe === 'busy'}>
                  {t('agentByokFetchModels', lang)}
                </button>
              )}
            </div>
            <datalist id="byok-model-options">
              {models.map((id) => <option key={id} value={id} />)}
            </datalist>
          </div>

          {/* Test connection */}
          <div>
            <button type="button" style={S_BTN_SM} onClick={onTest}
              disabled={probe === 'busy' || !draft.baseUrl || !draft.model}>
              {t('agentByokTest', lang)}
            </button>
            {probe === 'busy' && (
              <p className="mono" role="status" style={{ fontSize: '0.66rem', marginTop: '0.35rem', color: 'var(--text-muted)' }}>
                {t('agentByokTesting', lang)}
              </p>
            )}
            {probeMsg}
          </div>

          {/* Privacy: disclosure + redaction toggle */}
          <div className="px-2.5 py-2" style={{ background: 'var(--bg-2)', border: '2px solid var(--border)' }}>
            <p style={{ ...S_MUTED, fontSize: '0.68rem', lineHeight: 1.5 }}>
              {isLocal ? t('agentByokLocalNote', lang) : t('agentByokDisclosure', lang)}
            </p>
            {!isLocal && (
              <>
                <label className="flex items-center gap-2 mt-2 text-xs" style={{ color: 'var(--text)', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={!draft.disableRedaction}
                    onChange={(e) => set({ disableRedaction: !e.target.checked })}
                  />
                  {t('agentByokRedaction', lang)}
                </label>
                {draft.disableRedaction && (
                  <p className="mono" style={{ fontSize: '0.66rem', marginTop: '0.35rem', color: 'var(--danger-text)', lineHeight: 1.5 }}>
                    {t('agentByokRedactionWarn', lang)}
                  </p>
                )}
              </>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3"
          style={{ borderTop: '2px solid var(--border)', background: 'var(--bg-2)' }}>
          <button type="button" onClick={onClose}
            className="px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'transparent', color: 'var(--text-muted)', border: '2px solid var(--border)' }}>
            {t('agentByokCancel', lang)}
          </button>
          <button type="button" onClick={onSave} disabled={saving}
            className="px-3 py-1.5 text-xs font-bold"
            style={{ background: 'var(--primary)', color: 'var(--on-primary)', border: '2px solid var(--border-strong)' }}>
            {t('agentByokSave', lang)}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
