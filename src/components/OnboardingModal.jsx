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
    { titleKey: 'onboardingPrivacyTitle', bodyKey: 'onboardingPrivacyBody', icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z' },
  ];

  function handleClose() {
    localStorage.setItem('labmate_onboardingDone', 'true');
    db.settings.put({ key: 'labmate_onboardingDone', value: 'true' }).catch(() => {});
    onClose();
  }

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }} />
      <div className="relative w-full max-w-md rounded-2xl p-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
        {/* Illustration */}
        <div className="flex justify-center mb-5">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center" style={{ background: 'var(--primary-light)' }}>
            <svg width={36} height={36} viewBox="0 0 24 24" fill="none" stroke="var(--primary)"
              strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d={slides[step].icon} />
            </svg>
          </div>
        </div>
        {/* Content */}
        <h2 className="text-xl font-bold text-center mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--text)' }}>
          {t(slides[step].titleKey, lang)}
        </h2>
        <p className="text-sm text-center mb-6 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {t(slides[step].bodyKey, lang)}
        </p>
        {/* Progress dots */}
        <div className="flex justify-center gap-2 mb-5">
          {slides.map((_, i) => (
            <div key={i} className="rounded-full transition-all" style={{
              width: i === step ? '24px' : '8px', height: '8px',
              background: i === step ? 'var(--primary)' : 'var(--border)',
            }} />
          ))}
        </div>
        {/* Buttons */}
        <div className="flex gap-3">
          {step > 0 ? (
            <button onClick={() => setStep(step - 1)} className="px-4 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--bg-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {t('onboardingPrev', lang)}
            </button>
          ) : (
            <button onClick={handleClose} className="px-4 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--bg-2)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {t('onboardingSkip', lang)}
            </button>
          )}
          {step < slides.length - 1 ? (
            <button onClick={() => setStep(step + 1)} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--primary)', color: 'white' }}>
              {t('onboardingNext', lang)}
            </button>
          ) : (
            <button onClick={handleClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold"
              style={{ background: 'var(--primary)', color: 'white' }}>
              {t('onboardingDone', lang)}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

export default OnboardingModal;
