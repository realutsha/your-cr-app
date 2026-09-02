import { useState, useEffect } from 'react';
import './FreeAccessOfferModal.css';

interface FreeAccessOfferModalProps {
  onClaim: () => void | Promise<void>;
}

const FACEBOOK_PAGE_URL = 'https://www.facebook.com/Classmate.studentapp/';

export function FreeAccessOfferModal({ onClaim }: FreeAccessOfferModalProps) {
  const [mounted, setMounted] = useState(true);
  const [shown, setShown] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    let raf1: number;
    let raf2: number;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setShown(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, []);

  const handleClaim = async () => {
    if (claiming) return;
    setClaiming(true);
    try {
      await onClaim();
    } finally {
      setShown(false);
      setTimeout(() => {
        setMounted(false);
      }, 260);
    }
  };

  const handleFacebookFollow = () => {
    window.open(FACEBOOK_PAGE_URL, '_blank', 'noopener,noreferrer');
  };

  if (!mounted) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* iOS Blurred Backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--c-backdrop, rgba(0, 0, 0, 0.68))',
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
          opacity: shown ? 1 : 0,
          transition: 'opacity 240ms ease',
        }}
      />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="free-access-title"
        aria-describedby="free-access-subtitle"
        className="cm-trial-popup"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 380,
          background: 'var(--c-card-bg)',
          border: '1px solid var(--c-hairline-strong)',
          borderRadius: 24,
          padding: '30px 24px 22px',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
          transform: shown ? 'scale(1) translateY(0)' : 'scale(0.93) translateY(12px)',
          opacity: shown ? 1 : 0,
          transition: 'transform 280ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {/* Floating Graduation Cap Badge Icon */}
        <div
          aria-hidden="true"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: '2px solid var(--c-accent-glow)',
            background: 'var(--c-accent-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            position: 'relative',
          }}
        >
          <svg
            fill="none"
            height="28"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="28"
            style={{ color: 'var(--c-text)' }}
          >
            <path d="M2 12l10-7 10 7-10 7-10-7z" />
            <path d="M12 22v-7" />
            <path d="M22 12v6" />
          </svg>
        </div>

        {/* Offer Tag */}
        <span
          style={{
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--c-accent)',
            border: '1px solid var(--c-accent-glow)',
            borderRadius: 999,
            marginBottom: 14,
            background: 'var(--c-accent-bg)',
          }}
        >
          Semester Access
        </span>

        {/* Main Heading */}
        <h1
          id="free-access-title"
          style={{
            fontFamily: 'var(--font-head)',
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.2,
            letterSpacing: '-0.02em',
            color: 'var(--c-text)',
            margin: '0 0 10px',
          }}
        >
          Get Your 4-Month Free Access
        </h1>

        {/* Subtitle */}
        <p
          id="free-access-subtitle"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 400,
            color: 'var(--c-text-soft)',
            margin: '0 0 20px',
            lineHeight: 1.45,
          }}
        >
          One Semester of ClassMate — completely free.
        </p>

        {/* Primary Action Button: Uiverse dexter-st adapted component */}
        <div className="cm-trial-button-container">
          <div className="cm-trial-drawer cm-trial-transition-top">
            expires in...
          </div>

          <div className="cm-trial-drawer cm-trial-transition-bottom">
            ...4 months
          </div>

          <button
            type="button"
            onClick={handleClaim}
            disabled={claiming}
            autoFocus
            className="cm-trial-button"
          >
            <span className="cm-trial-button-text">
              {claiming ? 'Claiming Access...' : 'Claim & Continue'}
            </span>
          </button>

          <svg className="cm-trial-corner cm-trial-corner-tl" viewBox="0 0 10 10" fill="none">
            <path d="M1 9V1H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <svg className="cm-trial-corner cm-trial-corner-tr" viewBox="0 0 10 10" fill="none">
            <path d="M9 9V1H1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <svg className="cm-trial-corner cm-trial-corner-bl" viewBox="0 0 10 10" fill="none">
            <path d="M1 1V9H9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <svg className="cm-trial-corner cm-trial-corner-br" viewBox="0 0 10 10" fill="none">
            <path d="M9 1V9H1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>

        {/* Secondary Option: Follow ClassMate on Facebook */}
        <button
          type="button"
          onClick={handleFacebookFollow}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            fontWeight: 500,
            color: 'var(--c-text)',
            background: 'var(--c-card-bg)',
            border: '1px solid var(--c-hairline-strong)',
            borderRadius: 14,
            padding: '13px 18px',
            cursor: 'pointer',
            transition: 'background 150ms ease, border-color 150ms ease',
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#1877F2"
            style={{ flexShrink: 0 }}
          >
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>Follow ClassMate on Facebook</span>
        </button>
      </div>
    </div>
  );
}
