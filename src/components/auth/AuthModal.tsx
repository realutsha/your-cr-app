import React, { useState, useRef, useEffect } from 'react';
import { store } from '../../lib/store';

interface AuthModalProps {
  onSuccess: () => void;
  showToast?: (msg: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, showToast }) => {
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'popup' | 'redirect'>('popup');
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleGoogleAuth = async (useRedirect = false) => {
    setErrorMsg('');
    setLoading(true);
    setAuthMode(useRedirect ? 'redirect' : 'popup');

    // UI safety timeout: reset loading if browser or popup hangs indefinitely
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setLoading(false);
      setErrorMsg('Authentication timed out. If the Google popup was blocked, please try "Sign in with redirect" below.');
    }, 26000);

    try {
      const res = await store.signInWithGoogle({ useRedirect });
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);

      if (res.error) {
        setErrorMsg(res.error);
      } else if (res.user) {
        showToast?.(`Signed in as ${res.user.username}`);
        onSuccess();
      }
    } catch (err: unknown) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      setLoading(false);
      const e = err as Error;
      setErrorMsg(e.message || 'An unexpected error occurred during Google authentication.');
    }
  };

  const handleCancel = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoading(false);
    setErrorMsg('Authentication was cancelled.');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--c-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        transition: 'background 220ms ease',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 400,
          margin: '0 auto',
        }}
      >
        {/* Header / Branding */}
        <div style={{ marginBottom: 32, textAlign: 'left' }}>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'var(--c-accent)',
              marginBottom: 6,
            }}
          >
            Daffodil International University
          </div>
          <div
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 26,
              fontWeight: 800,
              color: 'var(--c-text)',
              letterSpacing: '-0.02em',
              lineHeight: 1.22,
            }}
          >
            Class Announcement Hub
          </div>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13.5,
              color: 'var(--c-text-soft)',
              marginTop: 6,
              lineHeight: 1.5,
            }}
          >
            Focused academic updates from your Class Representative.
          </div>
        </div>

        {/* Error Message Box */}
        {errorMsg && (
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 12.5,
              color: 'var(--c-danger)',
              background: 'var(--c-danger-bg)',
              border: '1px solid var(--c-danger)',
              borderRadius: 10,
              padding: '12px 14px',
              marginBottom: 20,
              lineHeight: 1.45,
              wordBreak: 'break-word',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* PRIMARY AUTH BUTTON: CONTINUE WITH GOOGLE */}
        <button
          id="google-signin-btn"
          onClick={() => handleGoogleAuth(false)}
          disabled={loading}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            background: 'var(--c-card-bg)',
            border: '1px solid var(--c-hairline-strong)',
            borderRadius: 14,
            padding: '14px 18px',
            fontFamily: 'var(--font-body)',
            fontSize: 14.5,
            fontWeight: 600,
            color: 'var(--c-text)',
            cursor: loading ? 'default' : 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
            transition: 'background 180ms ease, border-color 180ms ease, transform 120ms ease',
          }}
        >
          {loading && authMode === 'popup' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  border: '2px solid var(--c-text-soft)',
                  borderTopColor: 'var(--c-accent)',
                  borderRadius: '50%',
                  display: 'inline-block',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span>Authenticating with Google...</span>
            </div>
          ) : (
            <>
              <svg width="19" height="19" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {/* Cancel button if currently loading */}
        {loading && (
          <div style={{ textAlign: 'center', marginTop: 12 }}>
            <button
              onClick={handleCancel}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--c-text-soft)',
                fontFamily: 'var(--font-body)',
                fontSize: 12.5,
                textDecoration: 'underline',
                cursor: 'pointer',
                padding: '4px 8px',
              }}
            >
              Cancel authentication
            </button>
          </div>
        )}

        {/* Fallback / Mobile friendly option: Sign in with redirect */}
        <div style={{ marginTop: 20, textAlign: 'center' }}>
          <button
            onClick={() => handleGoogleAuth(true)}
            disabled={loading}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--c-text-faint)',
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              cursor: loading ? 'default' : 'pointer',
              padding: '6px 10px',
              transition: 'color 160ms ease',
            }}
          >
            Having trouble with popups? <span style={{ color: 'var(--c-accent)', textDecoration: 'underline' }}>Sign in with redirect</span>
          </button>
        </div>

        {/* Security badge note */}
        <div
          style={{
            marginTop: 28,
            padding: '12px 14px',
            background: 'var(--c-card-subtle)',
            borderRadius: 12,
            border: '1px solid var(--c-hairline)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 2 }}>
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 11.5,
              color: 'var(--c-text-soft)',
              lineHeight: 1.4,
            }}
          >
            Access is strictly restricted to verified Daffodil International University Google accounts (<strong style={{ color: 'var(--c-text)' }}>@diu.edu.bd</strong>).
          </div>
        </div>
      </div>
    </div>
  );
};
