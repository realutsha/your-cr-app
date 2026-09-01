import React, { useState, useEffect } from 'react';
import { store } from '../../lib/store';

interface AuthModalProps {
  onSuccess: () => void;
  showToast?: (msg: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ onSuccess, showToast }) => {
  const [errorMsg, setErrorMsg] = useState(store.getAuthErrorMessage() || '');
  const [loading, setLoading] = useState(false);
  const [authMode, setAuthMode] = useState<'popup' | 'redirect'>('popup');

  useEffect(() => {
    const syncError = () => {
      const msg = store.getAuthErrorMessage();
      if (msg) {
        setErrorMsg(msg);
      }
    };
    syncError();
    const unsub = store.subscribe(syncError);
    return () => {
      unsub();
    };
  }, []);

  const handleGoogleAuth = async (useRedirect = false) => {
    setErrorMsg('');
    store.clearAuthErrorMessage();
    setLoading(true);
    setAuthMode(useRedirect ? 'redirect' : 'popup');

    try {
      const res = await store.signInWithGoogle({ useRedirect });
      // If using redirect, window will navigate away so loading stays active until unload.
      if (!useRedirect) {
        setLoading(false);
      }

      if (res.error) {
        setLoading(false);
        setErrorMsg(res.error);
      } else if (res.user) {
        setLoading(false);
        showToast?.(`Signed in as ${res.user.username}`);
        onSuccess();
      }
    } catch (err: unknown) {
      setLoading(false);
      const e = err as Error;
      setErrorMsg(e.message || 'An unexpected error occurred during Google authentication.');
    }
  };

  const handleCancel = () => {
    setLoading(false);
    setErrorMsg('Authentication was cancelled.');
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--c-bg)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '24px 20px',
        transition: 'background 220ms ease',
      }}
    >
      <main
        style={{
          width: '100%',
          maxWidth: 420,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header Section */}
        <header style={{ marginBottom: 36, textAlign: 'left' }}>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--c-accent)',
              marginBottom: 8,
            }}
          >
            Daffodil International University
          </h2>
          <h1
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 34,
              fontWeight: 700,
              color: 'var(--c-text)',
              letterSpacing: '-0.025em',
              lineHeight: 1.15,
              margin: 0,
            }}
          >
            Class Announcement Hub
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 17,
              fontWeight: 400,
              color: 'var(--c-text-soft)',
              marginTop: 10,
              marginBottom: 0,
              lineHeight: 1.4,
            }}
          >
            Focused academic updates from your Class Representative.
          </p>
        </header>

        {/* Error Message Box */}
        {errorMsg && (
          <div
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 13,
              color: 'var(--c-danger)',
              background: 'var(--c-danger-bg)',
              border: '1px solid var(--c-danger)',
              borderRadius: 12,
              padding: '12px 16px',
              marginBottom: 20,
              lineHeight: 1.45,
              wordBreak: 'break-word',
            }}
          >
            {errorMsg}
          </div>
        )}

        {/* Authentication Actions Section */}
        <section style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
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
              borderRadius: 16,
              padding: '14px 18px',
              fontFamily: 'var(--font-body)',
              fontSize: 17,
              fontWeight: 500,
              color: 'var(--c-text)',
              cursor: loading ? 'default' : 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              transition: 'background 180ms ease, border-color 180ms ease, transform 120ms ease',
            }}
          >
            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    width: 16,
                    height: 16,
                    border: '2px solid var(--c-text-soft)',
                    borderTopColor: 'var(--c-accent)',
                    borderRadius: '50%',
                    display: 'inline-block',
                    animation: 'spin 0.8s linear infinite',
                  }}
                />
                <span>{authMode === 'redirect' ? 'Redirecting to Google...' : 'Authenticating with Google...'}</span>
              </div>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span style={{ letterSpacing: '-0.01em' }}>Continue with Google</span>
              </>
            )}
          </button>

          {/* Cancel button if currently loading */}
          {loading && (
            <div style={{ textAlign: 'center' }}>
              <button
                onClick={handleCancel}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--c-text-soft)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  textDecoration: 'underline',
                  cursor: 'pointer',
                  padding: '4px 8px',
                }}
              >
                Cancel authentication
              </button>
            </div>
          )}

          {/* Alternative Login Link: Sign in with redirect */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ margin: 0, fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--c-text-faint)' }}>
              Having trouble with popups?{' '}
              <button
                type="button"
                onClick={() => handleGoogleAuth(true)}
                disabled={loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--c-accent)',
                  fontFamily: 'var(--font-body)',
                  fontSize: 13,
                  fontWeight: 500,
                  cursor: loading ? 'default' : 'pointer',
                  textDecoration: 'underline',
                  padding: 0,
                }}
              >
                Sign in with redirect
              </button>
            </p>
          </div>
        </section>

        {/* Security / Restriction Notice Section */}
        <section style={{ marginTop: 44 }}>
          <div
            style={{
              background: 'var(--c-card-bg)',
              borderRadius: 16,
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              border: '1px solid var(--c-hairline)',
            }}
          >
            {/* Info Icon */}
            <div style={{ flexShrink: 0, paddingTop: 1 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
            </div>
            {/* Restriction Text */}
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-body)',
                fontSize: 13,
                fontWeight: 400,
                color: 'var(--c-text-soft)',
                lineHeight: 1.45,
              }}
            >
              Access is strictly restricted to verified Daffodil International University Google accounts (<strong style={{ fontWeight: 600, color: 'var(--c-text)' }}>@diu.edu.bd</strong>).
            </p>
          </div>
        </section>
      </main>
    </div>
  );
};
