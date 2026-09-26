import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { t, useLang } from '../i18n/index.js';
import db from '../lib/db.js';

// First-run tour. One responsive dialog: a bottom sheet on phones, a centred
// card from 640px up.
function OnboardingModal({ isOpen, onClose }) {
  const lang = useLang();
  const [step, setStep] = useState(0);

  const slides = [
    { titleKey: 'onboardingWelcomeTitle', bodyKey: 'onboardingWelcomeBody', logo: true },
    { titleKey: 'onboardingRecipesTitle', bodyKey: 'onboardingRecipesBody', icon: 'M4 6h16M4 12h16M4 18h10' },
    { titleKey: 'onboardingCalcTitle', bodyKey: 'onboardingCalcBody', icon: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 14v8M13 18h8' },
    { titleKey: 'onboardingPlateTitle', bodyKey: 'onboardingPlateBody', icon: 'M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18' },
    { titleKey: 'onboardingToolsTitle', bodyKey: 'onboardingToolsBody', icon: 'M12 8v4l3 3M12 2a10 10 0 100 20 10 10 0 000-20z' },
    { titleKey: 'onboardingNavTitle', bodyKey: 'onboardingNavBody', icon: 'M3 3h18v18H3zM9 3v18M12 8h6M12 12h6M12 16h4' },
    { titleKey: 'onboardingPrivacyTitle', bodyKey: 'onboardingPrivacyBody', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  ];

  function handleClose() {
    localStorage.setItem('labmate_onboardingDone', 'true');
    db.settings.put({ key: 'labmate_onboardingDone', value: 'true' }).catch(() => {});
    setStep(0);
    onClose();
  }

  useEffect(() => {
    if (!isOpen) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') handleClose();
      else if (e.key === 'ArrowRight') setStep(s => Math.min(slides.length - 1, s + 1));
      else if (e.key === 'ArrowLeft') setStep(s => Math.max(0, s - 1));
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const slide = slides[step];
  const last = step === slides.length - 1;
  const pad = (n) => String(n).padStart(2, '0');

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4"
      role="dialog" aria-modal="true" aria-labelledby="onboarding-title" aria-describedby="onboarding-body">
      <div className="overlay-backdrop" aria-hidden="true" />
      <div className="dialog w-full sm:max-w-md" style={{ zIndex: 51, paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-between px-5 pt-4">
          <span className="eyebrow">{pad(step + 1)} / {pad(slides.length)}</span>
          {!last && (
            <button type="button" className="btn-ghost btn-sm" onClick={handleClose}>{t('onboardingSkip', lang)}</button>
          )}
        </div>
        <div className="px-6 pt-4 pb-6 sm:px-7">
          <div className="flex items-center justify-center mb-5" style={{ width: 56, height: 56, background: 'var(--primary-light)', border: '1px solid var(--border-strong)' }}>
            {slide.logo ? (
              <img src={import.meta.env.BASE_URL + 'favicon.svg'} alt="" width="30" height="30" />
            ) : (
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="var(--accent)"
                strokeWidth={1.6} strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
                <path d={slide.icon} />
              </svg>
            )}
          </div>
          <h2 id="onboarding-title" style={{ fontFamily: 'var(--font-heading)', fontSize: '1.375rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
            {t(slide.titleKey, lang)}
          </h2>
          <p id="onboarding-body" className="mt-2" style={{ fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--text-muted)', minHeight: '4.8em' }}>
            {t(slide.bodyKey, lang)}
          </p>

          <div className="flex gap-1 mt-5 mb-5" aria-hidden="true">
            {slides.map((_, i) => (
              <span key={i} style={{
                flex: 1, height: 3,
                background: i <= step ? 'var(--primary)' : 'var(--rule)',
                transition: 'background-color var(--duration-base) ease',
              }} />
            ))}
          </div>

          <div className="flex gap-2">
            {step > 0 && (
              <button type="button" onClick={() => setStep(step - 1)} className="btn btn-lg">
                {t('onboardingPrev', lang)}
              </button>
            )}
            {!last ? (
              <button type="button" onClick={() => setStep(step + 1)} className="btn-primary btn-lg flex-1">
                {t('onboardingNext', lang)}
              </button>
            ) : (
              <button type="button" onClick={handleClose} className="btn-primary btn-lg flex-1">
                {t('onboardingDone', lang)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default OnboardingModal;
