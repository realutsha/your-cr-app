import { useState, useEffect } from 'react';

interface IntroPopupProps {
  onDismiss: () => void;
}

export function IntroPopup({ onDismiss }: IntroPopupProps) {
  const [mounted, setMounted] = useState(true);
  const [shown, setShown] = useState(false);

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

  const handleClose = () => {
    setShown(false);
    setTimeout(() => {
      setMounted(false);
      onDismiss();
    }, 240);
  };

  if (!mounted) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'var(--c-backdrop, rgba(0, 0, 0, 0.68))',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          opacity: shown ? 1 : 0,
          transition: 'opacity 240ms ease',
        }}
      />

      {/* Popup Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-popup-title"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 340,
          background: 'var(--c-card-bg)',
          border: '1px solid var(--c-hairline-strong)',
          borderRadius: 24,
          padding: '32px 26px 24px',
          textAlign: 'center',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.25)',
          transform: shown ? 'scale(1) translateY(0)' : 'scale(0.93) translateY(12px)',
          opacity: shown ? 1 : 0,
          transition: 'transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 240ms ease',
        }}
      >
        <h1
          id="intro-popup-title"
          style={{
            fontFamily: 'var(--font-head)',
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--c-text)',
            margin: '0 0 8px',
          }}
        >
          Class Mate
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 15,
            fontWeight: 400,
            color: 'var(--c-text-soft)',
            margin: '0 0 28px',
            lineHeight: 1.45,
          }}
        >
          Never miss any deadline.
        </p>

        <button
          type="button"
          onClick={handleClose}
          autoFocus
          style={{
            width: '100%',
            fontFamily: 'var(--font-body)',
            fontSize: 17,
            fontWeight: 500,
            color: '#FFFFFF',
            background: 'var(--c-accent)',
            border: 'none',
            borderRadius: 14,
            padding: '13px 20px',
            cursor: 'pointer',
            boxShadow: '0 2px 10px var(--c-accent-glow)',
            transition: 'opacity 150ms ease, transform 150ms ease',
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
