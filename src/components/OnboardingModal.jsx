import { useState } from 'react';
import { createPortal } from 'react-dom';
import { t, useLang } from '../i18n/index.js';
import db from '../lib/db.js';

function OnboardingModal({ isOpen, onClose }) {
  const lang = useLang();
  const [step, setStep] = useState(0);

  const slides = [
    { titleKey: 'onboardingWelcomeTitle', bodyKey: 'onboardingWelcomeBody', icon: 'M12 3v18M5.5 8l13-2M5.5 16l13-2' },
    { titleKey: 'onboardingRecipesTitle', bodyKey: 'onboardingRecipesBody', icon: 'M4 6h16M4 12h16M4 18h10' },
    { titleKey: 'onboardingCalcTitle', bodyKey: 'onboardingCalcBody', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 14v8M13 18h8' },
    { titleKey: 'onboardingPlateTitle', bodyKey: 'onboardingPlateBody', icon: 'M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18' },
    { titleKey: 'onboardingToolsTitle', bodyKey: 'onboardingToolsBody', icon: 'M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z' },
    // New — mentions the mobile bottom nav added in this overhaul. No translations.js key
    // (that file isn't owned by this change); uses the same inline lang-ternary idiom
    // App.jsx already uses for its own ad-hoc strings (e.g. the backup-reminder banner).
    {
      title: lang === 'zh' ? '全新底部导航栏' : 'New: Bottom Navigation',
      body: lang === 'zh'
        ? '在手机上，常用标签现在固定在底部导航栏中，其余功能收纳在"更多"里，触达更快。'
        : 'On phones, the tabs you use most now live in a bottom bar — everything else is one tap away under "More".',
      icon: 'M4 4h16v16H4zM4 15h16',
    },
    { titleKey: 'onboardingPrivacyTitle', bodyKey: 'onboardingPrivacyBody', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  ];

  function handleClose() {
    localStorage.setItem('labmate_onboardingDone', 'true');
    db.settings.put({ key: 'labmate_onboardingDone', value: 'true' }).catch(() => {});
    onClose();
  }

  if (!isOpen) return null;

  const slide = slides[step];
  const title = slide.titleKey ? t(slide.titleKey, lang) : slide.title;
  const body = slide.bodyKey ? t(slide.bodyKey, lang) : slide.body;

  // Shared content — identical markup/copy in both the desktop dialog and the mobile
  // bottom sheet, only the surrounding chrome differs.
  const content = (
    <>
      <div className="flex justify-center mb-5">
        <div className="w-20 h-20 flex items-center justify-center" style={{ background: 'var(--primary-light)', border: '2px solid var(--border-strong)' }}>
          <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="var(--primary)"
            strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
            <path d={slide.icon} />
          </svg>
        </div>
      </div>
      <h2 className="text-xl font-bold text-center mb-2 mono" style={{ color: 'var(--text)' }}>
        {title}
      </h2>
      <p className="text-sm text-center mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {body}
      </p>
      <div className="flex justify-center gap-2 mb-5">
        {slides.map((_, i) => (
          <div key={i} className="transition-all" style={{
            width: i === step ? '24px' : '8px', height: '4px', borderRadius: 0,
            background: i === step ? 'var(--primary)' : 'var(--border)',
          }} />
        ))}
      </div>
      <div className="flex gap-3">
        {step > 0 ? (
          <button onClick={() => setStep(step - 1)} className="btn-secondary flex-shrink-0" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
            {t('onboardingPrev', lang)}
          </button>
        ) : (
          <button onClick={handleClose} className="btn-secondary flex-shrink-0" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
            {t('onboardingSkip', lang)}
          </button>
        )}
        {step < slides.length - 1 ? (
          <button onClick={() => setStep(step + 1)} className="btn-primary flex-1" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
            {t('onboardingNext', lang)}
          </button>
        ) : (
          <button onClick={handleClose} className="btn-primary flex-1" style={{ padding: '10px 16px', fontSize: '0.85rem' }}>
            {t('onboardingDone', lang)}
          </button>
        )}
      </div>
    </>
  );

  return createPortal(
    <>
      {/* Desktop / tablet (≥640px) — centered brutalist dialog. Matches the ≥sm split
          idiom already used in App.jsx's backup-reminder banner. */}
      <div className="hidden sm:flex fixed inset-0 z-50 items-center justify-center p-4"
        role="dialog" aria-modal="true" aria-label={t('onboardingWelcomeTitle', lang)}>
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)' }} />
        <div className="relative w-full max-w-md p-6 tab-fade-in"
          style={{ background: 'var(--card)', border: '2px solid var(--border-strong)', borderRadius: 0, boxShadow: 'var(--shadow-lg)' }}>
          {content}
        </div>
      </div>

      {/* Mobile (<640px) — bottom sheet, same structural idiom as MoreSheet.jsx. */}
      <div className="sm:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t('onboardingWelcomeTitle', lang)}>
        <div className="absolute inset-0" style={{ background: 'rgba(20,23,18,0.5)' }} />
        <div
          className="absolute bottom-0 left-0 right-0 tab-fade-in"
          style={{
            background: 'var(--card)',
            borderTop: '2px solid var(--border-strong)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            maxHeight: '85vh',
            overflowY: 'auto',
          }}
        >
          <div className="p-6 pt-8">
            {content}
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

export default OnboardingModal;
