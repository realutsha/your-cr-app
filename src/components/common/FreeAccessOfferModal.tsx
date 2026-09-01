import { useState, useEffect } from 'react';

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
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 350,
          background: 'var(--c-card-bg, #121318)',
          border: '1px solid var(--c-hairline-strong, rgba(255, 255, 255, 0.14))',
          borderRadius: 24,
          padding: '28px 24px 22px',
          textAlign: 'center',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.42)',
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
          style={{
            width: 58,
            height: 58,
            borderRadius: '50%',
            background: 'var(--c-accent-bg, rgba(124, 147, 232, 0.12))',
            border: '1.5px solid var(--c-accent, #7C93E8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 26,
            marginBottom: 16,
            boxShadow: '0 4px 20px var(--c-accent-glow, rgba(124, 147, 232, 0.2))',
          }}
        >
          🎓
        </div>

        {/* Offer Tag */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: 'var(--c-accent-bg, rgba(124, 147, 232, 0.12))',
            border: '1px solid var(--c-accent, #7C93E8)',
            borderRadius: 100,
            padding: '4px 12px',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--c-accent, #7C93E8)',
            marginBottom: 12,
          }}
        >
          Semester Access
        </div>

        {/* Main Heading */}
        <h2
          id="free-access-title"
          style={{
            fontFamily: 'var(--font-head)',
            fontSize: 21,
            fontWeight: 800,
            letterSpacing: '-0.02em',
            color: 'var(--c-text, #F4F5F7)',
            margin: '0 0 8px',
            lineHeight: 1.25,
          }}
        >
          Get Your 4-Month Free Access
        </h2>

        {/* Subtitle */}
        <p
          id="free-access-subtitle"
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 13.5,
            fontWeight: 400,
            color: 'var(--c-text-soft, rgba(244, 245, 247, 0.6))',
            margin: '0 0 24px',
            lineHeight: 1.45,
          }}
        >
          One Semester of ClassMate — completely free.
        </p>

        {/* Primary Action Button: Claim & Continue */}
        <button
          type="button"
          onClick={handleClaim}
          disabled={claiming}
          autoFocus
          style={{
            width: '100%',
            fontFamily: 'var(--font-body)',
            fontSize: 14.5,
            fontWeight: 600,
            color: '#FFFFFF',
            background: 'var(--c-accent, #7C93E8)',
            border: 'none',
            borderRadius: 14,
            padding: '12px 20px',
            cursor: claiming ? 'default' : 'pointer',
            opacity: claiming ? 0.8 : 1,
            boxShadow: '0 4px 14px var(--c-accent-glow, rgba(124, 147, 232, 0.3))',
            transition: 'opacity 150ms ease, transform 150ms ease',
            marginBottom: 12,
          }}
        >
          {claiming ? 'Claiming Access...' : 'Claim & Continue'}
        </button>

        {/* Secondary Option: Follow ClassMate on Facebook */}
        <button
          type="button"
          onClick={handleFacebookFollow}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: 'var(--font-body)',
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--c-text, #F4F5F7)',
            background: 'var(--c-card-subtle, rgba(255, 255, 255, 0.04))',
            border: '1px solid var(--c-hairline, rgba(255, 255, 255, 0.08))',
            borderRadius: 12,
            padding: '10px 16px',
            cursor: 'pointer',
            transition: 'background 150ms ease, border-color 150ms ease',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ color: '#1877F2', flexShrink: 0 }}
          >
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
          <span>Follow ClassMate on Facebook</span>
        </button>
      </div>
    </div>
  );
}
