import React, { useState } from 'react';
import { auth, adminGoogleProvider, signInWithPopup, signInWithRedirect, firebaseSignOut } from '../../lib/firebase';

interface AdminLoginProps {
  onSuccess: () => void;
  onGoToApp: () => void;
  isAccessDenied?: boolean;
  attemptedEmail?: string | null;
  onResetAuth?: () => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({
  onSuccess,
  onGoToApp,
  isAccessDenied = false,
  attemptedEmail = null,
  onResetAuth,
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleAdminSignIn = async (useRedirect = false) => {
    setErrorMsg(null);
    setLoading(true);

    if (!auth) {
      setLoading(false);
      setErrorMsg('Firebase Authentication is not configured.');
      return;
    }

    try {
      if (useRedirect) {
        await signInWithRedirect(auth, adminGoogleProvider);
        return;
      }

      await signInWithPopup(auth, adminGoogleProvider);
      // On success, onAuthStateChanged in AdminLayout will handle verification and routing
      setLoading(false);
      onSuccess();
    } catch (err: any) {
      setLoading(false);
      const code = err.code || '';
      const message = err.message || '';

      // User closed or cancelled popup -> remain on /admin/login cleanly without error
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        message.includes('popup-closed-by-user') ||
        message.includes('cancelled-popup-request')
      ) {
        setErrorMsg(null);
        return;
      }

      setErrorMsg(err.message || 'Failed to authenticate.');
    }
  };

  const handleSwitchAccount = async () => {
    if (auth) {
      await firebaseSignOut(auth).catch(() => {});
    }
    if (onResetAuth) {
      onResetAuth();
    }
    setErrorMsg(null);
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0B0D14',
        color: '#FFFFFF',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        fontFamily: 'var(--font-body)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 420,
          background: '#121624',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20,
          padding: '40px 32px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.55)',
          textAlign: 'center',
        }}
      >
        {/* Brand & Portal Header */}
        <div style={{ marginBottom: 32 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 14,
              background: '#818CF8',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-head)',
              fontWeight: 800,
              fontSize: 20,
              margin: '0 auto 16px',
              boxShadow: '0 8px 24px rgba(129,140,248,0.3)',
            }}
          >
            CM
          </div>

          <div
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 22,
              fontWeight: 800,
              color: '#FFFFFF',
              letterSpacing: '-0.02em',
            }}
          >
            Class Mate
          </div>

          <div
            style={{
              display: 'inline-block',
              marginTop: 6,
              background: 'rgba(129,140,248,0.15)',
              border: '1px solid rgba(129,140,248,0.3)',
              color: '#A5B4FC',
              padding: '3px 10px',
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: 0.8,
              textTransform: 'uppercase',
            }}
          >
            Admin Portal
          </div>

          <div
            style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.7)',
              marginTop: 14,
              fontWeight: 500,
            }}
          >
            Administrator Sign In
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: 'rgba(255,255,255,0.45)',
              marginTop: 4,
            }}
          >
            Sign in with your authorized Google account
          </div>
        </div>

        {/* Access Denied Box (ONLY shown when user is authenticated with an unauthorized account) */}
        {isAccessDenied ? (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 12,
              padding: '16px',
              marginBottom: 24,
              textAlign: 'left',
              fontSize: 13,
              color: '#FCA5A5',
              lineHeight: 1.45,
            }}
          >
            <div style={{ fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
              <span>🚫 Access Denied</span>
            </div>
            <div>You are not authorized to access the Admin Portal.</div>
            {attemptedEmail && (
              <div style={{ marginTop: 6, fontSize: 11.5, opacity: 0.85 }}>
                Account: <strong>{attemptedEmail}</strong>
              </div>
            )}
            <div style={{ marginTop: 14 }}>
              <button
                onClick={handleSwitchAccount}
                style={{
                  background: '#EF4444',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '8px 14px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Sign in with a different account
              </button>
            </div>
          </div>
        ) : null}

        {/* Other Errors (network, configuration, etc.) */}
        {!isAccessDenied && errorMsg ? (
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 20,
              textAlign: 'left',
              fontSize: 12.5,
              color: '#FCD34D',
              lineHeight: 1.45,
            }}
          >
            {errorMsg}
          </div>
        ) : null}

        {/* Primary Action Button: Continue with Google (Hidden if Access Denied is active with switch button) */}
        {!isAccessDenied && (
          <>
            <button
              id="admin-google-signin-btn"
              onClick={() => handleAdminSignIn(false)}
              disabled={loading}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                background: '#1E2438',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 12,
                padding: '14px 18px',
                fontSize: 14.5,
                fontWeight: 600,
                color: '#FFFFFF',
                cursor: loading ? 'default' : 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                transition: 'background 160ms ease, border-color 160ms ease, transform 100ms ease',
              }}
            >
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#818CF8',
                      borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span>Signing in with Google...</span>
                </div>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
                    <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.16 0 9.94 0 12s.45 3.84 1.25 5.42l4.03-3.15z" />
                    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
                  </svg>
                  <span>Continue with Google</span>
                </>
              )}
            </button>

            {/* Notice text */}
            <div
              style={{
                fontSize: 12,
                color: 'rgba(255,255,255,0.45)',
                marginTop: 20,
                lineHeight: 1.5,
              }}
            >
              Only authorized administrators can access this dashboard.
            </div>

            {/* Fallback Redirect */}
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <button
                onClick={() => handleAdminSignIn(true)}
                disabled={loading}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'rgba(255,255,255,0.35)',
                  fontSize: 11.5,
                  cursor: loading ? 'default' : 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Having trouble? Use redirect sign-in
              </button>
            </div>
          </>
        )}

        {/* Link back to Student App */}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 28, paddingTop: 18 }}>
          <button
            onClick={onGoToApp}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#818CF8',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <span>&larr; Back to ClassMate App</span>
          </button>
        </div>
      </div>
    </div>
  );
};
