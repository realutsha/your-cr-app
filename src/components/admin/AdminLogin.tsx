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
        background: '#F8FAFC',
        color: '#0F172A',
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
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 20,
          padding: '40px 32px',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.06), 0 8px 10px -6px rgba(0, 0, 0, 0.04)',
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
              background: '#4F46E5',
              color: '#FFFFFF',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-head)',
              fontWeight: 800,
              fontSize: 20,
              margin: '0 auto 16px',
              boxShadow: '0 8px 20px rgba(79, 70, 229, 0.25)',
            }}
          >
            CM
          </div>

          <div
            style={{
              fontFamily: 'var(--font-head)',
              fontSize: 24,
              fontWeight: 800,
              color: '#0F172A',
              letterSpacing: '-0.02em',
            }}
          >
            ClassMate
          </div>

          <div
            style={{
              display: 'inline-block',
              marginTop: 6,
              background: '#EEF2FF',
              border: '1px solid #C7D2FE',
              color: '#4F46E5',
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
              fontSize: 14.5,
              color: '#475569',
              marginTop: 14,
              fontWeight: 600,
            }}
          >
            Administrator Sign In
          </div>
          <div
            style={{
              fontSize: 13,
              color: '#64748B',
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
              background: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: 14,
              padding: '20px 18px',
              marginBottom: 24,
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontWeight: 800, marginBottom: 4, fontSize: 16, color: '#DC2626' }}>
              Access Denied
            </div>
            <div style={{ color: '#991B1B', fontSize: 13.5, fontWeight: 500 }}>
              This account is not authorized to access the ClassMate Admin Dashboard.
            </div>
            {attemptedEmail && (
              <div style={{ marginTop: 8, fontSize: 12, color: '#B91C1C', opacity: 0.9 }}>
                Signed in as: <strong>{attemptedEmail}</strong>
              </div>
            )}
            <div style={{ marginTop: 16 }}>
              <button
                onClick={handleSwitchAccount}
                style={{
                  background: '#DC2626',
                  border: 'none',
                  color: '#FFFFFF',
                  padding: '10px 16px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  width: '100%',
                  boxShadow: '0 2px 8px rgba(220, 38, 38, 0.25)',
                  transition: 'background 140ms ease',
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
              background: '#FFFBEB',
              border: '1px solid #FDE68A',
              borderRadius: 12,
              padding: '12px 14px',
              marginBottom: 20,
              textAlign: 'left',
              fontSize: 12.5,
              color: '#B45309',
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
                background: '#FFFFFF',
                border: '1px solid #CBD5E1',
                borderRadius: 12,
                padding: '14px 18px',
                fontSize: 14.5,
                fontWeight: 600,
                color: '#0F172A',
                cursor: loading ? 'default' : 'pointer',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.05)',
                transition: 'background 160ms ease, border-color 160ms ease, transform 100ms ease',
              }}
            >
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      border: '2px solid #CBD5E1',
                      borderTopColor: '#4F46E5',
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
                color: '#64748B',
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
                  color: '#64748B',
                  fontSize: 12,
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
        <div style={{ borderTop: '1px solid #E2E8F0', marginTop: 28, paddingTop: 18 }}>
          <button
            onClick={onGoToApp}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4F46E5',
              fontSize: 13,
              fontWeight: 600,
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
